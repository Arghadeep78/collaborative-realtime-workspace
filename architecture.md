# Architecture Document: Collaborative Realtime Workspace

## 1. System Overview

The Collaborative Realtime Workspace is a full-stack, real-time application that lets multiple users collaborate on a shared, multi-page canvas. The system uses Conflict-free Replicated Data Types (CRDTs) via **Yjs** for concurrent-edit synchronization, and is designed to run horizontally across multiple Node.js instances behind a load balancer.

The monorepo has two independently deployable apps:

- **Frontend** (`/frontend`) — React 19 + Vite, custom SVG canvas, Yjs CRDT client
- **Backend** (`/backend`) — Node.js + Express, custom Yjs WebSocket server, BullMQ workers

---

## 2. Technology Stack

### 2.1 Frontend

| Concern | Choice |
|---|---|
| Framework | React 19, Vite |
| Canvas | Custom SVG (no third-party canvas library) |
| Realtime sync | Yjs + `y-websocket` (`WebsocketProvider`) |
| Presence | Yjs Awareness protocol |
| Routing | React Router |
| Styling | Tailwind CSS |
| Auth | JWT (access/refresh), Google OAuth 2.0 |

### 2.2 Backend

| Concern | Choice |
|---|---|
| Runtime | Node.js, Express.js |
| WebSocket | `ws` library (native, not Socket.IO) |
| CRDT sync | `yjs`, `y-protocols`, `lib0` |
| Database | MongoDB + Mongoose |
| Cache / Pub-Sub | Redis (`redis` + `ioredis`) |
| Background jobs | BullMQ + ioredis |
| AI | Google Gemini API (`@google/generative-ai`) |
| Auth | `bcryptjs`, `jsonwebtoken`, `google-auth-library` |
| Rate limiting | `express-rate-limit` + `rate-limit-redis` |
| Media | Cloudinary + multer |
| Email | nodemailer |

---

## 3. High-Level Architecture

```mermaid
graph TD
    subgraph Client [Frontend — React/Vite]
        UI[Custom SVG Canvas + UI]
        YjsClient[Yjs Client Doc]
        Awareness[Yjs Awareness<br/>cursors · presence · laser]
        UI <--> YjsClient
        UI <--> Awareness
    end

    subgraph Server [Backend — Node.js/Express]
        API[Express REST API]
        WSS[Yjs WebSocket Server<br/>WSServer.js]
        DocMgr[DocumentManager<br/>in-memory Y.Doc lifecycle]
        Scheduler[Persistence Scheduler<br/>30s dirty-doc heartbeat]
        PersistWorker[BullMQ Persist Worker<br/>Y.Doc → MongoDB]
        PublishWorker[BullMQ Publish Worker<br/>async board snapshot]
    end

    subgraph Data [Data Layer]
        MongoDB[(MongoDB<br/>board state · users · metadata)]
        Redis[(Redis<br/>pub/sub · board-meta cache · BullMQ queues · rate-limit counters)]
    end

    Gemini[Google Gemini API]

    Client -- REST/HTTPS --> API
    YjsClient <-- WebSocket /yjs/boardId --> WSS
    Awareness <--> WSS
    WSS <--> DocMgr
    DocMgr -- cold load --> MongoDB
    DocMgr --> Scheduler
    Scheduler -- enqueue persist job --> Redis
    PersistWorker -- consume job --> Redis
    PersistWorker -- write Y.Doc state --> MongoDB
    WSS -- delta fanout --> Redis
    Redis -- cross-instance relay --> WSS
    API --> MongoDB
    API --> Redis
    PublishWorker <--> Redis
    PublishWorker --> MongoDB
    API -- HTTPS --> Gemini
```

---

## 4. Backend Components

### 4.1 Yjs WebSocket Server (`crdt/WSServer.js`)

The realtime core. A custom WebSocket server that implements the full `y-protocols` binary sync handshake using the `ws` library — no Hocuspocus or y-websocket server adapter.

**Startup:** `setupYjsWSServer(httpServer, redisPub, redisSub)` intercepts HTTP upgrade events at the `/yjs/` path prefix. All other upgrade requests are passed through (e.g., to other middleware).

