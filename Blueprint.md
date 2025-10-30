# Project Blueprint: Taskara (AI-Augmented Collaborative Kanban)
**Version:** 1.0
**Date:** October 30, 2025
**Status:** Blueprint / Design Phase

---

## 1. Overview & Motivation
Taskara is a real-time, web-based project management application inspired by Trello. It allows teams to visualize tasks on a collaborative Kanban board.

The primary motivation for this project is to evolve the concepts developed in the "AI-Powered CV Builder" to tackle a more complex, dynamic, and multi-user problem. While the CV builder focused on synchronizing a single, structured document, Momentum's challenge is to synchronize a dynamic, multi-object state (a board with many lists and cards) manipulated by multiple users simultaneously.

This project introduces advanced, real-world challenges in real-time state management, database design for ordered lists, and the integration of generative AI as a proactive assistant (generating content) rather than a reactive editor (rewriting content).

## 2. Problem Statement
### For Users
Small teams often struggle with complex, expensive project management tools. They need a simple, visual, and "live" way to track tasks. Manually breaking down large tasks into sub-steps is tedious, and getting a quick overview of progress is difficult.

### For the Developer
* How do you architect a system that synchronizes the state of dozens of interactive elements (cards) across multiple clients in real-time?
* What is the optimal database schema to manage ordered, nestable lists (cards within lists, lists within boards) that supports efficient drag-and-drop reordering?
* How can generative AI be integrated natively into a workflow to generate structured content (e.g., a checklist) from a simple prompt, rather than just suggesting text edits?

## 3. Objectives & Key Questions
### Primary Objectives (What we will build)
* **Full Real-time CRUD:** Implement a MERN-stack application with full CRUD (Create, Read, Update, Delete) for Workspaces, Boards, Lists, and Cards.
* **Real-time Drag-and-Drop:** Enable users to drag-and-drop cards between lists and reorder cards within a list. These changes must be broadcast via WebSockets and reflected instantly (<200ms) on all other connected clients.
* **Scalable WebSocket Architecture:** Implement a "room-based" Socket.IO architecture where each board is a separate room. Use the Socket.IO Redis adapter to ensure state can be synchronized across multiple horizontally-scaled server instances.
* **AI Sub-task Generation:** Integrate the Gemini API to allow users to click a button on a card, which will read the card's title and auto-populate its description with a structured checklist of suggested sub-tasks.
* **Multi-User Collaboration:** Implement a workspace/board invitation system using Nodemailer, allowing users to collaborate on shared boards.

### Key Technical Questions (What we will learn)
* What is the most robust way to handle state synchronization between an optimistic UI (e.g., react-beautiful-dnd) and a server-authoritative state?
* How do you resolve state conflicts if two users modify the same card simultaneously?
* What is the most efficient MongoDB schema for managing ordered lists? (See Section 7 for the proposed solution).
* What prompt engineering techniques are required to have the Gemini API consistently return valid, machine-parseable JSON (e.g., a checklist array)?

## 4. System Architecture & Workflow
### Components
* **Frontend (Client):** A React (Vite) single-page application (SPA).
    * Manages UI state and user interaction.
    * Uses `react-beautiful-dnd` to handle the drag-and-drop UI.
    * Uses `socket.io-client` to maintain a persistent WebSocket connection with the backend.
    * Implements an "optimistic update" strategy for drag-and-drop: the UI updates locally first to feel instant, then a socket event is emitted.
* **Backend (API Server):** A Node.js / Express server.
    * Handles all non-real-time communication: user authentication (JWT/OAuth), REST API endpoints for creating/deleting boards, managing invites, etc.
    * Serves as the host for the WebSocket server.
* **Real-time Service (WebSockets):** Socket.IO server, integrated with Express.
    * Manages all real-time events (`move:card`, `new:card`, etc.).
    * Manages room logic. When a user loads a board, their socket joins a room named `board:<boardId>`.
    * Uses the Socket.IO Redis Adapter for broadcasting events.
* **Database (DB):** MongoDB.
    * Stores all persistent data: users, workspaces, boards, lists, and cards.
    * The schema (see Section 7) is designed specifically to support efficient reordering.
* **Scaling Service (Redis):**
    * Acts as the publish/subscribe (pub/sub) bus for Socket.IO. When a server instance emits an event, it publishes it to a Redis channel. All other server instances subscribe to that channel and broadcast the event to their connected clients. This is the key to horizontal scaling.
