import { STICKY_COLORS, makeId, SLIDE_W, SLIDE_H } from './boardConstants.js';

// tldraw colour names → our pastel palette (best-effort; sticky bg only).
const COLOR_MAP = {
  yellow: '#FFF9AA',
  orange: '#FFD8BE',
  blue: '#BAE1FF',
  'light-blue': '#BAE1FF',
  green: '#BFFCC6',
  'light-green': '#BFFCC6',
  violet: '#E0BBE4',
  'light-violet': '#E0BBE4',
  red: '#FFD8BE',
  'light-red': '#FFD8BE',
};

// Extract plain text from a tldraw shape, tolerating both the old `props.text`
// string and the newer structured `props.richText` document.
function extractText(props) {
  if (!props) return '';
  if (typeof props.text === 'string') return props.text;
  const rt = props.richText;
  if (rt && Array.isArray(rt.content)) {
    const walk = (nodes) =>
      nodes
        .map((n) => (n.text ? n.text : n.content ? walk(n.content) : ''))
        .join('');
    return walk(rt.content).trim();
  }
  return '';
}

// Map one tldraw shape record → a new board element (or null to skip).
function shapeToElement(shape, pageId, createdBy) {
  const p = shape.props || {};
  const base = {
    id: makeId('el'),
    pageId,
    x: Number.isFinite(shape.x) ? shape.x : 0,
    y: Number.isFinite(shape.y) ? shape.y : 0,
    z: 1,
    createdBy,
  };
  const text = extractText(p);

  switch (shape.type) {
    case 'note':
      return {
        ...base,
        type: 'sticky',
        w: 200,
        h: 200 + (Number.isFinite(p.growY) ? p.growY : 0),
        props: { text, color: COLOR_MAP[p.color] || STICKY_COLORS[0] },
      };
    case 'text':
      return {
        ...base,
        type: 'text',
        w: Number.isFinite(p.w) ? Math.max(120, p.w) : 280,
        h: 60,
        props: { text, size: 22 },
      };
    case 'geo':
      // Boxes/frames → a Kanban card; any label becomes the card title.
      return {
        ...base,
        type: 'kanban',
        w: Number.isFinite(p.w) ? Math.max(120, p.w) : 240,
        h: Number.isFinite(p.h) ? Math.max(80, p.h) : 132,
        props: { title: text, labels: [], images: [], assignees: [], subcards: [], due: '' },
      };
    default:
      return null; // arrows, draw, lines, etc. are out of scope for Phase 2
  }
}

// Translate/scale a set of elements so their bounding box fits comfortably
// inside the fixed slide (legacy boards span an unbounded infinite canvas).
function fitToSlide(els) {
  if (els.length === 0) return els;
  const margin = 80;
  const minX = Math.min(...els.map((e) => e.x));
  const minY = Math.min(...els.map((e) => e.y));
  const maxX = Math.max(...els.map((e) => e.x + e.w));
  const maxY = Math.max(...els.map((e) => e.y + e.h));
  const bw = maxX - minX || 1;
  const bh = maxY - minY || 1;
  const scale = Math.min(1, (SLIDE_W - margin * 2) / bw, (SLIDE_H - margin * 2) / bh);
  return els.map((e) => ({
    ...e,
    x: Math.round((e.x - minX) * scale + margin),
    y: Math.round((e.y - minY) * scale + margin),
    w: Math.round(e.w * scale),
    h: Math.round(e.h * scale),
  }));
}

/**
 * One-time migration: map an existing tldraw board (records stored as JSON
 * strings in the legacy `tldraw_records` Y.Map) into the new `pages`/`elements`
 * schema. No-op unless `elements` is empty and legacy records exist.
 *
 * @returns {{ migrated: number, pageId: string }|null}
 */
export function convertLegacyBoard(ydoc, createdBy = 'import') {
  if (!ydoc) return null;
  const yElements = ydoc.getMap('elements');
  const yRecords = ydoc.getMap('tldraw_records');
  if (yElements.size > 0 || yRecords.size === 0) return null;

  // Collect convertible shapes.
  const shapes = [];
  yRecords.forEach((raw) => {
    try {
      const rec = JSON.parse(raw);
      if (rec?.typeName === 'shape') shapes.push(rec);
    } catch {
      /* skip malformed records */
    }
  });
  if (shapes.length === 0) return null;

  const yPages = ydoc.getArray('pages');
  const pageId = yPages.length ? yPages.get(0).id : makeId('page');

  const elements = fitToSlide(
    shapes.map((s) => shapeToElement(s, pageId, createdBy)).filter(Boolean),
  );
  if (elements.length === 0) return null;

  ydoc.transact(() => {
    if (yPages.length === 0) yPages.push([{ id: pageId, title: 'Imported', order: 0 }]);
    elements.forEach((el) => yElements.set(el.id, el));
  }, 'legacy-convert');

  return { migrated: elements.length, pageId };
}
