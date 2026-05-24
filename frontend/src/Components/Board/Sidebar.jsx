import { useMemo, useState, useEffect } from 'react';
import { UI, SLIDE_W, SLIDE_H, STICKY_COLORS } from './boardConstants.js';

// Flat fill used to telegraph each element type in the miniature preview.
const SWATCH = {
  sticky: STICKY_COLORS[0],
  kanban: '#ffffff',
  text: 'transparent',
  poll: '#c7d2fe',
  iframe: '#cbd5e1',
};

import BoardElement from './BoardElement.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { getSlideBackground } from './SlideCanvas.jsx';

/**
 * A live, scaled-down render of one slide. Elements are positioned by percentage
 * of the slide (1600×900) so the preview tracks the box size with no scale math.
 */
function SlideThumbnail({ elements, page, sidebarWidth }) {
  const { isDark } = useTheme();
  const pageId = page.id;
  const items = useMemo(
    () =>
      Object.values(elements)
        .filter((e) => e.pageId === pageId && e.type !== 'connector')
        .sort((a, b) => (a.z ?? 0) - (b.z ?? 0)),
    [elements, pageId],
  );

  // Calculate dynamic scale based on sidebar width minus padding/borders (~38px)
  const thumbnailWidth = Math.max(sidebarWidth - 38, 100);
  const scale = thumbnailWidth / SLIDE_W;

  const slideBg = getSlideBackground(page?.background, isDark);

  return (
    <div
      className="relative w-full aspect-video rounded-md overflow-hidden ring-1 ring-black/10 select-none pointer-events-none"
      style={slideBg}
    >
      <div
        className="absolute top-0 left-0 origin-top-left pointer-events-none"
        style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})` }}
      >
        {items.map((el) => (
          <BoardElement
            key={el.id}
            element={el}
            getScale={() => scale}
            selected={false}
            editing={false}
            editable={false}
            connectMode={false}
          />
        ))}
      </div>
      {items.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-slate-300">
          Empty slide
        </div>
      )}
    </div>
  );
}

/**
 * Left pane: the slide hierarchy. Click a slide to make it active; editors can
 * add, rename (double-click), and delete slides. Collapsible to reclaim canvas.
 */
export default function Sidebar({
  pages,
  elements,
  activePageId,
  editable,
  collapsed,
  onToggleCollapse,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
  onMovePage,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');
  const [customWidth, setCustomWidth] = useState(240);
  const [isResizing, setIsResizing] = useState(false);
  const [draggedPageId, setDraggedPageId] = useState(null);
  const [dragOverPageId, setDragOverPageId] = useState(null);

  useEffect(() => {
    if (!isResizing) return;
    const onMouseMove = (e) => {
      // m-3 left margin is 12px
      const newWidth = Math.max(160, Math.min(e.clientX - 12, 260));
      setCustomWidth(newWidth);
    };
    const onMouseUp = () => setIsResizing(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  const startRename = (page) => {
    if (!editable) return;
    setEditingId(page.id);
    setDraft(page.title);
  };
  const commitRename = () => {
    if (editingId && draft.trim()) onRenamePage(editingId, draft.trim());
    setEditingId(null);
  };

  return (
    <aside
      className={`relative shrink-0 flex flex-col m-3 mr-0 rounded-2xl overflow-hidden ${UI.surface} ${!isResizing ? 'transition-[width,opacity] duration-300 ease-in-out' : ''
        } ${collapsed ? 'opacity-80' : 'opacity-100'}`}
      style={{ width: collapsed ? 40 : customWidth }}
    >
      {!collapsed && (
        <div
          className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-20 transition-colors ${isResizing ? 'bg-blue-500/80' : 'hover:bg-blue-400/50'
            }`}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
        />
      )}
      {collapsed ? (
        /* ── Collapsed: single expand button ── */
        <div className="flex flex-col items-center py-2">
          <button onClick={onToggleCollapse} className={UI.iconBtn} title="Show slides">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      ) : (
        /* ── Expanded: full panel ── */
        <>
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200/70 dark:border-slate-700/60">
            <span className="text-[11px] font-bold tracking-[0.16em] uppercase text-slate-400 dark:text-slate-500">
              Slides
            </span>
            <button onClick={onToggleCollapse} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title="Hide slides">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {pages.map((page, i) => {
              const active = page.id === activePageId;
              const isDragOver = dragOverPageId === page.id && draggedPageId !== page.id;
              return (
                <div
                  key={page.id}
                  onClick={() => onSelectPage(page.id)}
                  onDoubleClick={() => startRename(page)}
                  draggable={editable}
                  onDragStart={(e) => {
                    setDraggedPageId(page.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedPageId && draggedPageId !== page.id) setDragOverPageId(page.id);
                  }}
                  onDragLeave={() => setDragOverPageId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverPageId(null);
                    if (draggedPageId && draggedPageId !== page.id) onMovePage(draggedPageId, page.id);
                    setDraggedPageId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedPageId(null);
                    setDragOverPageId(null);
                  }}
                  className={`group relative rounded-xl border px-2.5 py-2 cursor-pointer transition ${
                    active
                      ? 'border-blue-400/60 bg-blue-500/10'
                      : 'border-transparent hover:bg-slate-900/5 dark:hover:bg-white/5'
                  } ${isDragOver ? 'ring-2 ring-blue-500 scale-[1.02] shadow-md z-10' : ''} ${draggedPageId === page.id ? 'opacity-40 scale-95' : ''}`}
                >
                  <SlideThumbnail elements={elements} page={page} sidebarWidth={customWidth} />

                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="shrink-0 w-5 h-5 rounded bg-slate-900/5 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-slate-400">
                      {i + 1}
                    </span>
                    {editingId === page.id ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-0 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100 border-b border-blue-400"
                      />
                    ) : (
                      <span className="flex-1 min-w-0 truncate text-sm text-slate-700 dark:text-slate-200">
                        {page.title}
                      </span>
                    )}
                  </div>

                  {editable && pages.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this slide? This cannot be undone.')) onDeletePage(page.id); }}
                      className="absolute top-2 left-2 w-8 h-8 rounded-md bg-white/90 dark:bg-slate-800/80 text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 opacity-0 group-hover:opacity-100 shadow-sm flex items-center justify-center transition"
                      title="Delete slide"
                      aria-label={`Delete slide ${i + 1}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {editable && (
            <div className="p-2 border-t border-slate-200/70 dark:border-slate-700/60">
              <button
                onClick={() => onAddPage()}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/5 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Slide
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