* **AI Service (Gemini API):**
    * An external API (Google) accessed by the backend. The backend includes a dedicated `GeminiService` module that handles prompt formatting, API calls, and (critically) parsing and sanitizing the JSON response.

### Core Workflow Example: User A Moves a Card
1.  **Client A (Drag End):** User A drags "Card X" from "List 1" to "List 2". The `react-beautiful-dnd` `onDragEnd` hook fires.
2.  **Client A (Optimistic UI):** The client immediately updates its local React state to show "Card X" in "List 2". The UI feels instantaneous.
3.  **Client A (Emit Event):** The client's socket handler emits a `move:card` event to the server with a payload:
    ```json
    {
      "boardId": "b-123",
      "cardId": "c-456",
      "fromListId": "l-abc",
      "toListId": "l-xyz",
      "newIndex": 0
    }
    ```
4.  **Backend (Receive):** The Socket.IO server receives the `move:card` event.
5.  **Backend (Database Op):** The server logic updates the MongoDB document for "Card X", setting its `listId` to `l-xyz` and its `index` to `0`. It also updates the `index` of all other cards in `l-abc` and `l-xyz` to close the gaps (this must be a transaction).
6.  **Backend (Broadcast):** Once the database write is successful, the server broadcasts a `card:moved` event to all other clients in the `board:b-123` room. The payload is the same as the one received.
7.  **Client B, C... (Receive):** The other clients' socket listeners receive the `card:moved` event. They update their React state, and their UI updates to show "Card X" in its new position.
8.  **Conflict Handling:** If Client A's optimistic update was wrong (e.g., Client B moved the card first), the server's broadcast event is the "source of truth" and will correct Client A's UI.

## 5. Methodology / Approach
* **Database Schema:** The core challenge is ordering. We will not store arrays of child IDs (e.g., `list.cards = [c1, c2]`) as this makes reordering (like `array.splice`) a database nightmare. Instead, we will use a "linked list" or "positional indexing" approach. Each Card/List will store its parent's ID and an `index` (or `position`) field. Reordering simply involves updating the `index` fields of the affected items.
* **State Management:**
    * **Global State:** React Context for non-volatile data: `AuthContext` (user, token) and `SocketContext` (the socket instance).
    * **Board State:** The "source of truth" for the board (lists, cards) will be managed by a `useBoard` custom hook. This hook will fetch the initial board state via REST, then subscribe to socket events to receive and apply real-time updates.
* **Real-time Strategy:** A room-based, server-authoritative model. The client's optimistic update is for "perceived performance," but the server's broadcast is the final word, preventing desynchronization.
* **AI Integration:** AI features will be exposed via standard REST API endpoints, not WebSockets. The client will make a `POST` request (e.g., `/api/card/c-456/generate-tasks`), the backend will orchestrate the Gemini API call, and the result will be returned. If the result modifies the card, a separate socket event (`card:updated`) will be broadcast.

## 6. Tech Stack & Tools
* **Frontend:** React 18 (Vite), Tailwind CSS, `react-beautiful-dnd`, `socket.io-client`, `axios`
* **Backend:** Node.js, Express.js, `socket.io`
* **Database:** MongoDB (with Mongoose ODM)
* **Real-time Scaling:** Redis (for `socket.io-redis-adapter`)
* **Authentication:** `bcryptjs` (hashing), `jsonwebtoken` (JWT Access/Refresh), `passport-google-oauth20`
* **AI:** `@google/generative-ai` (Gemini API SDK)
* **Emailing:** `Nodemailer` (for workspace invites)

## 7. Data Description (Database Schema)
This schema is designed for efficient querying and reordering.

### User Collection
* `_id`: (ObjectId)
* `email`: (String, Unique, Required)
* `passwordHash`: (String)
* `googleId`: (String, Sparse)
* `username`: (String)
* `workspaces`: (\[{ type: ObjectId, ref: 'Workspace' }])

### Workspace Collection
* `_id`: (ObjectId)
* `name`: (String, Required)
* `ownerId`: (ObjectId, ref: 'User')
* `members`: (\[{ type: ObjectId, ref: 'User' }])
* `boards`: (\[{ type: ObjectId, ref: 'Board' }])

### Board Collection
* `_id`: (ObjectId)
* `name`: (String, Required)
* `workspaceId`: (ObjectId, ref: 'Workspace')
* (Lists are fetched separately by querying List collection)

