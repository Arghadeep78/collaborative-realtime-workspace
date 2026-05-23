# Collaborative Whiteboard Platform - Frontend

The frontend for the real-time collaborative whiteboard platform, powered by React, Vite, Tldraw, and Yjs.

---

## ✨ Features

- **Infinite Canvas:** High-performance whiteboard using Tldraw.
- **Real-Time Collaboration:** Synchronize drawings, sticky notes, and shapes instantly with Yjs CRDTs and WebSockets.
- **AI Brainstorming Panel:** Generate ideas and content directly on your canvas using the Gemini API.
- **Collaboration Roles:** Support for Viewers, Commenters, and Editors.
- **Comments & Voting:** Threaded comments on board elements with upvote/downvote for async feedback.
- **Facilitation Tools:** Built-in countdown timer and "Follow Me" features for workshops and meetings.
- **Premium UI:** Beautiful floating-card style design, responsive breakpoints, and micro-animations for an elevated user experience.

---

## 🛠️ Tech Stack

- **Framework:** React 18, Vite
- **Canvas Element:** Tldraw
- **Realtime Sync:** Yjs, y-websocket
- **Styling:** Vanilla CSS (floating UI, custom properties, modern animations)
- **Auth:** JWT (access/refresh), Google OAuth 2.0 integration

---

## 📦 Local Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the `frontend` directory. Example:

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_BACKEND_URL=http://localhost:3030
```

### 3. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or your default Vite port).

---

## 📜 License

MIT
