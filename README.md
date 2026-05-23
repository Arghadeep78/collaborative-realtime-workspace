# Collaborative Whiteboard Platform

A full-stack, real-time collaborative whiteboard platform built with React, Tldraw, and Yjs. Features an infinite canvas, real-time collaboration, AI-powered brainstorming, role-based access control, and board publishing.

---

## Features

| Feature | Description |
|---|---|
| **Live Collaboration** | Multiple users draw and edit on the same infinite canvas simultaneously. Changes sync seamlessly using Yjs CRDTs. |
| **Tldraw Integration** | High-performance, feature-rich whiteboard canvas with sticky notes, shapes, drawing tools, and interactive menus. |
| **Role-Based Access** | Granular permissions with Viewer, Commenter, and Editor roles, enforced on every Yjs sync message — a `viewer` cannot mutate the board even over a raw WebSocket. |
| **AI Brainstorming** | Integrated AI Panel powered by Google Gemini, hardened with request timeouts, retries, and a circuit breaker so a Gemini outage degrades gracefully. |
| **Board Publishing** | Asynchronous "Publish Board" workflow to share boards publicly with a read-only view. |
| **Comments & Voting** | Leave threaded comments on any board element and upvote/downvote ideas for async decision-making. |
| **Export & Tools** | Export boards to images, countdown timers for facilitation, and "Follow Me" spotlighting for presentations. |
| **Secure Authentication** | Sign in securely using Google OAuth or email and password. |
| **Production Hardening** | Redis-backed distributed rate limiting, board-metadata caching, `/health` & `/ready` probes, and resilient external API calls. |

---

## Monorepo Structure

```
.
├── backend/   # Node.js + Express + Socket.IO + Yjs WS server
├── frontend/  # React + Vite + Tldraw + Yjs client
└── README.md  # Project overview
```

---

## Tech Stack

**Backend**
- Node.js, Express.js
- Socket.IO + Yjs (`y-websocket`) – CRDT sync engine
- MongoDB + Mongoose
- Redis – Socket.IO adapter, Yjs cross-instance pub/sub, board-metadata cache, and shared rate-limit store
- BullMQ – async job queues for publishing boards
- `express-rate-limit` + `rate-limit-redis` – distributed API rate limiting
- Google Gemini API – AI brainstorming features (timeout + retry + circuit breaker)
- JWT auth + Google OAuth 2.0

**Frontend**
- React 18, Vite
- Tldraw – Infinite canvas UI and tools
- Yjs + `y-websocket` – Real-time state synchronization
- Tailwind CSS / Vanilla CSS – UI styling

---

## Getting Started

### Prerequisites
- Node.js >= 18
- MongoDB instance
- Redis instance
- Google Gemini API key
- Google OAuth credentials

### Setup Backend

```bash
cd backend
npm install
# Configure your .env file
npm run dev
```

### Setup Frontend

```bash
cd frontend
npm install
# Configure your .env file
npm run dev
```

---

## Operations & Hardening

These backend features make the platform safe to run behind a load balancer across multiple instances:

| Concern | Implementation |
|---|---|
| **Liveness probe** | `GET /health` → `{ status, redis, mongo }`. Returns `503` if MongoDB or Redis is unreachable so the LB pulls the node. |
| **Readiness probe** | `GET /ready` → adds a BullMQ worker check. A node can be live but not ready if its background workers have died. |
| **Authorization** | The Yjs WebSocket server resolves each user's role and rejects sync **writes** from `viewer`s (`backend/crdt/WSServer.js`). Reads are still allowed. |
| **Rate limiting** | `express-rate-limit` backed by a shared Redis store (`backend/middleware/rateLimiters.js`). Counters are global across instances — separate tiers for auth, AI, and general API routes. |
| **Board-metadata cache** | Access metadata (`owner`, `collaborators`, `isPublic`, `publicRole`) is cached in Redis under `board:meta:<id>` with a 60s TTL and invalidated on share/unshare/publish/delete (`backend/cache/boardCache.js`). |
| **External API resilience** | Gemini calls are wrapped with a 10s timeout, exponential-backoff retry on transient errors, and an in-memory circuit breaker (`backend/utils/resilience.js`). |

---

## License

MIT
