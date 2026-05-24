# Product Requirements Document — Collaborative Realtime Workspace

**Vision:** A seamless, real-time workspace where distributed teams ideate and organize together on a shared, multi-page canvas — sticky notes, Kanban cards, polls, connectors, and embeds — with changes appearing instantly and conflict-free for everyone.

This document describes the product as built. Backend design and scaling concerns live in [architecture.md](architecture.md).

---

## 1. The Canvas

- **Multi-page boards.** A board is a sequence of fixed-size **slides** (16:9, 1600×900 "slide units"). Pages can be added, reordered, and navigated. Element coordinates are stored in slide units so rendering is zoom-independent.
- **Navigation.** Pan and zoom the slide; the canvas scales the slide rectangle to fit the viewport.
- **Selection.** Click to select a single element; drag on empty canvas for **marquee** multi-select.
- **Layout modes.** *Freeform* (place anywhere), *Grid* (snap dragging to a grid step), and *Columns* (group elements into Trello-style stacks).
- **Layering.** Explicit z-order control via a right-click context menu — bring to front / send to back / forward / backward. Z-order is an integer model; selecting an element does not auto-raise it.

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

A **laser pointer** tool broadcasts a transient glowing pointer to peers for presentations.

---

## 3. Real-Time Collaboration

- **Instant sync.** Every add, move, resize, edit, and delete propagates to all collaborators over WebSockets, backed by Yjs CRDTs — concurrent edits merge automatically with no central locking.
- **Live presence.** Teammate cursors render in real time with name tags and per-user colors.
- **Resilient state.** The shared document is rehydrated correctly even after server-side history compaction, including nested CRDT types such as the per-element `votes` map.

---

## 4. Comments & Voting

- Leave comments on board elements for asynchronous discussion.
- Upvote / downvote ideas (poll blocks and elements) to support async decision-making.

---

## 5. Sharing & Access Control

- **Roles:** *Viewer* (read-only), *Commenter* (read + comment), *Editor* (full read/write).
- **Enforcement:** Roles are enforced server-side on every Yjs sync message — a viewer cannot mutate a board even by crafting a raw WebSocket frame, not just through a disabled UI.
- **Link sharing & invites:** Owners share by link or by emailing collaborators, and can change or revoke a collaborator's role at any time.
- **Publishing:** A board can be published to a read-only public view; the snapshot is produced asynchronously off the request path.

---

## 6. AI Brainstorming

- An AI panel (Google Gemini) supports generating ideas, expanding an idea, and summarizing a board.
- AI calls are hardened with timeouts, retries, and a circuit breaker so an upstream outage degrades gracefully rather than hanging the app.

---

## 7. Accounts & Dashboard

- **Auth:** Email/password and Google OAuth 2.0, with JWT access/refresh tokens.
- **Dashboard:** Lists the user's boards and workspaces; create, open, and manage boards from one place.
- **Profile:** User profile with avatar handling.

---

## 8. Non-Functional Requirements

- **Horizontal scalability** behind a load balancer (Redis-backed pub/sub and shared state across instances).
- **Operational readiness:** health/readiness probes, distributed rate limiting, board-metadata caching, and graceful shutdown.
- **Low-latency sync** as the primary experience metric for live collaboration.

See [architecture.md](architecture.md) for how these are implemented.
</content>
