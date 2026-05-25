import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync.js';
import * as awarenessProtocol from 'y-protocols/awareness.js';
import * as encoding from 'lib0/encoding.js';
import * as decoding from 'lib0/decoding.js';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { URL } from 'url';
import { documentManager } from './DocumentManager.js';
import { getBoardMeta, resolveRole } from '../cache/boardCache.js';

// Unique per-process id, prefixed onto every awareness frame we publish to
// Redis so an instance can recognise and skip the echo of its own messages.
const INSTANCE_ID = randomUUID();

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

// Reject client updates larger than this before parsing — a single legitimate
// delta (one element moved/created) is a few hundred bytes; even a large paste
// is well under this. Anything bigger is a buggy or hostile payload that could
// stall the event loop or exhaust memory in Y.applyUpdate.
const MAX_UPDATE_BYTES = 512 * 1024;

/**
 * Validate and apply a client's Yjs update to the shared doc.
 *
 * The server trusts no client byte stream: a buggy or hostile peer could send
 * an oversized payload, malformed CRDT structs, or a pure replay of an old
 * delta. We guard each of those before/around Y.applyUpdate so one bad frame
 * can't stall the event loop, crash the process, or be silently mis-handled.
 *
 * @param {Y.Doc} ydoc
 * @param {Uint8Array} update  - raw Yjs update bytes (already extracted)
 * @param {import('ws').WebSocket} origin
 * @param {string} userEmail
 * @param {string} boardId
 * @returns {boolean} whether the update was applied
 */
function applyClientUpdate(ydoc, update, origin, userEmail, boardId) {
  if (update.byteLength > MAX_UPDATE_BYTES) {
    console.warn(`[Yjs WS] Dropped oversized update (${update.byteLength}B) from ${userEmail} on ${boardId}`);
    return false;
  }

  // Pure-replay check: an update's structs carry the clocks of the clients
  // that produced them. If every clock is already covered by the doc's current
  // state vector, the update adds nothing — applying it is a wasteful no-op
  // (or, for a malicious replay, an attempt to look productive). Decoding the
  // state vector is O(#clients), not O(doc size), so the check is cheap.
  try {
    const before = Y.encodeStateVector(ydoc);
    if (isPureReplay(before, update)) {
      console.warn(`[Yjs WS] Dropped pure-replay update from ${userEmail} on ${boardId}`);
      return false;
    }
  } catch {
    // A malformed update can throw while we inspect it. Treat it as garbage
    // and drop it rather than handing it to applyUpdate.
    console.warn(`[Yjs WS] Dropped unparseable update from ${userEmail} on ${boardId}`);
    return false;
  }

  try {
    Y.applyUpdate(ydoc, update, origin);
    return true;
  } catch (err) {
    // applyUpdate can throw on corrupt struct data. Log and drop — never let a
    // single bad frame take down the WebSocket server for every other peer.
    console.error(`[Yjs WS] applyUpdate failed for ${userEmail} on ${boardId}:`, err.message);
    return false;
  }
}

/**
 * True when the update carries no client clocks newer than the doc already has
 * — i.e. it's entirely in the past relative to `stateVector`. Compares the
 * update's embedded state vector (the "missing-from" clocks in its header)
 * against the doc's current state vector.
 *
 * @param {Uint8Array} stateVector  - Y.encodeStateVector(ydoc)
 * @param {Uint8Array} update
 * @returns {boolean}
 */
function isPureReplay(stateVector, update) {
  // The update's own state vector describes the highest clock per client it
  // contains. Y.encodeStateVectorFromUpdate gives us that without applying.
  const updateSV = Y.encodeStateVectorFromUpdate(update);
  const have = decodeSVToMap(stateVector);
  const incoming = decodeSVToMap(updateSV);
  for (const [client, clock] of incoming) {
    // This client carries a clock the doc hasn't seen yet → real new content.
    if (clock > (have.get(client) || 0)) return false;
  }
  return true; // nothing newer than what we already have
}

