// Element glyphs shared by the radial menu (kept inline — we own our chrome).
function Glyph({ type }) {
  const c = { className: 'w-5 h-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (type === 'pointer') return <svg {...c}><path d="M3 3l7.5 18 2.3-7.2L20 11.5 3 3z" /></svg>;
  if (type === 'sticky')  return <svg {...c}><path d="M4 4h16v11l-5 5H4z" /><path d="M20 15h-5v5" /></svg>;
  if (type === 'kanban')  return <svg {...c}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h10M7 13h6" /></svg>;
  if (type === 'text')    return <svg {...c}><path d="M4 6V4h16v2M9 20h6M12 4v16" /></svg>;
  if (type === 'connector') return <svg {...c}><circle cx="5" cy="6" r="2" /><circle cx="19" cy="18" r="2" /><path d="M7 7l10 10" /></svg>;
  if (type === 'poll')    return <svg {...c}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
  if (type === 'iframe')  return <svg {...c}><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 9h18M8 14h4" /></svg>;
  if (type === 'shape')   return <svg {...c}><rect x="4" y="4" width="7" height="7" rx="1" /><circle cx="17" cy="7" r="3" /><polygon points="12,16 16,22 8,22" /></svg>;
  return null;
}

const ITEMS = [
  { type: 'pointer',   label: 'Pointer',   color: '#3b82f6' }, // blue-500
  { type: 'sticky',    label: 'Sticky',    color: '#eab308' }, // yellow-500
  { type: 'kanban',    label: 'Card',      color: '#2563eb' }, // blue-600
  { type: 'text',      label: 'Text',      color: '#7c3aed' }, // violet-600
  { type: 'connector', label: 'Connect',   color: '#059669' }, // emerald-600
  { type: 'poll',      label: 'Poll',      color: '#0284c7' }, // sky-600
  { type: 'iframe',    label: 'Web',       color: '#ea580c' }, // orange-600
  { type: 'shape',     label: 'Shape',     color: '#e11d48' }, // rose-600
];

// Arc placement — spread 8 items across a full circle.
const ANGLES = [-90, -45, 0, 45, 90, 135, 180, -135];
const RADIUS = 84;

/**
 * Double-click-empty quick-spawn. Renders at container-relative (x,y); picking
 * an option drops that element at the slide coordinates captured on open. A
 * full-bleed backdrop catches outside clicks to dismiss.
 */
export default function RadialMenu({ x, y, onPick, onClose }) {
  return (
    <div
      className="absolute inset-0 z-40 select-none"
      onPointerDown={(e) => { e.stopPropagation(); onClose(); }}
    >
      {/* Centre marker */}
      <div
        className="absolute w-2.5 h-2.5 rounded-full bg-content/70"
        style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
      />
      {ITEMS.map((item, i) => {
        const a = (ANGLES[i] * Math.PI) / 180;
        const ox = x + Math.cos(a) * RADIUS;
        const oy = y + Math.sin(a) * RADIUS;
        return (
          <button
            key={item.type}
            onPointerDown={(e) => { e.stopPropagation(); onPick(item.type); }}
            className="absolute flex flex-col items-center gap-1 group"
            style={{ left: ox, top: oy, transform: 'translate(-50%, -50%)' }}
          >
            <span
              className="w-11 h-11 rounded-full bg-surface shadow-[0_8px_24px_rgba(15,23,42,0.22)] border border-edge flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ color: item.color }}
            >
              <Glyph type={item.type} />
            </span>
            <span className="text-[10px] font-semibold text-content-muted bg-surface/80 px-1.5 rounded">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
