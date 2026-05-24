# Collaborative Realtime Workspace — Backend

The backend for the real-time collaborative workspace: a Node.js/Express service that hosts a **Yjs CRDT WebSocket server**, a REST API, and background workers — designed to run across multiple instances behind a load balancer.

---

## ✨ What it does

- **CRDT synchronization** — a Yjs WebSocket server merges and rebroadcasts document deltas; conflicting edits resolve automatically without central locking.
- **Horizontal scaling** — Socket.IO Redis adapter + Yjs cross-instance **Redis pub/sub** keep clients in sync regardless of which Node process they hit.
- **Write-behind persistence** — a **BullMQ** worker + scheduler flush in-memory `Y.Doc` state to MongoDB on an interval, keeping the database off the hot sync path. History is compacted on save while preserving nested Yjs types (e.g. the `votes` map).
- **Authorization at the trust boundary** — `viewer`/`commenter`/`editor` roles are enforced **per Yjs sync message**, so a viewer cannot mutate a board even over a raw WebSocket.
- **Distributed rate limiting** — `express-rate-limit` + `rate-limit-redis` with shared counters across instances, split into auth / AI / general tiers.
- **Board-metadata cache** — Redis-cached access metadata (`board:meta:<id>`, 60s TTL) with explicit invalidation, removing a cold Mongo read from every connection.
- **External API resilience** — Gemini calls wrapped with timeout, retry, and a circuit breaker.
- **Health & readiness probes** — `GET /health` (MongoDB + Redis) and `GET /ready` (+ BullMQ workers).
- **Async board publishing** — BullMQ queue + worker generate a read-only public snapshot off the request path.
- **Auth** — email/password and Google OAuth 2.0, JWT access/refresh tokens.

---

## 🛠️ Tech Stack

- **Server:** Node.js, Express.js
- **Realtime:** Yjs (`y-protocols`, `y-websocket`), Socket.IO, Redis
- **Database:** MongoDB + Mongoose
- **Queues:** BullMQ
- **AI:** Google Gemini API
- **Auth:** bcrypt, jsonwebtoken, Google Auth Library

---

## 📂 Layout

```
backend/
├── crdt/        # Yjs WebSocket server, document manager, persistence worker + scheduler
├── jobs/        # BullMQ publish queue + worker
├── cache/       # Redis board-metadata cache (role resolution + invalidation)
├── middleware/  # Auth, socket auth, Redis-backed rate limiters
├── utils/       # Resilience primitives (timeout / retry / circuit breaker)
├── Routes/      # Express REST routes (users, boards, ai, publish, workspaces, health)
├── Controllers/ # Route handlers
├── models/      # Mongoose schemas
└── index.js     # Server bootstrap (HTTP + WS + workers + graceful shutdown)
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

# Redis — Socket.IO adapter, Yjs pub/sub, cache, rate-limit store, BullMQ
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-jwt-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id

# Gemini (AI brainstorming)
GOOGLE_API_KEY=your-gemini-api-key

# Allowed frontend origin(s) for CORS (FRONTEND_URLS = comma-separated list)
FRONTEND_URL=http://localhost:5173
```

> See [`.env.example`](.env.example) for the full list, including Cloudinary (media uploads) and SMTP (share-invite email).

### 3. Run

```bash
npm run dev
```

The server starts on `PORT` (default `3030`), with the Yjs WebSocket server attached on the `/yjs` path.

---

## 📜 License

MIT
</content>