**Connection lifecycle:**

1. **Auth buffering** — early messages from the client are buffered while async authentication runs, so the client's `SyncStep1` is never dropped.
2. **JWT verification** — token extracted from the `?token=` query param and verified. Invalid tokens close the connection immediately.
3. **Role resolution** — `resolveRole(boardMeta, userEmail)` determines the effective role:
   - Owner → `'editor'`
   - Named collaborator → their assigned role
   - Workspace member → `'viewer'` baseline
   - Public board → `publicRole` (default `'viewer'`)
   - Otherwise → `null` (connection closed)
4. **Doc load** — `documentManager.getDoc(boardId)` returns the in-memory Y.Doc, loading from MongoDB on first access (concurrent load requests deduplicated with a pending-promise map).
5. **Awareness setup** — sends current peer states to the new client; relays subsequent awareness changes to all room peers.
6. **Sync handshake** — sends `SyncStep1` (state vector) immediately, then proactively sends `SyncStep2` (full encoded state) to bring the client up to date without waiting for a second round-trip.
7. **Message dispatch:**
   - `MSG_SYNC (0)` — reads the y-protocol sub-message type:
     - `SyncStep1` / `SyncStep2` — always served (read path)
     - `Update` — applied **only** for write-capable roles (`editor`, `commenter` for allowed ops); viewers' bytes are discarded before `Y.applyUpdate` is called
   - `MSG_AWARENESS (1)` — relayed to all other room peers
8. **Cross-instance fanout** — after applying an update locally, publishes the raw binary to `yjs:<boardId>` on Redis. Subscriber handler on each instance applies the update to its local Y.Doc copy and rebroadcasts to its local peers.
9. **Disconnect cleanup** — removes the connection from `DocumentManager`, evicts only that connection's `clientId` from the Awareness instance, and broadcasts the updated awareness state to remaining peers.

**RBAC is enforced at the message level, not just at connect.** A viewer connecting with a raw WebSocket client and replaying update frames will have every write discarded.

---

### 4.2 Document Manager (`crdt/DocumentManager.js`)

Manages the in-memory lifecycle of all active `Y.Doc` instances.

**State:**
- `docs: Map<boardId, Y.Doc>` — hot boards
- `dirtyDocs: Set<boardId>` — boards with unflushed changes
- `connections: Map<boardId, Set<WebSocket>>` — active peers per board
- `pendingLoads: Map<boardId, Promise<Y.Doc>>` — deduplicates concurrent cold loads

**Cold load (`_loadDoc`):**
1. Fetches board from MongoDB (lean query).
2. Applies stored `yjsState` buffer to a fresh `Y.Doc` via `Y.applyUpdate`.
3. Registers an `update` listener that marks the doc dirty on every change.
4. Calls `_compact` to shrink accumulated CRDT history before any client connects.

**History compaction (`_compact`):**
- Computes `Y.encodeStateAsUpdate(ydoc)` to measure current size.
- Skips if < 64 KB (`COMPACT_MIN_BYTES`).
- Deep-clones all top-level shared types into a fresh `Y.Doc` inside a transaction:
  - Plain JSON values (elements, pages) are set directly.
  - Nested Y.Maps (votes, comments) are recursively reconstructed as new `Y.Map` instances.
- If compacted size ≤ 80% of original (`COMPACT_SAVE_RATIO`), swaps the doc, persists the compacted state, and returns it. Otherwise returns the original unchanged.
- **Runs synchronously on cold load** — no peers are attached yet, so the swap is invisible. Clients receive the compacted state through the normal sync handshake.

**Dirty tracking:**
- `ydoc.on('update')` → `markDirty(boardId)`
- `peekDirtyIds()` — non-destructive snapshot for the scheduler
- `clearDirty(boardIds)` — called by scheduler after durable enqueue

**GC (`_scheduleGC`):**
- Fires 5 minutes after the last peer disconnects (`GC_DELAY_MS = 300_000`).
- If the doc is still dirty when the timer fires, reschedules and waits for persistence.
- Once clean, destroys the Y.Doc, removes from `docs`, and calls the eviction callback.

