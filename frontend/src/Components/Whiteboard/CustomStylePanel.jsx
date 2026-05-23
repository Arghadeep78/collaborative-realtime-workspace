import { useState } from 'react';
import { track, useEditor, DefaultColorStyle, DefaultSizeStyle, DefaultDashStyle, DefaultFillStyle } from '@tldraw/tldraw';
import { UI, GRID_COLORS, getClosestTldrawColor } from './whiteboardConstants.js';

const CustomStylePanel = track(() => {
  const editor = useEditor();
  const [openMenu, setOpenMenu] = useState(null);

  const sharedStyles = editor.getSharedStyles();
  const activeColor = sharedStyles?.getAsKnownValue(DefaultColorStyle) || 'black';
  const activeSize = sharedStyles?.getAsKnownValue(DefaultSizeStyle) || 'm';
  const activeDash = sharedStyles?.getAsKnownValue(DefaultDashStyle) || 'draw';
  const activeFill = sharedStyles?.getAsKnownValue(DefaultFillStyle) || 'none';

  const applyStyle = (styleRef, value) => {
    editor.setStyleForNextShapes(styleRef, value);
    editor.setStyleForSelectedShapes(styleRef, value);
    setOpenMenu(null);
  };

  const handleToggle = (menuName) => {
    setOpenMenu(prev => prev === menuName ? null : menuName);
  };

  const colorOptions = ['black', 'blue', 'green', 'yellow', 'orange', 'red', 'violet'];
  const sizeOptions = ['s', 'm', 'l', 'xl'];
  const dashOptions = ['draw', 'solid', 'dashed', 'dotted'];
  const fillOptions = ['none', 'semi', 'solid', 'pattern'];

  return (
    <div className="pointer-events-auto flex gap-2 items-center">
      <div className={`rounded-2xl p-1.5 flex flex-row gap-2 ${UI.surfaceSolid} shadow-lg border border-slate-200`}>
        {/* Color */}
        <div className="relative">
          <button onClick={() => handleToggle('color')} className="w-8 h-8 rounded-[10px] flex items-center justify-center hover:bg-slate-100 transition-colors" title="Color">
            <div className="w-5 h-5 rounded-full shadow-sm border border-black/10" style={{ backgroundColor: getClosestTldrawColor(activeColor)?.hex || activeColor }} />
          </button>
          {openMenu === 'color' && (
            <div className="absolute top-full mt-2 left-0 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 p-2 grid grid-cols-4 gap-2 w-max z-50">
              {colorOptions.map(c => {
                const hex = GRID_COLORS.find(g => g.id === c)?.hex || c;
                return (
                  <button key={c} onClick={() => applyStyle(DefaultColorStyle, c)} className={`w-8 h-8 rounded-full shadow-sm border-2 transition-transform hover:scale-110 ${activeColor === c ? 'border-blue-500' : 'border-transparent'}`} style={{ backgroundColor: hex }} title={c} />
                );
              })}
            </div>
          )}
        </div>

        {/* Size */}
        <div className="relative">
          <button onClick={() => handleToggle('size')} className="w-8 h-8 rounded-[10px] flex items-center justify-center hover:bg-slate-100 text-slate-700 text-[11px] font-bold uppercase transition-colors" title="Size">
            {activeSize}
          </button>
          {openMenu === 'size' && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 p-2 flex flex-col gap-1 w-16 z-50">
              {sizeOptions.map(s => (
                <button key={s} onClick={() => applyStyle(DefaultSizeStyle, s)} className={`py-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors ${activeSize === s ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}>{s}</button>
              ))}
            </div>
          )}
        </div>

        {/* Dash */}
        <div className="relative">
          <button onClick={() => handleToggle('dash')} className="px-2 h-8 rounded-[10px] flex items-center justify-center hover:bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider transition-colors" title="Dash Style">
            {activeDash}
          </button>
          {openMenu === 'dash' && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 p-2 flex flex-col gap-1 w-20 z-50">
              {dashOptions.map(d => (
                <button key={d} onClick={() => applyStyle(DefaultDashStyle, d)} className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${activeDash === d ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}>{d}</button>
              ))}
            </div>
          )}
        </div>

        {/* Fill */}
        <div className="relative">
          <button onClick={() => handleToggle('fill')} className="px-2 h-8 rounded-[10px] flex items-center justify-center hover:bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider transition-colors" title="Fill">
            {activeFill === 'none' ? 'No Fill' : activeFill}
          </button>
          {openMenu === 'fill' && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 p-2 flex flex-col gap-1 w-20 z-50">
              {fillOptions.map(f => (
                <button key={f} onClick={() => applyStyle(DefaultFillStyle, f)} className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${activeFill === f ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}>{f}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default CustomStylePanel;
