const fs = require('fs');
const file = 'src/Components/Whiteboard/WhiteboardRoom.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Imports
content = content.replace(
  "import { Tldraw, track, DefaultColorStyle, DefaultSizeStyle, GeoShapeGeoStyle, useEditor, exportAs }",
  "import { Tldraw, track, DefaultColorStyle, DefaultSizeStyle, DefaultFillStyle, DefaultDashStyle, DefaultAlignStyle, GeoShapeGeoStyle, useEditor, exportAs }"
);

// 2. States
content = content.replace(
  "  const [activeSize, setActiveSize] = useState('m');\n  const [activeTool, setActiveTool] = useState('draw');",
  "  const [activeSize, setActiveSize] = useState('m');\n  const [activeTool, setActiveTool] = useState('draw');\n  const [activeFill, setActiveFill] = useState('none');\n  const [activeDash, setActiveDash] = useState('draw');\n  const [activeAlign, setActiveAlign] = useState('middle');"
);

// 3. Handlers
const oldApplyEditorStyle = `  const applyEditorStyle = (prop, value) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (prop === 'color') {
      editor.setStyleForNextShapes(DefaultColorStyle, value);
      editor.setStyleForSelectedShapes(DefaultColorStyle, value);
    } else if (prop === 'size') {
      editor.setStyleForNextShapes(DefaultSizeStyle, value);
      editor.setStyleForSelectedShapes(DefaultSizeStyle, value);
    }
  };`;

const newApplyEditorStyle = `  const applyEditorStyle = (prop, value) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (prop === 'color') {
      editor.setStyleForNextShapes(DefaultColorStyle, value);
      editor.setStyleForSelectedShapes(DefaultColorStyle, value);
    } else if (prop === 'size') {
      editor.setStyleForNextShapes(DefaultSizeStyle, value);
      editor.setStyleForSelectedShapes(DefaultSizeStyle, value);
    } else if (prop === 'fill') {
      editor.setStyleForNextShapes(DefaultFillStyle, value);
      editor.setStyleForSelectedShapes(DefaultFillStyle, value);
    } else if (prop === 'dash') {
      editor.setStyleForNextShapes(DefaultDashStyle, value);
      editor.setStyleForSelectedShapes(DefaultDashStyle, value);
    } else if (prop === 'align') {
      editor.setStyleForNextShapes(DefaultAlignStyle, value);
      editor.setStyleForSelectedShapes(DefaultAlignStyle, value);
    }
  };

  const handleFillSelect = (fill) => {
    setActiveFill(fill);
    applyEditorStyle('fill', fill);
  };
  const handleDashSelect = (dash) => {
    setActiveDash(dash);
    applyEditorStyle('dash', dash);
  };
  const handleAlignSelect = (align) => {
    setActiveAlign(align);
    applyEditorStyle('align', align);
  };`;

content = content.replace(oldApplyEditorStyle, newApplyEditorStyle);

// 4. showPropsMenu variable
content = content.replace(
  "  if (!synced) {",
  "  const showPropsMenu = !['hand', 'eraser'].includes(activeTool);\n\n  if (!synced) {"
);

