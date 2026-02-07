# Collaborative Whiteboard Platform

A full-stack, real-time collaborative whiteboard platform built with React, Tldraw, and Yjs. Features an infinite canvas, real-time collaboration, AI-powered brainstorming, role-based access control, and board publishing.

---

## Features

| Feature | Description |
|---|---|
| **Live Collaboration** | Multiple users draw and edit on the same infinite canvas simultaneously. Changes sync seamlessly using Yjs CRDTs. |
| **Tldraw Integration** | High-performance, feature-rich whiteboard canvas with sticky notes, shapes, drawing tools, and interactive menus. |
| **Role-Based Access** | Granular permissions with Viewer, Commenter, and Editor roles for shared boards. |
| **AI Brainstorming** | Integrated AI Panel powered by Google Gemini to generate ideas, structures, and content directly on the board. |
| **Board Publishing** | Asynchronous "Publish Board" workflow to share boards publicly with a read-only view. |
| **Export & Tools** | Export boards to images, countdown timers for facilitation, and "Follow Me" spotlighting for presentations. |
| **Secure Authentication** | Sign in securely using Google OAuth or email and password. |

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
- Redis – Socket.IO adapter + Yjs cross-instance pub/sub
- BullMQ – async job queues for publishing boards
- Google Gemini API – AI brainstorming features
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

## License

MIT
