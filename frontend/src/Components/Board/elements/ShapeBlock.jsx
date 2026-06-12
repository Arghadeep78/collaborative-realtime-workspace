import { useEffect, useRef } from 'react';
import { FloatBar, Sep, Swatch, Popover, TextFormatToolbar } from './SharedUI';
import { useTheme } from '../../../contexts/ThemeContext.jsx';
import { getThemeColor } from '../theme/themeUtils.js';
import { FILL_COLORS, STROKE_OPTIONS, DEFAULT_TEXT_COLOR } from '../theme/colorMap.js';

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

// ── Shape clip-path helpers ────────────────────────────────────────────────

function getShapeClipPath(type) {
  switch (type) {
    case 'circle':   return 'ellipse(48% 48% at 50% 50%)';
    case 'diamond':  return 'polygon(50% 4%, 96% 50%, 50% 96%, 4% 50%)';
    case 'triangle': return 'polygon(50% 4%, 96% 96%, 4% 96%)';
    case 'hexagon':  return 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0% 50%)';
    default:         return undefined;
  }
}

// Padding large enough to keep text in the "inscribed safe zone" for each shape
function getTextPadding(type, strokeWidth, w, h) {
  const base = Math.max(8, strokeWidth + 4);
  const s = Math.min(w, h);
  switch (type) {
    case 'circle':   return Math.max(base, s * 0.18);
    case 'diamond':  return Math.max(base, s * 0.25);
    case 'triangle': return Math.max(base, s * 0.22);
    case 'hexagon':  return Math.max(base, s * 0.12);
    default:         return base;
  }
}

// Palette arrays are imported from colorMap.js — edit there to change all UIs at once.
const SHAPES = [
  { id: 'rect', icon: '▭' },
  { id: 'roundrect', icon: '▢' },
  { id: 'circle', icon: '○' },
  { id: 'diamond', icon: '◇' },
  { id: 'triangle', icon: '△' },
  { id: 'star', icon: '☆' },
  { id: 'hexagon', icon: '⬡' },
  { id: 'arrow', icon: '→' },
];

