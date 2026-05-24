import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DefaultFontStyle, DefaultTextAlignStyle, DefaultVerticalAlignStyle } from '@tldraw/tlschema';
import { UI, GRID_COLORS } from './whiteboardConstants.js';

// Capability sets per normalized context key. `opacity` is appended for every
// visible context, so it isn't listed here.
const CAPS = {
  draw: { color: true, weight: true, stroke: true, shapes: false, fill: false, font: false, textSize: false, align: false, valign: false },
  geo: { color: true, weight: true, stroke: true, shapes: true, fill: true, font: false, textSize: false, align: false, valign: false },
  line: { color: true, weight: true, stroke: true, shapes: false, fill: false, font: false, textSize: false, align: false, valign: false },
  arrow: { color: true, weight: true, stroke: true, shapes: false, fill: false, font: false, textSize: false, align: false, valign: false },
  text: { color: true, weight: false, stroke: false, shapes: false, fill: false, font: true, textSize: true, align: true, valign: true },
  note: { color: true, weight: false, stroke: false, shapes: false, fill: false, font: true, textSize: true, align: true, valign: true },
};

// While typing into any shape, only the text controls are relevant.
const TEXT_EDIT_CAPS = { color: true, font: true, textSize: true, align: true, valign: true };

// tldraw tool ids / shape type ids → normalized capability key
const TO_KEY = { draw: 'draw', highlight: 'draw', geo: 'geo', line: 'line', arrow: 'arrow', text: 'text', note: 'note' };

function resolveCaps({ activeTool, selectedTypes, editingType }) {
  // 1) Actively typing into a shape → text sub-toolbar.
  if (editingType) return { ...TEXT_EDIT_CAPS, opacity: true };

  // 2) One or more shapes selected → union of their capability sets.
  if (selectedTypes && selectedTypes.length) {
    const merged = {};
    for (const type of selectedTypes) {
      const caps = CAPS[TO_KEY[type]];
      if (caps) for (const k in caps) merged[k] = merged[k] || caps[k];
    }
    merged.opacity = true; // any shape can change opacity
    return merged;
  }

  // 3) Otherwise reflect the active drawing tool.
  const caps = CAPS[TO_KEY[activeTool]];
  return caps ? { ...caps, opacity: true } : {};
}

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
  { id: 'start', title: 'Align Left', icon: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></> },
  { id: 'middle', title: 'Align Center', icon: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></> },
  { id: 'end', title: 'Align Right', icon: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></> },
];

const VALIGN_OPTIONS = [
  { id: 'start', title: 'Align Top', icon: <><line x1="3" y1="4" x2="21" y2="4" /><rect x="8" y="8" width="8" height="11" rx="1.5" fill="none" /></> },
  { id: 'middle', title: 'Align Middle', icon: <><line x1="3" y1="12" x2="21" y2="12" /><rect x="8" y="6" width="8" height="12" rx="1.5" fill="none" /></> },
  { id: 'end', title: 'Align Bottom', icon: <><rect x="8" y="5" width="8" height="11" rx="1.5" fill="none" /><line x1="3" y1="20" x2="21" y2="20" /></> },
];

function GenericPicker({ activeValue, options, handleSelect, iconRender, title, columns = 4, gap = 1, buttonClass }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 8, left: rect.left });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const activeOption = options.find(o => (o.id || o) === activeValue) || options[0];

  return (
    <div className="relative flex items-center shrink-0">
      <button
        ref={btnRef}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${open ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-700/50' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'} ${buttonClass || ''}`}
        title={title}
      >
        {iconRender(activeOption, true)}
      </button>
      {open && coords && createPortal(
        <div
          ref={popRef}
          className="fixed p-2 rounded-xl bg-white dark:bg-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-200 dark:border-slate-700 grid z-[100]"
          style={{ top: coords.top, left: coords.left, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: `${gap * 0.25}rem` }}
        >
          {options.map(o => {
            const id = o.id || o;
            const label = o.title || o.label || (typeof o === 'string' ? o : id);
            const isActive = activeValue === id;
            return (
              <button
                key={id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { handleSelect(id); setOpen(false); }}
                className={`h-8 min-w-[32px] px-1.5 flex items-center justify-center rounded-lg transition-all ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-700/50' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
                title={label}
              >
                {iconRender(o, false)}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}

