import { useMemo, useState } from 'react';
import {
  TASK_STATUSES, TASK_PRIORITIES, GENERAL_SECTION,
  resolveTaskLocation, statusOf, priorityOf, dueMeta,
} from './taskConstants.js';
import { X, Search, Plus, ChevronRight, ChevronDown, Clock, ClipboardList } from 'lucide-react';
import MemberAvatar from './MemberAvatar.jsx';

// One task row in a group.
function TaskRow({ task, location, members, onClick }) {
  const status = statusOf(task);
  const priority = priorityOf(task);
  const due = dueMeta(task.props?.dueDate);
  const assignees = task.props?.assignees || [];
  const memberOf = (email) => members.find((m) => m.email === email);

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-hover transition group"
    >
      <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: priority.strip }} title={`${priority.label} priority`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-content truncate flex-1">
            {task.props?.title || <span className="text-content-subtle italic">Untitled task</span>}
          </span>
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${status.chip}`}>
            {status.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-content-muted">
          <span className="text-[11px] truncate min-w-0 flex items-center gap-0.5">
            {location.sectionTitle} <ChevronRight className="w-3 h-3 inline shrink-0" /> {location.pageTitle}
          </span>
          {due && (
            <span className={`shrink-0 flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-semibold ${due.badgeCls}`}>
              <Clock className="w-2.5 h-2.5" /> {due.label}
            </span>
          )}
          {assignees.length > 0 && (
            <span className="shrink-0 flex items-center -space-x-1 ml-auto">
              {assignees.slice(0, 3).map((a) => {
                const m = memberOf(a);
                return <MemberAvatar key={a} label={m?.name || a} email={a} size={18} />;
              })}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

const PillToggle = ({ active, onClick, children, cls }) => (
  <button
    onClick={onClick}
    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${active ? (cls || 'bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400/50') : 'bg-muted text-content-muted hover:bg-hover'}`}
  >
    {children}
  </button>
);

/**
 * The single global task viewer for the whole project — a right-side drawer.
 * Lists every `task` element across all pages/sections, grouped Section → Page
 * (collapsible). Filters (status/priority/section/assignee/search) are local
 * React state only. Clicking a row calls onSelectTask(task) — the parent
 * switches to that task's page and opens its modal. New Task quick-create at the
 * bottom adds a task to the centre of the chosen page.
 */
