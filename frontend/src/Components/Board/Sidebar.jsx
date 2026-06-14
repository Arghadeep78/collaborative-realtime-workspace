import { useState, useEffect, useRef } from 'react';
import { UI } from './boardConstants.js';
import { GENERAL_SECTION } from './taskConstants.js';

const GENERAL_ID = GENERAL_SECTION.id;

// ── Icon helpers ───────────────────────────────────────────────────────────────
const PlusIcon = ({ cls = 'w-3.5 h-3.5' }) => (
  <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" d="M12 5v14M5 12h14" />
  </svg>
);
const ChevronIcon = ({ open, cls = 'w-3 h-3' }) => (
  <svg className={`${cls} transition-transform duration-150 ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
  </svg>
);
const PencilIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.071-6.071a2.5 2.5 0 013.536 3.536L12 14.5H9v-3z" />
  </svg>
);
const TrashIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
  </svg>
);
const LayersIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);
const FileIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5l5 5v14a2 2 0 01-2 2z" />
  </svg>
);

// ── Small icon action button ───────────────────────────────────────────────────
function IconBtn({ onClick, title, danger, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-5 h-5 flex items-center justify-center rounded transition ${
        danger
          ? 'text-content-muted hover:bg-rose-500/10 hover:text-rose-500'
          : 'text-content-muted hover:bg-hover hover:text-content'
      }`}
    >
      {children}
    </button>
  );
}

// ── Inline rename input ────────────────────────────────────────────────────────
function InlineInput({ value, onChange, onCommit, onCancel }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.select(); }, []);
  return (
    <input
      ref={ref}
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit();
        if (e.key === 'Escape') onCancel();
      }}
      onClick={(e) => e.stopPropagation()}
      className="flex-1 min-w-0 bg-blue-500/10 border border-blue-400/60 rounded px-1.5 py-0.5 outline-none text-xs text-content font-medium"
    />
  );
}

