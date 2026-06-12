// ─────────────────────────────────────────────────────────────────────────────
// Discussion Board — shared constants & design tokens
//
// This module is intentionally self-contained (no tldraw imports). Everything
// the custom canvas needs — slide geometry, the element registry, presence
// colour, and the Tailwind class tokens for our own chrome — lives here.
// ─────────────────────────────────────────────────────────────────────────────

import * as Y from 'yjs';
import {
  STICKY_COLORS as _STICKY_COLORS,
  AVATAR_COLORS,
  FILL_COLORS,
  STROKE_OPTIONS,
  DEFAULT_TEXT_COLOR,
} from './theme/colorMap.js';

// A slide is a discrete, fixed-size page (presentation-style 16:9). The canvas
// scales this rectangle to fit the viewport; all element coordinates are in
// these "slide units", independent of zoom.
export const SLIDE_W = 3600;
export const SLIDE_H = SLIDE_W * 9 / 16;

// High-visibility laser-pointer red for live teammate cursors.
export const PRESENCE_RED = '#FF4A4A';

// A stable-ish per-session colour for this user's avatar / name tag.
// Palette source of truth is colorMap.js (shared with task-card avatars).
export const myColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

// Pastel options for sticky notes — source of truth is colorMap.js.
export const STICKY_COLORS = _STICKY_COLORS;

// Element toolbar — keyboard shortcuts 1–8 + L. The connector tool puts the
// canvas into "link mode"; the laser tool broadcasts a glowing pointer to peers.
export const TOOLS = [
  { id: 'pointer',   key: '1', label: 'Pointer' },
  { id: 'sticky',    key: '2', label: 'Sticky Note' },
  { id: 'task',      key: '3', label: 'Task Card' },
  { id: 'text',      key: '4', label: 'Text Box' },
  { id: 'connector', key: '5', label: 'Connector' },
  { id: 'poll',      key: '6', label: 'Poll Block' },
  { id: 'iframe',    key: '7', label: 'iFrame Window' },
  { id: 'shape',     key: '8', label: 'Shape' },
  { id: 'media',     key: '9', label: 'Media' },
  { id: 'laser',     key: 'L', label: 'Laser Pointer' },
];

// Layout-engine modes (auto-arrange the active slide). Grid additionally snaps
// dragging to a grid step; Columns groups elements into Trello-style stacks.
export const LAYOUT_MODES = [
  { id: 'freeform', label: 'Freeform' },
  { id: 'grid', label: 'Grid' },
  { id: 'columns', label: 'Columns' },
];

// Snap step (slide units) used by the Grid layout while dragging.
export const GRID_STEP = 20;

// Spawn defaults per element type. `props` holds the type-specific payload that
// the element component renders. Everything here is plain JSON (no nested Yjs
// types) so the backend's history compaction stays happy.
export const ELEMENT_DEFAULTS = {
  sticky: { w: 260, h: 260, props: { text: '', color: STICKY_COLORS[0] } },
  task: {
    w: 160, h: 56,
    props: {
      title: '', description: '', status: 'todo', priority: 'medium',
      assignees: [], dueDate: '', checklist: [],
    },
  },
  text: { w: 380, h: 80, props: { text: '', size: 34 } },
  poll: {
    w: 380,
    h: 300,
    props: {
      configured: false,
      question: '',
      multiChoice: false,
      options: [
        { id: 'o1', label: 'Option 1' },
        { id: 'o2', label: 'Option 2' },
      ],
    },
  },
  iframe: { w: 440, h: 300, props: { url: '', title: '' } },
  media: { w: 400, h: 300, props: { url: '', mediaType: 'image', caption: '' } },
  shape: {
    w: 220, h: 180,
    props: {
      shapeType: 'rect',
      fill: FILL_COLORS[0],          // '#a5b4fc'
      stroke: STROKE_OPTIONS[1].v,   // '#6366f1' (index 0 is transparent)
      strokeWidth: 3,
      opacity: 1,
      text: '',
      fontSize: 28,
      textColor: DEFAULT_TEXT_COLOR, // '#1e293b'
      textAlign: 'center',
      bold: false,
      italic: false,
    },
  },
};

// Tools that drop a fresh element where the user clicks empty canvas. Connector
// and laser are excluded — they don't spawn persistent elements.
export const SPAWN_TOOLS = ['sticky', 'task', 'text', 'poll', 'iframe', 'shape', 'media'];

export const MIN_W = 80;
export const MIN_H = 48;
export const MIN_FONT = 8;