---

### 4.3 Persistence Scheduler (`crdt/persistenceScheduler.js`)

A 30-second `setInterval` heartbeat that drives write-behind persistence:

1. Calls `documentManager.peekDirtyIds()` to get the current dirty set.
2. For each dirty board, enqueues a BullMQ job `{ boardId }` with `jobId: persist-<boardId>` (BullMQ deduplicates by jobId — no queue buildup if a board stays hot).
3. Calls `documentManager.clearDirty(ids)` **only after** the jobs are durably enqueued in Redis — if enqueue fails, the doc stays dirty and retries on the next tick.

---

### 4.4 Persistence Worker (`crdt/persistenceWorker.js`)

BullMQ worker consuming the `yjs-persist` queue (concurrency 5):

1. Reads the in-memory Y.Doc via `documentManager.encodeState(boardId)`.
2. If the board has been GC'd from memory, the job is a no-op (returns early).
3. Calls `Whiteboard.updateOne({ id: boardId }, { $set: { yjsState: Buffer } })`.
4. On any failure, re-marks the board dirty so the next scheduler tick retries.

---

### 4.5 Board Metadata Cache (`cache/boardCache.js`)

Avoids a cold MongoDB read on every WebSocket connection.

**Cached payload (`board:meta:<boardId>`, TTL 60 s):**
```json
{
  "owner": "email",
  "collaborators": [{ "email": "...", "role": "editor|commenter|viewer" }],
  "isPublic": true,
  "publicRole": "viewer",
  "workspaceMembers": ["email", ...]
}
```

**Role resolution (`resolveRole(meta, userEmail)`):**
- Owner → `'editor'`
- Named collaborator → their role
- Workspace member → `'viewer'`
- Public board → `meta.publicRole`
- Otherwise → `null`

**Invalidation** (`invalidateBoardMeta(boardId)`) — called on share, unshare, publish, unpublish, and delete. Next access falls through to MongoDB and repopulates the cache.

---

### 4.6 Rate Limiting (`middleware/rateLimiters.js`)

Three `express-rate-limit` instances backed by a shared `RedisStore`:

| Tier | Limit | Applied to |
|---|---|---|
| Auth | 50 req / 15 min | `/api/auth/*` |
| AI | 40 req / 15 min | `/api/ai/*` |
| General | 300 req / 15 min | All other API routes |

Counters live in Redis, not process memory, so the limit holds globally across N instances. The server runs with `trust proxy: 1` so rate-limit keys use the real client IP behind the load balancer.

---

### 4.7 External API Resilience (`utils/resilience.js`)

Three composable primitives used to harden Gemini API calls:

- **`withTimeout(promise, ms)`** — rejects after `ms` milliseconds with a transient-tagged error.
- **`retry(fn, { attempts, baseDelayMs })`** — exponential backoff, retries only on transient errors (5xx, network, timeout). Permanent errors (4xx) propagate immediately.
- **`CircuitBreaker`** — three-state machine:
  - `CLOSED` → normal operation; failure counter incremented on each transient error
  - `OPEN` → after 5 consecutive failures; all calls rejected immediately (fail-fast)
  - `HALF_OPEN` → after 30 s cooldown; one trial request allowed. Success → `CLOSED`; failure → re-`OPEN`

---

### 4.8 Health & Readiness Probes (`Routes/healthRoutes.js`)

| Endpoint | Checks | Failure response |
|---|---|---|
| `GET /health` | MongoDB ping, Redis ping | `503` with per-service status |
| `GET /ready` | MongoDB, Redis, BullMQ worker running | `503` if any check fails |

Both return JSON: `{ status: 'ok'|'degraded', services: { ... } }`.

`/ready` checks that the BullMQ persistence worker is active, not just that Redis is reachable — a node with a crashed worker will not receive traffic from a Kubernetes readiness probe.

---

### 4.9 Server Bootstrap (`index.js`)

Startup sequence (sequential, each step waits for the previous):