export default function ContextToolbar({
  activeTool,
  selectedTypes,
  editingType,
  activeColor,
  activeSize,
  activeDash,
  activeFill,
  activeShape,
  activeTextFont,
  activeTextAlign,
  activeTextVAlign,
  activeOpacity,
  handleColorSelect,
  handleSizeSelect,
  handleDashSelect,
  handleFillSelect,
  handleShapeSelect,
  handleOpacitySelect,
  setActiveTextFont,
  setActiveTextAlign,
  setActiveTextVAlign,
  editorRef,
}) {
  const caps = resolveCaps({ activeTool, selectedTypes, editingType });
  if (!Object.values(caps).some(Boolean)) return null;

  const applyTextAlign = (align) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setStyleForNextShapes(DefaultTextAlignStyle, align);
    editor.setStyleForSelectedShapes(DefaultTextAlignStyle, align);
    setActiveTextAlign(align);
  };

  const applyVerticalAlign = (align) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setStyleForNextShapes(DefaultVerticalAlignStyle, align);
    editor.setStyleForSelectedShapes(DefaultVerticalAlignStyle, align);
    setActiveTextVAlign(align);
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
      className={`absolute top-20 left-20 z-20 flex items-center rounded-2xl px-2 py-1.5 gap-1 shadow-sm border border-slate-200/50 dark:border-slate-700/50 ${UI.surface}`}
      style={{ maxWidth: 'calc(100vw - 120px)', overflowX: 'auto' }}
    >
      {/* Color */}
      {caps.color && <ColorPicker activeColor={activeColor} handleColorSelect={handleColorSelect} />}

      {/* Shape type */}
      {caps.shapes && (
        <>
          <VDiv />
          <GenericPicker
            activeValue={activeShape}
            options={SHAPES}
            handleSelect={handleShapeSelect}
            title="Shape Type"
            columns={3}
            iconRender={(o) => (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                {o.path}
              </svg>
            )}
          />
        </>
      )}

      {/* Stroke weight */}
      {caps.weight && (
        <>
          <VDiv />
          <GenericPicker
            activeValue={activeSize}
            options={[{ id: 's', sz: 2 }, { id: 'm', sz: 3 }, { id: 'l', sz: 5 }, { id: 'xl', sz: 8 }]}
            handleSelect={handleSizeSelect}
            title="Stroke Weight"
            columns={4}
            iconRender={(o) => (
              <div className="rounded-full bg-current" style={{ width: o.sz + 2, height: o.sz + 2 }} />
            )}
          />
        </>
      )}

      {/* Stroke style */}
      {caps.stroke && (
        <>
          <VDiv />
          <GenericPicker
            activeValue={activeDash}
            options={STROKE_STYLES}
            handleSelect={handleDashSelect}
            title="Stroke Style"
            columns={4}
            iconRender={(o) => (
              <svg width="18" height="13" viewBox="0 0 18 13" fill="none" stroke="currentColor" strokeWidth="1.5">{o.icon}</svg>
            )}
          />
        </>
      )}

      {/* Fill */}
      {caps.fill && (
        <>
          <VDiv />
          <GenericPicker
            activeValue={activeFill}
            options={FILL_STYLES}
            handleSelect={handleFillSelect}
            title="Fill Style"
            columns={4}
            iconRender={(o) => (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">{o.icon}</svg>
            )}
          />
        </>
      )}

      {/* Font */}
      {caps.font && (
        <>
          <VDiv />
          <GenericPicker
            activeValue={activeTextFont}
            options={[
              { id: 'sans', label: 'Sans', cls: 'font-sans' },
              { id: 'serif', label: 'Serif', cls: 'font-serif' },
              { id: 'mono', label: 'Mono', cls: 'font-mono' },
              { id: 'draw', label: 'Hand', cls: 'italic' },
            ]}
            handleSelect={applyFont}
            title="Font"
            columns={1}
            iconRender={(o, isButton) => (
              isButton ? <span className={`text-[13px] font-semibold ${o.cls}`}>Aa</span> : <span className={`text-[13px] font-semibold ${o.cls}`}>{o.label}</span>
            )}
          />
        </>
      )}

      {/* Text size */}
      {caps.textSize && (
        <>
          <VDiv />
          <GenericPicker
            activeValue={activeSize}
            options={['s', 'm', 'l', 'xl']}
            handleSelect={handleSizeSelect}
            title="Text Size"
            columns={4}
            iconRender={(o) => (
              <span className="text-[11px] font-bold uppercase">{o}</span>
            )}
          />
        </>
      )}

      {/* Text align (horizontal) */}
      {caps.align && (
        <>
          <VDiv />
          <GenericPicker
            activeValue={activeTextAlign}
            options={ALIGN_OPTIONS}
            handleSelect={applyTextAlign}
            title="Horizontal Align"
            columns={3}
            iconRender={(o) => (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">{o.icon}</svg>
            )}
          />
        </>
      )}

      {/* Text align (vertical) */}
      {caps.valign && (
        <>
          <VDiv />
          <GenericPicker
            activeValue={activeTextVAlign}
            options={VALIGN_OPTIONS}
            handleSelect={applyVerticalAlign}
            title="Vertical Align"
            columns={3}
            iconRender={(o) => (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{o.icon}</svg>
            )}
          />
        </>
      )}

      {/* Opacity */}
      {caps.opacity && (
        <>
          <VDiv />
          <OpacityPicker activeOpacity={activeOpacity} handleOpacitySelect={handleOpacitySelect} />
        </>
      )}
    </div>
  );
}