/** Decode an encoded Yjs state vector into a Map<clientId, clock>. */
function decodeSVToMap(encoded) {
  const dec = decoding.createDecoder(encoded);
  const size = decoding.readVarUint(dec);
  const map = new Map();
  for (let i = 0; i < size; i++) {
    const client = decoding.readVarUint(dec);
    const clock = decoding.readVarUint(dec);
    map.set(client, clock);
  }
  return map;
}

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
  /** @type {Map<string, (update: Uint8Array, origin: any) => void>} The `update` listener wired per doc, kept so it can be moved when the doc instance is swapped (async compaction). */
  const docUpdateListeners = new Map();

  // Build (and register) the broadcast + Redis-fanout `update` listener for a
  // board's Y.Doc. Extracted so it can be re-attached to a freshly compacted
  // doc instance when DocumentManager swaps one in.
  const makeUpdateListener = (boardId) => (update, origin) => {
    documentManager.markDirty(boardId);

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
  };

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
    let boardId, userEmail, userRole;

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

      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!boardId || !UUID_RE.test(boardId)) {
        ws.close(4401, 'Invalid boardId');
        return;
      }

      // Access metadata is served from Redis (60s TTL) when warm, falling back
      // to a lean MongoDB query. The full board (incl. yjsState) is loaded
      // lazily by DocumentManager only when the Y.Doc is cold.
      const meta = await getBoardMeta(boardId);
      if (!meta) { ws.close(4404, 'Board not found'); return; }

      userEmail = 'anonymous';
      if (token && token !== 'undefined' && token !== 'null') {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userEmail = decoded.email;
      }

      // Authorization: resolve the user's effective role. `null` => no access.
      userRole = resolveRole(meta, userEmail);
      if (!userRole) { ws.close(4403, 'Access denied'); return; }
    } catch (err) {
      console.error('[Yjs WS] Auth error:', err);
      ws.close(4401, 'Authentication failed');
      return;
    }

    // ── Load / get Y.Doc ────────────────────────────────────────────────
    // No board is passed: DocumentManager fetches the full doc (with yjsState)
    // itself, but only on a cold load — warm rooms skip the query entirely.
    const ydoc = await documentManager.getDoc(boardId);
    documentManager.addConnection(boardId, ws);

    // A viewer may read the board (sync down) but must not mutate it. commenter
    // and editor are write-capable. Enforced per-message in the MSG_SYNC handler.
    const canWrite = userRole !== 'viewer';

    const peerCountAfterConnect = documentManager.getConnections(boardId).size;
    console.log(`[Yjs WS] ✓ ${userEmail} (${userRole}) connected to room ${boardId} (${peerCountAfterConnect} peer${peerCountAfterConnect !== 1 ? 's' : ''} now in room)`);

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
    if (!docUpdateListeners.has(boardId)) {
      const listener = makeUpdateListener(boardId);
      docUpdateListeners.set(boardId, listener);
      ydoc.on('update', listener);
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
            // Dispatch on the sync sub-message type ourselves (instead of
            // syncProtocol.readSyncMessage) so we can enforce RBAC: reads are
            // always allowed, writes only for write-capable roles.
            const syncMessageType = decoding.readVarUint(decoder);
            const respEncoder = encoding.createEncoder();
            encoding.writeVarUint(respEncoder, MSG_SYNC);

            // Resolve the doc fresh each message: async compaction can swap the
            // Y.Doc instance out from under this connection, so the captured
            // `ydoc` may be stale. The map always holds the live instance.
            const doc = documentManager.docs.get(boardId) || ydoc;

            if (syncMessageType === syncProtocol.messageYjsSyncStep1) {
              // Read request: client asks for the doc state. Always permitted —
              // even viewers need the current board to render it.
              syncProtocol.readSyncStep1(decoder, respEncoder, doc);
            } else if (canWrite) {
              // Write paths (SyncStep2 / Update) apply the client's changes.
              if (syncMessageType === syncProtocol.messageYjsSyncStep2) {
                syncProtocol.readSyncStep2(decoder, doc, ws);
              } else if (syncMessageType === syncProtocol.messageYjsUpdate) {
                // Pull the raw update bytes out ourselves (rather than letting
                // syncProtocol.readUpdate apply them blindly) so we can guard
                // against oversized, malformed, or pure-replay payloads before
                // they touch the shared doc.
                const update = decoding.readVarUint8Array(decoder);
                applyClientUpdate(doc, update, ws, userEmail, boardId);
              }
            } else {
              // Viewer attempting a mutation — discard the update without
              // applying it. authentication ≠ authorization: a connected,
              // authenticated viewer is still not allowed to write.
              console.warn(`[Yjs WS] Rejected write from viewer ${userEmail} on board ${boardId}`);
            }

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
            // Applying mutates the shared Awareness instance, which fires
            // `onAwarenessChange` and relays to local peers (with `ws` as the
            // origin so the sender is skipped).
            awarenessProtocol.applyAwarenessUpdate(
              awareness,
              awarenessBytes,
              ws
            );
            // Fan the same frame out to other server instances so peers on a
            // different Node process see this cursor/presence too. Payload is
            // "<instanceId>|<base64 bytes>" — base64 because pub/sub messages
            // are delivered as UTF-8 strings and would corrupt raw binary; the
            // instance prefix lets us drop the echo of our own publish.
            redisPub
              .publish(
                `awareness:${boardId}`,
                `${INSTANCE_ID}|${Buffer.from(awarenessBytes).toString('base64')}`
              )
              .catch(() => {});
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

        const removalUpdate = awarenessProtocol.encodeAwarenessUpdate(
          awareness, [...wsClientIds]
        );

        // Publish the removal to other instances too. A disconnect cleanup is
        // server-initiated, so it never flows through the MSG_AWARENESS publish
        // path — without this, peers on a *different* instance would keep
        // rendering this user's ghost cursor after they leave.
        redisPub
          .publish(
            `awareness:${boardId}`,
            `${INSTANCE_ID}|${Buffer.from(removalUpdate).toString('base64')}`
          )
          .catch(() => {});

        // Directly push the removal to every remaining local peer.
        // The onAwarenessChange relay uses `conn !== ws` to skip the sender,
        // but for a server-initiated removal there is no sender — so the last
        // remaining peer (whose listener excludes itself) would never receive
        // the update.  Broadcasting here guarantees all peers see the removal.
        const remaining = documentManager.getConnections(boardId);
        if (remaining.size > 0) {
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

      // NOTE: awarenessMap / docUpdateListeners are intentionally NOT cleared
      // here. The Y.Doc (and its single `update` listener) survives the GC
      // window, so clearing docUpdateListeners on an empty room would let a
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

    // Cross-instance awareness relay: presence (cursors, laser, user meta) is
    // ephemeral and lived only on the instance a client was connected to.
    // Without this, user A on instance 1 never sees user B's cursor on
    // instance 2. We mirror remote awareness frames onto the local Awareness
    // instance so they reach this instance's peers (and feed the snapshot sent
    // to future joiners), skipping the echo of our own publishes.
    crossSub.pSubscribe('awareness:*', (message, channel) => {
      const boardId = channel.slice(10); // strip "awareness:"
      const sep = message.indexOf('|');
      if (sep === -1) return;
      const senderInstance = message.slice(0, sep);
      if (senderInstance === INSTANCE_ID) return; // our own frame, ignore

      const awareness = awarenessMap.get(boardId);
      if (!awareness) return; // no local peers on this board

      try {
        const bytes = new Uint8Array(Buffer.from(message.slice(sep + 1), 'base64'));
        // origin is a non-WebSocket sentinel; the per-connection change relay
        // then forwards it to every local peer on this board.
        awarenessProtocol.applyAwarenessUpdate(awareness, bytes, 'redis-awareness');
      } catch (err) {
        console.error('[Yjs Redis] awareness apply error:', err);
      }
    });
  }).catch((err) => {
    console.error('[Yjs Redis] crossSub connect failed:', err);
  });

  // Eviction housekeeping
  documentManager.onDocEvicted = (boardId) => {
    docUpdateListeners.delete(boardId);
    awarenessMap.delete(boardId);
  };

  // Doc-swap rewiring (async compaction replaces the Y.Doc instance).
  // The map already points at `newDoc` by the time this fires; we just move
  // the `update` listener to it and bring every attached peer up to the
  // compacted state with a fresh SyncStep2.
  documentManager.onDocSwapped = (boardId, oldDoc, newDoc) => {
    const listener = docUpdateListeners.get(boardId);
    if (listener) {
      oldDoc.off('update', listener);
      newDoc.on('update', listener);
    }

    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MSG_SYNC);
    syncProtocol.writeSyncStep2(enc, newDoc);
    const buf = encoding.toUint8Array(enc);
    documentManager.getConnections(boardId).forEach(conn => {
      if (conn.readyState === 1) conn.send(buf);
    });
    console.log(`[Yjs WS] Doc swapped after compaction for ${boardId}; re-synced ${documentManager.getConnections(boardId).size} peer(s)`);
  };

  return wss;
}
