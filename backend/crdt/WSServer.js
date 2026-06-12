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
import { getBoardMeta, resolveRole, invalidateBoardMeta } from '../cache/boardCache.js';
import Whiteboard from '../models/whiteboardModel.js';
import User from '../models/usermodel.js';

// Unique per-process id, prefixed onto every awareness frame we publish to
// Redis so an instance can recognise and skip the echo of its own messages.
const INSTANCE_ID = randomUUID();

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;
// Custom server→client control frame carrying a live role change (e.g. an
// editor demoted to viewer mid-session). y-websocket reserves 0–3; we pick a
// high number that won't collide and register a matching handler on the client
// via provider.messageHandlers[MSG_ACCESS]. Payload: [varuint MSG_ACCESS][varString role].
const MSG_ACCESS = 100;

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
 * Persist a share-link visitor as a board collaborator at the link's role.
 *
 * Called fire-and-forget when a logged-in user connects with a valid `?st=`
 * token but no prior named access. Re-reads the board under a fresh query and
 * re-checks membership so two simultaneous joins (or a join racing a manual
 * invite) don't create a duplicate or clobber a higher role the owner just set.
 * We also respect a revocation: if the owner already removed this email, we do
 * NOT silently re-add them (resolveRole denies them anyway, and their socket
 * will be closed by the access subscriber).
 *
 * @param {string} boardId
 * @param {string} email
 * @param {'viewer'|'commenter'|'editor'} role  - role the share link grants
 */
