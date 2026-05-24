import { useMemo, useState } from 'react';
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

/**
 * A live, scaled-down render of one slide. Elements are positioned by percentage
 * of the slide (1600×900) so the preview tracks the box size with no scale math.
 */
function SlideThumbnail({ elements, pageId }) {
  const items = useMemo(
    () =>
      Object.values(elements)
        .filter((e) => e.pageId === pageId && e.type !== 'connector')
        .sort((a, b) => (a.z ?? 0) - (b.z ?? 0)),
    [elements, pageId],
  );

  // Width is approx 202px inside the container. Scale is ~0.126
  const scale = 0.126;

  return (
    <div
      className="relative w-full aspect-video rounded-md overflow-hidden bg-white ring-1 ring-black/10 select-none pointer-events-none"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(15,23,42,0.06) 1px, transparent 1px)',
        backgroundSize: '10px 10px',
      }}
    >
      <div 
        className="absolute top-0 left-0 origin-top-left"
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
}) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');

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
      className={`shrink-0 flex flex-col m-3 mr-0 rounded-2xl overflow-hidden ${UI.surface} transition-[width,opacity] duration-300 ease-in-out ${
        collapsed ? 'w-10 opacity-80' : 'w-60 opacity-100'
      }`}
    >
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
              return (
                <div
                  key={page.id}
                  onClick={() => onSelectPage(page.id)}
                  onDoubleClick={() => startRename(page)}
                  className={`group relative rounded-xl border px-2.5 py-2 cursor-pointer transition ${
                    active
                      ? 'border-blue-400/60 bg-blue-500/10'
                      : 'border-transparent hover:bg-slate-900/5 dark:hover:bg-white/5'
                  }`}
                >
                  <SlideThumbnail elements={elements} pageId={page.id} />

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
                      onClick={(e) => { e.stopPropagation(); onDeletePage(page.id); }}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition"
                      title="Delete slide"
                    >
                      <svg className="w-3.5 h-3.5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
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
