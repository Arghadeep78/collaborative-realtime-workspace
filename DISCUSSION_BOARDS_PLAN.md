# Discussion Boards — Frontend Rebuild Plan

> Self-contained plan for replacing the tldraw-based whiteboard frontend with a
> custom **collaborative idea discussion board**, while keeping the existing
> backend. Written to be handed to a fresh Claude session as full context.
>
> **Branch:** `discussion-boards`
> **Repo:** distributed-vector-workspace (React 19 + Vite frontend, Node/Express +
> Yjs CRDT + Redis + MongoDB backend)

---

## 1. Why this rebuild exists (read this first)

The original whiteboard mounted tldraw's **stock `<Tldraw>` UI shell** (its default
toolbar, menus, panels, styling). The result was pixel-for-pixel identical to
tldraw.com — so for an SDE portfolio it read as "a tldraw wrapper," and a reviewer
who recognizes the tldraw UI stops looking.

**The lesson — and the governing constraint for all work here:**

> The problem was **shipping a library's default UI shell**, not using libraries.
> We own **100% of the visible UI and interaction design**. Any library is used
> only for its **headless primitives / engine capability**, never its default
> components or chrome. Cherry-pick capability; ship our own interface.

Concretely for this product: the spec is a **slide-based document board**, which
needs only simple absolute positioning — no infinite zoom/pan engine. So there is
no all-in-one canvas framework worth pulling in. **We build the canvas, elements,
drag/resize, connectors, and presence ourselves.** Avoid tldraw / React Flow /
Excalidraw entirely — they would reintroduce the exact same "wrapper" criticism.

---

## 2. Key architectural finding — the backend is reusable as-is

The backend is **schema-agnostic** about board content. This was verified by tracing
the sync path:

- **`backend/crdt/WSServer.js`** is a generic Yjs-protocol WebSocket relay. It only
  does: binary sync passthrough (`MSG_SYNC` / `MSG_AWARENESS`), per-message RBAC
  (viewers can read/sync but cannot write), and Redis cross-instance delta fanout.
  It never inspects shape/element data.
- **`backend/crdt/DocumentManager.js`** loads/persists/compacts **arbitrary
  top-level Yjs shared types holding plain JSON** (write-behind persistence to Mongo,
  idle GC, history compaction). The only mention of "tldraw" in the entire backend
  is a single comment listing the current map names.
- **`backend/Controllers/AiWhiteboardControllers.js`** returns **plain text**
  (idea strings, themes, summaries) — no shapes.

**Therefore the following are reused untouched:** the Yjs WS relay, RBAC, Redis
fanout, write-behind persistence, doc GC + compaction, and the **awareness/presence
relay** (which powers the live red cursors). The Yjs map names are chosen by the
*client*; the server creates shared types by name on demand, so changing the schema
is a pure frontend change.

> Persistence note: `DocumentManager._compact` assumes every top-level type holds
> **plain JSON-safe values** (no nested Yjs types). The new schema below honors this.

---

## 3. Tech approach

- **Stack kept:** React 19, Vite, TailwindCSS v4, react-router v7, lucide-react,
  `yjs` + `y-websocket`, react-hot-toast.
- **Canvas: from scratch.** Slide is a fixed-size, relatively-positioned container;
  elements are absolutely-positioned `<div>`s driven by `{x,y,w,h}` from Yjs.
- **Allowed libraries:** only invisible/headless utilities used behind our own
  components (e.g. a date picker for Kanban due dates, optional `@use-gesture/react`
  for pointer normalization). Default: prefer raw pointer-event handlers.
- **Forbidden:** any all-in-one canvas/diagram framework (tldraw, React Flow,
  Excalidraw, etc.).
- **Transport unchanged:** `frontend/src/crdt/useYjsBoard.js` already connects a
  `Y.Doc` to `ws://<backend>/yjs/<boardId>?token=<jwt>` and exposes
  `{ ydoc, provider, synced }`. Keep it.

### Frontend pieces to build (each a focused hook/component)
- `useBoardSync` — observes the `elements` Y.Map → React state and writes local
  edits back. Replaces the tldraw store bridge; much simpler.
- `useElementDrag` / `useElementResize` — native pointer events; write `{x,y,w,h}`
  to the `elements` map, **throttled ~50ms** (same cadence as the old
  `useWhiteboardSync.js` flush).
- `Slide` / `SlideCanvas` — renders one page's elements; fixed dimensions.
- `ConnectorLayer` — SVG overlay; computes anchor points from element rects. Ship
  straight/curved edges first; obstacle-avoidance routing is a later upgrade.
- `PresenceLayer` — red laser cursors + active-team avatars from
  `provider.awareness`.
- Element components: `StickyNote`, `KanbanCard`, `TextBox`, `PollBlock`,
  `IframeWindow`.

---

## 4. New Yjs document schema (replaces tldraw records)

Plain JSON in Yjs shared types (compatible with backend compaction):

