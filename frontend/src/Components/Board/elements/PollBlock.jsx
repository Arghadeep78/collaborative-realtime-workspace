import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart2, CheckCircle2, ClipboardList, Plus, Trash2, Users, X } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext.jsx';
import { getThemeColor } from '../theme/themeUtils.js';
import { POLL_BG_COLORS, AVATAR_FALLBACK } from '../theme/colorMap.js';
import Avatar from '../../common/Avatar.jsx';
import { primePhotoCache } from '../../../hooks/usePhotoResolver.js';

const OPTION_COLORS = [
  { bar: 'bg-blue-500/20 dark:bg-blue-500/30',    fill: 'bg-blue-500',    active: 'border-blue-500 ring-1 ring-blue-500',    text: 'text-blue-600 dark:text-blue-400' },
  { bar: 'bg-emerald-500/20 dark:bg-emerald-500/30', fill: 'bg-emerald-500', active: 'border-emerald-500 ring-1 ring-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  { bar: 'bg-amber-500/20 dark:bg-amber-500/30',  fill: 'bg-amber-500',   active: 'border-amber-500 ring-1 ring-amber-500',   text: 'text-amber-600 dark:text-amber-400' },
  { bar: 'bg-rose-500/20 dark:bg-rose-500/30',    fill: 'bg-rose-500',    active: 'border-rose-500 ring-1 ring-rose-500',    text: 'text-rose-600 dark:text-rose-400' },
  { bar: 'bg-purple-500/20 dark:bg-purple-500/30', fill: 'bg-purple-500',  active: 'border-purple-500 ring-1 ring-purple-500',  text: 'text-purple-600 dark:text-purple-400' },
  { bar: 'bg-cyan-500/20 dark:bg-cyan-500/30',    fill: 'bg-cyan-500',    active: 'border-cyan-500 ring-1 ring-cyan-500',    text: 'text-cyan-600 dark:text-cyan-400' },
];

// FONT_SIZES removed: poll scales automatically based on element width.

// ── Setup modal ───────────────────────────────────────────────────────────────

function PollSetupModal({ initialProps, isDark, onConfirm, onCancel }) {
  const [question,    setQuestion]    = useState(initialProps.question    || '');
  const [multiChoice, setMultiChoice] = useState(initialProps.multiChoice || false);
  const [options,     setOptions]     = useState(
    initialProps.options?.length >= 2
      ? initialProps.options
      : [{ id: 'o1', label: 'Option 1' }, { id: 'o2', label: 'Option 2' }]
  );
  const [bgColor, setBgColor] = useState(initialProps.bgColor || null);
  const questionRef = useRef(null);

  useEffect(() => { questionRef.current?.focus(); }, []);

  const setOptionLabel = (id, label) =>
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, label } : o)));
  const addOption = () =>
    setOptions((prev) => [...prev, { id: `o${Date.now().toString(36)}`, label: `Option ${prev.length + 1}` }]);
  const removeOption = (id) =>
    setOptions((prev) => prev.filter((o) => o.id !== id));

  const handleConfirm = () => {
    if (!question.trim()) { questionRef.current?.focus(); return; }
    onConfirm({ question: question.trim(), multiChoice, options, bgColor, configured: true });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-99998 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="bg-surface border border-edge rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
        style={{ maxWidth: 460 }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleConfirm(); } if (e.key === 'Escape') onCancel(); }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-edge-subtle">
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
            <ClipboardList className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-content">Create poll</div>
            <div className="text-xs text-content-muted">Set up your question and options</div>
          </div>
          <button onClick={onCancel} className="text-content-subtle hover:text-content transition-colors p-1 rounded-lg hover:bg-hover">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {/* Question */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-muted uppercase tracking-wider">Question</label>
            <input
              ref={questionRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask something…"
              className="bg-muted border border-edge rounded-xl px-3 py-2.5 text-content text-sm font-medium placeholder:text-content-subtle outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/15 transition"
            />
          </div>

          {/* Vote type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-muted uppercase tracking-wider">Vote type</label>
            <div className="flex gap-2">
              {[
                { value: false, label: 'Single choice', icon: <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${!multiChoice ? 'border-blue-500' : 'border-current'}`}>{!multiChoice && <div className="w-2 h-2 rounded-full bg-blue-500" />}</div> },
                { value: true,  label: 'Multi choice',  icon: <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center ${multiChoice ? 'border-blue-500 bg-blue-500' : 'border-current'}`}>{multiChoice && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2.5"><path d="M2 6l3 3 5-5"/></svg>}</div> },
              ].map(({ value, label, icon }) => (
                <button
                  key={String(value)}
                  onClick={() => setMultiChoice(value)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition ${
                    multiChoice === value
                      ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'border-edge bg-muted text-content-muted hover:border-edge-strong hover:text-content'
                  }`}
                >
                  {icon}{label}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-muted uppercase tracking-wider">Options</label>
            <div className="flex flex-col gap-2">
              {options.map((opt, i) => (
                <div key={opt.id} className="flex items-center gap-2 group">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${OPTION_COLORS[i % OPTION_COLORS.length].fill}`} />
                  <input
                    value={opt.label}
                    onChange={(e) => setOptionLabel(opt.id, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 bg-muted border border-edge rounded-xl px-3 py-2 text-sm text-content placeholder:text-content-subtle outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/15 transition"
                  />
                  {options.length > 2 && (
                    <button onClick={() => removeOption(opt.id)} className="text-content-subtle hover:text-rose-500 transition-colors p-1 opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <button onClick={addOption} className="flex items-center gap-1.5 text-sm font-semibold text-content-muted hover:text-content transition-colors self-start px-1 py-0.5 mt-0.5">
                  <Plus className="w-4 h-4" /> Add option
                </button>
              )}
            </div>
          </div>

          {/* Color */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-muted uppercase tracking-wider">Background color</label>
            <div className="flex items-center gap-2">
              {POLL_BG_COLORS.map((c) => (
                <button
                  key={c || 'default'}
                  onClick={() => setBgColor(c)}
                  className={`w-6 h-6 rounded-full border transition-all ${bgColor === c ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 border-transparent' : 'border-edge-strong hover:scale-110'}`}
                  style={{ backgroundColor: c ? getThemeColor(c, isDark) : 'transparent' }}
                >
                  {!c && <div className="w-full h-full rounded-full bg-surface border border-edge" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-edge-subtle bg-muted/50">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-semibold text-content-muted hover:text-content hover:bg-hover border border-edge transition">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!question.trim()}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-linear-to-br from-indigo-500 to-purple-500 hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            Create poll
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PollBlock({
  element,
  editable,
  editing,
  selected,
  onEditProps,
  votes,
  castPollVote,
  removePollVote,
  canVote = true,
  getScale,
  peers = [],
}) {
  const { props } = element;
  const { isDark } = useTheme();

  const [showSetup, setShowSetup] = useState(false);

  // When double clicking the poll (editing = true triggers), show the setup modal.
  useEffect(() => {
    if (editing && editable) {
      setShowSetup(true);
    }
  }, [editing, editable]);

  // Scale font sizes based on element width to fix visibility and squishing issues
  const BASE_W = 320;
  const textScale = Math.min(2.5, Math.max(0.5, element.w ? (element.w / BASE_W) : 1));
  const fsHeader = Math.round(24 * textScale);
  const fsOption = Math.round(15 * textScale);
  
  // Also scale height and icons proportionally
  const minHeightOpt = Math.round(40 * textScale);
  const iconClass = textScale > 1.5 ? 'w-6 h-6' : textScale > 1.2 ? 'w-5 h-5' : 'w-4 h-4';

  const options = useMemo(() => props.options || [], [props.options]);
  const pollId  = element.id;

  const userData   = JSON.parse(localStorage.getItem('userData') || '{}');
  const myEmail    = userData.email    || 'anon';
  const myName     = userData.name     || 'Anonymous';
  const myPhotoURL = userData.profilePic || userData.profilePicture || userData.photoURL || null;

  // Seed the shared photo cache with pictures we already trust (own user + live
  // peers from awareness); everything else resolves by email through <Avatar/>.
  // Backend stays authoritative.
  useEffect(() => {
    const seed = {};
    if (myEmail && myPhotoURL) seed[myEmail] = myPhotoURL;
    peers.forEach(p => { if (p.email && p.profilePic) seed[p.email] = p.profilePic; });
    primePhotoCache(seed);
  }, [peers, myEmail, myPhotoURL]);

  const [voterPopup, setVoterPopup] = useState(null);
  const containerRef = useRef(null);
  const popoverRef   = useRef(null);
  const [popupPos,   setPopupPos]   = useState({ top: 0, left: 0 });
  const rafRef = useRef(null);

  useEffect(() => {
    if (!voterPopup) return;
    const handler = (e) => { if (popoverRef.current && !popoverRef.current.contains(e.target)) setVoterPopup(null); };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [voterPopup]);

  useEffect(() => {
    if (!voterPopup?.triggerEl || !containerRef.current) return;
    const sync = () => {
      const btnRect       = voterPopup.triggerEl.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      const boardScale    = getScale ? getScale() : 1;
      setPopupPos({ top: btnRect.top, left: (containerRect?.right ?? btnRect.right) + 10, scale: boardScale });
      rafRef.current = requestAnimationFrame(sync);
    };
    rafRef.current = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(rafRef.current);
  }, [voterPopup]);

  const pollVotes = useMemo(() => votes?.[pollId] || {}, [votes, pollId]);

  const optionsVotes = useMemo(() => {
    const grouped = {};
    Object.values(pollVotes).forEach(v => {
      if (!grouped[v.optionId]) grouped[v.optionId] = [];
      grouped[v.optionId].push(v);
    });
    return grouped;
  }, [pollVotes]);

  const counts = options.map((o) => optionsVotes[o.id]?.length || 0);
  const total  = counts.reduce((a, b) => a + b, 0);

  // Single-choice: one optionId. Multi-choice: Set of optionIds per user.
  const myVoteSingle = !props.multiChoice ? (pollVotes[myEmail]?.optionId || null) : null;
  const myVotesMulti = useMemo(() => {
    if (!props.multiChoice) return new Set();
    const s = new Set();
    Object.values(pollVotes).forEach(v => { if (v.email === myEmail) s.add(v.optionId); });
    return s;
  }, [pollVotes, myEmail, props.multiChoice]);

  const openVoterPopup = (e, optId, voters) => {
    e.stopPropagation();
    if (voterPopup?.optId === optId) { setVoterPopup(null); return; }
    setVoterPopup({ optId, voters, triggerEl: e.currentTarget });
  };

  const castVote = (optionId) => {
    if (editing || !canVote) return;
    const user = { email: myEmail, name: myName, color: userData.color || AVATAR_FALLBACK, photoURL: myPhotoURL };
    if (props.multiChoice) {
      if (myVotesMulti.has(optionId)) removePollVote(pollId, `${myEmail}:${optionId}`);
      else castPollVote(pollId, optionId, user, true);
    } else {
      if (myVoteSingle === optionId) removePollVote(pollId, myEmail);
      else castPollVote(pollId, optionId, user);
    }
  };

  const hasColor      = !!props.bgColor;
  const displayBgColor = getThemeColor(props.bgColor, isDark);

  const textMain      = hasColor ? (isDark ? 'text-slate-100' : 'text-slate-900') : 'text-content';
  const textSub       = hasColor ? (isDark ? 'text-slate-300' : 'text-slate-700') : 'text-content';
  const textMuted     = hasColor ? (isDark ? 'text-slate-400' : 'text-slate-600') : 'text-content-muted';
  const btnBase       = hasColor
    ? (isDark ? 'border-slate-700 hover:border-slate-500 bg-black/40' : 'border-slate-300 hover:border-slate-400 bg-white/50')
    : 'border-edge hover:border-edge-strong bg-surface';
  const footerBorder  = hasColor ? (isDark ? 'border-white/10' : 'border-slate-300/40') : 'border-edge-subtle';
  const unvotedCircle = hasColor
    ? (isDark ? 'border-slate-500 group-hover:border-slate-400' : 'border-slate-400 group-hover:border-slate-500')
    : 'border-edge-strong group-hover:border-content-subtle';
  const avatarBorder  = hasColor ? (isDark ? 'border-white/20' : 'border-white/60') : 'border-surface';

  // ── Unconfigured placeholder ──────────────────────────────────────────────
  if (!props.configured) {
    return (
      <>
        <div
          ref={containerRef}
          className="w-full h-full rounded-2xl border-2 border-dashed border-edge flex flex-col items-center justify-center gap-3 bg-surface cursor-pointer group transition-colors hover:border-indigo-400/60 hover:bg-indigo-500/5"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); if (editable) setShowSetup(true); }}
        >
          <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-300/30 flex items-center justify-center group-hover:from-indigo-500/30 group-hover:to-purple-500/30 transition-all">
            <BarChart2 className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div className="text-center px-4">
            <div className="text-sm font-bold text-content">Poll</div>
            <div className="text-xs text-content-muted mt-0.5">{editable ? 'Click to set up' : 'Not yet configured'}</div>
          </div>
          {editable && (
            <div className="px-4 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-400/30 text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
              Set up poll →
            </div>
          )}
        </div>
        {showSetup && (
          <PollSetupModal
            initialProps={props}
            isDark={isDark}
            onConfirm={(patch) => { onEditProps(patch); setShowSetup(false); }}
            onCancel={() => setShowSetup(false)}
          />
        )}
      </>
    );
  }

  // ── Configured poll ───────────────────────────────────────────────────────
  return (
    <>
      <div
        ref={containerRef}
        className="w-full h-full rounded-2xl border border-edge shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex flex-col overflow-hidden transition-colors"
        style={{ backgroundColor: displayBgColor || undefined, padding: 16, gap: 10 }}
      >
        <div className={`absolute inset-0 -z-10 ${!hasColor ? 'bg-surface' : ''} rounded-2xl pointer-events-none`} />

        {/* Header */}
        <div className="flex gap-2 items-start shrink-0 z-10">
          <div className="mt-0.5 bg-linear-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shrink-0 shadow-sm w-7 h-7 min-w-7">
            <BarChart2 className="text-white w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`font-bold ${textMain} leading-snug break-words`} style={{ fontSize: fsHeader }}>
              {props.question || <span className="text-content-subtle font-semibold italic">Untitled poll</span>}
            </div>
            {props.multiChoice && (
              <div className={`text-[10px] font-semibold mt-0.5 ${textMuted}`}>Multi-choice</div>
            )}
          </div>
        </div>

        {/* Options */}
        <div
          className="flex-1 flex flex-col overflow-y-auto pr-0.5 z-10"
          style={{ gap: 8 }}
        >
          {options.map((opt, i) => {
            const pct   = total ? Math.round((counts[i] / total) * 100) : 0;
            const mine  = props.multiChoice ? myVotesMulti.has(opt.id) : myVoteSingle === opt.id;
            const theme = OPTION_COLORS[i % OPTION_COLORS.length];
            const votersForOption = optionsVotes[opt.id] || [];
            const vCount = votersForOption.length;

            return (
              <button
                key={opt.id}
                onClick={(e) => { e.stopPropagation(); castVote(opt.id); }}
                onPointerDown={(e) => e.stopPropagation()}
                className={`relative w-full text-left rounded-xl overflow-hidden border transition-all duration-200 group flex items-center shrink-0 min-w-0 ${
                  mine ? theme.active + (hasColor ? (isDark ? ' bg-white/10' : ' bg-white/70') : ' bg-muted') : btnBase
                }`}
              >
                {/* Progress bar */}
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-500 ease-out ${mine ? theme.bar : (hasColor ? (isDark ? 'bg-white/20' : 'bg-black/10') : 'bg-muted')}`}
                  style={{ width: `${pct}%` }}
                />
                {/* Row */}
                <div className="relative w-full flex items-center gap-2 px-3 py-2 min-w-0" style={{ minHeight: minHeightOpt }}>
                  {/* Check/circle indicator — fixed size, never shrinks */}
                  {mine ? (
                    props.multiChoice ? (
                      <div className={`${iconClass} rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${theme.active}`}>
                        <svg className={`w-3/5 h-3/5 ${theme.text}`} fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2.5"><path d="M2 6l3 3 5-5"/></svg>
                      </div>
                    ) : (
                      <CheckCircle2 className={`${iconClass} shrink-0 transition-all ${theme.text}`} />
                    )
                  ) : (
                    <div className={`${props.multiChoice ? 'rounded-md' : 'rounded-full'} ${iconClass} border-2 shrink-0 transition-all ${unvotedCircle}`} />
                  )}

                  {/* Label — takes remaining space, wraps nicely when space is constrained */}
                  <div
                    className={`font-medium flex-1 min-w-0 leading-tight ${mine ? textMain : textSub}`}
                    style={{ fontSize: fsOption, whiteSpace: 'normal', overflowWrap: 'break-word', padding: '2px 0' }}
                  >
                    {opt.label}
                  </div>

                  {/* Right side: voter badge + percentage — both shrink-0, fixed layout */}
                  <div className="flex items-center gap-1 shrink-0">
                    {vCount > 0 && (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => openVoterPopup(e, opt.id, votersForOption)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.key === 'Enter' && openVoterPopup(e, opt.id, votersForOption)}
                        className={`flex items-center gap-0.5 rounded-full px-1 py-0.5 font-semibold cursor-pointer shrink-0 ${
                          voterPopup?.optId === opt.id
                            ? `${theme.text} ring-1 ring-current`
                            : mine
                              ? `${theme.text} ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-white/50 hover:bg-white/70'}`
                              : `${textMuted} ${hasColor ? (isDark ? 'bg-white/20 hover:bg-white/30' : 'bg-black/10 hover:bg-black/20') : 'bg-muted hover:bg-hover'}`
                        }`}
                        style={{ fontSize: 11 }}
                        title="See who voted"
                      >
                        <Users className="w-2.5 h-2.5" />
                        <span>{vCount}</span>
                      </div>
                    )}
                    {/* Percentage — width driven by content, tabular so digits align */}
                    <span
                      className={`font-bold tabular-nums shrink-0 text-right ${mine ? theme.text : textMuted}`}
                      style={{ fontSize: fsOption, minWidth: '2.5ch' }}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

        </div>

        {/* Footer */}
        <div className={`border-t flex items-center justify-between text-xs font-medium z-10 shrink-0 pt-2 mt-1 ${footerBorder} ${textMuted}`}>
          <div className="flex items-center gap-1.5">
            {(() => {
                const seen = new Set();
                const unique = Object.values(pollVotes).filter(v => { if (seen.has(v.email)) return false; seen.add(v.email); return true; });
                return (
                  <>
                    <div className="flex -space-x-1">
                      {unique.slice(0, 3).map((voter, idx) => (
                        <Avatar key={voter.email || idx} email={voter.email} name={voter.name} color={voter.color} size={18} borderClass={avatarBorder} />
                      ))}
                    </div>
                    <span>{unique.length} voter{unique.length === 1 ? '' : 's'}</span>
                  </>
                );
              })()}
            </div>
            {selected && editable && <span>Double-click to edit</span>}
          </div>
      </div>

      {/* Voter popup */}
      {voterPopup && createPortal(
        <div
          ref={popoverRef}
          onPointerDown={(e) => e.stopPropagation()}
          className="bg-surface border border-edge rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ position: 'fixed', top: popupPos.top, left: popupPos.left, zIndex: 99999, minWidth: 220, maxWidth: 320, transform: `scale(${popupPos.scale ?? 1})`, transformOrigin: 'top left' }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-edge-subtle bg-muted">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 shrink-0 text-content-subtle" />
              <span className="text-xs font-semibold text-content-muted">Voters</span>
            </div>
            <button onClick={() => setVoterPopup(null)} className="ml-2 shrink-0 text-content-subtle hover:text-content transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-col overflow-y-auto" style={{ maxHeight: 240 }}>
            {voterPopup.voters.map((voter) => (
              <div key={voter.email} className="flex items-center gap-2.5 px-3 py-2 hover:bg-hover transition-colors">
                <Avatar email={voter.email} name={voter.name} color={voter.color} size={28} borderClass={avatarBorder} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-content truncate">{voter.name}</div>
                  {voter.email === myEmail && <div className="text-[10px] text-content-subtle leading-none mt-0.5">you</div>}
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Setup Modal trigger when opening via double click */}
      {showSetup && (
        <PollSetupModal
          initialProps={props}
          isDark={isDark}
          onConfirm={(patch) => { onEditProps(patch); setShowSetup(false); }}
          onCancel={() => setShowSetup(false)}
        />
      )}
    </>
  );
}
