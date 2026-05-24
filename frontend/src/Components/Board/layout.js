import { GRID_STEP, SLIDE_W } from './boardConstants.js';

// Auto-arrange geometry. All functions take the active slide's non-connector
// elements and return a list of `{ id, x, y }` position updates (never mutating
// inputs); connectors re-derive their geometry from element rects, so they are
// excluded by the caller. Every layout keeps elements within the slide's width
// so nothing is pushed off the page.

const MARGIN = 60; // gap from the slide's top-left when arranging
const GAP = 28; // gap between cells / stacked cards

export const snap = (v, step = GRID_STEP) => Math.round(v / step) * step;

/**
 * Tidy elements into a squarish grid that fits the slide width, preserving rough
 * reading order. The number of columns is capped so the grid block never spills
 * past the slide's right edge, then the block is centred horizontally.
 */
export function arrangeGrid(els) {
  if (els.length === 0) return [];
  const ordered = [...els].sort((a, b) => a.y - b.y || a.x - b.x);
  const cellW = Math.max(...ordered.map((e) => e.w));
  const cellH = Math.max(...ordered.map((e) => e.h));
  const usableW = SLIDE_W - 2 * MARGIN;
  // Most columns that fit the slide width…
  const fitCols = Math.max(1, Math.floor((usableW + GAP) / (cellW + GAP)));
  // …but stay squarish for small counts.
  const cols = Math.min(fitCols, Math.max(1, Math.ceil(Math.sqrt(ordered.length))));
  const blockW = cols * cellW + (cols - 1) * GAP;
  const startX = Math.max(MARGIN, Math.round((SLIDE_W - blockW) / 2));
  return ordered.map((e, i) => ({
    id: e.id,
    x: startX + (i % cols) * (cellW + GAP),
    y: MARGIN + Math.floor(i / cols) * (cellH + GAP),
  }));
}

/**
 * Group elements by type into vertical Trello-style stacks — one column per
 * type, cards stacked top-to-bottom in their current order. Columns are spread
 * across equal-width slots that span the slide, so the stacks always stay on the
 * page regardless of how many types are present.
 */
export function arrangeColumns(els) {
  if (els.length === 0) return [];
  const order = ['sticky', 'kanban', 'text', 'poll', 'iframe'];
  const groups = {};
  els.forEach((e) => {
    (groups[e.type] ||= []).push(e);
  });
  const types = order.filter((t) => groups[t]?.length);
  if (types.length === 0) return [];

  const slotW = (SLIDE_W - 2 * MARGIN) / types.length;
  const updates = [];
  types.forEach((t, ci) => {
    const col = groups[t].sort((a, b) => a.y - b.y);
    const slotX = MARGIN + ci * slotW;
    let y = MARGIN;
    col.forEach((e) => {
      // Centre each card within its column slot.
      updates.push({ id: e.id, x: Math.round(slotX + (slotW - e.w) / 2), y: Math.round(y) });
      y += e.h + GAP;
    });
  });
  return updates;
}

export function arrangeElements(els, mode) {
  if (mode === 'grid') return arrangeGrid(els);
  if (mode === 'columns') return arrangeColumns(els);
  return [];
}
