import { SLIDE_W, SLIDE_H } from './boardConstants.js';
import { routeConnector } from './connectorRouting.js';

// Point where the ray from a rect's centre in direction (dx,dy) crosses its
// border — used only for the dashed rubber-band while linking.
function borderPoint(cx, cy, hw, hh, dx, dy) {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < 1e-6 && ady < 1e-6) return { x: cx, y: cy };
  const s = Math.min(adx ? hw / adx : Infinity, ady ? hh / ady : Infinity);
  return { x: cx + dx * s, y: cy + dy * s };
}

const centerOf = (el) => ({ x: el.x + el.w / 2, y: el.y + el.h / 2 });

/**
 * SVG overlay (in slide coordinates) drawing connectors as orthogonal,
 * obstacle-avoiding paths between elements, plus a dashed rubber-band while a
 * link is in progress. The <svg> itself is click-through; only the per-edge
 * hit-strokes capture clicks (for selection), and only when the pointer tool is
 * active so link-mode clicks pass to the elements underneath.
 */
export default function ConnectorLayer({
  connectors,
  elements,
  obstacles = [],
  editable,
  selectable,
  selectedId,
  onSelect,
  onDelete,
  pending,
  scale,
}) {
  const ARROW = '#475569';
  const SELECTED = '#2563eb';
  const inv = 1 / (scale || 1);

  // Resolve drawable edges (skip dangling connectors whose endpoints vanished).
  // Each edge routes around the other elements on the slide.
  const edges = connectors
    .map((c) => {
      const from = elements[c.props?.fromId];
      const to = elements[c.props?.toId];
      if (!from || !to) return null;
      const avoid = obstacles.filter((o) => o.id !== from.id && o.id !== to.id);
      const { d, mid } = routeConnector(from, to, avoid);
      return { id: c.id, d, mid };
    })
    .filter(Boolean);

  // Rubber-band: source border → live pointer.
  let pendingLine = null;
  if (pending && pending.point) {
    const from = elements[pending.fromId];
    if (from) {
      const a = centerOf(from);
      const dx = pending.point.x - a.x;
      const dy = pending.point.y - a.y;
      const p1 = borderPoint(a.x, a.y, from.w / 2, from.h / 2, dx, dy);
      pendingLine = { p1, p2: pending.point };
    }
  }

  return (
    <>
      <svg
        className="absolute inset-0 overflow-visible"
        width={SLIDE_W}
        height={SLIDE_H}
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <marker id="arrow-default" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill={ARROW} />
          </marker>
          <marker id="arrow-selected" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill={SELECTED} />
          </marker>
        </defs>

        {edges.map((e) => {
          const sel = selectedId === e.id;
          return (
            <g key={e.id}>
              {/* Visible edge */}
              <path
                d={e.d}
                fill="none"
                stroke={sel ? SELECTED : ARROW}
                strokeWidth={sel ? 3 : 2.25}
                strokeLinejoin="round"
                markerEnd={`url(#arrow-${sel ? 'selected' : 'default'})`}
              />
              {/* Fat invisible hit target (pointer-tool selection only) */}
              {selectable && (
                <path
                  d={e.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onPointerDown={(ev) => { ev.stopPropagation(); onSelect(e.id); }}
                />
              )}
            </g>
          );
        })}

        {pendingLine && (
          <line
            x1={pendingLine.p1.x} y1={pendingLine.p1.y}
            x2={pendingLine.p2.x} y2={pendingLine.p2.y}
            stroke={SELECTED}
            strokeWidth={2}
            strokeDasharray="6 5"
            markerEnd="url(#arrow-selected)"
          />
        )}
      </svg>

      {/* Delete handle for the selected connector (HTML, counter-scaled) */}
      {editable && selectedId &&
        edges
          .filter((e) => e.id === selectedId)
          .map((e) => (
            <button
              key={`del-${e.id}`}
              onPointerDown={(ev) => ev.stopPropagation()}
              onClick={(ev) => { ev.stopPropagation(); onDelete(e.id); }}
              className="absolute w-6 h-6 rounded-full bg-rose-500 text-white shadow-md flex items-center justify-center hover:bg-rose-600 transition"
              style={{
                left: e.mid.x,
                top: e.mid.y,
                transform: `translate(-50%, -50%) scale(${inv})`,
                zIndex: 2000,
              }}
              title="Delete connector"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          ))}
    </>
  );
}
