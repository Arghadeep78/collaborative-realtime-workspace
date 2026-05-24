import { useEffect, useRef } from 'react';

// ── Shape geometry helpers ─────────────────────────────────────────────────

function starPoints(cx, cy, r1, r2, n = 5) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts.map((p) => p.join(',')).join(' ');
}

function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * i) / 3 - Math.PI / 6;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts.map((p) => p.join(',')).join(' ');
}

function ShapeSvg({ type, w, h, fill, stroke, strokeWidth }) {
  const sw = strokeWidth ?? 3;
  const half = sw / 2;
  const cx = w / 2;
  const cy = h / 2;
  const shared = { fill, stroke: stroke === 'transparent' ? 'none' : stroke, strokeWidth: sw, strokeLinejoin: 'round' };

  switch (type) {
    case 'circle':
      return <ellipse cx={cx} cy={cy} rx={cx - half} ry={cy - half} {...shared} />;
    case 'roundrect':
      return <rect x={half} y={half} width={w - sw} height={h - sw} rx={Math.min(w, h) * 0.15} ry={Math.min(w, h) * 0.15} {...shared} />;
    case 'diamond':
      return <polygon points={`${cx},${half} ${w - half},${cy} ${cx},${h - half} ${half},${cy}`} {...shared} />;
    case 'triangle':
      return <polygon points={`${cx},${half} ${w - half},${h - half} ${half},${h - half}`} {...shared} />;
    case 'star': {
      const r1 = Math.min(cx, cy) - half;
      return <polygon points={starPoints(cx, cy, r1, r1 * 0.42)} {...shared} />;
    }
    case 'hexagon': {
      const r = Math.min(cx, cy) - half;
      return <polygon points={hexPoints(cx, cy, r)} {...shared} />;
    }
    case 'arrow': {
      const hw = h * 0.3, hw2 = h * 0.12;
      const tip = w - half;
      const d = `M${half},${cy - hw2} L${w * 0.6},${cy - hw2} L${w * 0.6},${cy - hw} L${tip},${cy} L${w * 0.6},${cy + hw} L${w * 0.6},${cy + hw2} L${half},${cy + hw2} Z`;
      return <path d={d} {...shared} />;
    }
    default: // rect
      return <rect x={half} y={half} width={w - sw} height={h - sw} {...shared} />;
  }
}

// ── Palette helpers ────────────────────────────────────────────────────────

const FILL_COLORS = [
  '#a5b4fc', '#fca5a5', '#6ee7b7', '#fcd34d', '#f9a8d4',
  '#93c5fd', '#d1d5db', '#ffffff', '#1e293b', '#f97316',
];
const STROKE_OPTIONS = [
  { v: 'transparent', label: '×' },
  { v: '#6366f1' }, { v: '#ef4444' }, { v: '#10b981' },
  { v: '#f59e0b' }, { v: '#1e293b' }, { v: '#ffffff' },
];
const TEXT_COLORS = ['#1e293b', '#ffffff', '#6366f1', '#ef4444', '#10b981', '#f59e0b'];
const SHAPES = [
  { id: 'rect',     icon: '▭' },
  { id: 'roundrect',icon: '▢' },
  { id: 'circle',   icon: '○' },
  { id: 'diamond',  icon: '◇' },
  { id: 'triangle', icon: '△' },
  { id: 'star',     icon: '☆' },
  { id: 'hexagon',  icon: '⬡' },
  { id: 'arrow',    icon: '→' },
];

// ── Floating toolbar (counter-scaled to fixed screen size) ─────────────────

function FloatBar({ children, anchorBottom, scale }) {
  const inv = 1 / (scale || 1);
  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        ...(anchorBottom
          ? { bottom: -56 * inv, top: 'auto' }
          : { top: -56 * inv, bottom: 'auto' }),
        left: 0,
        transformOrigin: anchorBottom ? 'top left' : 'bottom left',
        transform: `scale(${inv})`,
        zIndex: 300,
        whiteSpace: 'nowrap',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl px-2.5 py-2">
        {children}
      </div>
    </div>
  );
}

const Sep = () => <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-0.5 shrink-0" />;