// Per-element-type resize floors. Elements below these sizes become unreadable.
export const ELEMENT_MIN_DIMS = {
  poll: { minW: 260, minH: 220 },
  // Task card size is defined once on ELEMENT_DEFAULTS.task (w/h); the resize
  // floor reuses it so there's a single source of truth.
  task: { minW: ELEMENT_DEFAULTS.task.w, minH: ELEMENT_DEFAULTS.task.h },
};

// How often live drag/resize positions are flushed to Yjs during a continuous
// gesture — matches the old whiteboard's 50ms (~20fps) socket cadence.
export const FLUSH_MS = 50;

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const makeId = (prefix = 'el') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// Convenience: pull the top-level shared types this board uses. Names are
// chosen by the client; the server creates them on demand.
//
// `comments` mirrors the `votes` shape: a Y.Map keyed by elementId, each value
// a nested Y.Map keyed by commentId → comment record. The nested-Map structure
// lets concurrent commenters merge cleanly, and the backend's history
// compaction preserves nested Yjs types (see DocumentManager._compactState).
export const getBoardTypes = (ydoc) => ({
  yPages: ydoc.getArray('pages'),
  ySections: ydoc.getArray('sections'),
  yElements: ydoc.getMap('elements'),
  ySystem: ydoc.getMap('system'),
  yVotes: ydoc.getMap('votes'),
  yComments: ydoc.getMap('comments'),
});

// Element types that support threaded comments (toolbar tools 2,3,4,6,7,8 —
// sticky, task, text, poll, iframe, shape). Connectors, media, laser excluded.
export const COMMENTABLE_TYPES = ['sticky', 'task', 'text', 'poll', 'iframe', 'shape'];

// Re-exported so call sites don't each import yjs just for an origin tag.
// export const Yjs = Y;

// Transaction origin tag for this client's own edits. The per-user UndoManager
// tracks only this origin, so each browser can undo solely the work it authored
// (remote peers' transactions carry the provider's origin and are left alone).
export const LOCAL_ORIGIN = 'board-local';

// ── Tailwind tokens for our own chrome (glassy surfaces, buttons, inputs) ────
export const UI = {
  surface:
    'bg-surface/90 border border-edge shadow-[0_16px_40px_rgba(12,18,36,0.12)] backdrop-blur-xl',
  surfaceSolid:
    'bg-surface border border-edge shadow-[0_16px_40px_rgba(12,18,36,0.12)]',
  iconBtn:
    'inline-flex items-center justify-center w-9 h-9 rounded-xl border border-edge bg-muted text-content-muted transition hover:bg-hover hover:text-content',
  iconBtnActive:
    'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/50',
  primaryBtn:
    'bg-gradient-to-br from-[#4262ff] to-[#2f49e7] text-white border border-blue-400/40 shadow-[0_12px_28px_rgba(66,98,255,0.28)] hover:brightness-95 transition',
  input:
    'bg-muted border border-edge rounded-xl px-3 py-2 text-content focus:outline-none focus:border-blue-500/70 focus:ring-4 focus:ring-blue-500/15 transition',
  chip:
    'bg-muted border border-edge text-content-muted text-[10px] font-bold tracking-[0.16em] uppercase rounded-full px-2 py-0.5',
  logo: 'font-bold text-[1.05rem] tracking-[-0.03em] text-content',
  lite: 'bg-amber-200/60 dark:bg-amber-900/40 text-amber-950 dark:text-amber-300 border border-amber-300/70 dark:border-amber-700/60 rounded-full text-[9px] font-bold tracking-[0.2em] uppercase px-2 py-0.5',
};

export const boardShellClass =
  'fixed inset-0 w-screen h-screen overflow-hidden bg-app [background:radial-gradient(1200px_540px_at_10%_-15%,rgba(66,98,255,0.2),transparent_65%),radial-gradient(900px_420px_at_90%_0%,rgba(0,167,116,0.15),transparent_60%),radial-gradient(700px_360px_at_40%_110%,rgba(255,204,102,0.18),transparent_65%)] dark:[background:radial-gradient(1200px_540px_at_10%_-15%,rgba(66,98,255,0.12),transparent_65%),radial-gradient(900px_420px_at_90%_0%,rgba(0,167,116,0.08),transparent_60%),radial-gradient(700px_360px_at_40%_110%,rgba(255,204,102,0.08),transparent_65%),#0f172a] [&_button]:cursor-pointer';