// 5. JSX
const oldJSX = `      {/* ── Top Left Floating Box: Global Properties ─────────────────────── */}
      <div className={\`absolute top-4 left-4 z-20 flex items-center gap-3 rounded-[20px] p-2 \${UI.surfaceSolid} shadow-xl border border-slate-100\`}>
        {/* Sizes */}
        <div className="flex gap-1 items-center px-1">
          <button onClick={() => handleSizeSelect('s')} className={\`w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-full transition-all \${activeSize === 's' ? 'bg-slate-100 shadow-inner ring-1 ring-slate-200' : ''}\`} title="Small (2px)"><div className="w-[2px] h-[2px] rounded-full bg-slate-800" /></button>
          <button onClick={() => handleSizeSelect('m')} className={\`w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-full transition-all \${activeSize === 'm' ? 'bg-slate-100 shadow-inner ring-1 ring-slate-200' : ''}\`} title="Medium (3px)"><div className="w-[3px] h-[3px] rounded-full bg-slate-800" /></button>
          <button onClick={() => handleSizeSelect('l')} className={\`w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-full transition-all \${activeSize === 'l' ? 'bg-slate-100 shadow-inner ring-1 ring-slate-200' : ''}\`} title="Large (5px)"><div className="w-[5px] h-[5px] rounded-full bg-slate-800" /></button>
          <button onClick={() => handleSizeSelect('xl')} className={\`w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-full transition-all \${activeSize === 'xl' ? 'bg-slate-100 shadow-inner ring-1 ring-slate-200' : ''}\`} title="Extra Large (8px)"><div className="w-[8px] h-[8px] rounded-full bg-slate-800" /></button>
        </div>
        
        <div className="w-px h-6 bg-slate-200/60" />
        
        {/* Colors */}
        <div className="flex gap-2 items-center relative">
          {penPresets.map((c, i) => (
            <div key={c.id + i} className="relative">
              <button 
                onClick={() => { handleColorSelect(c); setShowFullPalette(false); }} 
                className={\`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 border-2 \${activeColor === c.id ? 'border-blue-500' : 'border-transparent'}\`}
                style={{ borderColor: activeColor === c.id ? c.hex : 'transparent' }}
                title={c.tl}
              >
                 <div className="w-6 h-6 rounded-full" style={{ backgroundColor: c.hex }} />
              </button>
            </div>
          ))}
          
          {/* Arrow Button */}
          <button 
            onClick={() => setShowFullPalette(p => !p)}
            className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all hover:bg-slate-100 text-slate-400"
            title="More Colors"
          >
            <svg className={\`w-4 h-4 transition-transform duration-200 \${showFullPalette ? 'rotate-90' : ''}\`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>

          {showFullPalette && (
            <div className="absolute left-0 top-full mt-4 z-50">
              <div className={\`rounded-[20px] p-3 grid grid-cols-4 gap-2 \${UI.surfaceSolid} w-[140px] shadow-xl border border-slate-100\`}>
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
                    className={\`w-6 h-6 rounded-full mx-auto flex items-center justify-center transition-transform hover:scale-110 border-2 \${activeColor === c.id ? 'shadow-sm' : 'border-transparent'}\`}
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
      </div>`;

