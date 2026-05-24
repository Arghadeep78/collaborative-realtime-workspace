// ─────────────────────────────────────────────────────────────────────────────
// Discussion Board — shared constants & design tokens
//
// This module is intentionally self-contained (no tldraw imports). Everything
// the custom canvas needs — slide geometry, the element registry, presence
// colour, and the Tailwind class tokens for our own chrome — lives here.
// ─────────────────────────────────────────────────────────────────────────────

import * as Y from 'yjs';

// A slide is a discrete, fixed-size page (presentation-style 16:9). The canvas
// scales this rectangle to fit the viewport; all element coordinates are in
// these "slide units", independent of zoom.
export const SLIDE_W = 1600;
export const SLIDE_H = 900;

// High-visibility laser-pointer red for live teammate cursors.
export const PRESENCE_RED = '#FF4A4A';

// A stable-ish per-session colour for this user's avatar / name tag.
const PALETTE = ['#e0457b', '#0b69ff', '#0a9d62', '#f5821f', '#7c4dff', '#0bb4c4'];
export const myColor = PALETTE[Math.floor(Math.random() * PALETTE.length)];

// Pastel options for sticky notes (matching the premium Poll Block palette).
export const STICKY_COLORS = ['#fdf4c8', '#d3f1df', '#cce0ff', '#fdedd8', '#ffdce0', '#e8dffe'];

// Element toolbar — keyboard shortcuts 1–8 + L. The connector tool puts the
// canvas into "link mode"; the laser tool broadcasts a glowing pointer to peers.
export const TOOLS = [
  { id: 'pointer',   key: '1', label: 'Pointer' },
  { id: 'sticky',    key: '2', label: 'Sticky Note' },
  { id: 'kanban',    key: '3', label: 'Kanban Card' },
  { id: 'text',      key: '4', label: 'Text Box' },
  { id: 'connector', key: '5', label: 'Connector' },
  { id: 'poll',      key: '6', label: 'Poll Block' },
  { id: 'iframe',    key: '7', label: 'iFrame Window' },
  { id: 'shape',     key: '8', label: 'Shape' },
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
  kanban: { w: 380, h: 340, props: { title: '', labels: [], images: [], assignees: [], subcards: [], due: '' } },
  text: { w: 380, h: 80, props: { text: '', size: 34 } },
  poll: {
    w: 380,
    h: 300,
    props: {
      question: '',
      options: [
        { id: 'o1', label: 'Option 1' },
        { id: 'o2', label: 'Option 2' },
      ],
    },
  },
  iframe: { w: 440, h: 300, props: { url: '', title: '' } },
  shape: {
    w: 220, h: 180,
    props: {
      shapeType: 'rect',
      fill: '#a5b4fc',
      stroke: '#6366f1',
      strokeWidth: 3,
      opacity: 1,
      text: '',
      fontSize: 28,
      textColor: '#1e293b',
      textAlign: 'center',
      bold: false,
      italic: false,
    },
  },
};

// Tools that drop a fresh element where the user clicks empty canvas. Connector
// and laser are excluded — they don't spawn persistent elements.
export const SPAWN_TOOLS = ['sticky', 'kanban', 'text', 'poll', 'iframe', 'shape'];

export const MIN_W = 80;
export const MIN_H = 48;

// How often live drag/resize positions are flushed to Yjs during a continuous
// gesture — matches the old whiteboard's 50ms (~20fps) socket cadence.
export const FLUSH_MS = 50;

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const makeId = (prefix = 'el') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// Convenience: pull the four top-level shared types this board uses. Names are
// chosen by the client; the server creates them on demand.
export const getBoardTypes = (ydoc) => ({
  yPages: ydoc.getArray('pages'),
  yElements: ydoc.getMap('elements'),
  ySystem: ydoc.getMap('system'),
  yVotes: ydoc.getMap('votes'),
});

// Re-exported so call sites don't each import yjs just for an origin tag.
export const Yjs = Y;

// ── Tailwind tokens for our own chrome (glassy surfaces, buttons, inputs) ────
export const UI = {
  surface:
    'bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 shadow-[0_16px_40px_rgba(12,18,36,0.12)] backdrop-blur-xl',
  surfaceSolid:
    'bg-white/95 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 shadow-[0_16px_40px_rgba(12,18,36,0.12)]',
  iconBtn:
    'inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-900/5 dark:bg-white/5 text-slate-500 dark:text-slate-400 transition hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100',
  iconBtnActive:
    'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/50',
  primaryBtn:
    'bg-gradient-to-br from-[#4262ff] to-[#2f49e7] text-white border border-blue-400/40 shadow-[0_12px_28px_rgba(66,98,255,0.28)] hover:brightness-95 transition',
  input:
    'bg-slate-50/90 dark:bg-slate-700/80 border border-slate-900/10 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500/70 focus:ring-4 focus:ring-blue-500/15 transition',
  chip:
    'bg-slate-900/5 dark:bg-white/10 border border-slate-900/10 dark:border-white/10 text-slate-500 dark:text-slate-400 text-[10px] font-bold tracking-[0.16em] uppercase rounded-full px-2 py-0.5',
  logo: 'font-bold text-[1.05rem] tracking-[-0.03em] text-slate-900 dark:text-slate-100',
  lite: 'bg-amber-200/60 dark:bg-amber-900/40 text-amber-950 dark:text-amber-300 border border-amber-300/70 dark:border-amber-700/60 rounded-full text-[9px] font-bold tracking-[0.2em] uppercase px-2 py-0.5',
};

export const boardShellClass =
  'fixed inset-0 w-screen h-screen overflow-hidden bg-slate-50 dark:bg-[#212121] [background:radial-gradient(1200px_540px_at_10%_-15%,rgba(66,98,255,0.2),transparent_65%),radial-gradient(900px_420px_at_90%_0%,rgba(0,167,116,0.15),transparent_60%),radial-gradient(700px_360px_at_40%_110%,rgba(255,204,102,0.18),transparent_65%)] dark:[background:radial-gradient(1200px_540px_at_10%_-15%,rgba(66,98,255,0.12),transparent_65%),radial-gradient(900px_420px_at_90%_0%,rgba(0,167,116,0.08),transparent_60%),radial-gradient(700px_360px_at_40%_110%,rgba(255,204,102,0.08),transparent_65%),#212121] [&_button]:cursor-pointer';
