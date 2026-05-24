# Collaborative Realtime Workspace — Frontend

The client for the real-time collaborative workspace, built with **React 19 + Vite** on a **custom SVG canvas** (no third-party canvas library) and synced with **Yjs** CRDTs over WebSockets.

---

## ✨ Features

- **Custom multi-page canvas** — fixed 16:9 slides with freeform / grid / column layout modes, pan & zoom, marquee select, and explicit z-order layering.
- **Rich elements** — sticky notes, Kanban cards (labels, assignees, subcards, due dates), text boxes, connectors, poll blocks, iframe embeds, shapes, and media.
- **Real-time collaboration** — element edits sync instantly via Yjs CRDTs; conflicts resolve automatically.
- **Live presence** — teammate cursors with name tags and a broadcast laser pointer.
- **Comments & voting** on elements for async feedback.
- **AI brainstorming** panel powered by the Gemini API.
- **Sharing roles** — Viewer, Commenter, and Editor.
- **Polished UI** — floating-card design, dark mode, responsive layout, and micro-animations.

---

## 🛠️ Tech Stack

- **Framework:** React 19, Vite
- **Canvas:** Custom SVG rendering (self-contained element registry)
- **Realtime:** Yjs, `y-websocket`
- **Routing:** React Router
- **Styling:** Tailwind CSS
- **Auth:** JWT (access/refresh), Google OAuth 2.0

---

## 📦 Local Setup

### 1. Install

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and fill in the values:

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_BACKEND_URL=http://localhost:3030
```

### 3. Run

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

---

## 📜 License

MIT
</content>