export default function ShapeBlock({ element, editable, editing, selected, onEditProps, getScale }) {
  const { props, w, h } = element;
  const { isDark } = useTheme();
  const shapeType = props.shapeType || 'rect';
  const rawFill = props.fill ?? FILL_COLORS[0];
  const rawStroke = props.stroke ?? STROKE_OPTIONS[1].v;
  const rawTextColor = props.textColor || DEFAULT_TEXT_COLOR;
  
  const fill = getThemeColor(rawFill, isDark);
  const stroke = getThemeColor(rawStroke, isDark);
  const textColor = getThemeColor(rawTextColor, isDark);
  
  const strokeWidth = props.strokeWidth ?? 3;
  const opacity = props.opacity ?? 1;
  const text = props.text || '';
  const fontSize = props.fontSize || 28;
  const textAlign = props.textAlign || 'center';
  const bold = !!props.bold;
  const italic = !!props.italic;

  const taRef = useRef(null);
  const rootRef = useRef(null);
  useEffect(() => {
    if (editing && taRef.current) taRef.current.focus();
  }, [editing]);

  const scale = getScale?.() || 1;

  const textPadding = getTextPadding(shapeType, strokeWidth, w, h);
  // leading-snug = 1.375; compute how many lines fit in the padded safe area
  const maxLines = Math.max(1, Math.floor((h - 2 * textPadding) / (fontSize * 1.375)));

  return (
    <div ref={rootRef} className="relative w-full h-full select-none" style={{ opacity }}>
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
        className="absolute inset-0 flex items-start justify-center overflow-hidden"
        style={{
          padding: getTextPadding(shapeType, strokeWidth, w, h),
          pointerEvents: 'none',
          clipPath: getShapeClipPath(shapeType),
        }}
      >
        {editing ? (
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => onEditProps({ text: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Type text…"
            className="w-full h-full bg-transparent outline-none resize-none placeholder:text-black/25 leading-snug"
            style={{ fontSize, color: textColor, textAlign, fontWeight: bold ? 700 : 400, fontStyle: italic ? 'italic' : 'normal', pointerEvents: 'auto' }}
          />
        ) : (
          text && (
            <div
              className={`w-full leading-snug overflow-hidden whitespace-pre-wrap break-words text-content-container`}
              style={{
                fontSize, color: textColor, textAlign,
                fontWeight: bold ? 700 : 400,
                fontStyle: italic ? 'italic' : 'normal',
                maxHeight: '100%',
                pointerEvents: 'auto',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: maxLines,
              }}
            >
              {text}
            </div>
          )
        )}
      </div>

      {/* ── Text format toolbar (when editing) ────────────────────────────── */}
      {editing && (
        <TextFormatToolbar
          onEditProps={onEditProps}
          fontSize={fontSize}
          bold={bold}
          italic={italic}
          textAlign={textAlign}
          textColor={rawTextColor}
          scale={scale}
          elementY={element.y}
          anchorRef={rootRef}
        />
      )}

      {/* ── Shape style panel (when selected, not editing) ─────────────────── */}
      {selected && editable && !editing && (
        <FloatBar scale={scale} elementY={element.y} anchorRef={rootRef}>
          {/* Shape type */}
          <Popover
            title="Shape"
            activeIcon={<span className="text-[16px] leading-none">{SHAPES.find(s => s.id === shapeType)?.icon || '▭'}</span>}
          >
            <div className="grid grid-cols-4 gap-1.5 w-[144px]">
              {SHAPES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onEditProps({ shapeType: s.id })}
                  title={s.id}
                  className={`w-8 h-8 rounded-lg text-[18px] flex items-center justify-center transition leading-none ${shapeType === s.id ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-content-muted hover:bg-hover'}`}
                >{s.icon}</button>
              ))}
            </div>
          </Popover>

          <Sep />

          {/* Fill */}
          <Popover
            title="Fill Color"
            activeIcon={<Swatch color={rawFill} active={false} />}
          >
            <div className="grid grid-cols-5 gap-1.5 w-35">
              {FILL_COLORS.map((c) => (
                <Swatch key={c} color={c} active={rawFill === c} onClick={() => onEditProps({ fill: c })} />
              ))}
            </div>
          </Popover>

          <Sep />

          {/* Border */}
          <Popover
            title="Border"
            activeIcon={<Swatch color={rawStroke} transparent={rawStroke === 'transparent'} active={false} />}
          >
            <div className="flex flex-col gap-3 w-36">
              <div className="grid grid-cols-4 gap-1.5 w-[108px]">
                {STROKE_OPTIONS.map(({ v, label }) => (
                  <Swatch key={v} color={v} active={rawStroke === v} onClick={() => onEditProps({ stroke: v })} transparent={v === 'transparent'} label={label} />
                ))}
              </div>
              <div className="h-px bg-edge w-full" />
              <div className="flex flex-col gap-1 w-full">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-content-muted uppercase">Width</span>
                  <span className="text-[10px] font-bold text-content tabular-nums">{strokeWidth}px</span>
                </div>
                <input
                  type="range" min={1} max={12} step={1} value={strokeWidth}
                  onChange={(e) => onEditProps({ strokeWidth: Number(e.target.value) })}
                  className="w-full accent-blue-500"
                />
              </div>
            </div>
          </Popover>

          <Sep />

          {/* Opacity */}
          <Popover
            title="Opacity"
            activeIcon={
              <svg width="14" height="14" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="2" />
                <path d="M12 3 a9 9 0 0 1 0 18 z" fill="currentColor" />
              </svg>
            }
          >
            <div className="flex flex-col gap-2 w-32">
               <div className="flex items-center justify-between">
                 <span className="text-[10px] font-bold text-content-muted uppercase">Opacity</span>
                 <span className="text-[10px] font-bold text-content tabular-nums">{Math.round(opacity * 100)}%</span>
               </div>
               <input
                 type="range" min={0.1} max={1} step={0.05} value={opacity}
                 onChange={(e) => onEditProps({ opacity: parseFloat(e.target.value) })}
                 className="w-full accent-blue-500"
               />
            </div>
          </Popover>
        </FloatBar>
      )}
    </div>
  );
}
