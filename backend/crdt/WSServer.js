import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync.js';
import * as awarenessProtocol from 'y-protocols/awareness.js';
import * as encoding from 'lib0/encoding.js';
import * as decoding from 'lib0/decoding.js';
import jwt from 'jsonwebtoken';
import { URL } from 'url';
import Whiteboard from '../models/whiteboardModel.js';
import { documentManager } from './DocumentManager.js';

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

/**
 * Attach a Yjs-protocol WebSocket server to the existing HTTP server.
 * Handles binary sync on the /yjs/<roomname> path, co-existing with Socket.IO.
 *
 * @param {import('http').Server} httpServer
 * @param {import('redis').RedisClientType} redisPub  - for cross-instance delta fanout
 * @param {import('redis').RedisClientType} redisSub  - subscriber (will be duplicated internally)
 */
export function setupYjsWSServer(httpServer, redisPub, redisSub) {
  const wss = new WebSocketServer({ noServer: true });

  /** @type {Map<string, awarenessProtocol.Awareness>} */
  const awarenessMap = new Map();
  /** Track which docs already have an `update` listener wired */
  const docListenersReady = new Set();

  // ─── HTTP Upgrade routing ─────────────────────────────────────────────
  httpServer.on('upgrade', (request, socket, head) => {
    let pathname;
    try {
      pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (!pathname.startsWith('/yjs/')) return; // let Socket.IO handle the rest

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  // ─── Connection handler ───────────────────────────────────────────────
  wss.on('connection', async (ws, request) => {
    let boardId, userEmail, cachedBoard;

    // Buffer messages that arrive while we're doing async auth / doc load.
    // The client's y-websocket WebsocketProvider sends SyncStep1 the instant
    // the socket opens — if we don't buffer here, that message is lost and
    // the client never receives the server's document state.
    const messageQueue = [];
    const earlyHandler = (data) => messageQueue.push(data);
    ws.on('message', earlyHandler);

    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      // Room name is the last path segment: /yjs/<boardId>
      boardId = url.pathname.split('/').filter(Boolean).pop();
      const token = url.searchParams.get('token');

      if (!boardId) {
        ws.close(4401, 'Missing boardId');
        return;
      }

      const board = await Whiteboard.findOne({ id: boardId }).lean();
      if (!board) { ws.close(4404, 'Board not found'); return; }

      userEmail = 'anonymous';
      if (token && token !== 'undefined' && token !== 'null') {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userEmail = decoded.email;
      }

      const hasAccess =
        board.owner === userEmail ||
        (board.collaborators && board.collaborators.some(u => u.email === userEmail)) ||
        board.isPublic;
      if (!hasAccess) { ws.close(4403, 'Access denied'); return; }

      // Reuse the already-fetched board doc to avoid a second MongoDB query
      cachedBoard = board;
    } catch (err) {
      console.error('[Yjs WS] Auth error:', err);
      ws.close(4401, 'Authentication failed');
      return;
    }

    // ── Load / get Y.Doc ────────────────────────────────────────────────
    const ydoc = await documentManager.getDoc(boardId, cachedBoard);
    documentManager.addConnection(boardId, ws);
    const peerCountAfterConnect = documentManager.getConnections(boardId).size;
    console.log(`[Yjs WS] ✓ ${userEmail} connected to room ${boardId} (${peerCountAfterConnect} peer${peerCountAfterConnect !== 1 ? 's' : ''} now in room)`);

    // ── Awareness ───────────────────────────────────────────────────────
    if (!awarenessMap.has(boardId)) {
      awarenessMap.set(boardId, new awarenessProtocol.Awareness(ydoc));
    }
    const awareness = awarenessMap.get(boardId);

    // Track the Yjs clientIds belonging to THIS WebSocket connection so we
    // can correctly remove only them when the socket closes (not ydoc.clientID
    // which is the server's shared doc, not the connecting client's).
    const wsClientIds = new Set();

    // Helper: parse clientIds from raw awareness update bytes (varuint list)
    const extractClientIds = (bytes) => {
      try {
        const dec = decoding.createDecoder(bytes);
        const count = decoding.readVarUint(dec);
        const ids = [];
        for (let i = 0; i < count; i++) {
          ids.push(decoding.readVarUint(dec));   // clientID
          decoding.readVarUint(dec);              // clock  (skip)
          decoding.readVarString(dec);            // state  (skip)
        }
        return ids;
      } catch {
        return [];
      }
    };

    // ── Per-doc broadcast + Redis publish (set up once) ─────────────────
    if (!docListenersReady.has(boardId)) {
      docListenersReady.add(boardId);

      ydoc.on('update', (update, origin) => {
        documentManager.markDirty(boardId);

        // Broadcast delta to local WS peers (skip sender)
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        syncProtocol.writeUpdate(encoder, update);
        const msg = encoding.toUint8Array(encoder);

        documentManager.getConnections(boardId).forEach(conn => {
          if (conn !== origin && conn.readyState === 1) conn.send(msg);
        });

        // Cross-instance fanout via Redis (skip if update originated from Redis)
        if (origin !== 'redis') {
          redisPub
            .publish(`yjs:${boardId}`, Buffer.from(update).toString('base64'))
            .catch(() => {});
        }
      });
    }

    // ── Send Sync Step 1 to the freshly-connected client ────────────────
    const syncEncoder = encoding.createEncoder();
    encoding.writeVarUint(syncEncoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(syncEncoder, ydoc);
    ws.send(encoding.toUint8Array(syncEncoder));

    // Proactively send Sync Step 2 (full doc state) so the client receives
    // all content immediately, without waiting for the round-trip.
    const step2Encoder = encoding.createEncoder();
    encoding.writeVarUint(step2Encoder, MSG_SYNC);
    syncProtocol.writeSyncStep2(step2Encoder, ydoc);
    ws.send(encoding.toUint8Array(step2Encoder));

    // ── Send current awareness states ───────────────────────────────────
    const stateKeys = Array.from(awareness.getStates().keys());
    if (stateKeys.length > 0) {
      const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(awareness, stateKeys);
      const awEncoder = encoding.createEncoder();
      encoding.writeVarUint(awEncoder, MSG_AWARENESS);
      encoding.writeVarUint8Array(awEncoder, awarenessUpdate);
      ws.send(encoding.toUint8Array(awEncoder));
    }

    // ── Awareness-change relay ──────────────────────────────────────────
    const onAwarenessChange = ({ added, updated, removed }) => {
      const awarenessEmails = [];
      awareness.getStates().forEach((state) => {
        if (state?.user?.email) awarenessEmails.push(state.user.email);
      });
      console.log(`[Yjs Awareness] room=${boardId} | WS peers=${documentManager.getConnections(boardId).size} | awareness states=${awareness.getStates().size} | emails=[${awarenessEmails.join(', ')}] | added=${JSON.stringify(added)} updated=${JSON.stringify(updated)} removed=${JSON.stringify(removed)}`);

      const changed = added.concat(updated, removed);
      const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changed);
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_AWARENESS);
      encoding.writeVarUint8Array(enc, update);
      const buf = encoding.toUint8Array(enc);
      documentManager.getConnections(boardId).forEach(conn => {
        if (conn !== ws && conn.readyState === 1) conn.send(buf);
      });
    };
    awareness.on('change', onAwarenessChange);

    // ── Incoming messages ───────────────────────────────────────────────
    const handleMessage = (data) => {
      try {
        const message = new Uint8Array(data);
        const decoder = decoding.createDecoder(message);
        const messageType = decoding.readVarUint(decoder);

        switch (messageType) {
          case MSG_SYNC: {
            const respEncoder = encoding.createEncoder();
            encoding.writeVarUint(respEncoder, MSG_SYNC);
            syncProtocol.readSyncMessage(decoder, respEncoder, ydoc, ws);
            if (encoding.length(respEncoder) > 1) {
              ws.send(encoding.toUint8Array(respEncoder));
            }
            break;
          }
          case MSG_AWARENESS: {
            const awarenessBytes = decoding.readVarUint8Array(decoder);
            // Record which clientIds come from this socket so we can evict
            // them precisely on disconnect.
            extractClientIds(awarenessBytes).forEach(id => wsClientIds.add(id));
            awarenessProtocol.applyAwarenessUpdate(
              awareness,
              awarenessBytes,
              ws
            );
            break;
          }
        }
      } catch (err) {
        console.error('[Yjs WS] message error:', err);
      }
    };

    // Replace the early buffering handler with the real one
    ws.off('message', earlyHandler);
    ws.on('message', handleMessage);

    // Drain any messages that arrived during async setup (e.g. client SyncStep1)
    for (const msg of messageQueue) {
      handleMessage(msg);
    }
    messageQueue.length = 0;

    // ── Cleanup on disconnect ───────────────────────────────────────────
    ws.on('close', () => {
      const peersBeforeRemove = documentManager.getConnections(boardId).size;
      console.log(`[Yjs WS] ✗ ${userEmail} disconnected from room ${boardId} (was ${peersBeforeRemove} peers → will be ${peersBeforeRemove - 1})`);
      console.log(`[Yjs WS] Evicting clientIds=${JSON.stringify([...wsClientIds])} from awareness (current awareness size=${awareness.getStates().size})`);
      documentManager.removeConnection(boardId, ws);
      awareness.off('change', onAwarenessChange);

      // Remove only the clientIds that belonged to THIS connection.
      // Previously this incorrectly used ydoc.clientID (server's shared doc)
      // instead of the connecting client's Yjs clientId.
      if (wsClientIds.size > 0) {
        awarenessProtocol.removeAwarenessStates(awareness, [...wsClientIds], null);

        // Directly push the removal to every remaining peer.
        // The onAwarenessChange relay uses `conn !== ws` to skip the sender,
        // but for a server-initiated removal there is no sender — so the last
        // remaining peer (whose listener excludes itself) would never receive
        // the update.  Broadcasting here guarantees all peers see the removal.
        const remaining = documentManager.getConnections(boardId);
        if (remaining.size > 0) {
          const removalUpdate = awarenessProtocol.encodeAwarenessUpdate(
            awareness, [...wsClientIds]
          );
          const enc = encoding.createEncoder();
          encoding.writeVarUint(enc, MSG_AWARENESS);
          encoding.writeVarUint8Array(enc, removalUpdate);
          const buf = encoding.toUint8Array(enc);
          let broadcastCount = 0;
          remaining.forEach(conn => {
            if (conn.readyState === 1) { conn.send(buf); broadcastCount++; }
          });
          console.log(`[Yjs WS] Removal broadcast sent to ${broadcastCount} remaining peer(s). Awareness size after eviction=${awareness.getStates().size}`);
        }
      }

      // NOTE: awarenessMap / docListenersReady are intentionally NOT cleared
      // here. The Y.Doc (and its single `update` listener) survives the GC
      // window, so clearing docListenersReady on an empty room would let a
      // reconnect within that window attach a duplicate `update` listener,
      // doubling every broadcast and Redis publish. Cleanup happens in
      // onDocEvicted, which fires only when the doc is actually evicted.
    });
  });

  // ─── Redis cross-instance subscriber ──────────────────────────────────
  const crossSub = redisSub.duplicate();
  crossSub.on('error', (err) => console.error('[Yjs Redis] crossSub error:', err));
  crossSub.connect().then(() => {
    crossSub.pSubscribe('yjs:*', (message, channel) => {
      const boardId = channel.slice(4); // strip "yjs:"
      const ydoc = documentManager.docs.get(boardId);
      if (!ydoc) return;

      try {
        const update = new Uint8Array(Buffer.from(message, 'base64'));
        Y.applyUpdate(ydoc, update, 'redis');
      } catch (err) {
        console.error('[Yjs Redis] apply error:', err);
      }
    });
  }).catch((err) => {
    console.error('[Yjs Redis] crossSub connect failed:', err);
  });

  // Eviction housekeeping
  documentManager.onDocEvicted = (boardId) => {
    docListenersReady.delete(boardId);
    awarenessMap.delete(boardId);
  };

  return wss;
}
