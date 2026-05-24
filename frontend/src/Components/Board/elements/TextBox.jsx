import { useEffect, useRef } from 'react';
import { Bold, Italic, Type, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

const TEXT_COLORS = [
  '#1e293b', '#6366f1', '#ef4444', '#10b981', '#f59e0b', '#ec4899', '#ffffff',
];

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

export default function TextBox({ element, editable, editing, selected, onEditProps, getScale }) {
  const { props } = element;
  const fontSize  = props.fontSize || props.size || 34;
  const bold      = !!props.bold;
  const italic    = !!props.italic;
  const textColor = props.textColor || '#1e293b';
  const textAlign = props.textAlign || 'left';
  const taRef = useRef(null);

  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      const len = taRef.current.value.length;
      taRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const scale = getScale?.() || 1;

  const textStyle = {
    fontSize,
    color: textColor,
    fontWeight: bold ? 700 : 600,
    fontStyle: italic ? 'italic' : 'normal',
    textAlign,
  };

  return (
    <div className="relative w-full h-full">
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
          {/* Alignment */}
          {[[AlignLeft, 'left'], [AlignCenter, 'center'], [AlignRight, 'right']].map(([Icon, a]) => (
            <button
              key={a}
              onClick={() => onEditProps({ textAlign: a })}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${textAlign === a ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title={`Align ${a}`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
          <Sep />
          {/* Text color */}
          <div className="flex items-center gap-1.5 px-1">
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onEditProps({ textColor: c })}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition shrink-0 ${textColor === c ? 'border-blue-500 scale-125 shadow-sm' : 'border-transparent hover:scale-110'}`}
                style={{ backgroundColor: c, boxShadow: textColor !== c ? '0 0 0 1px rgba(0,0,0,0.15) inset' : undefined }}
                title="Text color"
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
          className="w-full h-full bg-transparent resize-none outline-none placeholder:text-slate-400 leading-tight"
          style={textStyle}
          placeholder="Add text…"
        />
      ) : (
        <div
          className="w-full h-full whitespace-pre-wrap break-words leading-tight overflow-hidden"
          style={textStyle}
        >
          {props.text || <span className="text-slate-400 font-normal" style={{ fontSize, fontStyle: 'normal' }}>Text</span>}
        </div>
      )}
    </div>
  );
}
