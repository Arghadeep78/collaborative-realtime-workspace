import { DefaultFontStyle, DefaultTextAlignStyle } from '@tldraw/tlschema';
import { UI, GRID_COLORS } from './whiteboardConstants.js';

function ColorFlyout({ handleColorSelect }) {
  return (
    <div className="absolute left-full top-0 pl-3 z-50">
      <div className={`rounded-[20px] p-3 flex flex-col gap-3 ${UI.surfaceSolid} w-[140px] shadow-xl`}>
        <div className="grid grid-cols-2 gap-2">
          {GRID_COLORS.map(c => (
            <button
              key={c.id}
              onClick={() => handleColorSelect(c)}
              className="w-[48px] h-[40px] rounded border border-black/10 shadow-sm transition-transform hover:scale-105"
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ShapesFlyout({ activeTool, activeFill, handleShapeSelect, handleToolSelect, handleFillSelect }) {
  return (
    <div className="absolute left-full top-0 pl-3 z-50">
      <div className={`rounded-[20px] p-3 flex flex-col gap-2 ${UI.surfaceSolid} w-[160px] shadow-xl`}>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => handleShapeSelect('rectangle')} className="w-8 h-8 rounded border border-black/10 shadow-sm flex items-center justify-center hover:bg-slate-100 text-slate-700 mx-auto">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
          </button>
          <button onClick={() => handleShapeSelect('ellipse')} className="w-8 h-8 rounded border border-black/10 shadow-sm flex items-center justify-center hover:bg-slate-100 text-slate-700 mx-auto">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /></svg>
          </button>
          <button onClick={() => handleShapeSelect('triangle')} className="w-8 h-8 rounded border border-black/10 shadow-sm flex items-center justify-center hover:bg-slate-100 text-slate-700 mx-auto">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,3 21,21 3,21" /></svg>
          </button>
          <button onClick={() => handleShapeSelect('diamond')} className="w-8 h-8 rounded border border-black/10 shadow-sm flex items-center justify-center hover:bg-slate-100 text-slate-700 mx-auto">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 22,12 12,22 2,12" /></svg>
          </button>
          <button onClick={() => handleShapeSelect('hexagon')} className="w-8 h-8 rounded border border-black/10 shadow-sm flex items-center justify-center hover:bg-slate-100 text-slate-700 mx-auto">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" /></svg>
          </button>
          <button onClick={() => handleShapeSelect('star')} className="w-8 h-8 rounded border border-black/10 shadow-sm flex items-center justify-center hover:bg-slate-100 text-slate-700 mx-auto">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 15,8 22,9 17,14 18,21 12,17 6,21 7,14 2,9 9,8" /></svg>
          </button>
        </div>
        <div className="h-px bg-slate-200 my-1"></div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => handleToolSelect('line')} className={`h-[32px] rounded border border-black/10 shadow-sm flex items-center justify-center hover:bg-slate-100 ${activeTool === 'line' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="20" x2="20" y2="4" /></svg>
          </button>
          <button onClick={() => handleToolSelect('arrow')} className={`h-[32px] rounded border border-black/10 shadow-sm flex items-center justify-center hover:bg-slate-100 ${activeTool === 'arrow' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="20" x2="20" y2="4" /><polyline points="14 4 20 4 20 10" /></svg>
          </button>
        </div>
        <div className="h-px bg-slate-200 my-1"></div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Fill Style</span>
          <div className="grid grid-cols-2 gap-2">
            {['none', 'semi', 'solid', 'pattern'].map(f => (
              <button key={f} onClick={() => handleFillSelect(f)} className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${activeFill === f ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}>
                {f === 'none' ? 'None' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PenFlyout({ activeSize, activeDash, activeColor, penPresets, setPenPresets, showFullPalette, setShowFullPalette, handleSizeSelect, handleDashSelect, handleColorSelect }) {
  return (
    <div className="absolute left-full top-0 pl-3 z-50">
      <div className={`rounded-[20px] p-3 flex gap-3 items-center ${UI.surfaceSolid} w-max shadow-xl border border-slate-100`}>
        {/* Sizes */}
        <div className="flex gap-1 items-center px-1">
          {[
            { id: 's', size: 2 }, { id: 'm', size: 3 }, { id: 'l', size: 5 }, { id: 'xl', size: 8 }
          ].map(({ id, size }) => (
            <button key={id} onClick={() => handleSizeSelect(id)} className={`w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-full transition-all ${activeSize === id ? 'bg-slate-100 shadow-inner ring-1 ring-slate-200' : ''}`} title={`${id.toUpperCase()} (${size}px)`}>
              <div className={`rounded-full bg-slate-800`} style={{ width: size, height: size }} />
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-slate-200/60" />

        {/* Dashes */}
        <div className="flex gap-1 items-center px-1">
          {['draw', 'solid', 'dashed', 'dotted'].map(d => (
            <button key={d} onClick={() => handleDashSelect(d)} className={`px-2 h-8 flex items-center justify-center hover:bg-slate-50 rounded-lg transition-all text-[10px] font-bold uppercase ${activeDash === d ? 'bg-slate-100 shadow-inner ring-1 ring-slate-200 text-indigo-600' : 'text-slate-600'}`} title={d}>
              {d === 'dashed' ? 'Dash' : d === 'dotted' ? 'Dot' : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-slate-200/60" />

        {/* Colors */}
        <div className="flex gap-2 items-center relative">
          {penPresets.map((c, i) => (
            <div key={c.id + i} className="relative">
              <button
                onClick={() => { handleColorSelect(c); setShowFullPalette(false); }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 border-2`}
                style={{ borderColor: activeColor === c.id ? c.hex : 'transparent' }}
                title={c.tl}
              >
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: c.hex }} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setShowFullPalette(p => !p)}
            className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all hover:bg-slate-100 text-slate-400"
            title="More Colors"
          >
            <svg className={`w-4 h-4 transition-transform duration-200 ${showFullPalette ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
          {showFullPalette && (
            <div className="absolute left-1/2 top-full -translate-x-1/2 mt-4 z-50">
              <div className={`rounded-[20px] p-3 grid grid-cols-4 gap-2 ${UI.surfaceSolid} w-[140px] shadow-xl border border-slate-100`}>
                {GRID_COLORS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      handleColorSelect(c);
                      const idx = penPresets.findIndex(p => p.id === activeColor);
                      const newPresets = [...penPresets];
                      if (idx !== -1) newPresets[idx] = c;
                      else newPresets[0] = c;
                      setPenPresets(newPresets);
                      setShowFullPalette(false);
                    }}
                    className={`w-6 h-6 rounded-full mx-auto flex items-center justify-center transition-transform hover:scale-110 border-2`}
                    style={{ borderColor: activeColor === c.id ? c.hex : 'transparent' }}
                    title={c.tl}
                  >
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.hex }} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TextFlyout({ activeTextFont, activeTextAlign, activeSize, activeColor, editorRef, handleSizeSelect, handleColorSelect, setActiveTextFont, setActiveTextAlign }) {
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
    <div className="absolute left-full top-0 pl-3 z-50">
      <div className={`rounded-[20px] p-3 flex gap-3 items-start ${UI.surfaceSolid} w-max shadow-xl border border-slate-100`}>
        {/* Font */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Font</span>
          <div className="flex flex-col gap-1">
            {[
              { id: 'sans', label: 'Sans', style: 'font-sans' },
              { id: 'serif', label: 'Serif', style: 'font-serif' },
              { id: 'mono', label: 'Mono', style: 'font-mono' },
              { id: 'draw', label: 'Hand', style: 'italic' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => applyFont(f.id)}
                className={`px-3 h-8 rounded-lg text-[11px] font-semibold transition-all text-left ${f.style} ${activeTextFont === f.id ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-px self-stretch bg-slate-200/60" />

        {/* Size */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Size</span>
          <div className="flex flex-col gap-1">
            {[
              { id: 's', label: 'S', desc: 'Small' },
              { id: 'm', label: 'M', desc: 'Medium' },
              { id: 'l', label: 'L', desc: 'Large' },
              { id: 'xl', label: 'XL', desc: 'Extra Large' },
            ].map(s => (
              <button
                key={s.id}
                onClick={() => handleSizeSelect(s.id)}
                className={`w-10 h-8 rounded-lg text-[11px] font-bold uppercase transition-all ${activeSize === s.id ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200' : 'text-slate-600 hover:bg-slate-50'}`}
                title={s.desc}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-px self-stretch bg-slate-200/60" />

        {/* Alignment */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Align</span>
          <div className="flex flex-col gap-1">
            {[
              { id: 'start', title: 'Align Left', path: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></> },
              { id: 'middle', title: 'Align Center', path: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></> },
              { id: 'end', title: 'Align Right', path: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></> },
            ].map(a => (
              <button
                key={a.id}
                onClick={() => applyTextAlign(a.id)}
                className={`w-10 h-8 rounded-lg flex items-center justify-center transition-all ${activeTextAlign === a.id ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200' : 'text-slate-600 hover:bg-slate-50'}`}
                title={a.title}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">{a.path}</svg>
              </button>
            ))}
          </div>
        </div>

        <div className="w-px self-stretch bg-slate-200/60" />

        {/* Color */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Color</span>
          <div className="grid grid-cols-2 gap-1.5">
            {GRID_COLORS.slice(0, 8).map(c => (
              <button
                key={c.id}
                onClick={() => handleColorSelect(c)}
                className={`w-7 h-7 rounded-full transition-transform hover:scale-110 border-2 ${activeColor === c.id ? 'border-blue-500 shadow-sm' : 'border-transparent'}`}
                style={{ backgroundColor: c.hex }}
                title={c.tl}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeftToolbar({
  toolbarRef,
  activeTool,
  activeColor,
  activeSize,
  activeDash,
  activeFill,
  activeTextFont,
  activeTextAlign,
  penPresets,
  setPenPresets,
  hoveredTool,
  setHoveredTool,
  showFullPalette,
  setShowFullPalette,
  handleToolSelect,
  handleColorSelect,
  handleSizeSelect,
  handleDashSelect,
  handleFillSelect,
  handleShapeSelect,
  handleUndo,
  handleRedo,
  editorRef,
  setActiveTextFont,
  setActiveTextAlign,
}) {
  const toolBtn = (tool, icon, title) => (
    <button
      onClick={() => { handleToolSelect(tool); setHoveredTool(null); }}
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTool === tool ? 'bg-indigo-100 text-indigo-600' : 'text-slate-700 hover:bg-slate-100'}`}
      title={title}
    >
      {icon}
    </button>
  );

  return (
    <div ref={toolbarRef} className="absolute left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-3">
      <div className={`rounded-[20px] p-2 flex flex-col gap-2 ${UI.surfaceSolid}`}>

        {/* Select */}
        {toolBtn('select',
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" /></svg>,
          'Select (Escape)'
        )}

        {/* Hand */}
        {toolBtn('hand',
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" /><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" /><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" /><path d="M18 11v5a8 8 0 0 1-16 0v-5a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v0" /><path d="M6 14v-1a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v0" /></svg>,
          'Hand (Space)'
        )}

        {/* Pen */}
        <div className="relative group">
          <button
            onClick={() => { handleToolSelect('draw'); setHoveredTool(prev => prev === 'pen' ? null : 'pen'); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTool === 'draw' || activeTool === 'highlight' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-700 hover:bg-slate-100'}`}
            title="Pen (P)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          </button>
          {hoveredTool === 'pen' && (
            <PenFlyout
              activeSize={activeSize}
              activeDash={activeDash}
              activeColor={activeColor}
              penPresets={penPresets}
              setPenPresets={setPenPresets}
              showFullPalette={showFullPalette}
              setShowFullPalette={setShowFullPalette}
              handleSizeSelect={handleSizeSelect}
              handleDashSelect={handleDashSelect}
              handleColorSelect={handleColorSelect}
            />
          )}
        </div>

        {/* Eraser */}
        {toolBtn('eraser',
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L20 9C20.5 9.5 20.5 10.5 20 11L11 20H20V20Z"></path></svg>,
          'Eraser (E)'
        )}

        {/* Shapes */}
        <div className="relative group">
          <button
            onClick={() => { handleToolSelect('geo'); setHoveredTool(prev => prev === 'shapes' ? null : 'shapes'); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${(activeTool === 'geo' || activeTool === 'line' || activeTool === 'arrow') ? 'bg-indigo-100 text-indigo-600' : 'text-slate-700 hover:bg-slate-100'}`}
            title="Shapes"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><circle cx="17.5" cy="6.5" r="3.5" /><polygon points="6.5,14 10,21 3,21" strokeLinejoin="round" /><path d="M14 14l6 6m0-6v6h-6" /></svg>
          </button>
          {hoveredTool === 'shapes' && (
            <ShapesFlyout
              activeTool={activeTool}
              activeFill={activeFill}
              handleShapeSelect={handleShapeSelect}
              handleToolSelect={handleToolSelect}
              handleFillSelect={handleFillSelect}
            />
          )}
        </div>

        {/* Sticky Note */}
        <div className="relative group">
          <button
            onClick={() => { handleToolSelect('note'); setHoveredTool(prev => prev === 'note' ? null : 'note'); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTool === 'note' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-700 hover:bg-slate-100'}`}
            title="Sticky Note"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 15l-6 6H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10z" /><path d="M19 15l-6 6v-6h6z" /></svg>
          </button>
          {hoveredTool === 'note' && (
            <ColorFlyout handleColorSelect={handleColorSelect} />
          )}
        </div>

        {/* Text */}
        <div className="relative group">
          <button
            onClick={() => { handleToolSelect('text'); setHoveredTool(prev => prev === 'text' ? null : 'text'); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTool === 'text' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-700 hover:bg-slate-100'}`}
            title="Text (T)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3" /><path d="M12 4v16" /><path d="M8 20h8" /></svg>
          </button>
          {hoveredTool === 'text' && (
            <TextFlyout
              activeTextFont={activeTextFont}
              activeTextAlign={activeTextAlign}
              activeSize={activeSize}
              activeColor={activeColor}
              editorRef={editorRef}
              handleSizeSelect={handleSizeSelect}
              handleColorSelect={handleColorSelect}
              setActiveTextFont={setActiveTextFont}
              setActiveTextAlign={setActiveTextAlign}
            />
          )}
        </div>
      </div>

      {/* Undo / Redo */}
      <div className={`rounded-[20px] p-2 flex flex-col gap-2 ${UI.surfaceSolid}`}>
        <button onClick={handleUndo} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" /></svg>
        </button>
        <button onClick={handleRedo} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7" /></svg>
        </button>
      </div>
    </div>
  );
}