export default function TaskPanel({
  open, onClose, tasks, pages, sections, members, editable,
  onSelectTask, onCreateTask, activePageId,
}) {
  const [statusFilter, setStatusFilter] = useState(new Set());
  const [priorityFilter, setPriorityFilter] = useState(new Set());
  const [sectionFilter, setSectionFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState(new Set());
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({}); // groupKey → bool
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftStatus, setDraftStatus] = useState('todo');
  const [draftPage, setDraftPage] = useState(activePageId || '');

  const toggleIn = (setFn) => (val) => setFn((prev) => {
    const n = new Set(prev);
    if (n.has(val)) n.delete(val); else n.add(val);
    return n;
  });
  const toggleStatus = toggleIn(setStatusFilter);
  const togglePriority = toggleIn(setPriorityFilter);
  const toggleAssignee = toggleIn(setAssigneeFilter);

  // Attach resolved location to each task once.
  const located = useMemo(() =>
    tasks.map((t) => ({ task: t, location: resolveTaskLocation(t.pageId, pages, sections) })),
    [tasks, pages, sections]);

  // Apply filters.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return located.filter(({ task, location }) => {
      if (statusFilter.size && !statusFilter.has(task.props?.status || 'todo')) return false;
      if (priorityFilter.size && !priorityFilter.has(task.props?.priority || 'medium')) return false;
      if (sectionFilter !== 'all' && location.sectionId !== sectionFilter) return false;
      if (assigneeFilter.size) {
        const a = task.props?.assignees || [];
        if (!a.some((e) => assigneeFilter.has(e))) return false;
      }
      if (q && !(task.props?.title || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [located, statusFilter, priorityFilter, sectionFilter, assigneeFilter, search]);

  // Group Section → Page, preserving sections then pages order.
  const groups = useMemo(() => {
    // "General" is a real stored section now, so it's already in `sections`. Only
    // synthesize a leading General bucket when no real one exists, to still group
    // orphan pages (sectionId missing/invalid).
    const hasRealGeneral = sections.some((s) => s.id === GENERAL_SECTION.id);
    const orderedSections = hasRealGeneral ? sections : [GENERAL_SECTION, ...sections];
    const out = [];
    orderedSections.forEach((sec) => {
      const secPages = pages.filter((p) =>
        sec.id === GENERAL_SECTION.id ? (p.sectionId === GENERAL_SECTION.id || !p.sectionId) : p.sectionId === sec.id);
      secPages.forEach((page) => {
        const rows = filtered.filter(({ task }) => task.pageId === page.id);
        if (rows.length) {
          out.push({ key: `${sec.id}:${page.id}`, sectionTitle: sec.title, pageTitle: page.title, rows });
        }
      });
    });
    return out;
  }, [filtered, pages, sections]);

  const total = filtered.length;

  const submitCreate = () => {
    const title = draftTitle.trim();
    const pageId = draftPage || activePageId;
    if (!title || !pageId) return;
    onCreateTask({ title, status: draftStatus, pageId });
    setDraftTitle('');
    setCreating(false);
  };

  return (
    <div
      className={`absolute inset-y-0 right-0 w-[400px] max-w-full z-[70] flex flex-col bg-surface border-l border-edge shadow-[0_0_40px_rgba(12,18,36,0.18)] transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'} ${open ? '' : 'pointer-events-none'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge shrink-0">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-500" />
          <h2 className="text-sm font-bold text-content">Tasks</h2>
          <span className="text-[11px] font-semibold text-content-muted bg-muted rounded-full px-2 py-0.5">{total}</span>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-content-muted hover:bg-hover transition" title="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 border-b border-edge shrink-0 flex flex-col gap-3 max-h-[50%] overflow-y-auto">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-content-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-full bg-muted border border-edge rounded-lg pl-8 pr-3 py-1.5 text-[13px] text-content outline-none focus:border-blue-500/70 transition"
            data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" spellCheck={false}
          />
        </div>

        {/* Status */}
        <div className="flex flex-wrap gap-1.5">
          {TASK_STATUSES.map((s) => (
            <PillToggle key={s.id} active={statusFilter.has(s.id)} onClick={() => toggleStatus(s.id)} cls={`${s.chip} ring-1 ring-blue-400/40`}>
              {s.label}
            </PillToggle>
          ))}
        </div>

        {/* Priority */}
        <div className="flex flex-wrap gap-1.5">
          {TASK_PRIORITIES.map((p) => (
            <PillToggle key={p.id} active={priorityFilter.has(p.id)} onClick={() => togglePriority(p.id)} cls={`${p.chip} ring-1 ring-blue-400/40`}>
              {p.label}
            </PillToggle>
          ))}
        </div>

        {/* Section dropdown */}
        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="bg-muted border border-edge rounded-lg px-2 py-1.5 text-[12px] font-semibold text-content outline-none focus:border-blue-500/70 transition w-full"
        >
          <option value="all">All sections</option>
          <option value={GENERAL_SECTION.id}>{GENERAL_SECTION.title}</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>

        {/* Filter by member — shows every member of this board (owner + collaborators) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-content-muted">Filter by member</span>
            {assigneeFilter.size > 0 && (
              <button
                onClick={() => setAssigneeFilter(new Set())}
                className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          {members.length === 0 ? (
            <span className="text-[11px] text-content-subtle italic">No members on this board.</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => {
                const selected = assigneeFilter.has(m.email);
                return (
                  <button
                    key={m.email}
                    onClick={() => toggleAssignee(m.email)}
                    title={m.name || m.email}
                    className={`flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full border transition ${selected ? 'bg-blue-500/15 border-blue-400/60 text-blue-700 dark:text-blue-300' : 'bg-muted border-edge text-content-muted hover:bg-hover'}`}
                  >
                    <MemberAvatar label={m.name || m.email} email={m.email} size={20} ring={selected ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-surface' : ''} />
                    <span className="text-[11px] font-semibold max-w-27.5 truncate">{m.name || m.email}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Grouped task list */}
      <div className="flex-1 overflow-y-auto py-2">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-content-subtle gap-2 px-6 text-center">
            <ClipboardList className="w-8 h-8 opacity-40" />
            <p className="text-[13px]">{total === 0 ? 'No tasks match your filters.' : ''}</p>
          </div>
        ) : (
          groups.map((g) => {
            const isCollapsed = !!collapsed[g.key];
            return (
              <div key={g.key} className="px-2 mb-1">
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-hover transition"
                >
                  {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-content-subtle" /> : <ChevronDown className="w-3.5 h-3.5 text-content-subtle" />}
                  <span className="text-[11px] font-bold uppercase tracking-wide text-content-muted truncate">
                    {g.sectionTitle} <span className="text-content-subtle">›</span> {g.pageTitle}
                  </span>
                  <span className="ml-auto text-[10px] font-semibold text-content-subtle bg-muted rounded-full px-1.5">{g.rows.length}</span>
                </button>
                {!isCollapsed && (
                  <div className="pl-1.5">
                    {g.rows.map(({ task, location }) => (
                      <TaskRow key={task.id} task={task} location={location} members={members} onClick={() => onSelectTask(task)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* New Task */}
      {editable && (
        <div className="border-t border-edge p-3 shrink-0">
          {creating ? (
            <div className="flex flex-col gap-2">
              <input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitCreate(); if (e.key === 'Escape') setCreating(false); }}
                placeholder="Task title…"
                className="w-full bg-muted border border-edge rounded-lg px-3 py-2 text-[13px] text-content outline-none focus:border-blue-500/70 transition"
                data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" spellCheck={false}
              />
              <div className="flex items-center gap-2">
                <select
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value)}
                  className="bg-muted border border-edge rounded-lg px-2 py-1.5 text-[12px] font-semibold text-content outline-none flex-1"
                >
                  {TASK_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <select
                  value={draftPage}
                  onChange={(e) => setDraftPage(e.target.value)}
                  className="bg-muted border border-edge rounded-lg px-2 py-1.5 text-[12px] font-semibold text-content outline-none flex-1 min-w-0"
                >
                  {pages.length === 0 && <option value="">No pages</option>}
                  {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={submitCreate}
                  disabled={!draftTitle.trim() || !(draftPage || activePageId)}
                  className="flex-1 py-2 rounded-lg text-[13px] font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Add task
                </button>
                <button onClick={() => setCreating(false)} className="px-3 py-2 rounded-lg text-[13px] font-semibold bg-muted text-content-muted hover:bg-hover transition">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setDraftPage(activePageId || (pages[0]?.id ?? '')); setCreating(true); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-400/30 transition"
            >
              <Plus className="w-4 h-4" /> New Task
            </button>
          )}
        </div>
      )}
    </div>
  );
}
