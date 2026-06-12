# Collaborative Realtime Workspace — Frontend

The client for the real-time collaborative workspace, built with **React 19 + Vite** on a **custom SVG canvas** (no third-party canvas library) and synced with **Yjs** CRDTs over WebSockets.

---

## ✨ Features

- **Custom multi-page canvas** — fixed 16:9 slides with freeform / grid / column layout modes, pan & zoom, marquee select, and explicit z-order layering.
- **Rich elements** — sticky notes, Kanban cards (labels, assignees, subcards, due dates), text boxes, connectors, poll blocks, iframe embeds, shapes, and media.
- **Real-time collaboration** — element edits sync instantly via Yjs CRDTs; conflicts resolve automatically.
- **Live presence** — teammate cursors with name tags and a broadcast laser pointer, powered by the Yjs Awareness protocol. Presence is relayed cross-instance on the backend, so cursors stay visible even when collaborators are connected to different server instances.
- **Comments & voting** on elements for async feedback.
- **AI brainstorming** panel powered by the Gemini API.
- **Sharing roles** — Viewer, Commenter, and Editor; enforced client-side and at the server trust boundary. The dashboard shows each board's role as a badge, and non-owners can leave a board or workspace from the board card menu.
- **Polished UI** — floating-card design, dark mode, responsive layout, and micro-animations.

---

## 🛠️ Tech Stack

- **Framework:** React 19, Vite
- **Canvas:** Custom SVG rendering — a self-contained element registry (sticky notes, Kanban cards, text, connectors, polls, embeds, shapes, media). Element coordinates live in fixed slide units so rendering is zoom-independent.
- **Realtime:** Yjs + `y-websocket` (`WebsocketProvider`), Yjs Awareness for presence
- **Routing:** React Router
- **Styling:** Tailwind CSS
- **Auth:** JWT (access/refresh), Google OAuth 2.0

---

## 📂 Key Structure

```
frontend/src/
├── crdt/
│   ├── useYjsBoard.js        # Y.Doc + WebsocketProvider init; tracks hasSyncedOnce to avoid blank-board flicker on reconnect
│   └── useBoardHistory.js    # Per-client undo/redo via Yjs UndoManager
├── Components/Board/
│   ├── BoardRoom.jsx         # Main 3-pane layout (sidebar + toolbar + canvas); resolves user role and permissions
│   ├── useBoardSync.js       # Yjs ↔ React state bridge: observe shared types, expose CRUD helpers
│   ├── SlideCanvas.jsx       # SVG render loop + pointer/keyboard input
│   ├── Sidebar.jsx           # Page list with drag-reorder (fractional ordering)
│   ├── TopUtilityBar.jsx     # Toolbar (tools, layout modes, zoom)
│   ├── PresenceLayer.jsx     # Remote cursors + laser pointer overlay
│   └── elements/             # StickyNote, KanbanCard, PollBlock, TextBox, ConnectorLayer, ShapeBlock, MediaBlock, IframeWindow
├── Components/AuthPages/     # Login, Register
├── Components/Dashboard/     # Board + workspace list (page shell + components/ for cards, modals, dropdown)
├── Components/common/        # Avatar, shared SVG icon set
└── Components/Profile/       # User profile
```

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
