import { useEffect, useMemo, useRef, useState } from 'react';
import { AVATAR_MEMBER } from './theme/colorMap.js';

// Initials for an avatar chip from a display name / email.
function initials(name) {
  const s = (name || '').trim();
  if (!s) return '?';
  const parts = s.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Compact relative timestamp ("just now", "5m", "3h", "2d", else a date).
function ago(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(ts).toLocaleDateString();
}

/**
 * Small light/dark-themed dialog showing every comment on one element, in time
 * order, with an avatar, author, and relative timestamp per entry. Comments are
 * read live from the synced `thread` object (Yjs → React), so peers' additions
 * and deletions appear in real time.
 *
 * `canComment` (owner / editor / commenter, never viewer) gates the composer;
 * viewers see a read-only thread. A user may delete their own comments; the
 * board owner may delete anyone's.
 *
 * Themed entirely with the app's surface/content/edge tokens, so it follows the
 * global light/dark theme with no per-color mapping.
 */
export default function CommentsDialog({
  elementTitle,
  thread,
  canComment,
  currentEmail,
  isOwner = false,
  onAdd,
  onDelete,
  onClose,
}) {
  const [draft, setDraft] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // thread is a plain object { [commentId]: record }; sort by createdAt.
  const list = useMemo(() => {
    return Object.values(thread || {})
      .filter((c) => c && typeof c === 'object')
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  }, [thread]);

  // Keep the newest comment in view as the thread grows.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [list.length]);

  useEffect(() => {
    if (canComment) inputRef.current?.focus();
  }, [canComment]);

  // Esc closes the dialog.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft('');
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      onPointerDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm max-h-[80vh] flex flex-col rounded-2xl bg-surface border border-edge shadow-[0_24px_60px_rgba(12,18,36,0.28)] overflow-hidden"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-edge">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-content flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              Comments
              <span className="text-content-subtle font-semibold">{list.length}</span>
            </h2>
            {elementTitle && (
              <p className="text-[11px] text-content-subtle truncate mt-0.5">on {elementTitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-7 h-7 rounded-lg text-content-muted hover:bg-hover hover:text-content flex items-center justify-center transition"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Comment list */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[80px]">
          {list.length === 0 ? (
            <p className="text-sm text-content-subtle text-center py-6">
              No comments yet.{canComment ? ' Start the conversation below.' : ''}
            </p>
          ) : (
            list.map((c) => {
              const mine = c.authorEmail && c.authorEmail === currentEmail;
              const canDelete = mine || isOwner;
              return (
                <div key={c.id} className="flex gap-2.5 group">
                  <div
                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: c.color || AVATAR_MEMBER }}
                    title={c.author}
                  >
                    {initials(c.author)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12px] font-semibold text-content truncate">{c.author}</span>
                      <span className="text-[10px] text-content-subtle shrink-0">{ago(c.createdAt)}</span>
                      {canDelete && (
                        <button
                          onClick={() => onDelete(c.id)}
                          className="ml-auto shrink-0 text-content-subtle hover:text-rose-500 opacity-0 group-hover:opacity-100 transition"
                          title="Delete comment"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H7a1 1 0 01-1-1V6" /></svg>
                        </button>
                      )}
                    </div>
                    <p className="text-[13px] text-content-muted whitespace-pre-wrap break-words mt-0.5">{c.text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        {canComment && (
          <div className="border-t border-edge p-3">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
              rows={2}
              placeholder="Add a comment…  (Enter to send, Shift+Enter for newline)"
              className="w-full resize-none bg-muted border border-edge rounded-xl px-3 py-2 text-[13px] text-content placeholder:text-content-subtle focus:outline-none focus:border-blue-500/70 focus:ring-4 focus:ring-blue-500/15 transition"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={submit}
                disabled={!draft.trim()}
                className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold bg-gradient-to-br from-[#4262ff] to-[#2f49e7] text-white shadow-[0_8px_20px_rgba(66,98,255,0.28)] hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Comment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
