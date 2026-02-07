# Collaborative Whiteboard Platform - Backend

The backend for the real-time collaborative whiteboard platform, built with Node.js, Express, Socket.IO, and Yjs.

---

## ✨ Features

- **CRDT Synchronization:** Robust real-time state synchronization using Yjs and `y-websocket`.
- **Scalable WebSockets:** Socket.IO with Redis adapter for multi-instance scaling and pub/sub capabilities.
- **Asynchronous Publishing Pipeline:** BullMQ-powered job queues for publishing boards to public URLs.
- **AI Integration:** Secure endpoints communicating with the Google Gemini API for AI-powered whiteboard brainstorming.
- **Robust Authentication:** Email/password and Google OAuth 2.0 flows, protected with JWT access and refresh tokens.
- **Role-Based Access Control:** Middleware to enforce granular permissions (Viewer, Commenter, Editor) on document access and modifications.

---

## 🛠️ Tech Stack

- **Server:** Node.js, Express.js
- **Realtime:** Socket.IO, Yjs (`y-protocols`, `y-websocket`), Redis
- **Database:** MongoDB + Mongoose
- **Queues:** BullMQ
- **AI Services:** Google Gemini API
- **Auth:** bcrypt, jsonwebtoken, Google Auth Library

---

## 📦 Local Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the `backend` directory. Here is an example of the variables you might need:

```env
PORT=3030

# Database configuration
MONGO_URI=mongodb://localhost:27017/whiteboard-platform

# Redis configuration for scaling WebSockets and BullMQ
REDIS_URL=redis://localhost:6379

# JWT secret keys
JWT_SECRET=your-jwt-secret

# Google OAuth credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Gemini API key
GOOGLE_API_KEY=your-gemini-api-key

# Frontend URL for CORS
FRONTEND_URL=http://localhost:5173
```

### 3. Run Development Server

```bash
npm run dev
```

The server will start on the specified `PORT` (default 3030).

---

## 📜 License

MIT
