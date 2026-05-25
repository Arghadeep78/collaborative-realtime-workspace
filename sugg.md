# Yjs Architecture — Genuine Suggestions

These are targeted improvements worth doing for an SDE-1 resume project. Each one has a clear implementation scope and demonstrates a real distributed systems concept.

---

## 1. Replace full-snapshot persistence with incremental update log

**Current:** `Y.encodeStateAsUpdate(ydoc)` writes the entire document on every flush cycle, even if only one element moved.

**Problem:** For a board with 200 elements, a single drag event causes a ~50–200 KB write to MongoDB. At 30-second flush intervals with multiple active boards, this is wasteful and doesn't scale.

**What to do:**
- Accumulate Yjs binary update chunks in a separate MongoDB collection: `yjsUpdates: [{ boardId, update: Buffer, seq: Number, ts: Date }]`.
- On each `ydoc.on('update')`, push the raw update chunk (usually 20–200 bytes) to this log instead of re-encoding the full state.
- The persistence worker reads and appends incremental chunks, not full snapshots.
- On cold load, replay the update log via `Y.applyUpdate()` in sequence. If log size exceeds a threshold (e.g., 50 entries), compact into a snapshot and truncate the log.

**Why it matters:** This is the standard pattern used by y-websocket's `y-leveldb` and Hocuspocus's persistence adapters. It shows understanding of write amplification in CRDTs and the tradeoff between read-path complexity (replay) and write efficiency.

**Scope:** ~100 lines split across `DocumentManager.js` and `persistenceWorker.js`. Add a new `YjsUpdate` Mongoose model.

---

## 2. Add a state vector check before applying client updates

**Current:** `WSServer.js` applies every sync message from clients with no validation — it trusts that the client's update is a valid, non-replay delta.

**Problem:** A malicious or buggy client can replay an old update, inject garbage bytes, or send an oversized payload. The `Y.applyUpdate()` call will either silently no-op (for replays) or crash the process (for malformed data).

**What to do:**
- Before `Y.applyUpdate(ydoc, update)`, compute `Y.encodeStateVector(ydoc)` and compare it with the update's embedded clock using `Y.decodeStateVector(update)`.
- Reject updates whose clocks are entirely in the past (pure replays).
- Add a max update size check (e.g., reject updates > 512 KB) before parsing.
- Wrap `Y.applyUpdate` in a try/catch and log + drop malformed payloads without crashing.

**Why it matters:** Demonstrates defensive server design for a shared mutable data store — a common interview topic. The state vector check is O(n clients), not O(document size), so it's cheap.

**Scope:** ~30 lines in `WSServer.js`. No new dependencies.

---

## 3. Compaction should run async and not block the cold-load path

**Current:** `DocumentManager._compact()` is called synchronously during `_loadDoc()`. For large boards (100+ elements), encoding + deep-cloning + re-encoding a Y.Doc can take 50–200 ms on the Node event loop.

**Problem:** The first client to open an idle board pays this latency. All other WebSocket messages for that board are queued until the event loop is free. (WSServer.js buffers early messages, but the buffer window may expire.)

**What to do:**
- Return the un-compacted Y.Doc to `_loadDoc` immediately so the first client can start syncing.
- Schedule compaction as a `setImmediate` or `process.nextTick` callback that runs after the sync handshake.
- Guard with a per-boardId `isCompacting` flag so concurrent cold loads don't double-compact.
- After compaction, swap the doc in the `docs` map and mark it dirty (it will be persisted on the next flush).

**Why it matters:** This is a classic "serve then optimize" pattern. It shows awareness of Node.js event loop blocking — a frequent SDE interview topic when discussing I/O-heavy server code.

**Scope:** ~40 lines in `DocumentManager.js`. No API changes.

---

## 4. Add cross-instance awareness relay via Redis Pub/Sub

**Current:** The Redis pub/sub channel `yjs:${boardId}` is mentioned in the architecture for cross-instance Yjs *update* relay, but awareness messages (cursor positions, user presence) are only relayed to peers on the *same* server instance.

**Problem:** If user A connects to instance 1 and user B connects to instance 2, A will not see B's cursor and vice versa. This breaks presence in any horizontally-scaled deployment.

**What to do:**
- When `WSServer.js` receives a `MSG_AWARENESS` message, publish it to `awareness:${boardId}` on Redis in addition to broadcasting locally.
- Subscribe each instance to `awareness:${boardId}` channels for boards it has active connections for.
- On receiving a Redis awareness message, relay it to all local WebSocket connections for that board (excluding the one that originated it, identified by a per-message instance ID prefix).
- Unsubscribe when the last local connection for a board closes.

**Why it matters:** This is a real gap in the current architecture. Fixing it demonstrates understanding of horizontal scaling, pub/sub fan-out, and the difference between ephemeral state (awareness) and durable state (Yjs updates). It's a concrete story to tell in an interview.

**Scope:** ~60 lines in `WSServer.js`. Uses the existing `ioredis` dependency.

---

## 5. Expose a `/health/ready` endpoint that checks actual Yjs system health

**Current:** A `/health` endpoint likely exists (standard Express), but it probably just returns `{ status: 'ok' }` without checking whether the BullMQ worker is processing, the Redis connection is live, or the MongoDB write path is functional.

**What to do:**
- Add a `/health/ready` route that checks:
  1. MongoDB ping (`db.admin().ping()`).
  2. Redis ping (`redisClient.ping()`).
  3. BullMQ queue depth (warn if `persistQueue.getWaitingCount() > 100` — means workers are falling behind).
  4. Number of active boards in memory (`documentManager.docs.size`).
- Return 200 with a JSON breakdown if healthy, 503 if any check fails.

**Why it matters:** Readiness probes are required for Kubernetes deployments and are a standard SDE-1 backend concept. The BullMQ backpressure check specifically demonstrates Yjs-aware operational thinking, not just boilerplate health checks.

**Scope:** ~50 lines in a new `healthController.js`. No new dependencies.

---

## Priority order

| # | Effort | Resume Signal |
|---|--------|---------------|
| 4 (awareness relay) | Medium | Distributed systems, pub/sub fan-out |
| 2 (state vector guard) | Low | Defensive server design, CRDT internals |
| 3 (async compaction) | Low | Event loop awareness, concurrency |
| 1 (incremental log) | High | Write efficiency, CRDT persistence patterns |
| 5 (health endpoint) | Low | Ops maturity, production readiness |

Start with **4** and **2** — both are small, concrete, and make for good interview talking points about architectural decisions you made deliberately.
