import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../../contexts/ThemeContext.jsx';
import { getThemeColor } from '../theme/themeUtils.js';
import { TEXT_COLORS as _TEXT_COLORS } from '../theme/colorMap.js';

export function FloatBar({ children, scale, elementY, anchorRef }) {
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const flipDown = typeof elementY === 'number' && elementY * (scale || 1) < 80;
    setPos((prev) => {
      if (
        prev &&
        prev.flipDown === flipDown &&
        prev.rect.left === rect.left &&
        prev.rect.top === rect.top &&
        prev.rect.width === rect.width &&
        prev.rect.height === rect.height
      ) return prev;
      return { rect, flipDown };
    });
  });

  if (!pos) return null;

  const { rect, flipDown } = pos;
  const centerX = rect.left + rect.width / 2;
  const top = flipDown ? rect.bottom + 8 : rect.top - 8;
  const translateY = flipDown ? '0%' : '-100%';

  return createPortal(
    <div
      className="pointer-events-auto"
      style={{
        position: 'fixed',
        left: centerX,
        top,
        transform: `translateX(-50%) translateY(${translateY})`,
        zIndex: 9999,
        whiteSpace: 'nowrap',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="inline-flex items-center gap-1 bg-surface border border-edge rounded-2xl shadow-2xl px-2.5 py-2">
        {children}
      </div>
    </div>,
    document.body,
  );
}

export const Sep = () => <div className="w-px h-4 bg-edge mx-0.5 shrink-0" />;

export function Swatch({ color, active, onClick, label, transparent }) {
  const { isDark } = useTheme();
  const displayColor = getThemeColor(color, isDark);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      title={label || color}
      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition shrink-0 ${active ? 'border-blue-500 scale-110' : onClick ? 'border-transparent hover:border-edge-strong' : 'border-transparent'}`}
      style={{ backgroundColor: transparent ? 'transparent' : displayColor, boxShadow: '0 0 0 1px var(--c-edge) inset' }}
    >
      {transparent && <span className="text-[10px] text-content-subtle font-bold leading-none">/</span>}
    </Tag>
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
        className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${open ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-content-muted hover:bg-hover'}`}
        title={title}
      >
        {activeIcon}
      </button>
      {open && (
        <div
          ref={popoverRef}
          className="absolute top-full mt-3 bg-surface shadow-xl border border-edge rounded-xl p-3 flex flex-col gap-2 cursor-default whitespace-normal pointer-events-auto"
          style={{ zIndex: 10000, ...popStyle }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export const TEXT_COLORS = _TEXT_COLORS;

export function TextFormatToolbar({ onEditProps, fontSize, bold, italic, textAlign, textColor, scale, elementY, anchorRef }) {
  return (
    <FloatBar scale={scale} elementY={elementY} anchorRef={anchorRef}>
      {/* Font size */}
      <button
        onClick={() => onEditProps({ fontSize: Math.max(10, fontSize - 2) })}
        className="w-7 h-7 rounded-lg text-content-muted hover:bg-hover flex items-center justify-center text-[13px] font-bold"
      >A−</button>
      <span className="text-[12px] text-content-subtle tabular-nums w-7 text-center">{fontSize}</span>
      <button
        onClick={() => onEditProps({ fontSize: Math.min(120, fontSize + 2) })}
        className="w-7 h-7 rounded-lg text-content-muted hover:bg-hover flex items-center justify-center text-[13px] font-bold"
      >A+</button>
      <Sep />
      {/* Bold */}
      <button
        onClick={() => onEditProps({ bold: !bold })}
        className={`w-7 h-7 rounded-lg text-[13px] font-bold flex items-center justify-center transition ${bold ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-content-muted hover:bg-hover'}`}
      >B</button>
      {/* Italic */}
      <button
        onClick={() => onEditProps({ italic: !italic })}
        className={`w-7 h-7 rounded-lg text-[13px] italic font-semibold flex items-center justify-center transition ${italic ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-content-muted hover:bg-hover'}`}
      >I</button>
      <Sep />
      {/* Alignment */}
      {[['left', '⬅'], ['center', '↔'], ['right', '➡'], ['justify', '⇔']].map(([a, sym]) => (
        <button
          key={a}
          onClick={() => onEditProps({ textAlign: a })}
          className={`w-7 h-7 rounded-lg text-[11px] flex items-center justify-center transition ${textAlign === a ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'text-content-muted hover:bg-hover'}`}
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