async function recordLinkJoiner(boardId, email, role) {
  const board = await Whiteboard.findOne({ id: boardId });
  if (!board) return;
  if (board.owner === email) return;
  if (board.collaborators.some(c => c.email === email)) return; // already named
  if (board.revokedEmails?.includes(email)) return; // owner removed them — don't re-add

  const user = await User.findOne({ email }).select('name profilePicture').lean();
  // Use an atomic update guarded by "no existing entry for this email" so two
  // simultaneous joins (or a join racing a manual invite) can't both push and
  // leave a duplicate row. If another writer added the email between our read
  // and this update, the filter no-ops and we skip — exactly the dedupe we want.
  await Whiteboard.updateOne(
    { id: boardId, 'collaborators.email': { $ne: email } },
    { $push: { collaborators: {
      email,
      name: user?.name || email,
      role,
      profilePicture: user?.profilePicture || '',
    } } },
  );
  // Refresh the cached meta so the owner's Share modal and any other peers see
  // the new collaborator on their next read.
  await invalidateBoardMeta(boardId);
  console.log(`[Yjs WS] Recorded link-joiner ${email} as '${role}' collaborator on ${boardId}`);
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
  /** @type {Map<string, (update: Uint8Array, origin: any) => void>} The `update` listener wired once per room's Y.Doc; kept so it can be detached when the room is evicted. */
  const docUpdateListeners = new Map();
  /** @type {Map<string, ({added, updated, removed}, origin) => void>} The `change` relay wired per board's Awareness — registered ONCE per room, not once per socket, so a presence frame is fanned out a single time instead of once per connected peer (which scaled the broadcast as O(N²) in room size). Kept so it can be removed when the room's Awareness is evicted. */
  const awarenessChangeListeners = new Map();

  // Build the broadcast + Redis-fanout `update` listener for a board's Y.Doc.
  // Registered once per room (see below); marks the doc dirty, relays the delta
  // to local peers, and fans it out to other instances over Redis.
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
    let boardId, userEmail, userRole, shareRole = null;

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
      const shareToken = url.searchParams.get('st');

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

      // A signed share token (`?st=`) raises a link visitor's role above the
      // public viewer baseline. Verify it here so editing actually works over
      // the socket — without this the visitor would connect read-only.
      if (shareToken && shareToken !== 'undefined' && shareToken !== 'null') {
        try {
          const decoded = jwt.verify(shareToken, process.env.JWT_SECRET);
          if (decoded.boardId === boardId &&
              ['viewer', 'commenter', 'editor'].includes(decoded.shareRole)) {
            shareRole = decoded.shareRole;
          }
        } catch { /* expired/invalid share token — fall back to public role */ }
      }

      // Authorization: resolve the user's effective role. `null` => no access.
      userRole = resolveRole(meta, userEmail, shareRole);
      if (!userRole) { ws.close(4403, 'Access denied'); return; }

      // A logged-in user who got in purely on a share link (named access would
      // have been checked first) is recorded as a board collaborator at the
      // link's role. This makes them visible in the owner's Share modal and
      // removable through the normal unshare path — without it, link-joiners are
      // invisible and uncontrollable. Anonymous link visitors (no token) have no
      // stable identity to persist, so they're left as ephemeral.
      const isNamed = meta.owner === userEmail
        || (meta.collaborators || []).some(c => c.email === userEmail)
        || (meta.workspaceMembers || []).includes(userEmail);
      if (shareRole && userEmail !== 'anonymous' && !isNamed) {
        // Fire-and-forget: persistence + cache refresh shouldn't block the
        // socket from coming up. recordLinkJoiner re-checks under a fresh read
        // to avoid racing concurrent joins.
        recordLinkJoiner(boardId, userEmail, shareRole)
          .catch(err => console.error('[Yjs WS] recordLinkJoiner failed:', err.message));
      }
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
    //
    // `let`, not `const`: a live role change (owner demotes this user to viewer,
    // or revokes them entirely) must flip write access *without* a reconnect.
    // The `board:access:*` Redis subscriber re-resolves the role and reassigns
    // this variable; the MSG_SYNC handler reads it fresh on every message.
    let canWrite = userRole !== 'viewer';

    // Stash identity on the socket so the access-change subscriber can find this
    // connection's user when re-resolving roles after a share/unshare. `userRole`
    // is mirrored onto the socket so the subscriber can skip peers whose role is
    // unchanged; `setRole` is the hook it calls to flip `canWrite` (the closure
    // variable) and the mirror live.
    ws.userEmail = userEmail;
    ws.userRole = userRole;
    ws.shareRole = shareRole; // verified `?st=` role, re-applied on live re-resolve
    ws.setRole = (role) => {
      userRole = role;
      canWrite = role !== 'viewer';
      ws.userRole = role;
    };

    const peerCountAfterConnect = documentManager.getConnections(boardId).size;
    console.log(`[Yjs WS] ✓ ${userEmail} (${userRole}) connected to room ${boardId} (${peerCountAfterConnect} peer${peerCountAfterConnect !== 1 ? 's' : ''} now in room)`);

    // ── Awareness ───────────────────────────────────────────────────────
    // One shared Awareness per board (room), created on the first peer to join.
    // The change relay below is wired here — once per room — NOT once per socket:
    // registering it per connection meant N peers added N listeners, so a single
    // cursor move fired the relay N times and re-broadcast each frame to every
    // peer N times (O(N²) presence traffic). Wiring it with the Awareness keeps
    // exactly one relay per room for the room's whole lifetime.
    if (!awarenessMap.has(boardId)) {
      const awareness = new awarenessProtocol.Awareness(ydoc);
      awarenessMap.set(boardId, awareness);

      // Relay any awareness change to every live peer on this board. `origin` is
      // whatever was passed to applyAwarenessUpdate: it's the originating socket
      // for a client's own frame (so we skip echoing it back to the sender), and
      // a non-socket sentinel ('redis-awareness', server-side removals, etc.) for
      // which there is no local sender to skip — those go to everyone.
      const onAwarenessChange = ({ added, updated, removed }, origin) => {
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
          if (conn !== origin && conn.readyState === 1) conn.send(buf);
        });
      };
      awareness.on('change', onAwarenessChange);
      awarenessChangeListeners.set(boardId, onAwarenessChange);
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

            // The Y.Doc instance is stable for the life of the room — compaction
            // now happens only on teardown (after the last peer leaves), never
            // mid-session, so `ydoc` captured at connect is always the live doc.
            const doc = ydoc;

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
      // NOTE: the awareness `change` relay is now registered ONCE per room (not
      // per socket), so a single disconnect must NOT detach it — the remaining
      // peers still rely on it. It's removed only when the room is evicted, in
      // onDocEvicted below.

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

        // Directly push the removal to every remaining local peer. The
        // board-scoped relay also fires for this removeAwarenessStates call
        // (origin === null, so it broadcasts to everyone), making this a
        // belt-and-suspenders guarantee; peers de-dupe by awareness clock, so a
        // duplicate removal frame is harmless. Kept explicit so the removal is
        // never dropped even if the relay's wiring changes.
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

    // Live access-control changes. Published (on every instance) by
    // invalidateBoardMeta whenever a board's share/role/membership changes.
    // We re-resolve each connected peer's role against the *fresh* metadata and
    // either flip their write capability in place or, if access was revoked
    // entirely, close their socket. This is what makes a mid-session demotion
    // ("editor → viewer") or revocation take effect immediately instead of only
    // after the affected user reloads.
    crossSub.pSubscribe('board:access:*', async (message, channel) => {
      const boardId = channel.slice('board:access:'.length);
      const conns = documentManager.getConnections(boardId);
      if (conns.size === 0) return; // no local peers on this board on this instance

      // invalidateBoardMeta deletes the cache key before publishing, so this
      // read pulls the just-written access state (from Mongo, then re-primes
      // the cache once for all the peers below).
      const meta = await getBoardMeta(boardId);

      conns.forEach((conn) => {
        if (!conn.userEmail || typeof conn.setRole !== 'function') return;
        const newRole = resolveRole(meta, conn.userEmail, conn.shareRole);
        if (!newRole) {
          // Access fully revoked (removed as collaborator, board unpublished,
          // workspace membership dropped). Close with a policy code; the client
          // treats 4403 as "kicked" and routes away rather than reconnecting.
          console.log(`[Yjs WS] Access revoked for ${conn.userEmail} on ${boardId} — closing socket`);
          if (conn.readyState === 1) conn.close(4403, 'Access revoked');
          return;
        }
        if (newRole === conn.userRole) return; // unchanged for this peer — nothing to do
        conn.setRole(newRole);
        // Tell the client about its new role so the UI flips read-only/editable
        // live (toolbar locks on demotion, unlocks on promotion) without a reload.
        if (conn.readyState === 1) {
          const enc = encoding.createEncoder();
          encoding.writeVarUint(enc, MSG_ACCESS);
          encoding.writeVarString(enc, newRole);
          conn.send(encoding.toUint8Array(enc));
        }
        console.log(`[Yjs WS] Role for ${conn.userEmail} on ${boardId} re-resolved to '${newRole}' (live)`);
      });
    });
  }).catch((err) => {
    console.error('[Yjs Redis] crossSub connect failed:', err);
  });

  // Eviction housekeeping. Fires only when the room is actually torn down (last
  // peer gone + GC delay elapsed), so dropping the relay here is safe — there
  // are no peers left for it to serve. Detach the change listener from the
  // Awareness before discarding both so neither lingers past the room's life.
  documentManager.onDocEvicted = (boardId) => {
    docUpdateListeners.delete(boardId);
    const awareness = awarenessMap.get(boardId);
    const changeListener = awarenessChangeListeners.get(boardId);
    if (awareness && changeListener) awareness.off('change', changeListener);
    awarenessChangeListeners.delete(boardId);
    awarenessMap.delete(boardId);
  };

  return wss;
}