// ── Page row ──────────────────────────────────────────────────────────────────
function PageBlock({
  page, index, active, editable, pagesCount, editingId, draft, setDraft,
  onCommitRename, onCancelRename, onStartRename, onSelect, onDelete,
  draggedPageId, dragOverPageId, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}) {
  const isDragOver = dragOverPageId === page.id && draggedPageId !== page.id;
  const isDragging = draggedPageId === page.id;

  return (
    <div
      onClick={() => onSelect(page.id)}
      onDoubleClick={() => onStartRename(page)}
      draggable={editable}
      onDragStart={(e) => { onDragStart(page.id); e.dataTransfer.effectAllowed = 'move'; }}
      onDragOver={(e) => { e.preventDefault(); if (draggedPageId && draggedPageId !== page.id) onDragOver(page.id); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(page.id); }}
      onDragEnd={onDragEnd}
      className={`group/page relative flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-all select-none border ${
        active
          ? 'border-blue-400/50 bg-blue-500/10 text-content'
          : 'border-transparent hover:bg-hover text-content-muted hover:text-content'
      } ${isDragOver ? 'ring-1 ring-blue-400 scale-[1.01]' : ''} ${isDragging ? 'opacity-40 scale-95' : ''}`}
    >
      {/* Number badge */}
      <span className={`shrink-0 w-4.5 h-4.5 rounded text-[9px] font-bold flex items-center justify-center tabular-nums ${active ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300' : 'bg-muted text-content-subtle'}`}>
        {index + 1}
      </span>

      {/* Title or rename input */}
      {editingId === page.id ? (
        <InlineInput
          value={draft}
          onChange={setDraft}
          onCommit={onCommitRename}
          onCancel={onCancelRename}
        />
      ) : (
        <span className="flex-1 min-w-0 truncate text-xs font-medium">{page.title}</span>
      )}

      {/* Delete — only when not renaming */}
      {editable && pagesCount > 1 && editingId !== page.id && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Delete this subsection? This cannot be undone.')) onDelete(page.id);
          }}
          title="Delete subsection"
          className="shrink-0 w-4 h-4 rounded text-content-muted hover:text-rose-500 opacity-0 group-hover/page:opacity-100 flex items-center justify-center transition"
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────────────
export default function Sidebar({
  pages, sections = [], activePageId, editable, collapsed, onToggleCollapse,
  onSelectPage, onAddPage, onRenamePage, onDeletePage, onMovePage, onMovePageToSection,
  onAddSection, onRenameSection, onDeleteSection,
}) {
  const [editingPageId, setEditingPageId] = useState(null);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [draft, setDraft] = useState('');
  const [customWidth, setCustomWidth] = useState(220);
  const [isResizing, setIsResizing] = useState(false);
  const [draggedPageId, setDraggedPageId] = useState(null);
  const [dragOverPageId, setDragOverPageId] = useState(null);
  const [dragOverSectionId, setDragOverSectionId] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({});

  useEffect(() => {
    if (!isResizing) return;
    const onMouseMove = (e) => {
      setCustomWidth(Math.max(180, Math.min(e.clientX - 12, 300)));
    };
    const onMouseUp = () => setIsResizing(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  const startRenameSection = (sec) => { if (!editable) return; setEditingSectionId(sec.id); setDraft(sec.title); };
  const commitRenameSection = () => { if (editingSectionId && draft.trim()) onRenameSection(editingSectionId, draft.trim()); setEditingSectionId(null); };
  const startRenamePage = (page) => { if (!editable) return; setEditingPageId(page.id); setDraft(page.title); };
  const commitRenamePage = () => { if (editingPageId && draft.trim()) onRenamePage(editingPageId, draft.trim()); setEditingPageId(null); };
  const toggleSection = (id) => setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const sectionGroups = (() => {
    // "General" is now a real stored section (see useBoardSync.ensureFirstPage),
    // so it comes through `sections` like any other — already sorted first by its
    // order -1. We only synthesize a transient General bucket as a safety net for
    // orphan pages whose sectionId is missing/invalid and no real General exists.
    const byId = new Map();
    sections.forEach((s) => byId.set(s.id, { ...s, pages: [] }));
    let orphanBucket = null;
    pages.forEach((p) => {
      if (p.sectionId && byId.has(p.sectionId)) {
        byId.get(p.sectionId).pages.push(p);
      } else {
        if (!orphanBucket) orphanBucket = { id: GENERAL_ID, title: GENERAL_SECTION.title, pages: [] };
        orphanBucket.pages.push(p);
      }
    });
    const result = sections.map((s) => byId.get(s.id));
    // Prepend the orphan bucket only when it exists AND no real General is present.
    if (orphanBucket && !byId.has(GENERAL_ID)) result.unshift(orphanBucket);
    return result;
  })();

  const totalPages = pages.length;
  let globalIdx = 0;

  return (
    <aside
      className={`relative shrink-0 flex flex-col m-3 mr-0 rounded-2xl overflow-hidden ${UI.surface} ${!isResizing ? 'transition-[width,opacity] duration-300 ease-in-out' : ''} ${collapsed ? 'opacity-80' : 'opacity-100'}`}
      style={{ width: collapsed ? 40 : customWidth }}
    >
      {/* Resize handle */}
      {!collapsed && (
        <div
          className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-20 transition-colors ${isResizing ? 'bg-blue-500/80' : 'hover:bg-blue-400/40'}`}
          onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
        />
      )}

      {collapsed ? (
        <div className="flex flex-col items-center py-2">
          <button onClick={onToggleCollapse} className={UI.iconBtn} title="Show sections">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          {/* Header — title + hover-reveal + button for new section */}
          <div className="group/header flex items-center justify-between px-3 py-2.5 border-b border-edge">
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-content-subtle select-none">
              Sections
            </span>
            <div className="flex items-center gap-0.5">
              {editable && (
                <button
                  onClick={() => onAddSection()}
                  title="New Section"
                  className="w-5 h-5 flex items-center justify-center rounded text-content-muted hover:bg-hover hover:text-content transition"
                >
                  <PlusIcon />
                </button>
              )}
              <button onClick={onToggleCollapse} className="w-5 h-5 flex items-center justify-center rounded text-content-subtle hover:text-content hover:bg-hover transition" title="Hide sidebar">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            </div>
          </div>

          {/* Section + page list */}
          <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
            {sectionGroups.map((group) => {
              const isCollapsed = !!collapsedSections[group.id];
              // Real (stored) sections — including a real "General" — are fully
              // editable. The only non-editable group is the transient orphan
              // bucket, which exists solely when no stored General is present.
              const isVirtual = !sections.some((s) => s.id === group.id);
              const isGeneral = isVirtual;
              const sectionPages = group.pages;

              return (
                <div key={group.id} className="px-2">
                  {/* ── Section header ── */}
                  <div
                    className={`group/sec flex items-center gap-1 h-7 rounded-lg px-1 hover:bg-hover/60 transition ${dragOverSectionId === group.id ? 'ring-1 ring-blue-400/60 bg-blue-500/5' : ''}`}
                    onDragOver={(e) => {
                      // Drop a dragged subsection onto a section header to move it
                      // into that section (works for populated sections too).
                      if (editable && draggedPageId) { e.preventDefault(); setDragOverSectionId(group.id); }
                    }}
                    onDragLeave={() => setDragOverSectionId(null)}
                    onDrop={(e) => {
                      if (!editable || !draggedPageId) return;
                      e.preventDefault();
                      onMovePageToSection(draggedPageId, isGeneral ? undefined : group.id);
                      setDraggedPageId(null);
                      setDragOverPageId(null);
                      setDragOverSectionId(null);
                    }}
                  >
                    {/* Collapse chevron */}
                    <button
                      onClick={() => toggleSection(group.id)}
                      className="shrink-0 w-4 h-4 flex items-center justify-center text-content-subtle hover:text-content transition rounded"
                      title={isCollapsed ? 'Expand' : 'Collapse'}
                    >
                      <ChevronIcon open={!isCollapsed} />
                    </button>

                    {/* Section title / inline rename */}
                    {editingSectionId === group.id ? (
                      <InlineInput
                        value={draft}
                        onChange={setDraft}
                        onCommit={commitRenameSection}
                        onCancel={() => setEditingSectionId(null)}
                      />
                    ) : (
                      <span
                        className="flex-1 min-w-0 truncate text-[11px] font-semibold tracking-wide uppercase text-content-muted select-none"
                        onDoubleClick={() => !isGeneral && startRenameSection(group)}
                        title={isGeneral ? undefined : 'Double-click to rename'}
                      >
                        {group.title}
                      </span>
                    )}

                    {/* Section action icons — reveal on hover */}
                    {editable && editingSectionId !== group.id && (
                      <div className="flex items-center gap-0.5 transition shrink-0">
                        <IconBtn
                          onClick={() => onAddPage(isGeneral ? undefined : group.id)}
                          title={`Add subsection to "${group.title}"`}
                        >
                          <PlusIcon />
                        </IconBtn>
                        {!isGeneral && (
                          <>
                            <IconBtn onClick={() => startRenameSection(group)} title="Rename section">
                              <PencilIcon />
                            </IconBtn>
                            <IconBtn
                              danger
                              onClick={() => {
                                if (window.confirm(`Delete section "${group.title}"? Subsections will move to ${GENERAL_SECTION.title}.`)) {
                                  onDeleteSection(group.id);
                                }
                              }}
                              title="Delete section"
                            >
                              <TrashIcon />
                            </IconBtn>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Page blocks ── */}
                  {!isCollapsed && (
                    <div
                      className="pl-5 mt-0.5 space-y-0.5 mb-1 min-h-1.5"
                      onDragOver={(e) => {
                        // Allow dropping onto an empty section's body to move a
                        // subsection into it (cross-section move).
                        if (editable && draggedPageId && sectionPages.length === 0) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        if (!editable || !draggedPageId || sectionPages.length !== 0) return;
                        e.preventDefault();
                        onMovePageToSection(draggedPageId, isGeneral ? undefined : group.id);
                        setDraggedPageId(null);
                        setDragOverPageId(null);
                      }}
                    >
                      {sectionPages.map((page) => {
                          const idx = globalIdx++;
                          return (
                            <PageBlock
                              key={page.id}
                              page={page}
                              index={idx}
                              active={page.id === activePageId}
                              editable={editable}
                              pagesCount={totalPages}
                              editingId={editingPageId}
                              draft={draft}
                              setDraft={setDraft}
                              onCommitRename={commitRenamePage}
                              onCancelRename={() => setEditingPageId(null)}
                              onStartRename={startRenamePage}
                              onSelect={onSelectPage}
                              onDelete={onDeletePage}
                              draggedPageId={draggedPageId}
                              dragOverPageId={dragOverPageId}
                              onDragStart={(id) => setDraggedPageId(id)}
                              onDragOver={(id) => setDragOverPageId(id)}
                              onDragLeave={() => setDragOverPageId(null)}
                              onDrop={(targetId) => {
                                setDragOverPageId(null);
                                if (draggedPageId && draggedPageId !== targetId) onMovePage(draggedPageId, targetId);
                                setDraggedPageId(null);
                              }}
                              onDragEnd={() => { setDraggedPageId(null); setDragOverPageId(null); }}
                            />
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── No footer — use header icons to add section/subsection ── */}
        </>
      )}
    </aside>
  );
}