1. Parse allowed CORS origins and `trust proxy` setting from env.
2. Create Redis pub/sub clients (`redisPub`, `redisSub`) and connect.
3. Enforce `maxmemory-policy: noeviction` on Redis — eviction would silently corrupt BullMQ queues.
4. Initialize board-metadata cache (connects to Redis).
5. Create distributed rate limiters (connect to Redis store).
6. Connect to MongoDB.
7. Attach Yjs WebSocket server to the HTTP server's upgrade event.
8. Start BullMQ persistence worker + scheduler.
9. Start BullMQ publish worker + queue.
10. Mount REST API routers (boards, users, AI, workspaces, health).
11. Register graceful shutdown handlers (`SIGTERM`, `SIGINT`, `SIGUSR2`).

---

## 5. Frontend Components

### 5.1 Yjs Client Integration (`crdt/useYjsBoard.js`)

- Creates a `Y.Doc` and connects via `WebsocketProvider` from `y-websocket` to `ws://<BACKEND_URL>/yjs/<boardId>?token=<jwt>`.
- Tracks `hasSyncedOnceRef` — after the first successful sync, the `synced` flag stays `true` even on transient disconnects. This prevents the canvas from unmounting and flashing blank during network blips.
- Cleans up the provider on component unmount.

### 5.2 Yjs ↔ React State Bridge (`Components/Board/useBoardSync.js`)

Bridges Yjs shared types to React state via observers. All mutations write inside `doc.transact(..., 'board-local')` so the undo manager can scope history per client.

**Shared types and observers:**

| Shared type | Structure | Observer |
|---|---|---|
| `yPages` | `Y.Array<{ id, title, order }>` | `observe` |
| `yElements` | `Y.Map<id, plain JSON>` | `observe` |
| `yVotes` | `Y.Map<pollId, Y.Map<email, vote>>` | `observeDeep` |
| `yComments` | `Y.Map<elementId, Y.Map<commentId, comment>>` | `observeDeep` |

**Compaction rehydration:** After server-side compaction, nested Y.Maps (`votes`, `comments`) are stored as plain objects in the encoded state. On the first mutation after a cold load, the code checks `instanceof Y.Map`; if false, it reconstructs a fresh Y.Map from the plain object before writing, so CRDT merge semantics are restored for subsequent concurrent edits.

**Key mutation helpers:**

- Elements: `addElement`, `updateElement`, `updateElementProps`, `bulkUpdate`, `removeElement`
- Layer ordering: `applyLayerOrder` — normalized integer z-values with deterministic elementId tiebreak for concurrent reorders
- Pages: `addPage`, `updatePage`, `renamePage`, `deletePage`, `movePage` (fractional ordering), `ensureFirstPage`
- Votes: `castPollVote`, `removePollVote`
- Comments: `addComment`, `removeComment`

### 5.3 Board Layout (`Components/Board/BoardRoom.jsx`)

Three-pane layout: page sidebar + top utility bar + SVG canvas. Resolves role-based UI permissions:

| Permission | Condition |
|---|---|
| `editable` | role is `owner` or `editor` |
| `canComment` | role exists and is not `viewer` |
| `canVote` | role exists and is not `viewer` |
| `canShare` | role is `owner` only |

### 5.4 Presence (`Components/Board/PresenceLayer.jsx`)

Renders remote peer cursors and laser pointers as an SVG overlay. Peer data comes from `provider.awareness.getStates()`. Cursors are counter-scaled by the current zoom level so the icon size is constant on screen regardless of zoom. Only peers on the active slide are shown.

---

## 6. Data Model

### 6.1 Yjs Shared Types

```
Y.Doc
├── yPages     (Y.Array)  — [{ id, title, order }, ...]
├── yElements  (Y.Map)    — { elementId: { id, type, pageId, x, y, w, h, z, props, createdBy } }
├── yVotes     (Y.Map)    — { pollId: Y.Map { email: { optionId, name, ... } } }
├── yComments  (Y.Map)    — { elementId: Y.Map { commentId: { id, text, author, createdAt } } }
└── ySystem    (Y.Map)    — { title, ... }
```

