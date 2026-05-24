import { useEffect, useRef } from 'react';
import { STICKY_COLORS } from '../boardConstants.js';
import { Bold, Italic, Type } from 'lucide-react';

const TEXT_COLORS = ['#1e293b', '#7c3aed', '#dc2626', '#0369a1', '#065f46', '#ffffff'];

function FloatBar({ children, scale }) {
  const inv = 1 / (scale || 1);
  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        top: -60 * inv,
        left: '50%',
        transformOrigin: 'bottom center',
        transform: `translate(-50%, 0) scale(${inv})`,
        zIndex: 300,
        whiteSpace: 'nowrap',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="inline-flex items-center gap-2 bg-white/90 dark:bg-[#282e33]/90 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-xl px-3 py-2">
        {children}
      </div>
    </div>
  );
}

const Sep = () => <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />;

export default function StickyNote({ element, editable, editing, selected, onEditProps, getScale }) {
  const { props } = element;
  const color     = props.color     || STICKY_COLORS[0];
  const bold      = !!props.bold;
  const italic    = !!props.italic;
  const textColor = props.textColor || '#1e293b';
  // font size: user override OR auto-scale with note width
  const autoSize  = Math.max(20, Math.min(46, Math.round(element.w / 9)));
  const fontSize  = props.fontSize  || autoSize;

  const taRef = useRef(null);
  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      const len = taRef.current.value.length;
      taRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const scale = getScale?.() || 1;

  return (
    <div
      className="w-full h-full rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex flex-col p-5 relative overflow-hidden transition-all duration-200 border border-black/5 dark:border-white/5"
      style={{ backgroundColor: color }}
    >
      {/* Subtle Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
      
      {/* Tape Decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-white/40 dark:bg-black/10 backdrop-blur-sm rounded-b-lg shadow-sm border border-white/50 dark:border-white/10 pointer-events-none" />

      {/* Text format toolbar — shows while editing */}
      {editing && (
        <FloatBar scale={scale}>
          {/* Font size */}
          <div className="flex items-center gap-1">
            <Type className="w-4 h-4 text-slate-400" />
            <button
              onClick={() => onEditProps({ fontSize: Math.max(10, fontSize - 2) })}
              className="w-7 h-7 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-[15px] font-bold transition"
            >−</button>
            <span className="text-[14px] font-medium text-slate-600 dark:text-slate-300 tabular-nums w-7 text-center">{fontSize}</span>
            <button
              onClick={() => onEditProps({ fontSize: Math.min(120, fontSize + 2) })}
              className="w-7 h-7 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-[15px] font-bold transition"
            >+</button>
          </div>
          <Sep />
          {/* Bold */}
          <button
            onClick={() => onEditProps({ bold: !bold })}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${bold ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <Bold className="w-4 h-4" />
          </button>
          {/* Italic */}
          <button
            onClick={() => onEditProps({ italic: !italic })}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${italic ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <Italic className="w-4 h-4" />
          </button>
          <Sep />
          {/* Text color */}
          <div className="flex items-center gap-1.5 px-1">
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onEditProps({ textColor: c })}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition shrink-0 ${textColor === c ? 'border-blue-500 scale-125 shadow-sm' : 'border-transparent hover:scale-110'}`}
                style={{ backgroundColor: c, boxShadow: textColor !== c ? '0 0 0 1px rgba(0,0,0,0.1) inset' : undefined }}
                title="Text Color"
              />
            ))}
          </div>
        </FloatBar>
      )}

      {editing ? (
        <textarea
          ref={taRef}
          value={props.text}
          onChange={(e) => onEditProps({ text: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex-1 w-full bg-transparent resize-none outline-none placeholder:text-black/20 dark:placeholder:text-white/30 leading-snug z-10 pt-4"
          style={{
            fontSize,
            color: textColor,
            fontWeight: bold ? 700 : 400,
            fontStyle: italic ? 'italic' : 'normal',
          }}
          placeholder="Type an idea…"
        />
      ) : (
        <div
          className="flex-1 w-full whitespace-pre-wrap break-words leading-snug overflow-hidden z-10 pt-4"
          style={{
            fontSize,
            color: textColor,
            fontWeight: bold ? 700 : 400,
            fontStyle: italic ? 'italic' : 'normal',
          }}
        >
          {props.text || <span style={{ color: textColor, opacity: 0.3 }}>Empty note</span>}
        </div>
      )}

      {/* Note colour row — shown when selected */}
      {selected && editable && !editing && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 bg-white/40 dark:bg-black/20 backdrop-blur-md rounded-full border border-white/50 dark:border-white/10 shadow-sm z-20 transition-opacity" onPointerDown={(e) => e.stopPropagation()}>
          {STICKY_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onEditProps({ color: c })}
              className={`w-5 h-5 rounded-full border transition-all ${c === color ? 'ring-2 ring-black/40 dark:ring-white/60 ring-offset-1 scale-110 border-transparent' : 'border-black/10 dark:border-white/20 hover:scale-110'}`}
              style={{ background: c }}
              title="Recolor note"
            />
          ))}
        </div>
      )}
      
      {/* Bottom right fold effect */}
      <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-full h-full bg-gradient-to-tl from-black/10 to-transparent rounded-tl-xl" />
      </div>
    </div>
  );
}
