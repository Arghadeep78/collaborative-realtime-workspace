# Collaborative Realtime Workspace — Backend

The backend for the real-time collaborative workspace: a Node.js/Express service that hosts a **custom Yjs CRDT WebSocket server**, a REST API, and background workers — designed to run across multiple instances behind a load balancer.

---

## ✨ What it does

- **CRDT synchronization** — a custom Yjs WebSocket server (`crdt/WSServer.js`) implements the full `y-protocols` binary sync handshake. Incoming document deltas are merged into the shared `Y.Doc` and rebroadcast to all peers; conflicting edits resolve automatically without central locking.
- **Live presence** — the Yjs Awareness protocol broadcasts cursor positions, user metadata, and laser-pointer state to all peers on a board. Awareness states are cleaned up precisely per-connection on disconnect.
- **Horizontal scaling** — Yjs document deltas fan out across server instances via **Redis pub/sub** (`yjs:<boardId>` channel), so users connected to different Node processes stay in sync. Awareness frames relay over a parallel `awareness:<boardId>` channel (instance-id-prefixed to drop self-echoes), so cursors and presence work cross-instance too — including ghost-cursor cleanup when a peer on another instance disconnects.
- **Hardened write path** — client updates are validated before `Y.applyUpdate`: a 512 KB size cap and try/catch isolation so a malformed frame is logged and dropped instead of crashing the server. Pure-replay updates are handled natively by Yjs (idempotent via state vectors).
- **Write-behind persistence** — a **BullMQ** scheduler marks dirty docs every 30 seconds and enqueues persist jobs; a dedicated worker (concurrency 5) encodes and writes `Y.Doc` state to MongoDB. The dirty flag clears only after the job is durably enqueued, preventing silent data loss on crash.
- **History compaction** — Yjs docs grow monotonically (every erased shape leaves a tombstone; throttled drag writes leave per-key history chains), so `yjsState` bloats even at constant shape count. `DocumentManager` compacts on **room teardown** — when the last peer leaves — by replaying the doc's current logical values into a throwaway fresh doc and persisting *that* slim snapshot. Doing it at teardown means the rebuild never blocks a client's sync handshake (the room is empty) and the next cold load reads small, cheap-to-replay bytes. The savings on history-heavy docs are large — a synthetic board with a long per-key write chain compacted **68 KB → 5 KB (~93%)** in testing. Only persists the compacted form when it's ≤ 80% of the original; nested Y.Maps (votes, comments) are reconstructed rather than flattened so CRDT merge semantics survive a reload.
- **Authorization at the trust boundary** — `viewer`/`commenter`/`editor` roles are enforced **per Yjs sync message**, so a viewer cannot mutate a board even over a raw WebSocket.
- **Distributed rate limiting** — `express-rate-limit` + `rate-limit-redis` with shared Redis counters across instances, split into auth (50/15 min) / AI (40/15 min) / general (300/15 min) tiers.
- **Board-metadata cache** — access metadata (`owner`, `collaborators`, `isPublic`, `publicRole`, workspace members) is Redis-cached (`board:meta:<id>`, 60 s TTL) with explicit invalidation on share / unshare / publish / delete / leave, removing a cold MongoDB read from every WebSocket connection.
- **Self-service membership** — non-owner collaborators can leave a board (`DELETE /boards/leave/:id`) or a workspace (`DELETE /workspaces/:id/leave`, which also removes them from that workspace's boards); owners are rejected and must delete instead. Both paths invalidate the affected boards' metadata cache.
- **External API resilience** — Gemini calls wrapped with a 10 s timeout, exponential-backoff retries (transient errors only), and a shared circuit breaker (5 failure threshold, 30 s cooldown).
- **Health & readiness probes** — `GET /health` (MongoDB + Redis) and `GET /ready` (+ BullMQ workers running, persist-queue backpressure via `getWaitingCount`, and active-board count). `/ready` reports `not-ready` when the flush backlog exceeds the threshold so an orchestrator stops adding load until it drains.
- **Async board publishing** — BullMQ queue + worker generate a read-only public snapshot off the request path.
- **Graceful shutdown** — `SIGTERM`/`SIGINT`/`SIGUSR2` drain workers, close queues, and quit Redis clients before process exit.
- **Auth** — email/password and Google OAuth 2.0, JWT access/refresh tokens. Each email is tied to exactly **one** method: an email already registered with a password can't later sign in with Google (and vice-versa). A custom-uploaded profile picture is never overwritten by a subsequent Google sign-in.
- **Password reset** — `POST /users/forgot-password` emails a single-use link (SHA-256-hashed token, 15-min expiry, enumeration-safe generic response); `POST /users/reset-password/:token` verifies and sets the new password. Google-only accounts have no password, so they're excluded. Requires `EMAIL_USER`/`EMAIL_PASS` (Nodemailer/Gmail) and `FRONTEND_URL`.

---

## 🛠️ Tech Stack

- **Server:** Node.js, Express.js
- **Realtime:** Yjs (`y-protocols`, `y-websocket`, `lib0`), `ws` (native WebSocket), Redis pub/sub
- **Database:** MongoDB + Mongoose
- **Queues:** BullMQ + ioredis
- **AI:** ~~Google Gemini API~~ (removed)
- **Auth:** bcryptjs, jsonwebtoken, google-auth-library
- **Media:** Cloudinary, multer
- **Email:** nodemailer

---

## 📂 Layout

```
backend/
├── crdt/
│   ├── WSServer.js              # Custom Yjs WebSocket server (sync protocol + RBAC + awareness)
│   ├── DocumentManager.js       # In-memory Y.Doc lifecycle: load, compaction, dirty tracking, GC
│   ├── persistenceScheduler.js  # 30-second heartbeat that enqueues BullMQ persist jobs
│   └── persistenceWorker.js     # BullMQ consumer: encodes Y.Doc → writes to MongoDB
├── jobs/
│   ├── publish.queue.js         # BullMQ queue factory for project publishing
│   └── publish.worker.js        # Async project snapshot worker
├── cache/
│   └── project.cache.js         # Redis board:meta:* cache + resolveRole helper
├── middleware/
│   ├── auth.middleware.js        # JWT + Google OAuth verification
│   ├── cloudinary.middleware.js  # Multer + Cloudinary upload handler
│   └── rate-limiters.middleware.js  # Redis-backed rate limiters
├── utils/
│   ├── jwt.js                   # JWT sign/verify helpers
│   ├── role.js                  # resolveRole helper
│   └── mailer.js                # Nodemailer: board invites & password-reset links
├── routes/
│   ├── health.routes.js         # GET /health and GET /ready probe endpoints
│   ├── project.routes.js
│   ├── user.routes.js
│   ├── publish.routes.js
│   └── workspace.routes.js
├── controllers/                 # Express route handlers
├── models/                      # Mongoose schemas (user.model.js, whiteboard.model.js, workspace.model.js)
└── index.js                     # Server bootstrap: HTTP + Yjs WS + workers + graceful shutdown
```

---

## 📦 Local Setup

### 1. Install

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and fill in the values. Key variables:

```env
PORT=3030

# MongoDB — full URI in DB_CLUSTER_URL, or split DB_USERNAME/DB_PASSWORD/DB_CLUSTER_URL
DB_USERNAME=your-db-username
DB_PASSWORD=your-db-password
DB_CLUSTER_URL=cluster0.xxxxx.mongodb.net

# Redis — Yjs pub/sub, board-metadata cache, rate-limit store, BullMQ
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-jwt-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id

# Gemini (AI brainstorming)
GOOGLE_API_KEY=your-gemini-api-key

# Email (Nodemailer/Gmail) — board invites & password-reset links.
# EMAIL_PASS must be a Gmail App Password (requires 2FA).
EMAIL_USER=your-gmail-address@gmail.com
EMAIL_PASS=your-gmail-app-password

# Allowed frontend origin(s) for CORS (comma-separated). Also used to build
# the password-reset link sent by email.
FRONTEND_URL=http://localhost:5173
```

> See [`.env.example`](.env.example) for the full list, including Cloudinary (media uploads) and SMTP (board-invite & password-reset email).

### 3. Run

```bash
npm run dev
```

The server starts on `PORT` (default `3030`). The Yjs WebSocket server is attached at the `/yjs` upgrade path on the same HTTP port.

---

## 🔭 Future Improvements

- **Incremental update log.** The persistence worker currently writes a full `Y.encodeStateAsUpdate` snapshot per flush, so a single element move can cause a large MongoDB write (write amplification). The planned replacement appends raw per-update chunks (20–200 bytes) to a `yjsUpdates` collection on each `ydoc.on('update')`, replays them in `seq` order on cold load, and compacts the log into a snapshot once it exceeds a threshold (~50 entries) — the same approach used by `y-leveldb` and Hocuspocus persistence adapters. Touches `DocumentManager.js` + `persistenceWorker.js` and adds a `YjsUpdate` Mongoose model.

---

## 📜 License

MIT
