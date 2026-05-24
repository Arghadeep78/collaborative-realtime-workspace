import { useState, useRef, useEffect, useLayoutEffect } from 'react';

export function FloatBar({ children, scale, elementY }) {
  const inv = 1 / (scale || 1);
  // Flip toolbar below element when element is near the top of the slide (avoids topbar overlap)
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

export const Sep = () => <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-0.5 shrink-0" />;

export function Swatch({ color, active, onClick, label, transparent }) {
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

export function Popover({ activeIcon, children, title }) {
  const [open, setOpen] = useState(false);
  const [popStyle, setPopStyle] = useState({ left: '50%', transform: 'translateX(-50%)' });
  const containerRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onDown, { capture: true });
    return () => window.removeEventListener('pointerdown', onDown, { capture: true });
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !popoverRef.current) return;
    const rect = popoverRef.current.getBoundingClientRect();
    const margin = 8;
    if (rect.right > window.innerWidth - margin) {
      setPopStyle({ left: 'auto', right: 0, transform: 'none' });
    } else if (rect.left < margin) {
      setPopStyle({ left: 0, right: 'auto', transform: 'none' });
    } else {
      setPopStyle({ left: '50%', transform: 'translateX(-50%)' });
    }
  }, [open]);

  return (
    <div className="relative flex items-center shrink-0" ref={containerRef}>
      <button
        onClick={() => { setPopStyle({ left: '50%', transform: 'translateX(-50%)' }); setOpen(!open); }}
        className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${open ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
        title={title}
      >
        {activeIcon}
      </button>
      {open && (
        <div
          ref={popoverRef}
          className="absolute top-full mt-3 bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 rounded-xl p-3 z-50 flex flex-col gap-2 cursor-default whitespace-normal pointer-events-auto"
          style={popStyle}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export const TEXT_COLORS = ['#1e293b', '#ffffff', '#6366f1', '#ef4444', '#10b981', '#f59e0b'];

export function TextFormatToolbar({ onEditProps, fontSize, bold, italic, textAlign, textColor, scale, elementY }) {
  return (
    <FloatBar scale={scale} elementY={elementY}>
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
      {[['left', '⬅'], ['center', '↔'], ['right', '➡'], ['justify', '⇔']].map(([a, sym]) => (
        <button
          key={a}
          onClick={() => onEditProps({ textAlign: a })}
          className={`w-7 h-7 rounded-lg text-[11px] flex items-center justify-center transition ${textAlign === a ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          title={`Align ${a}`}
        >{sym}</button>
      ))}
      <Sep />
      {/* Text color */}
      <Popover title="Text Color" activeIcon={<Swatch color={textColor} active={false} />}>
        <div className="grid grid-cols-5 gap-1.5 w-[140px]">
          {TEXT_COLORS.map((c) => (
            <Swatch key={c} color={c} active={textColor === c} onClick={() => onEditProps({ textColor: c })} />
          ))}
        </div>
      </Popover>
    </FloatBar>
  );
}