const newJSX = `      {/* ── Top Left Floating Box: Global Properties ─────────────────────── */}
      {showPropsMenu && (
        <div className={\`absolute top-4 left-4 z-20 flex items-center gap-2 rounded-[20px] p-2 \${UI.surfaceSolid} shadow-xl border border-slate-100\`}>
          {/* Sizes */}
          <div className="flex gap-1 items-center px-1">
            <button onClick={() => handleSizeSelect('s')} className={\`w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-full transition-all \${activeSize === 's' ? 'bg-slate-100 shadow-inner ring-1 ring-slate-200' : ''}\`} title="Small (2px)"><div className="w-[2px] h-[2px] rounded-full bg-slate-800" /></button>
            <button onClick={() => handleSizeSelect('m')} className={\`w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-full transition-all \${activeSize === 'm' ? 'bg-slate-100 shadow-inner ring-1 ring-slate-200' : ''}\`} title="Medium (3px)"><div className="w-[3px] h-[3px] rounded-full bg-slate-800" /></button>
            <button onClick={() => handleSizeSelect('l')} className={\`w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-full transition-all \${activeSize === 'l' ? 'bg-slate-100 shadow-inner ring-1 ring-slate-200' : ''}\`} title="Large (5px)"><div className="w-[5px] h-[5px] rounded-full bg-slate-800" /></button>
            <button onClick={() => handleSizeSelect('xl')} className={\`w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-full transition-all \${activeSize === 'xl' ? 'bg-slate-100 shadow-inner ring-1 ring-slate-200' : ''}\`} title="Extra Large (8px)"><div className="w-[8px] h-[8px] rounded-full bg-slate-800" /></button>
          </div>
          
          <div className="w-px h-6 bg-slate-200/60" />
          
          {/* Colors */}
          <div className="flex gap-1.5 items-center relative">
            {penPresets.map((c, i) => (
              <div key={c.id + i} className="relative">
                <button 
                  onClick={() => { handleColorSelect(c); setShowFullPalette(false); }} 
                  className={\`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 border-2 \${activeColor === c.id ? 'border-blue-500' : 'border-transparent'}\`}
                  style={{ borderColor: activeColor === c.id ? c.hex : 'transparent' }}
                  title={c.tl}
                >
                   <div className="w-6 h-6 rounded-full" style={{ backgroundColor: c.hex }} />
                </button>
              </div>
            ))}
            
            {/* Arrow Button */}
            <button 
              onClick={() => setShowFullPalette(p => !p)}
              className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all hover:bg-slate-100 text-slate-400"
              title="More Colors"
            >
              <svg className={\`w-4 h-4 transition-transform duration-200 \${showFullPalette ? 'rotate-90' : ''}\`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>

            {showFullPalette && (
              <div className="absolute left-0 top-full mt-4 z-50">
                <div className={\`rounded-[20px] p-3 grid grid-cols-4 gap-2 \${UI.surfaceSolid} w-[140px] shadow-xl border border-slate-100\`}>
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
                      className={\`w-6 h-6 rounded-full mx-auto flex items-center justify-center transition-transform hover:scale-110 border-2 \${activeColor === c.id ? 'shadow-sm' : 'border-transparent'}\`}
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

          {/* Fill (Shapes & Select) */}
          {['geo', 'arrow', 'line', 'select'].includes(activeTool) && (
            <>
              <div className="w-px h-6 bg-slate-200/60" />
              <div className="flex gap-1 items-center px-1">
                <button onClick={() => handleFillSelect('none')} className={\`w-8 h-8 flex items-center justify-center rounded-lg transition-all \${activeFill === 'none' ? 'bg-slate-100 shadow-inner' : 'hover:bg-slate-50'}\`} title="Transparent">
                  <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                </button>
                <button onClick={() => handleFillSelect('semi')} className={\`w-8 h-8 flex items-center justify-center rounded-lg transition-all \${activeFill === 'semi' ? 'bg-slate-100 shadow-inner' : 'hover:bg-slate-50'}\`} title="Semi-transparent">
                  <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 12l8-8M4 20l16-16M12 24l8-8" stroke="white" strokeWidth="1.5"/></svg>
                </button>
                <button onClick={() => handleFillSelect('solid')} className={\`w-8 h-8 flex items-center justify-center rounded-lg transition-all \${activeFill === 'solid' ? 'bg-slate-100 shadow-inner' : 'hover:bg-slate-50'}\`} title="Solid">
                  <svg className="w-4 h-4 text-slate-800" fill="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
                </button>
              </div>
            </>
          )}

          {/* Dash (Shapes & Select) */}
          {['geo', 'arrow', 'line', 'select'].includes(activeTool) && (
            <>
              <div className="w-px h-6 bg-slate-200/60" />
              <div className="flex gap-1 items-center px-1">
                <button onClick={() => handleDashSelect('draw')} className={\`w-8 h-8 flex items-center justify-center rounded-lg transition-all \${activeDash === 'draw' ? 'bg-slate-100 shadow-inner' : 'hover:bg-slate-50'}\`} title="Draw">
                  <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" d="M4 12h16" /></svg>
                </button>
                <button onClick={() => handleDashSelect('dashed')} className={\`w-8 h-8 flex items-center justify-center rounded-lg transition-all \${activeDash === 'dashed' ? 'bg-slate-100 shadow-inner' : 'hover:bg-slate-50'}\`} title="Dashed">
                  <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeDasharray="4 4"><path strokeLinecap="round" d="M4 12h16" /></svg>
                </button>
                <button onClick={() => handleDashSelect('dotted')} className={\`w-8 h-8 flex items-center justify-center rounded-lg transition-all \${activeDash === 'dotted' ? 'bg-slate-100 shadow-inner' : 'hover:bg-slate-50'}\`} title="Dotted">
                  <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeDasharray="1 6"><path strokeLinecap="round" d="M4 12h16" /></svg>
                </button>
              </div>
            </>
          )}

          {/* Align (Text & Select) */}
          {['text', 'select'].includes(activeTool) && (
            <>
              <div className="w-px h-6 bg-slate-200/60" />
              <div className="flex gap-1 items-center px-1">
                <button onClick={() => handleAlignSelect('start')} className={\`w-8 h-8 flex items-center justify-center rounded-lg transition-all \${activeAlign === 'start' ? 'bg-slate-100 shadow-inner' : 'hover:bg-slate-50'}\`} title="Align Left">
                  <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" /></svg>
                </button>
                <button onClick={() => handleAlignSelect('middle')} className={\`w-8 h-8 flex items-center justify-center rounded-lg transition-all \${activeAlign === 'middle' ? 'bg-slate-100 shadow-inner' : 'hover:bg-slate-50'}\`} title="Align Center">
                  <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M4 18h16" /></svg>
                </button>
                <button onClick={() => handleAlignSelect('end')} className={\`w-8 h-8 flex items-center justify-center rounded-lg transition-all \${activeAlign === 'end' ? 'bg-slate-100 shadow-inner' : 'hover:bg-slate-50'}\`} title="Align Right">
                  <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M10 12h10M4 18h16" /></svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}`;

content = content.replace(oldJSX, newJSX);

fs.writeFileSync(file, content);
console.log('Update complete.');
