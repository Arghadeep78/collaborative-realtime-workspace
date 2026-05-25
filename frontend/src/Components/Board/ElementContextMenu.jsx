import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Layer glyphs — the highlighted rectangle shows where the target lands.
function LayerGlyph({ mode }) {
  const c = { className: 'w-4 h-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const hi = '#3b82f6';
  if (mode === 'front')
    return <svg {...c}><rect x="4" y="4" width="11" height="11" rx="1.5" stroke={hi} /><rect x="9" y="9" width="11" height="11" rx="1.5" /></svg>;
  if (mode === 'forward')
    return <svg {...c}><rect x="4" y="4" width="11" height="11" rx="1.5" /><rect x="9" y="9" width="11" height="11" rx="1.5" stroke={hi} /><path d="M9 9h11v11" stroke={hi} /></svg>;
  if (mode === 'backward')
    return <svg {...c}><rect x="9" y="9" width="11" height="11" rx="1.5" /><rect x="4" y="4" width="11" height="11" rx="1.5" stroke={hi} /></svg>;
  // back
  return <svg {...c}><rect x="9" y="9" width="11" height="11" rx="1.5" stroke={hi} /><rect x="4" y="4" width="11" height="11" rx="1.5" /></svg>;
}

// Speech-bubble glyph for the Comments action.
function CommentGlyph() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

/**
 * Right-click context menu for a board element. Positioned in viewport
 * coordinates (the slide is scaled, so screen coords are used directly) and
 * clamped to stay on-screen. Dismisses on outside click, Escape, scroll, or
 * resize.
 *
 * Layering actions (`onAction`) are shown only when `canLayer` (owner/editor).
 * The Comments action (`onComment`) is shown when `canComment` (owner / editor
 * / commenter — not viewers) and works for everyone who can comment, so a
 * commenter who can't reorder still gets a menu with just the Comments entry.
 */
export default function ElementContextMenu({
  x, y, atFront, atBack, onAction, onClose,
  canLayer = true, canComment = false, commentCount = 0, onComment,
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Clamp into the viewport once we know the menu's measured size.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const pad = 8;
    setPos({
      left: Math.min(x, window.innerWidth - width - pad),
      top: Math.min(y, window.innerHeight - height - pad),
    });
  }, [x, y]);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const items = [
    { mode: 'front',    label: 'Bring to Front', disabled: atFront },
    { mode: 'forward',  label: 'Bring Forward',  disabled: atFront },
    { mode: 'backward', label: 'Send Backward',  disabled: atBack },
    { mode: 'back',     label: 'Send to Back',   disabled: atBack },
  ];

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[9999] min-w-[176px] py-1.5 rounded-xl bg-surface/95 backdrop-blur-xl border border-edge shadow-[0_16px_40px_rgba(12,18,36,0.22)] select-none"
      style={{ left: pos.left, top: pos.top }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {canLayer && (
        <>
          <div className="px-3 pb-1 pt-0.5 text-[10px] font-bold tracking-[0.16em] uppercase text-content-subtle">
            Layer
          </div>
          {items.map((it) => (
            <button
              key={it.mode}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => { onAction(it.mode); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-content hover:bg-blue-500/10 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-content transition text-left"
            >
              <span className="text-content-muted shrink-0"><LayerGlyph mode={it.mode} /></span>
              {it.label}
            </button>
          ))}
        </>
      )}

      {canComment && (
        <>
          {canLayer && <div className="my-1 mx-2 h-px bg-edge" />}
          <button
            role="menuitem"
            onClick={() => { onComment?.(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-content hover:bg-blue-500/10 hover:text-blue-700 dark:hover:text-blue-300 transition text-left"
          >
            <span className="text-content-muted shrink-0"><CommentGlyph /></span>
            <span className="flex-1">Comments</span>
            {commentCount > 0 && (
              <span className="shrink-0 min-w-[18px] text-center px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] font-bold tabular-nums">
                {commentCount}
              </span>
            )}
          </button>
        </>
      )}
    </div>
  );
}