function Swatch({ color, active, onClick, label, transparent }) {
  return (
    <button
      onClick={onClick}
      title={label || color}
      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition shrink-0 ${active ? 'border-blue-500 scale-110' : 'border-transparent hover:border-slate-300 dark:hover:border-slate-500'}`}
      style={{ backgroundColor: transparent ? 'transparent' : color, boxShadow: '0 0 0 1px #e2e8f0 inset' }}
    >
      {transparent && <span className="text-[10px] text-slate-400 font-bold leading-none">/</span>}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ShapeBlock({ element, editable, editing, selected, onEditProps, getScale }) {
  const { props, w, h } = element;
  const shapeType  = props.shapeType  || 'rect';
  const fill       = props.fill       ?? '#a5b4fc';
  const stroke     = props.stroke     ?? '#6366f1';
  const strokeWidth= props.strokeWidth ?? 3;
  const opacity    = props.opacity    ?? 1;
  const text       = props.text       || '';
  const fontSize   = props.fontSize   || 28;
  const textColor  = props.textColor  || '#1e293b';
  const textAlign  = props.textAlign  || 'center';
  const bold       = !!props.bold;
  const italic     = !!props.italic;

  const taRef = useRef(null);
  useEffect(() => {
    if (editing && taRef.current) taRef.current.focus();
  }, [editing]);

  const scale = getScale?.() || 1;

  return (
    <div className="relative w-full h-full select-none" style={{ opacity }}>
      {/* SVG shape */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        <ShapeSvg type={shapeType} w={w} h={h} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      </svg>

      {/* Text layer */}
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{ padding: Math.max(8, strokeWidth + 4), pointerEvents: editing ? 'auto' : 'none' }}
        onPointerDown={(e) => editing && e.stopPropagation()}
      >
        {editing ? (
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => onEditProps({ text: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Type text…"
            className="w-full h-full bg-transparent outline-none resize-none placeholder:text-black/25 leading-snug"
            style={{ fontSize, color: textColor, textAlign, fontWeight: bold ? 700 : 400, fontStyle: italic ? 'italic' : 'normal' }}
          />
        ) : (
          text && (
            <div
              className="w-full whitespace-pre-wrap break-words leading-snug"
              style={{ fontSize, color: textColor, textAlign, fontWeight: bold ? 700 : 400, fontStyle: italic ? 'italic' : 'normal' }}
            >
              {text}
            </div>
          )
        )}
      </div>

      {/* ── Text format toolbar (when editing) ────────────────────────────── */}
      {editing && (
        <FloatBar scale={scale} anchorBottom={false}>
          {/* Font size */}
          <button
            onClick={() => onEditProps({ fontSize: Math.max(10, fontSize - 2) })}
            className="w-7 h-7 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-[13px] font-bold"
          >A−</button>
          <span className="text-[12px] text-slate-400 tabular-nums w-7 text-center">{fontSize}</span>
          <button
            onClick={() => onEditProps({ fontSize: Math.min(120, fontSize + 2) })}
            className="w-7 h-7 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-[13px] font-bold"
          >A+</button>
          <Sep />
          {/* Bold */}
          <button
            onClick={() => onEditProps({ bold: !bold })}
            className={`w-7 h-7 rounded-lg text-[13px] font-bold flex items-center justify-center transition ${bold ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          >B</button>
          {/* Italic */}
          <button
            onClick={() => onEditProps({ italic: !italic })}
            className={`w-7 h-7 rounded-lg text-[13px] italic font-semibold flex items-center justify-center transition ${italic ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          >I</button>
          <Sep />
          {/* Alignment */}
          {[['left','⬅'], ['center','↔'], ['right','➡']].map(([a, sym]) => (
            <button
              key={a}
              onClick={() => onEditProps({ textAlign: a })}
              className={`w-7 h-7 rounded-lg text-[11px] flex items-center justify-center transition ${textAlign === a ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              title={`Align ${a}`}
            >{sym}</button>
          ))}
          <Sep />
          {/* Text color */}
          {TEXT_COLORS.map((c) => (
            <Swatch key={c} color={c} active={textColor === c} onClick={() => onEditProps({ textColor: c })} />
          ))}
        </FloatBar>
      )}

      {/* ── Shape style panel (when selected, not editing) ─────────────────── */}
      {selected && editable && !editing && (
        <FloatBar scale={scale} anchorBottom>
          {/* Shape type */}
          {SHAPES.map((s) => (
            <button
              key={s.id}
              onClick={() => onEditProps({ shapeType: s.id })}
              title={s.id}
              className={`w-7 h-7 rounded-lg text-[16px] flex items-center justify-center transition leading-none ${shapeType === s.id ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >{s.icon}</button>
          ))}
          <Sep />
          {/* Fill */}
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Fill</span>
          {FILL_COLORS.map((c) => (
            <Swatch key={c} color={c} active={fill === c} onClick={() => onEditProps({ fill: c })} />
          ))}
          <Sep />
          {/* Stroke */}
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Border</span>
          {STROKE_OPTIONS.map(({ v, label }) => (
            <Swatch key={v} color={v} active={stroke === v} onClick={() => onEditProps({ stroke: v })} transparent={v === 'transparent'} label={label} />
          ))}
          <Sep />
          {/* Stroke width */}
          <input
            type="range" min={1} max={12} step={1} value={strokeWidth}
            onChange={(e) => onEditProps({ strokeWidth: Number(e.target.value) })}
            className="w-14 accent-blue-500"
            title="Border width"
          />
          <Sep />
          {/* Opacity */}
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Opacity</span>
          <input
            type="range" min={0.1} max={1} step={0.05} value={opacity}
            onChange={(e) => onEditProps({ opacity: parseFloat(e.target.value) })}
            className="w-14 accent-blue-500"
          />
          <span className="text-[11px] text-slate-400 tabular-nums w-8">{Math.round(opacity * 100)}%</span>
        </FloatBar>
      )}
    </div>
  );
}
