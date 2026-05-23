import { useState, useEffect, useRef } from 'react';
import { DefaultFontStyle, DefaultTextAlignStyle } from '@tldraw/tlschema';
import { UI, GRID_COLORS } from './whiteboardConstants.js';

// Which control groups appear for each tool
const TOOL_CAPS = {
  draw:    { color: true, weight: true,  stroke: true,  shapes: false, fill: false, font: false, textSize: false, align: false },
  geo:     { color: true, weight: true,  stroke: true,  shapes: true,  fill: true,  font: false, textSize: false, align: false },
  line:    { color: true, weight: true,  stroke: true,  shapes: false, fill: false, font: false, textSize: false, align: false },
  arrow:   { color: true, weight: true,  stroke: true,  shapes: false, fill: false, font: false, textSize: false, align: false },
  text:    { color: true, weight: false, stroke: false, shapes: false, fill: false, font: true,  textSize: true,  align: true  },
  note:    { color: true, weight: false, stroke: false, shapes: false, fill: false, font: false, textSize: false, align: false },
};

const SHAPES = [
  { id: 'rectangle', path: <rect x="2" y="2" width="12" height="12" rx="1.5" /> },
  { id: 'ellipse', path: <ellipse cx="8" cy="8" rx="6" ry="6" /> },
  { id: 'triangle', path: <polygon points="8,2 14,14 2,14" /> },
  { id: 'diamond', path: <polygon points="8,1.5 14.5,8 8,14.5 1.5,8" /> },
  { id: 'hexagon', path: <polygon points="8,1.5 13.5,4.75 13.5,11.25 8,14.5 2.5,11.25 2.5,4.75" /> },
  { id: 'star', path: <polygon points="8,1 9.8,6 15,6.2 11,9.5 12.5,14.5 8,11.5 3.5,14.5 5,9.5 1,6.2 6.2,6" /> },
];

const STROKE_STYLES = [
  { id: 'draw', title: 'Freehand', icon: <path d="M1.5 6.5 Q4 2 6.5 6.5 Q9 11 11.5 6.5 Q14 2 16.5 6.5" strokeLinecap="round" /> },
  { id: 'solid', title: 'Solid', icon: <line x1="1.5" y1="6.5" x2="16.5" y2="6.5" strokeLinecap="round" /> },
  { id: 'dashed', title: 'Dashed', icon: <line x1="1.5" y1="6.5" x2="16.5" y2="6.5" strokeLinecap="round" strokeDasharray="5 3" /> },
  { id: 'dotted', title: 'Dotted', icon: <line x1="1.5" y1="6.5" x2="16.5" y2="6.5" strokeLinecap="round" strokeDasharray="0.5 3.5" strokeWidth="2.5" /> },
];

