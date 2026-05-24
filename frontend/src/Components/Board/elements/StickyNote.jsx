import { useEffect, useRef } from 'react';
import { STICKY_COLORS } from '../boardConstants.js';

const TEXT_COLORS = ['#1e293b', '#7c3aed', '#dc2626', '#0369a1', '#065f46', '#ffffff'];

function FloatBar({ children, scale, elementY }) {
  const inv = 1 / (scale || 1);
  const flipDown = typeof elementY === 'number' && elementY * (scale || 1) < 80;
  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        ...(flipDown
          ? { top: `calc(100% + ${8 * inv}px)`, transformOrigin: 'top center' }
          : { top: -56 * inv, transformOrigin: 'bottom center' }),
        left: '50%',
        transform: `translate(-50%, 0) scale(${inv})`,
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

export default function StickyNote({ element, editable, editing, selected, onEditProps, getScale }) {
  const { props } = element;
  const color = props.color || STICKY_COLORS[0];
  const bold = !!props.bold;
  const italic = !!props.italic;
  const textColor = props.textColor || '#1e293b';
  const autoSize = Math.max(20, Math.min(46, Math.round(element.w / 9)));
  const fontSize = props.fontSize || autoSize;

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
      className={`w-full h-full rounded-xl flex flex-col p-5 relative transition-all duration-200 border overflow-hidden group ${
        selected && editable
          ? 'ring-2 ring-blue-400/40 shadow-[0_12px_40px_rgba(59,130,246,0.15)]'
          : 'border-black/5 dark:border-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]'
      }`}
      style={{ backgroundColor: color }}
    >
      {/* Paper texture overlay */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none rounded-xl"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%221%22 /%3E%3C/filter%3E%3Crect width=%22100%22 height=%22100%22 filter=%22url(%23noise)%22 opacity=%220.1%22/%3E%3C/svg%3E")',
          backgroundSize: '100px 100px',
        }}
      />


      {/* Enhanced Tape Decoration */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 w-16 h-3 pointer-events-none">
        <div className="absolute inset-0 bg-white/60 dark:bg-black/15 backdrop-blur-sm rounded-sm shadow-[0_2px_8px_rgba(0,0,0,0.15)] border-y border-white/30 dark:border-white/5" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-sm" />
        <div className="absolute -bottom-1 inset-x-0 h-1 bg-black/5 blur-sm" />
      </div>

      {/* Text format toolbar */}
      {(editing || selected) && editable && (
        <FloatBar scale={scale} elementY={element.y}>
          <button
            onClick={() => onEditProps({ fontSize: Math.max(10, fontSize - 2) })}
            className="w-7 h-7 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-[13px] font-bold transition-colors"
          >
            A−
          </button>
          <span className="text-[12px] text-slate-400 tabular-nums w-7 text-center">{fontSize}</span>
          <button
            onClick={() => onEditProps({ fontSize: Math.min(120, fontSize + 2) })}
            className="w-7 h-7 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-[13px] font-bold transition-colors"
          >
            A+
          </button>
          <Sep />
          <button
            onClick={() => onEditProps({ bold: !bold })}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition text-[13px] font-bold ${bold ? 'bg-blue-200 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          >
            B
          </button>
          <button
            onClick={() => onEditProps({ italic: !italic })}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition text-[13px] font-bold italic ${italic ? 'bg-blue-200 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          >
            I
          </button>
          <Sep />
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onEditProps({ textColor: c })}
              title="Text color"
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition shrink-0 ${textColor === c ? 'border-blue-500 scale-125 shadow-md' : 'border-transparent hover:border-slate-300 dark:hover:border-slate-500 hover:scale-110'}`}
              style={{ backgroundColor: c, boxShadow: '0 0 0 1px #e2e8f0 inset' }}
            />
          ))}
        </FloatBar>
      )}

      {/* Main content */}
      {editing ? (
        <textarea
          ref={taRef}
          value={props.text}
          onChange={(e) => onEditProps({ text: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex-1 w-full bg-transparent resize-none outline-none placeholder:text-black/25 dark:placeholder:text-white/30 leading-snug z-10 pt-2 font-medium"
          style={{
            fontSize,
            color: textColor,
            fontWeight: bold ? 700 : 600,
            fontStyle: italic ? 'italic' : 'normal',
          }}
          placeholder="Type an idea…"
        />
      ) : (
        <div
          className={`flex-1 w-full whitespace-pre-wrap break-words leading-snug overflow-hidden z-10 pt-2 font-medium transition-opacity ${!props.text ? 'opacity-40' : ''}`}
          style={{
            fontSize,
            color: textColor,
            fontWeight: bold ? 700 : 600,
            fontStyle: italic ? 'italic' : 'normal',
          }}
        >
          {props.text || 'Empty note'}
        </div>
      )}

      {/* Color picker - shown on hover when selected */}
      {selected && editable && !editing && (
        <div
          className="mt-3 flex items-center gap-1.5 p-2.5 bg-white/30 dark:bg-black/20 backdrop-blur-md rounded-lg border border-white/40 dark:border-white/10 shadow-sm z-20 transition-all opacity-0 group-hover:opacity-100 duration-200"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] font-semibold text-black/50 dark:text-white/50 uppercase tracking-wide px-1">Color</span>
          {STICKY_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onEditProps({ color: c })}
              className={`w-6 h-6 rounded-full border-2 transition-all flex-shrink-0 hover:scale-110 active:scale-95 ${
                c === color
                  ? 'ring-2 ring-black/40 dark:ring-white/60 ring-offset-1 scale-110 border-white/60 dark:border-white/40 shadow-md'
                  : 'border-white/30 dark:border-white/20 hover:border-white/50'
              }`}
              style={{ background: c }}
              title={`Color: ${c}`}
            />
          ))}
        </div>
      )}

      {/* Bottom right fold corner */}
      <div className="absolute bottom-0 right-0 w-7 h-7 pointer-events-none overflow-hidden rounded-tl-lg">
        <div className="absolute bottom-0 right-0 w-full h-full bg-gradient-to-tl from-black/15 to-transparent" />
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white/20 rounded-full blur-sm" />
      </div>
    </div>
  );
}
