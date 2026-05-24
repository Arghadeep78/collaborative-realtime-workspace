# Collaborative Realtime Workspace

<img width="1470" height="833" alt="image" src="https://github.com/user-attachments/assets/a2ef5d47-9451-43d9-9345-0830f16b55ba" />

A full-stack, real-time collaborative workspace where teams ideate and organize on a shared, multi-page canvas — sticky notes, Kanban cards, connectors, polls, embeds, and more. State syncs conflict-free across clients with **Yjs CRDTs**, and the backend is built to run horizontally behind a load balancer: Redis-backed pub/sub, write-behind persistence, distributed rate limiting, health probes, and resilient external calls.

The canvas UI is **custom-built** (React + SVG, no canvas library shell), so the workspace is fully owned end-to-end — from the CRDT wire protocol on the server to every element on the screen.

---

## Highlights (Backend)

This project's emphasis is a backend that is safe to scale across multiple instances:

| Concern | Implementation |
|---|---|
| **CRDT sync engine** | A Yjs WebSocket server (`backend/crdt/WSServer.js`) co-located on the same HTTP server (`/yjs` path). Merges and rebroadcasts document deltas; conflicts resolve automatically via CRDTs — no central locking. |
| **Horizontal scaling** | Socket.IO uses the **Redis adapter**, and Yjs updates fan out across instances over **Redis pub/sub**, so users on different Node processes stay in sync behind a load balancer. |
| **Write-behind persistence** | A **BullMQ** worker + scheduler flush in-memory `Y.Doc` state to MongoDB on an interval (`backend/crdt/persistenceWorker.js`), keeping the hot sync path off the database. |
| **Authorization at the trust boundary** | Roles (`viewer`/`commenter`/`editor`) are enforced **per Yjs sync message**, not just at connect. A `viewer`'s write bytes are discarded before touching the shared doc — a hand-crafted WebSocket frame can't bypass the UI's read-only mode. |
| **Distributed rate limiting** | `express-rate-limit` + `rate-limit-redis` with shared counters across instances, split into auth / AI / general API tiers (`backend/middleware/rateLimiters.js`). |
| **Board-metadata cache** | Access metadata (`owner`, `collaborators`, `isPublic`, `publicRole`) is cached in Redis (`board:meta:<id>`, 60s TTL) and invalidated on share/unshare/publish/delete — removing a cold Mongo read from every connection (`backend/cache/boardCache.js`). |
| **External API resilience** | Gemini calls are wrapped with a 10s timeout, exponential-backoff retries, and an in-memory circuit breaker, so an upstream outage fails fast instead of queuing hanging requests (`backend/utils/resilience.js`). |
| **Health & readiness probes** | `GET /health` checks live MongoDB + Redis (`503` when down); `GET /ready` additionally verifies BullMQ workers — concrete signals for load balancers / orchestrators. |
| **Async publishing** | A BullMQ queue + worker produces a read-only public snapshot of a board off the request path (`backend/jobs/`). |
| **Graceful shutdown** | `SIGTERM`/`SIGINT` drain workers, queues, and Redis clients before exit. |

---

## Features (Product)

- **Multi-page canvas** of fixed 16:9 slides with freeform / grid / column layout modes.
- **Rich elements:** sticky notes, Kanban cards (labels, assignees, subcards, due dates), text boxes, connectors, poll blocks, iframe embeds, shapes, and media.
- **Live presence:** real-time teammate cursors with name tags and a laser pointer.
- **Comments & voting** on elements for async decision-making.
- **Role-based sharing** (Viewer / Commenter / Editor) and public board publishing.
- **AI brainstorming** via the Google Gemini API.
- **Secure auth** with email/password and Google OAuth 2.0 (JWT access/refresh).

---

## Architecture

```
.
├── backend/   # Node.js + Express + Socket.IO + Yjs WebSocket server
└── frontend/  # React + Vite custom canvas client
```

```mermaid
graph TD
    subgraph Client [Frontend — React/Vite]
        UI[Custom SVG Canvas + UI]
        YjsClient[Yjs Client Doc]
        UI <--> YjsClient
    end

    subgraph Server [Backend — Node.js/Express]
        API[Express REST API]
        YjsServer[Yjs WebSocket Server]
        Workers[BullMQ Workers<br/>persistence + publish]
    end

    subgraph Data [Data Layer]
        MongoDB[(MongoDB)]
        Redis[(Redis<br/>pub/sub · cache · queues)]
    end

    Gemini[Google Gemini API]

    Client -- REST/HTTPS --> API
    YjsClient <-- WebSocket --> YjsServer
    API --> MongoDB
    YjsServer <--> Redis
    Workers <--> Redis
    Workers --> MongoDB
    API -- HTTPS --> Gemini
```

See [architecture.md](architecture.md) for the full design and [PRD.md](PRD.md) for the product spec.

---

## Tech Stack

**Backend** — Node.js, Express, Socket.IO + Yjs (`y-websocket`), MongoDB/Mongoose, Redis (adapter, pub/sub, cache, rate-limit store), BullMQ, JWT + Google OAuth 2.0, Google Gemini API.

**Frontend** — React 19, Vite, custom SVG canvas, Yjs + `y-websocket`, Tailwind CSS, React Router.

---

## Getting Started

### Prerequisites
- Node.js >= 18
- A MongoDB instance
- A Redis instance
- Google OAuth credentials and a Gemini API key (for auth + AI features)

### Backend

```bash
cd backend
npm install
cp .env.example .env   # then fill in the values
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # then fill in the values
npm run dev
```

The frontend runs on `http://localhost:5173` and talks to the backend on `http://localhost:3030`.

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for environment-variable details.

---

## License

MIT
</content>