`yElements` values are plain JSON objects (whole-value replace on mutation), which keeps compaction simple. `yVotes` and `yComments` use nested Y.Maps so concurrent votes/comments on the same poll/element merge without collision at the CRDT level.

### 6.2 MongoDB Collections

| Collection | Key fields |
|---|---|
| `whiteboards` | `id`, `title`, `owner`, `collaborators`, `yjsState` (Buffer), `isPublic`, `publicRole` |
| `users` | `email`, `name`, `passwordHash`, `profilePic` |
| `workspaces` | `name`, `owner`, `members` |

---

## 7. Cross-Cutting Concerns

### 7.1 Conflict Resolution

Yjs built-in CRDT semantics handle all conflicts — no custom merge logic on the server:

- **Y.Map keys** — Last-Write-Wins by Lamport clock + clientId tiebreak (deterministic across all peers)
- **Y.Array insertions** — position-based structural merge; concurrent inserts at the same index resolved by clientId order
- **Nested Y.Maps** — per-key LWW; concurrent votes/comments on the same element are additive (different keys), no conflict

### 7.2 Redis Roles

Redis serves four distinct purposes in this system:

| Purpose | Key pattern | Notes |
|---|---|---|
| Yjs cross-instance fanout | `yjs:<boardId>` pub/sub channel | Binary Yjs update frames, base64-encoded for Redis |
| Board metadata cache | `board:meta:<boardId>` | JSON, 60 s TTL, explicit invalidation |
| BullMQ job queues | BullMQ internal keys | `noeviction` policy required |
| Rate-limit counters | `rate-limit-redis` internal keys | Shared across instances |

### 7.3 Awareness Protocol

Cursor positions and user metadata are ephemeral — they live in the Yjs Awareness instance on the server (in-memory, per-room) and are not persisted. On disconnect, `removeAwarenessStates` evicts only that connection's `clientId` and broadcasts the updated state to remaining peers. Cross-instance awareness relay is handled within each instance's WebSocket broadcast; awareness messages are not published to Redis (cursors are inherently local to the connected instance's peers).

### 7.4 Scalability

| Concern | Approach |
|---|---|
| Stateful WebSocket connections | Multiple instances OK; Yjs updates cross-synced via Redis pub/sub |
| Rate limiting | Redis-backed counters; `trust proxy: 1` for correct client IP |
| Database load | Board-metadata cache removes MongoDB from hot connection path; write-behind removes it from the sync path |
| Memory | GC evicts idle boards after 5 min; compaction shrinks bloated docs on cold load |
| Worker reliability | Dirty flag cleared only after durable enqueue; failures re-mark dirty for retry |

---

## 8. Directory Structure

```
.
├── backend/
│   ├── crdt/
│   │   ├── WSServer.js              # Yjs WebSocket server
│   │   ├── DocumentManager.js       # In-memory Y.Doc lifecycle
│   │   ├── persistenceScheduler.js  # 30s dirty-doc flush heartbeat
│   │   └── persistenceWorker.js     # BullMQ → MongoDB persistence
│   ├── jobs/
│   │   ├── publishQueue.js
│   │   └── publishWorker.js
│   ├── cache/
│   │   └── boardCache.js
│   ├── middleware/
│   │   ├── AuthenticationMiddleware.js
│   │   └── rateLimiters.js
│   ├── utils/
│   │   └── resilience.js
│   ├── Routes/
│   ├── Controllers/
│   ├── models/
│   └── index.js
└── frontend/
    └── src/
        ├── crdt/
        │   ├── useYjsBoard.js
        │   └── useBoardHistory.js
        └── Components/
            ├── Board/
            │   ├── BoardRoom.jsx
            │   ├── useBoardSync.js
            │   ├── SlideCanvas.jsx
            │   ├── PresenceLayer.jsx
            │   ├── Sidebar.jsx
            │   ├── TopUtilityBar.jsx
            │   └── elements/
            ├── AuthPages/
            ├── Dashboard/
            └── Profile/
```