| Shared type | Yjs kind | Contents |
|---|---|---|
| `pages` | `Y.Array` | Slide list: `{ id, title, order }` *(new — multi-page/slides)* |
| `elements` | `Y.Map` | `id → { id, type, pageId, x, y, w, h, z, props, createdBy }` |
| `system` | `Y.Map` | timer (**reused from current app**) |
| `votes` | `Y.Map` | poll tallies (**reused** — backs Poll Block) |
| `comments` | `Y.Array` | comments (**reused**) |
| *(awareness)* | — | `{ user:{name,color,email}, cursor:{x,y,pageId}, tool, pageId }` |

Connectors are just elements with `type:'connector'` and
`props:{ fromId, toId, fromAnchor, toAnchor }`.

---

## 5. The product spec

### Layout — 3 panes
- **Left Sidebar (collapsible):** page/slide hierarchy. Clicking a page switches the
  active slide and loads its elements.
- **Top Utility Bar (fixed):** layout-engine toggle + element toolbar (keyboard
  shortcuts 1–6) + active-team avatars.
- **Main Canvas:** the **slide** — a discrete fixed-size page (presentation-style;
  switch between slides, not one infinite scroll). Red laser cursors of teammates
  glide over it in real time.

### Layout Engine toggle (auto-arranges elements on the active slide)
`Freeform` (manual) · `Grid` (snap-to-rows) · `Columns` (Trello/Kanban stacks)

### Element toolbar (shortcuts)
`1 Pointer` · `2 Sticky` · `3 Kanban Card` · `4 Text Box` · `5 Connector Arrow`

### The 7 core elements
1. **Sticky Note** — square pastel container (`#FFF9AA`), auto-scaling text, no
   header. Rapid brainstorming.
2. **Kanban Card** — white rounded rect, crisp borders, metadata sub-chips (assignee
   avatar, due date). Formalized execution steps.
3. **Text Box** — borderless transparent input, markdown styling. Headers /
   descriptions / instructions.
4. **Poll Block** — card with bold question, interactive voting options, progress
   bars with percentages. Backed by the `votes` map.
5. **iFrame Window** — bordered window with a platform-icon header (Figma/YouTube/
   Docs) and a live web frame. Embedding external assets/research.
6. **Node Connector** — vector line/arrow tethered to two elements' bounding boxes;
   routes around elements (routing is a later upgrade). Maps dependencies/flows.
7. **Mouse Red Pointer** — high-visibility red cursor (`#FF4A4A`) with a floating
   username tag, gliding smoothly. From awareness. Real-time collaboration.

### Interaction & control layer
- **Double-Click Radial Menu:** double-click empty canvas → quick-spawn menu to drop
  a Sticky / Kanban Card / Text Box at those exact coordinates.
- **The "Graduation" Drag:** drag a loose Sticky into a Kanban column zone → it
  converts into a Kanban Card; the sticky's text becomes the card title. (Drop-zone
  hit-testing is manual rect intersection.)
- **Smart Connection Snap:** with the Connector tool, drag from one element to
  another → line ends snap to the nearest bounding border of the target.
- **Persistent Action FAB:** floating bottom-right button for quick element insertion
  (thumb-accessible on touch).

---

## 6. Decisions locked in

- **Migration:** write a **converter** that maps existing tldraw records (notes, geo,
  text) → new elements on load. (Not a fresh-schema reset.)
- **Branch:** all work on **`discussion-boards`**.
- **Dependencies:** keep existing deps installed during the transition (they're just
  storage/transport). Remove tldraw-specific deps only once the new board fully works.
- **Canvas:** slide-based (discrete fixed-size pages), built from scratch. No
  all-in-one canvas framework.

---

## 7. Build phases

**Phase 1 — Foundation (prove multiplayer end-to-end)**
- New 3-pane shell (sidebar / top bar / slide canvas).
- `pages` + `elements` schema; `useBoardSync`.
- Sticky, Text, Kanban elements.
- Custom drag/resize (pointer events → throttled Yjs writes).
- Live red presence cursors via awareness.

**Phase 2 — Richer elements**
- Poll Block (reuses `votes`), iFrame Window, Connectors (straight edges first).
- tldraw → element converter.

**Phase 3 — Interaction polish**
- Graduation drag, layout engine (Freeform/Grid/Columns), double-click radial menu,
  FAB, connector obstacle-routing.

---

## 8. Files involved

**Frontend — to replace/rewrite** (the tldraw-coupled set):
`frontend/src/Components/Whiteboard/` → `WhiteboardRoom.jsx`, `useWhiteboardSync.js`,
`ContextToolbar.jsx`, `CustomGrid.jsx`, `CustomStylePanel.jsx`, `FixedNoteShapeUtil.js`,
`Overlays.jsx`, `AIPanel.jsx`, plus tldraw bits in `whiteboardConstants.js`.

**Frontend — keep:** `frontend/src/crdt/useYjsBoard.js` (transport),
`TopBar.jsx`/`LeftToolbar.jsx`/`ShareModal.jsx` (reuse/restyle as needed), auth /
dashboard / profile components.

**Backend — no changes required** (optionally update the stale comment in
`backend/crdt/DocumentManager.js`). AI endpoints in `AiWhiteboardControllers.js`
return plain text and are reused; the frontend `AIPanel` rewrite just renders AI
output as new elements instead of tldraw shapes.
