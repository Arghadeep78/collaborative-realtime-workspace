import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { makeId } from './boardConstants.js';
import {
  TASK_STATUSES, TASK_PRIORITIES,
  TASK_PRIORITY_MAP, statusOf, priorityOf, dueMeta,
} from './taskConstants.js';
import {
  X, Plus, Check, Clock, AlignLeft, CheckSquare, Users, ChevronRight, Flag, Eye, Pencil, Lock,
} from 'lucide-react';
import MemberAvatar from './MemberAvatar.jsx';

const stop = (e) => e.stopPropagation();

const SectionLabel = ({ icon: Icon, children }) => (
  <span className="text-[11px] font-bold uppercase tracking-wide text-content-subtle flex items-center gap-1.5">
    {Icon && <Icon className="w-3.5 h-3.5" />} {children}
  </span>
);

// ── Compact read-only "View" tab ─────────────────────────────────────────────
// Checklist items can only be struck off by an assignee of the task (gated on
// currentEmail). Everyone else sees them read-only.
function ViewTab({ element, members, currentEmail, onUpdate }) {
  const props = element.props || {};
  const status = statusOf(element);
  const priority = priorityOf(element);
  const assignees = props.assignees || [];
  const checklist = props.checklist || [];
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0;
  const due = dueMeta(props.dueDate);
  const labelFor = (email) => members.find((m) => m.email === email)?.name || email;
  const isAssignee = !!currentEmail && assignees.includes(currentEmail);
  const currentStatus = props.status || 'todo';

  const toggleItem = (id) => {
    if (!isAssignee) return;
    onUpdate({ checklist: checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) });
  };

  return (
    <div className="px-6 pb-5 flex gap-6">
      {/* ── Left: main content ─────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* Assignees — horizontal chips above title */}
        {assignees.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {assignees.map((a) => (
              <div key={a} className="flex items-center gap-1.5 bg-muted rounded-full px-2 py-0.5">
                <MemberAvatar label={labelFor(a)} email={a} size={18} />
                <span className="text-[12px] font-medium text-content">{labelFor(a)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="text-[24px] font-bold text-content leading-snug wrap-break-word">
          {props.title || <span className="text-content-subtle italic font-normal">Untitled task</span>}
        </h1>

        {/* Description */}
        {props.description ? (
          <p className="text-[15px] text-content whitespace-pre-wrap wrap-break-word leading-relaxed">{props.description}</p>
        ) : (
          <p className="text-[14px] text-content-subtle italic">No description provided.</p>
        )}

        {/* Checklist */}
        {checklist.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <SectionLabel icon={CheckSquare}>Checklist</SectionLabel>
              <span className="text-[11px] font-semibold text-content-muted">{doneCount}/{checklist.length}</span>
              {!isAssignee && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-content-subtle" title="Only assignees can check off items">
                  <Lock className="w-3 h-3" /> assignees only
                </span>
              )}
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex flex-col gap-0.5 mt-0.5">
              {checklist.map((chk) => (
                <button
                  key={chk.id}
                  onClick={() => toggleItem(chk.id)}
                  disabled={!isAssignee}
                  className={`flex items-center gap-2 text-left rounded px-1 py-0.5 transition ${isAssignee ? 'hover:bg-hover cursor-pointer' : 'cursor-default'}`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${chk.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-edge-strong'}`}>
                    {chk.done && <Check className="w-3 h-3" />}
                  </span>
                  <span className={`text-[15px] ${chk.done ? 'line-through text-content-subtle' : 'text-content'}`}>
                    {chk.text || <span className="italic text-content-subtle">Empty item</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {element.createdBy && (
          <div className="pt-3 mt-auto border-t border-edge-subtle text-[11px] text-content-subtle">
            Created by <span className="font-semibold text-content-muted">{element.createdBy}</span>
          </div>
        )}
      </div>

      {/* ── Right: metadata sidebar ────────────────────────── */}
      <div className="w-52 shrink-0 flex flex-col gap-4 border-l border-edge-subtle pl-5">

        {/* Status — pill selector for assignees, read-only badge for everyone else */}
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Status</SectionLabel>
          {isAssignee ? (
            <div className="flex flex-col gap-1 mt-1">
              {TASK_STATUSES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onUpdate({ status: s.id })}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                    currentStatus === s.id
                      ? `${s.chip} border-transparent ring-2 ring-blue-400/40`
                      : 'bg-transparent border-edge text-content-muted hover:bg-hover'
                  }`}
                >
                  {currentStatus === s.id && <Check className="w-3 h-3 shrink-0" />}
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            <span className={`self-start px-2 py-0.5 rounded text-[11px] font-bold mt-1 ${status.chip}`}>{status.label}</span>
          )}
        </div>

        {/* Priority + due */}
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Details</SectionLabel>
          <div className="flex flex-col gap-1.5 mt-1">
            <span className={`self-start flex items-center gap-1.5 px-2.5 py-1 rounded text-[13px] font-bold ${priority.chip}`}>
              <Flag className="w-3.5 h-3.5" /> {priority.label}
            </span>
            {due && (
              <span className={`self-start flex items-center gap-1.5 px-2.5 py-1 rounded text-[13px] font-bold ${due.badgeCls}`}>
                <Clock className="w-3.5 h-3.5" /> {due.label}
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Admin "Edit" tab ─────────────────────────────────────────────────────────
// Admins manage everything, but striking a checklist item done is reserved for
// assignees (gated on currentEmail) — admins can still add / rename / delete.
function EditTab({ element, members, currentEmail, onUpdate, onClose }) {
  const props = element.props || {};
  const [draft, setDraft] = useState({ ...props });

  const [desc, setDesc] = useState(props.description || '');
  const [newItem, setNewItem] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const set = (patch) => {
    setHasChanges(true);
    setDraft((p) => ({ ...p, ...patch }));
  };

  const assignees = draft.assignees || [];
  const checklist = draft.checklist || [];
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0;
  const isAssignee = !!currentEmail && assignees.includes(currentEmail);

  const toggleAssignee = (email) => set({ assignees: assignees.includes(email) ? assignees.filter((x) => x !== email) : [...assignees, email] });
  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    set({ checklist: [...checklist, { id: makeId('chk'), text, done: false }] });
    setNewItem('');
  };
  const patchItem = (id, patch) => set({ checklist: checklist.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const removeItem = (id) => set({ checklist: checklist.filter((c) => c.id !== id) });
  const labelFor = (email) => members.find((m) => m.email === email)?.name || email;

  const handleSave = () => {
    onUpdate({ ...draft, description: desc });
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="px-6 pb-6 flex flex-col gap-5">
      {/* Title */}
      <input
        value={draft.title || ''}
        onChange={(e) => set({ title: e.target.value })}
        placeholder="Task title…"
        className="w-full bg-transparent text-[26px] font-bold text-content outline-none placeholder:text-content-subtle border-b border-edge-subtle pb-2 focus:border-blue-500/70 transition"
        data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" spellCheck={false}
      />

      {/* Status + Priority */}
      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Status</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {TASK_STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => set({ status: s.id })}
                className={`px-2.5 py-1 rounded-lg text-[12px] font-bold transition ${draft.status === s.id ? s.chip + ' ring-2 ring-blue-400/50' : 'bg-muted text-content-muted hover:bg-hover'}`}
              >{s.label}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Priority</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {TASK_PRIORITIES.map((p) => (
              <button
                key={p.id}
                onClick={() => set({ priority: p.id })}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-bold transition ${draft.priority === p.id ? p.chip + ' ring-2 ring-blue-400/50' : 'bg-muted text-content-muted hover:bg-hover'}`}
              ><Flag className="w-3 h-3" /> {p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Assignees + Due */}
      <div className="flex flex-wrap gap-x-8 gap-y-5">
        <div className="flex flex-col gap-1.5 relative flex-1 min-w-48">
          <div className="flex items-center gap-2">
            <SectionLabel icon={Users}>Assignees</SectionLabel>
            {assignees.length > 0 && (
              <span className="text-[10px] font-semibold text-content-subtle bg-muted rounded-full px-1.5 py-0.5">{assignees.length}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {assignees.map((a) => (
              <div key={a} className="group/assignee flex items-center gap-1.5 bg-muted rounded-full pl-1.5 pr-1 py-0.5">
                <MemberAvatar label={labelFor(a)} email={a} size={18} />
                <span className="text-[12px] font-medium text-content">{labelFor(a)}</span>
                <button
                  onClick={() => toggleAssignee(a)}
                  className="text-content-subtle hover:text-rose-500 rounded-full transition opacity-0 group-hover/assignee:opacity-100 shrink-0"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowMembers((v) => !v)}
            className="flex items-center gap-1.5 mt-0.5 px-2 py-1 rounded-lg border border-edge-strong text-[12px] font-semibold text-content-muted hover:bg-hover transition self-start"
          >
            <Plus className="w-3.5 h-3.5" /> Add assignee
          </button>
          {showMembers && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-surface border border-edge shadow-xl rounded-lg p-1.5 z-20 flex flex-col gap-0.5 max-h-60 overflow-y-auto">
              {members.length === 0 && <span className="text-[12px] text-content-subtle px-2 py-1">No members</span>}
              {members.map((m) => (
                <button key={m.email} onClick={() => toggleAssignee(m.email)} className="flex items-center gap-2 p-1.5 hover:bg-hover rounded-lg text-left transition">
                  <MemberAvatar label={m.name || m.email} email={m.email} size={22} />
                  <span className="text-[13px] truncate flex-1 text-content">{m.name || m.email}</span>
                  {assignees.includes(m.email) && <Check className="w-4 h-4 text-blue-500" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <SectionLabel icon={Clock}>Due date</SectionLabel>
          <input
            type="date"
            value={draft.dueDate || ''}
            onClick={(e) => { try { e.target.showPicker(); } catch { /* ignore */ } }}
            onChange={(e) => set({ dueDate: e.target.value })}
            className="px-3 py-1.5 border border-edge hover:bg-hover rounded-lg text-[13px] font-semibold text-content transition outline-none bg-transparent"
          />
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-2">
        <SectionLabel icon={AlignLeft}>Description</SectionLabel>
        <textarea
          value={desc}
          onChange={(e) => { setDesc(e.target.value); descRef.current = e.target.value; setHasChanges(true); }}
          onBlur={() => set({ description: desc })}
          placeholder="Add a more detailed description…"
          className="w-full min-h-22.5 border border-edge rounded-lg p-3 text-[16px] text-content outline-none focus:ring-2 focus:ring-blue-500 resize-y bg-transparent"
          data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" spellCheck={false}
        />
      </div>

      {/* Checklist */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <SectionLabel icon={CheckSquare}>Checklist</SectionLabel>
          {checklist.length > 0 && <span className="text-[12px] font-semibold text-content-muted">{doneCount}/{checklist.length}</span>}
          {checklist.length > 0 && !isAssignee && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-content-subtle" title="Only assignees can check off items">
              <Lock className="w-3 h-3" /> assignees only
            </span>
          )}
        </div>
        {checklist.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[12px] text-content-muted w-9 text-right tabular-nums">{pct}%</span>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {checklist.map((chk) => (
            <div key={chk.id} className="flex items-center gap-2.5 group/chk">
              <button
                onClick={() => { if (isAssignee) patchItem(chk.id, { done: !chk.done }); }}
                disabled={!isAssignee}
                title={isAssignee ? 'Toggle done' : 'Only assignees can check off items'}
                className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition ${chk.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-edge-strong bg-surface'} ${isAssignee ? '' : 'opacity-60 cursor-not-allowed'}`}
              >
                {chk.done && <Check className="w-3.5 h-3.5" />}
              </button>
              <input
                value={chk.text}
                onChange={(e) => patchItem(chk.id, { text: e.target.value })}
                placeholder="Item…"
                className={`flex-1 text-[16px] bg-transparent outline-none ${chk.done ? 'line-through text-content-subtle' : 'text-content'}`}
                data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" spellCheck={false}
              />
              <button onClick={() => removeItem(chk.id)} className="opacity-0 group-hover/chk:opacity-100 text-content-subtle hover:text-rose-500 p-1 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
            placeholder="Add an item…"
            className="flex-1 text-[16px] bg-muted border border-edge rounded-lg px-3 py-1.5 text-content outline-none focus:border-blue-500/70 transition"
            data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" spellCheck={false}
          />
          <button onClick={addItem} className="px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-400/30 transition">Add</button>
        </div>
      </div>

      {/* Save & Cancel buttons */}
      <div className="flex justify-end gap-2 pt-2 border-t border-edge-subtle">
        <button onClick={handleCancel} className="px-6 py-2 rounded-lg text-[14px] font-semibold bg-muted text-content-muted hover:bg-hover border border-edge transition">Cancel</button>
        <button onClick={handleSave} disabled={!hasChanges} className={`px-6 py-2 rounded-lg text-[14px] font-semibold bg-linear-to-br from-[#4262ff] to-[#2f49e7] text-white border border-blue-400/40 shadow-[0_12px_28px_rgba(66,98,255,0.28)] transition ${hasChanges ? 'hover:brightness-95 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>Save Changes</button>
      </div>
    </div>
  );
}

/**
 * Full-screen task editor, portaled to <body>. Reads live from `element` so
 * collaborative edits flow in. Everyone sees the read-only "View" tab; admins
 * (editable owners/editors) additionally get an "Edit" tab whose controls write
 * straight to Yjs via `onUpdate(propsPatch)`. Closes on Escape / backdrop click.
 */
export default function TaskModal({ element, location, members = [], editable = false, currentEmail = '', onUpdate, onClose }) {
  useTheme();
  // Admins land on Edit by default (they opened it to manage it); everyone else
  // only ever sees View.
  const [tab, setTab] = useState(editable ? 'edit' : 'view');
  const priority = TASK_PRIORITY_MAP[element.props?.priority] || TASK_PRIORITIES[1];

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const content = (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onPointerDown={onClose}>
      <div
        className="bg-surface w-full max-w-3xl max-h-full overflow-y-auto rounded-2xl shadow-2xl border border-edge flex flex-col relative"
        onPointerDown={stop}
        onClick={stop}
      >
        {tab !== 'edit' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-hover text-content-muted bg-muted transition z-10"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="h-1.5 w-full rounded-t-2xl" style={{ background: priority.strip }} />

        {/* Breadcrumb */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-1 text-[12px] font-semibold text-content-muted flex-wrap">
            <span className="truncate max-w-45">{location?.sectionTitle || 'General'}</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-55 text-content">{location?.pageTitle || 'Untitled'}</span>
          </div>
        </div>

        {/* Tabs — Edit tab only for admins */}
        <div className="px-6 mt-3 mb-4 flex items-center gap-1 border-b border-edge-subtle">
          <button
            onClick={() => setTab('view')}
            className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold border-b-2 -mb-px transition ${tab === 'view' ? 'border-blue-500 text-content' : 'border-transparent text-content-muted hover:text-content'}`}
          >
            <Eye className="w-4 h-4" /> View
          </button>
          {editable && (
            <button
              onClick={() => setTab('edit')}
              className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold border-b-2 -mb-px transition ${tab === 'edit' ? 'border-blue-500 text-content' : 'border-transparent text-content-muted hover:text-content'}`}
            >
              <Pencil className="w-4 h-4" /> Edit
            </button>
          )}
        </div>

        {tab === 'edit' && editable ? (
          <EditTab element={element} members={members} currentEmail={currentEmail} onUpdate={onUpdate} onClose={onClose} />
        ) : (
          <ViewTab element={element} members={members} currentEmail={currentEmail} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