const FILL_STYLES = [
  {
    id: 'none', title: 'No Fill',
    icon: (
      <>
        <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: 'semi', title: 'Semi Transparent',
    icon: <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5" />,
  },
  {
    id: 'solid', title: 'Solid Fill',
    icon: <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />,
  },
  {
    id: 'pattern', title: 'Pattern',
    icon: (
      <>
        <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 13L13 5M2 10L10 2M8 14L14 8M11 13.5L13.5 11" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </>
    ),
  },
];

const ALIGN_OPTIONS = [
  { id: 'start', title: 'Align Left', icon: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></> },
  { id: 'middle', title: 'Align Center', icon: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></> },
  { id: 'end', title: 'Align Right', icon: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></> },
];

function VDiv() {
  return <div className="w-px self-stretch bg-slate-200 mx-1 my-1" />;
}

function Btn({ active, onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`h-8 min-w-[32px] px-1.5 rounded-lg flex items-center justify-center transition-all shrink-0
        ${active
          ? 'bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-200'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
    >
      {children}
    </button>
  );
}

function ColorPicker({ activeColor, handleColorSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const hex = GRID_COLORS.find(c => c.id === activeColor)?.hex ?? '#1d1d1d';

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-center shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${open ? 'bg-slate-100' : 'hover:bg-slate-100'}`}
        title="Color"
      >
        <div className="w-5 h-5 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: hex }} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 p-2 rounded-xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-200 grid grid-cols-4 gap-1.5 z-[60]">
          {GRID_COLORS.map(c => (
            <button
              key={c.id}
              onClick={() => { handleColorSelect(c); setOpen(false); }}
              className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{ borderColor: activeColor === c.id ? c.hex : 'transparent', backgroundColor: c.hex }}
              title={c.tl}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContextToolbar({
  activeTool,
  activeColor,
  activeSize,
  activeDash,
  activeFill,
  activeShape,
  activeTextFont,
  activeTextAlign,
  handleColorSelect,
  handleSizeSelect,
  handleDashSelect,
  handleFillSelect,
  handleShapeSelect,
  setActiveTextFont,
  setActiveTextAlign,
  editorRef,
}) {
  const caps = TOOL_CAPS[activeTool] || {};
  if (!Object.values(caps).some(Boolean)) return null;

  const applyTextAlign = (align) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setStyleForNextShapes(DefaultTextAlignStyle, align);
    editor.setStyleForSelectedShapes(DefaultTextAlignStyle, align);
    setActiveTextAlign(align);
  };

  const applyFont = (fontId) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setStyleForNextShapes(DefaultFontStyle, fontId);
    editor.setStyleForSelectedShapes(DefaultFontStyle, fontId);
    setActiveTextFont(fontId);
  };

  return (
    <div
      className={`absolute top-[68px] left-20 z-20 flex items-center rounded-2xl px-2 py-1.5 gap-0.5 ${UI.surface}`}
      style={{ maxWidth: 'calc(100vw - 100px)', overflowX: 'auto' }}
    >
      {/* Color — always present when any cap is on */}
      <ColorPicker activeColor={activeColor} handleColorSelect={handleColorSelect} />

      {/* Shape type (geo only) */}
      {caps.shapes && (
        <>
          <VDiv />
          <div className="flex items-center gap-0.5">
            {SHAPES.map(({ id, path }) => (
              <Btn key={id} active={activeShape === id} onClick={() => handleShapeSelect(id)} title={id.charAt(0).toUpperCase() + id.slice(1)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                  {path}
                </svg>
              </Btn>
            ))}
          </div>
        </>
      )}

      {/* Stroke weight */}
      {caps.weight && (
        <>
          <VDiv />
          <div className="flex items-center gap-0.5">
            {[{ id: 's', sz: 2 }, { id: 'm', sz: 3 }, { id: 'l', sz: 5 }, { id: 'xl', sz: 8 }].map(({ id, sz }) => (
              <Btn key={id} active={activeSize === id} onClick={() => handleSizeSelect(id)} title={`Weight: ${id.toUpperCase()}`}>
                <div className="rounded-full bg-current" style={{ width: sz + 2, height: sz + 2 }} />
              </Btn>
            ))}
          </div>
        </>
      )}

      {/* Stroke style */}
      {caps.stroke && (
        <>
          <VDiv />
          <div className="flex items-center gap-0.5">
            {STROKE_STYLES.map(({ id, title, icon }) => (
              <Btn key={id} active={activeDash === id} onClick={() => handleDashSelect(id)} title={title}>
                <svg width="18" height="13" viewBox="0 0 18 13" fill="none" stroke="currentColor" strokeWidth="1.5">{icon}</svg>
              </Btn>
            ))}
          </div>
        </>
      )}

      {/* Fill */}
      {caps.fill && (
        <>
          <VDiv />
          <div className="flex items-center gap-0.5">
            {FILL_STYLES.map(({ id, title, icon }) => (
              <Btn key={id} active={activeFill === id} onClick={() => handleFillSelect(id)} title={title}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">{icon}</svg>
              </Btn>
            ))}
          </div>
        </>
      )}

      {/* Font (text tool) */}
      {caps.font && (
        <>
          <VDiv />
          <div className="flex items-center gap-0.5">
            {[
              { id: 'sans', label: 'Sans', cls: 'font-sans' },
              { id: 'serif', label: 'Serif', cls: 'font-serif' },
              { id: 'mono', label: 'Mono', cls: 'font-mono' },
              { id: 'draw', label: 'Hand', cls: 'italic' },
            ].map(({ id, label, cls }) => (
              <Btn key={id} active={activeTextFont === id} onClick={() => applyFont(id)} title={label}>
                <span className={`text-[11px] font-semibold ${cls}`}>{label}</span>
              </Btn>
            ))}
          </div>
        </>
      )}

      {/* Text size */}
      {caps.textSize && (
        <>
          <VDiv />
          <div className="flex items-center gap-0.5">
            {['s', 'm', 'l', 'xl'].map(s => (
              <Btn key={s} active={activeSize === s} onClick={() => handleSizeSelect(s)} title={`Size: ${s.toUpperCase()}`}>
                <span className="text-[11px] font-bold uppercase">{s}</span>
              </Btn>
            ))}
          </div>
        </>
      )}

      {/* Text align */}
      {caps.align && (
        <>
          <VDiv />
          <div className="flex items-center gap-0.5">
            {ALIGN_OPTIONS.map(({ id, title, icon }) => (
              <Btn key={id} active={activeTextAlign === id} onClick={() => applyTextAlign(id)} title={title}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">{icon}</svg>
              </Btn>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
