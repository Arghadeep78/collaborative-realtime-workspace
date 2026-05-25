import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart2, CheckCircle2, Plus, Trash2, Users, X } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext.jsx';
import { getThemeColor } from '../theme/themeUtils.js';

const OPTION_COLORS = [
  { bar: 'bg-blue-500/20 dark:bg-blue-500/30', fill: 'bg-blue-500', active: 'border-blue-500 ring-1 ring-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  { bar: 'bg-emerald-500/20 dark:bg-emerald-500/30', fill: 'bg-emerald-500', active: 'border-emerald-500 ring-1 ring-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  { bar: 'bg-amber-500/20 dark:bg-amber-500/30', fill: 'bg-amber-500', active: 'border-amber-500 ring-1 ring-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { bar: 'bg-rose-500/20 dark:bg-rose-500/30', fill: 'bg-rose-500', active: 'border-rose-500 ring-1 ring-rose-500', text: 'text-rose-600 dark:text-rose-400' },
  { bar: 'bg-purple-500/20 dark:bg-purple-500/30', fill: 'bg-purple-500', active: 'border-purple-500 ring-1 ring-purple-500', text: 'text-purple-600 dark:text-purple-400' },
  { bar: 'bg-cyan-500/20 dark:bg-cyan-500/30', fill: 'bg-cyan-500', active: 'border-cyan-500 ring-1 ring-cyan-500', text: 'text-cyan-600 dark:text-cyan-400' },
];

const BG_COLORS = [
  null,
  '#d3f1df',
  '#fdf4c8',
  '#fdedd8',
  '#ffdce0',
  '#e8dffe',
  '#cce0ff',
];

const POLL_BASE_W = 380;
// Only font sizes scale with width — structural spacing stays fixed.
// Tight bounds so text never grows/shrinks dramatically.
const SCALE_MIN = 0.65;   // ~247px wide → text floor
const SCALE_MAX = 1.45;   // ~551px wide → text ceiling

function VoterAvatar({ voter, size = 24, borderClass }) {
  const [imgError, setImgError] = useState(false);
  const initial = voter.name?.[0]?.toUpperCase() || '?';

  if (voter.photoURL && !imgError) {
    return (
      <img
        src={voter.photoURL}
        alt={voter.name}
        title={voter.name}
        onError={() => setImgError(true)}
        className={`rounded-full object-cover border-2 ${borderClass} shadow-sm`}
        style={{ width: size, height: size, minWidth: size }}
      />
    );
  }

  return (
    <div
      title={voter.name}
      className={`rounded-full flex items-center justify-center text-white font-bold border-2 ${borderClass} shadow-sm`}
      style={{ width: size, height: size, minWidth: size, backgroundColor: voter.color || '#94a3b8', fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </div>
  );
}

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
}) {
  const { props } = element;
  const { isDark } = useTheme();

  // Only font sizes react to width — everything else (padding, gaps, icons) is fixed.
  // This means expanding the block reveals more text content rather than making text bigger.
  const textScale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, element.w / POLL_BASE_W));
  const fs = (base) => Math.round(base * textScale);

  const options = useMemo(() => props.options || [], [props.options]);
  const pollId = element.id;

  const userData = useMemo(() => JSON.parse(localStorage.getItem('userData') || '{}'), []);
  const myEmail = userData.email || 'anon';
  const myName = userData.name || 'Anonymous';
  const myPhotoURL = userData.profilePic || userData.profilePicture || userData.photoURL || null;

  // Enrich a voter with the current user's photo when old votes lack photoURL
  const enrichVoter = (voter) =>
    voter.email === myEmail && !voter.photoURL && myPhotoURL
      ? { ...voter, photoURL: myPhotoURL }
      : voter;

  const [voterPopup, setVoterPopup] = useState(null);
  const containerRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!voterPopup) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setVoterPopup(null);
      }
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [voterPopup]);

  useEffect(() => {
    if (!voterPopup || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const boardScale = getScale ? getScale() : 1;
    setVoterPopup(prev => prev ? { ...prev, left: rect.right + 10, boardScale } : null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.x, element.y, element.w]);

  const pollVotes = useMemo(() => votes?.[pollId] || {}, [votes, pollId]);

  const optionsVotes = useMemo(() => {
    const grouped = {};
    Object.values(pollVotes).forEach(v => {
      if (!grouped[v.optionId]) grouped[v.optionId] = [];
      grouped[v.optionId].push(enrichVoter(v));
    });
    return grouped;
  // enrichVoter is stable — myEmail/myPhotoURL are memo'd above
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollVotes]);

  const counts = options.map((o) => optionsVotes[o.id]?.length || 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const myVote = pollVotes[myEmail]?.optionId || null;

  const openVoterPopup = (e, optId, voters) => {
    e.stopPropagation();
    if (voterPopup?.optId === optId) { setVoterPopup(null); return; }
    const containerRect = containerRef.current?.getBoundingClientRect();
    const btnRect = e.currentTarget.getBoundingClientRect();
    const boardScale = getScale ? getScale() : 1;
    setVoterPopup({
      optId,
      voters,
      top: btnRect.top,
      left: (containerRect?.right ?? btnRect.right) + 10,
      boardScale,
    });
  };

  const castVote = (optionId) => {
    if (editing || !canVote) return;
    if (myVote === optionId) {
      removePollVote(pollId, myEmail);
    } else {
      castPollVote(pollId, optionId, {
        email: myEmail,
        name: myName,
        color: userData.color || '#94a3b8',
        photoURL: userData.profilePic || userData.profilePicture || userData.photoURL || null,
      });
    }
  };

  const setOptionLabel = (id, label) =>
    onEditProps({ options: options.map((o) => (o.id === id ? { ...o, label } : o)) });
  const addOption = () =>
    onEditProps({ options: [...options, { id: `o${Date.now().toString(36)}`, label: `Option ${options.length + 1}` }] });
  const removeOption = (id) =>
    onEditProps({ options: options.filter((o) => o.id !== id) });

  const questionRef = useRef(null);
  useEffect(() => {
    if (editing && questionRef.current) questionRef.current.focus();
  }, [editing]);

  const hasColor = !!props.bgColor;
  const displayBgColor = getThemeColor(props.bgColor, isDark);
  
  const textMain = hasColor ? (isDark ? 'text-slate-100' : 'text-slate-900') : 'text-content';
  const textSub  = hasColor ? (isDark ? 'text-slate-300' : 'text-slate-700') : 'text-content';
  const textMuted = hasColor ? (isDark ? 'text-slate-400' : 'text-slate-600') : 'text-content-muted';
  const inputBg = hasColor
    ? (isDark 
        ? 'bg-black/20 border-slate-700 text-slate-100 placeholder:text-slate-500' 
        : 'bg-white/60 border-slate-300 text-slate-900 placeholder:text-slate-500')
    : 'bg-muted border-edge text-content';
  const btnBase = hasColor
    ? (isDark
        ? 'border-slate-700 hover:border-slate-500 bg-black/40'
        : 'border-slate-300 hover:border-slate-400 bg-white/50')
    : 'border-edge hover:border-edge-strong bg-surface';
  const footerBorder = hasColor ? (isDark ? 'border-white/10' : 'border-slate-300/40') : 'border-edge-subtle';
  const unvotedCircle = hasColor
    ? (isDark ? 'border-slate-500 group-hover:border-slate-400' : 'border-slate-400 group-hover:border-slate-500')
    : 'border-edge-strong group-hover:border-content-subtle';
  const avatarBorder = hasColor ? (isDark ? 'border-white/20' : 'border-white/60') : 'border-surface';

  const activeOption = voterPopup ? options.find(o => o.id === voterPopup.optId) : null;

  return (
    <>
      <div
        ref={containerRef}
        className="w-full h-full rounded-2xl border border-edge shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex flex-col overflow-hidden transition-colors"
        style={{ backgroundColor: displayBgColor || undefined, padding: 16, gap: 10 }}
      >
        <div className={`absolute inset-0 -z-10 ${!hasColor ? 'bg-surface' : ''} rounded-2xl pointer-events-none`} />

        {/* Header / Question — fixed 28px icon, line-clamp-2 so it never eats all height */}
        <div className="flex gap-2 items-start shrink-0 z-10">
          <div className="mt-0.5 bg-linear-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shrink-0 shadow-sm w-7 h-7 min-w-7">
            <BarChart2 className="text-white w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                ref={questionRef}
                value={props.question}
                onChange={(e) => onEditProps({ question: e.target.value })}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="Ask a question…"
                className={`w-full bg-transparent outline-none font-bold ${textMain} placeholder:text-content-subtle`}
                style={{ fontSize: fs(22) }}
              />
            ) : (
              <div
                className={`font-bold ${textMain} leading-snug line-clamp-2`}
                style={{ fontSize: fs(22) }}
              >
                {props.question || <span className="text-content-subtle font-semibold italic">Untitled poll</span>}
              </div>
            )}
          </div>
        </div>

        {/* Options */}
        <div
          className="flex-1 flex flex-col overflow-y-auto pr-0.5 z-10"
          style={{ gap: 8 }}
          onPointerDown={(e) => editing && e.stopPropagation()}
        >
          {options.map((opt, i) => {
            const pct = total ? Math.round((counts[i] / total) * 100) : 0;
            const mine = myVote === opt.id;
            const theme = OPTION_COLORS[i % OPTION_COLORS.length];
            const votersForOption = optionsVotes[opt.id] || [];
            const vCount = votersForOption.length;

            if (editing) {
              return (
                <div key={opt.id} className="flex items-center gap-2 group">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${theme.fill}`} />
                  <input
                    value={opt.label}
                    onChange={(e) => setOptionLabel(opt.id, e.target.value)}
                    className={`flex-1 min-w-0 border focus:border-edge-strong rounded-lg outline-none transition-colors px-2.5 py-1.5 ${inputBg}`}
                    style={{ fontSize: fs(15) }}
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(opt.id)}
                      className="text-content-subtle hover:text-rose-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      title="Remove option"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            }

            return (
              <button
                key={opt.id}
                onClick={(e) => { e.stopPropagation(); castVote(opt.id); }}
                onPointerDown={(e) => e.stopPropagation()}
                className={`relative w-full text-left rounded-xl overflow-hidden border transition-all duration-200 group flex items-center ${
                  mine ? theme.active + (hasColor ? ' bg-white/70' : ' bg-muted') : btnBase
                }`}
              >
                {/* Progress bar fill */}
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-500 ease-out ${mine ? theme.bar : (hasColor ? 'bg-white/40' : 'bg-muted')}`}
                  style={{ width: `${pct}%` }}
                />
                {/* Row content — fixed 40px min-height, px-3 py-2 */}
                <div className="relative w-full flex items-start justify-between gap-2 px-3 py-2" style={{ minHeight: 40 }}>
                  {/* Label side */}
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    {mine ? (
                      <CheckCircle2 className={`w-4 h-4 shrink-0 ${theme.text}`} />
                    ) : (
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${unvotedCircle}`} />
                    )}
                    <span
                      className={`font-medium min-w-0 line-clamp-3 ${mine ? textMain : textSub}`}
                      style={{ fontSize: fs(15) }}
                    >
                      {opt.label}
                    </span>
                  </div>

                  {/* Right side — fixed, aligned to first line */}
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    {vCount > 0 && (
                      <button
                        onClick={(e) => openVoterPopup(e, opt.id, votersForOption)}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors text-xs font-semibold ${
                          voterPopup?.optId === opt.id
                            ? `${theme.text} ring-1 ring-current`
                            : mine
                              ? `${theme.text} bg-white/50 hover:bg-white/70`
                              : `${textMuted} ${hasColor ? 'bg-white/40 hover:bg-white/60' : 'bg-muted hover:bg-hover'}`
                        }`}
                        title="See who voted"
                      >
                        <Users className="w-3 h-3" />
                        <span>{vCount}</span>
                      </button>
                    )}
                    <span
                      className={`font-bold tabular-nums w-9 text-right ${mine ? theme.text : textMuted}`}
                      style={{ fontSize: fs(14) }}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

          {editing && editable && (
            <div className="flex flex-col gap-2 mt-1.5">
              <button
                onClick={addOption}
                className={`flex w-max items-center gap-1.5 text-sm font-semibold self-start px-2 py-1 rounded transition-colors ${
                  hasColor ? 'text-slate-700 hover:bg-white/40' : 'text-content-muted hover:text-content hover:bg-hover'
                }`}
              >
                <Plus className="w-4 h-4" /> Add another option
              </button>

              <div className={`flex items-center gap-2 pt-2 border-t ${footerBorder}`}>
                <span className={`text-xs font-medium ${textMuted} mr-1`}>Color:</span>
                {BG_COLORS.map((c) => (
                  <button
                    key={c || 'default'}
                    onClick={() => onEditProps({ bgColor: c })}
                    className={`w-5 h-5 rounded-full border transition-all ${
                      props.bgColor === c
                        ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 border-transparent'
                        : 'border-edge-strong hover:scale-110'
                    }`}
                    style={{ backgroundColor: c || 'transparent' }}
                    title={c ? 'Color' : 'Default'}
                  >
                    {!c && <div className="w-full h-full rounded-full bg-surface border border-edge" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!editing && (
          <div
            className={`border-t flex items-center justify-between text-xs font-medium z-10 shrink-0 pt-2 mt-1 ${footerBorder} ${textMuted}`}
          >
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1">
                {total > 0 && Object.values(pollVotes).slice(0, 3).map((voter, idx) => (
                  <VoterAvatar key={voter.email || idx} voter={enrichVoter(voter)} size={18} borderClass={hasColor ? 'border-white/60' : 'border-surface'} />
                ))}
              </div>
              <span>{total} vote{total === 1 ? '' : 's'}</span>
            </div>
            {selected && editable && <span>Double-click to edit</span>}
          </div>
        )}
      </div>

      {/* Voter popup — portal so it escapes overflow:hidden and canvas transforms */}
      {voterPopup && createPortal(
        <div
          ref={popoverRef}
          onPointerDown={(e) => e.stopPropagation()}
          className="bg-surface border border-edge rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ position: 'fixed', top: voterPopup.top, left: voterPopup.left, zIndex: 99999, minWidth: 180, maxWidth: 240, transform: `scale(${voterPopup.boardScale ?? 1})`, transformOrigin: 'top left' }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-edge-subtle bg-muted">
            <div className="flex items-center gap-1.5 min-w-0">
              <Users className="w-3.5 h-3.5 shrink-0 text-content-subtle" />
              <span className="text-xs font-semibold text-content-muted truncate">
                {activeOption?.label || 'Voters'}
              </span>
            </div>
            <button
              onClick={() => setVoterPopup(null)}
              className="ml-2 shrink-0 text-content-subtle hover:text-content transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-col overflow-y-auto" style={{ maxHeight: 240 }}>
            {voterPopup.voters.map((voter) => (
              <div key={voter.email} className="flex items-center gap-2.5 px-3 py-2 hover:bg-hover transition-colors">
                <VoterAvatar voter={voter} size={28} borderClass={avatarBorder} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-content truncate">{voter.name}</div>
                  {voter.email === myEmail && (
                    <div className="text-[10px] text-content-subtle leading-none mt-0.5">you</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
