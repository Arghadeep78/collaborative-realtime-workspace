// ─────────────────────────────────────────────────────────────────────────────
// Task element — shared constants & helpers
//
// A `task` is a board element stored in the same `elements` Y.Map as stickies.
// It carries a fixed-size card on the canvas and is edited through a modal; a
// single global TaskPanel lists every task across the whole project. This module
// is the one source of truth for the status / priority vocabularies, their
// colours, and the pageId → page → section breadcrumb lookup the modal + panel
// both use.
// ─────────────────────────────────────────────────────────────────────────────

// Status vocabulary (rendered as a badge on the card, modal dropdown, panel
// groups & filters). `id` is what we persist; `dot` is a Tailwind text color for
// the status badge, `chip` a full badge class set.
export const TASK_STATUSES = [
  { id: 'todo',        label: 'To Do',       chip: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300' },
  { id: 'in_progress', label: 'In Progress', chip: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
  { id: 'in_review',   label: 'In Review',   chip: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300' },
  { id: 'done',        label: 'Done',        chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
];

export const TASK_STATUS_MAP = Object.fromEntries(TASK_STATUSES.map((s) => [s.id, s]));

// Priority vocabulary. `strip` is the left-edge accent on the card; `dot` a
// small color swatch; `chip` the selector pill / panel badge.
export const TASK_PRIORITIES = [
  { id: 'low',    label: 'Low',    strip: '#94a3b8', dot: 'bg-slate-400',  chip: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300' },
  { id: 'medium', label: 'Medium', strip: '#3b82f6', dot: 'bg-blue-500',   chip: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
  { id: 'high',   label: 'High',   strip: '#f59e0b', dot: 'bg-amber-500',  chip: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
  { id: 'urgent', label: 'Urgent', strip: '#ef4444', dot: 'bg-rose-500',   chip: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' },
];

export const TASK_PRIORITY_MAP = Object.fromEntries(TASK_PRIORITIES.map((p) => [p.id, p]));

export const GENERAL_SECTION = { id: '__general__', title: 'Untitled' };

/**
 * Resolve a task's page + section breadcrumb from the board's pages/sections.
 * task.pageId → page in pages[] → section via page.sectionId in sections[].
 * Falls back to "General" when the page has no section (or is missing).
 *
 * @returns {{ pageId, pageTitle, sectionId, sectionTitle }}
 */
export function resolveTaskLocation(pageId, pages = [], sections = []) {
  const page = pages.find((p) => p.id === pageId) || null;
  const section = page?.sectionId
    ? sections.find((s) => s.id === page.sectionId) || null
    : null;
  return {
    pageId,
    pageTitle: page?.title || 'Untitled',
    sectionId: section?.id || GENERAL_SECTION.id,
    sectionTitle: section?.title || GENERAL_SECTION.title,
  };
}

// Format a YYYY-MM-DD due date into a short badge { label, badgeCls } or null.
// Overdue → rose, due today/tomorrow → amber, otherwise neutral.
export function dueMeta(due) {
  if (!due) return null;
  const d = new Date(`${due}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d - today) / 86400000);
  const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  let badgeCls = 'bg-muted text-content-muted';
  if (days < 0) badgeCls = 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400';
  else if (days <= 1) badgeCls = 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
  return { label, badgeCls };
}

export const statusOf = (task) => TASK_STATUS_MAP[task?.props?.status] || TASK_STATUSES[0];
export const priorityOf = (task) => TASK_PRIORITY_MAP[task?.props?.priority] || TASK_PRIORITIES[1];
