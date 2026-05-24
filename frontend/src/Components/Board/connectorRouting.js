// Orthogonal connector routing with light obstacle avoidance.
//
// Given two element rects and a set of obstacle rects, produce a right-angle
// SVG path (rounded corners) that steps out of each element and threads a
// corridor between them, preferring corridors that don't cross other elements.
// This is a pragmatic router — it enumerates a bounded set of candidate
// corridors and scores them by (crossings, length) — not a full pathfinder.

const CLEAR = 24; // how far to step out of an element before turning
const PAD = 10; // obstacle inflation so routes keep clear of edges
const RADIUS = 10; // corner rounding

const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const inflate = (r) => ({ x: r.x - PAD, y: r.y - PAD, w: r.w + 2 * PAD, h: r.h + 2 * PAD });

function sideAnchor(rect, side) {
  const c = center(rect);
  if (side === 'left') return { x: rect.x, y: c.y };
  if (side === 'right') return { x: rect.x + rect.w, y: c.y };
  if (side === 'top') return { x: c.x, y: rect.y };
  return { x: c.x, y: rect.y + rect.h }; // bottom
}

function stepOut(pt, side) {
  if (side === 'left') return { x: pt.x - CLEAR, y: pt.y };
  if (side === 'right') return { x: pt.x + CLEAR, y: pt.y };
  if (side === 'top') return { x: pt.x, y: pt.y - CLEAR };
  return { x: pt.x, y: pt.y + CLEAR };
}

// Axis-aligned segment vs rect overlap test (segments here are H or V only).
function segHitsRect(p1, p2, r) {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  return minX <= r.x + r.w && maxX >= r.x && minY <= r.y + r.h && maxY >= r.y;
}

function scoreRoute(points, obstacles) {
  let crossings = 0;
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    length += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    for (const r of obstacles) {
      if (segHitsRect(a, b, r)) { crossings++; break; }
    }
  }
  return crossings * 100000 + length;
}

function dedupe(pts) {
  return pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
}

function roundedPath(rawPts) {
  const p = dedupe(rawPts);
  if (p.length < 2) return '';
  if (p.length === 2) return `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y}`;
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let i = 1; i < p.length - 1; i++) {
    const prev = p[i - 1];
    const cur = p[i];
    const next = p[i + 1];
    const d1 = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const d2 = Math.hypot(next.x - cur.x, next.y - cur.y);
    const rr = Math.min(RADIUS, d1 / 2, d2 / 2);
    const u1 = { x: (prev.x - cur.x) / (d1 || 1), y: (prev.y - cur.y) / (d1 || 1) };
    const u2 = { x: (next.x - cur.x) / (d2 || 1), y: (next.y - cur.y) / (d2 || 1) };
    const e1 = { x: cur.x + u1.x * rr, y: cur.y + u1.y * rr };
    const e2 = { x: cur.x + u2.x * rr, y: cur.y + u2.y * rr };
    d += ` L ${e1.x.toFixed(1)} ${e1.y.toFixed(1)} Q ${cur.x} ${cur.y} ${e2.x.toFixed(1)} ${e2.y.toFixed(1)}`;
  }
  const last = p[p.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * @param {{x,y,w,h}} from
 * @param {{x,y,w,h}} to
 * @param {Array<{x,y,w,h}>} obstacles  rects to avoid (exclude from & to)
 * @returns {{ d: string, mid: {x,y} }}
 */
export function routeConnector(from, to, obstacles = []) {
  const ca = center(from);
  const cb = center(to);
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);

  const fromSide = horizontal ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top';
  const toSide = horizontal ? (dx >= 0 ? 'left' : 'right') : dy >= 0 ? 'top' : 'bottom';

  const a0 = sideAnchor(from, fromSide);
  const b0 = sideAnchor(to, toSide);
  const aOut = stepOut(a0, fromSide);
  const bOut = stepOut(b0, toSide);

  const infl = obstacles.map(inflate);

  // Candidate corridor coordinates: midpoints, the step-out lines themselves,
  // and just outside each obstacle's edges.
  const xs = new Set([(aOut.x + bOut.x) / 2, aOut.x, bOut.x]);
  const ys = new Set([(aOut.y + bOut.y) / 2, aOut.y, bOut.y]);
  for (const r of infl) {
    xs.add(r.x - 1);
    xs.add(r.x + r.w + 1);
    ys.add(r.y - 1);
    ys.add(r.y + r.h + 1);
  }

  const candidates = [];
  for (const cx of xs) candidates.push([a0, aOut, { x: cx, y: aOut.y }, { x: cx, y: bOut.y }, bOut, b0]);
  for (const cy of ys) candidates.push([a0, aOut, { x: aOut.x, y: cy }, { x: bOut.x, y: cy }, bOut, b0]);

  let best = null;
  let bestScore = Infinity;
  for (const pts of candidates) {
    const s = scoreRoute(pts, infl);
    if (s < bestScore) { bestScore = s; best = pts; }
  }
  const points = dedupe(best || [a0, b0]);

  // Delete-handle anchor: the midpoint along the corridor.
  const mid = points[Math.floor(points.length / 2)] || ca;

  return { d: roundedPath(points), mid };
}
