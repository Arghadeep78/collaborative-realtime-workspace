// Element glyphs shared by the radial menu (kept inline — we own our chrome).
function Glyph({ type }) {
  const c = { className: 'w-5 h-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (type === 'sticky')  return <svg {...c}><path d="M4 4h16v11l-5 5H4z" /><path d="M20 15h-5v5" /></svg>;
  if (type === 'kanban')  return <svg {...c}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h10M7 13h6" /></svg>;
  if (type === 'shape')   return <svg {...c}><rect x="4" y="4" width="7" height="7" rx="1" /><circle cx="17" cy="7" r="3" /><polygon points="12,16 16,22 8,22" /></svg>;
  return <svg {...c}><path d="M4 6V4h16v2M9 20h6M12 4v16" /></svg>; // text
}

const ITEMS = [
  { type: 'sticky', label: 'Sticky',  color: '#eab308' },
  { type: 'kanban', label: 'Card',    color: '#2563eb' },
  { type: 'text',   label: 'Text',    color: '#7c3aed' },
  { type: 'shape',  label: 'Shape',   color: '#e11d48' },
];

// Arc placement — spread 4 items across the upper semicircle.
const ANGLES = [-160, -105, -75, -20];
const RADIUS = 72;

/**
 * Double-click-empty quick-spawn. Renders at container-relative (x,y); picking
 * an option drops that element at the slide coordinates captured on open. A
 * full-bleed backdrop catches outside clicks to dismiss.
 */
export default function RadialMenu({ x, y, onPick, onClose }) {
  return (
    <div
      className="absolute inset-0 z-40"
      onPointerDown={(e) => { e.stopPropagation(); onClose(); }}
    >
      {/* Centre marker */}
      <div
        className="absolute w-2.5 h-2.5 rounded-full bg-slate-900/70 dark:bg-white/70"
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
              className="w-11 h-11 rounded-full bg-white dark:bg-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.22)] border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ color: item.color }}
            >
              <Glyph type={item.type} />
            </span>
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 px-1.5 rounded">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
