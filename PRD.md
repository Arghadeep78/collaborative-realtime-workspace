# Product Requirements Document — Collaborative Realtime Workspace

**Vision:** A seamless, real-time workspace where distributed teams ideate and organize together on a shared, multi-page canvas — sticky notes, Kanban cards, polls, connectors, and embeds — with changes appearing instantly and conflict-free for everyone.

This document describes the product as built. Backend design and scaling concerns live in [architecture.md](architecture.md).

---

## 1. The Canvas

- **Multi-page boards.** A board is a sequence of fixed-size **slides** (16:9, 1600×900 "slide units"). Pages can be added, renamed, reordered, and navigated. Element coordinates are stored in slide units so rendering is zoom-independent.
- **Navigation.** Pan and zoom the slide; the canvas scales the slide rectangle to fit the viewport.
- **Selection.** Click to select a single element; drag on empty canvas for **marquee** multi-select.
- **Layout modes.** *Freeform* (place anywhere), *Grid* (snap dragging to a grid step), and *Columns* (group elements into Trello-style stacks).
- **Layering.** Explicit z-order control via a right-click context menu — bring to front / send to back / forward / backward. Z-order is an integer model; selecting an element does not auto-raise it. Concurrent reorders use a deterministic elementId tiebreak to converge consistently across clients.

---

## 2. Element Library

Each element is plain JSON (`type`, position, size, and a type-specific `props` payload) so it merges cleanly through the CRDT layer.

| Element | Purpose |
|---|---|
| **Sticky note** | Core brainstorming primitive; text with a pastel color palette. |
| **Kanban card** | Title, labels, assignees, sub-cards, images, and a due date. |
| **Text box** | Free-standing text with adjustable size. |
| **Connector** | Links two elements; reroutes as elements move. |
| **Poll block** | Inline poll with options and tallied votes. |
| **iFrame window** | Embed external web content. |
| **Shape** | Basic shapes for diagramming and grouping. |
| **Media block** | Uploaded image / video / audio (stored via Cloudinary). |

A **laser pointer** tool broadcasts a transient glowing pointer to peers via the Yjs Awareness protocol for presentations.

---

## 3. Real-Time Collaboration

- **Instant sync.** Every add, move, resize, edit, and delete propagates to all collaborators over WebSockets, backed by Yjs CRDTs — concurrent edits merge automatically with no central locking.
- **Live presence.** Teammate cursors render in real time with name tags and per-user colors. Cursor positions are broadcast via the Yjs Awareness protocol and are ephemeral (not persisted).
- **Resilient canvas.** After a transient network disconnect, the canvas stays mounted and re-syncs automatically on reconnect — no blank-board flash.
- **Correct state after compaction.** The shared document rehydrates correctly after server-side history compaction, including nested CRDT types such as the per-element `votes` and `comments` maps.

---

## 4. Comments & Voting

- Leave threaded comments on any board element for asynchronous discussion. Comments are stored as nested Y.Maps (`yComments[elementId][commentId]`), so concurrent comments on the same element merge without conflict.
- Cast votes on poll blocks. Votes are stored as nested Y.Maps (`yVotes[pollId][voterEmail]`), so concurrent votes from different users are additive and never collide.

---

## 5. Sharing & Access Control

- **Roles:** *Viewer* (read-only canvas), *Commenter* (read + comment + vote), *Editor* (full read/write).
- **Enforcement:** Roles are enforced server-side on every Yjs sync message in `WSServer.js`. A viewer cannot mutate a board even by crafting a raw WebSocket frame — the update bytes are discarded before reaching `Y.applyUpdate`, not just blocked in the UI.
- **Link sharing & invites:** Owners share by link or by emailing collaborators directly, and can change or revoke a collaborator's role at any time. Metadata cache is invalidated immediately on role changes.
- **Workspace sharing:** Workspace members receive a baseline `viewer` role on all boards in the workspace, overridden by any explicit collaborator role.
- **Publishing:** A board can be published to a read-only public view. The snapshot is produced asynchronously via a BullMQ worker off the request path.

---

## 6. AI Brainstorming

- An AI panel (Google Gemini) supports generating ideas, expanding an idea, and summarizing a board.
- AI calls are hardened with a 10 s timeout, exponential-backoff retries, and a circuit breaker so an upstream outage degrades gracefully rather than hanging the app.

---

## 7. Accounts & Dashboard

- **Auth:** Email/password and Google OAuth 2.0, with JWT access/refresh tokens.
- **Dashboard:** Lists the user's boards and workspaces; create, open, rename, delete, and move boards from one place.
- **Workspaces:** Group boards; workspace members get baseline viewer access to all boards.
- **Profile:** User profile with avatar handling (Cloudinary).

---

## 8. Non-Functional Requirements

- **Horizontal scalability** behind a load balancer — Yjs document deltas cross-synced via Redis pub/sub; rate-limit counters and board-metadata cache shared in Redis across instances.
- **Operational readiness:** `GET /health` (MongoDB + Redis) and `GET /ready` (+ BullMQ worker check) probes, distributed rate limiting (3 tiers), board-metadata caching (60 s TTL), and graceful shutdown.
- **Low-latency sync** as the primary experience metric — WebSocket path touches only in-memory Y.Doc; database is off the hot sync path.
- **Data durability** — write-behind persistence with dirty-flag cleared only after durable BullMQ enqueue; worker failures re-mark dirty for retry.

See [architecture.md](architecture.md) for implementation details.