### List Collection
* `_id`: (ObjectId)
* `name`: (String, Required)
* `boardId`: (ObjectId, ref: 'Board', Indexed)
* `index`: (Number, Required)
* *(Query: `List.find({ boardId: '...' }).sort({ index: 1 })`)*

### Card Collection
* `_id`: (ObjectId)
* `title`: (String, Required)
* `description`: (String)
* `listId`: (ObjectId, ref: 'List', Indexed)
* `boardId`: (ObjectId, ref: 'Board', Indexed)
* `index`: (Number, Required)
* `checklist`: (\[{ text: String, isDone: Boolean }])
* *(Query: `Card.find({ listId: '...' }).sort({ index: 1 })`)*

## 8. Model Design (AI Integration)
### Model
`gemini-2.5-flash-preview-09-2025`

### Framework
Google Generative AI API, accessed via the official Node.js SDK.

### Methodology
The backend will include a `GeminiService` with two primary methods:

* **`generateSubtasks(cardTitle)`:**
    * **Action:** Called when a user clicks "Generate Sub-tasks" on a card.
    * **System Prompt:** You are a helpful project manager. The user will provide a task title. Your sole response must be a valid JSON array of objects, where each object has a "text" (string) and "isDone" (boolean) key. The tasks should be clear, actionable sub-steps. Do not include any other text, explanation, or markdown formatting.
    * **User Prompt:** `Task: "Build user login page"`
    * **Post-processing:** The backend must wrap the API call in a `try/catch` block, parse the response as JSON, and validate its structure before saving it to the `Card.checklist` field.

* **`summarizeList(cardTitles)`:**
    * **Action:** Called when a user clicks "Summarize List."
    * **System Prompt:** You are a helpful project manager. You will be given a JSON array of card titles from a single project list. Provide a concise, one-sentence summary (max 25 words) of the current focus of that list. Do not add any greeting or preamble.
    * **User Prompt:** `["Create login API endpoint", "Design database schema", "Add password hashing", "Fix auth bug"]`

## 9. Evaluation Metrics & Expected Outcomes
* **Real-time Performance:** "Event Latency" will be the key metric: the time from `onDragEnd` firing on Client A to the `card:moved` event being processed on Client B.
    * **Target:** < 200ms on a good connection.
* **AI Utility:** "Acceptance Rate" of AI-generated sub-tasks. We can track this by seeing how many generated lists are saved versus discarded.
* **Scalability:** We will benchmark the Socket.IO server's performance with and without the Redis adapter.
* **Expected Outcome:** A fully functional, real-time, and scalable collaborative tool. The final product will be a highly visual and impressive portfolio piece that demonstrates advanced skills in full-stack development, real-time architectures, and practical AI integration.

## 10. Challenges & Limitations
* **State Synchronization:** The single greatest challenge is ensuring the `react-beautiful-dnd` local state and the server's database state never permanently diverge. This requires robust event handling and a clear "source of truth" (the server).
* **Race Conditions / Conflicts:** If two users drag the same card at the same time, the server must gracefully handle the conflict. The simplest solution is "last write wins," where the server's database transaction logic will process one event first, and the second event will (correctly) operate on the new state.
* **Database Performance:** Re-indexing cards on every drag-and-drop (N database writes for one user action) can be slow. This must be wrapped in a MongoDB transaction. For v2, a "linked list" (`prevCardId`, `nextCardId`) or a "fractional index" schema might be considered for O(1) reordering.
* **AI Reliability:** The Gemini API may not always return perfect JSON. The backend must have robust parsing, validation, and error-handling logic to prevent bad data from being saved.

## 11. Future Improvements
* **Card Enhancements:** Add due dates, attachments (via Cloudinary), labels/tags, and user assignments.
* **Board Activity Log:** A real-time feed ("User A moved Card X to 'Done'") that is also persisted.
* **@Mentions & Comments:** A comments section on each card.
* **AI v2 (Automation):** Evolve the AI from a generator to an "automator." (e.g., "If a card is dragged to 'Done', automatically check off all its sub-tasks.").
* **P2P Architecture:** Explore a v2.0 of this project that replaces the centralized Socket.IO server with a peer-to-peer (WebRTC) architecture using CRDTs (e.g., Y.js) for conflict-free state merging and even lower latency.