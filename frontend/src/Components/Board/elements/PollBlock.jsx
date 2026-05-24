import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart2, CheckCircle2, Plus, Trash2 } from 'lucide-react';

const voteKey = (pollId, optionId) => `poll:${pollId}:${optionId}`;

const OPTION_COLORS = [
  { bar: 'bg-blue-500/20 dark:bg-blue-500/30', fill: 'bg-blue-500', active: 'border-blue-500 ring-1 ring-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  { bar: 'bg-emerald-500/20 dark:bg-emerald-500/30', fill: 'bg-emerald-500', active: 'border-emerald-500 ring-1 ring-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  { bar: 'bg-amber-500/20 dark:bg-amber-500/30', fill: 'bg-amber-500', active: 'border-amber-500 ring-1 ring-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { bar: 'bg-rose-500/20 dark:bg-rose-500/30', fill: 'bg-rose-500', active: 'border-rose-500 ring-1 ring-rose-500', text: 'text-rose-600 dark:text-rose-400' },
  { bar: 'bg-purple-500/20 dark:bg-purple-500/30', fill: 'bg-purple-500', active: 'border-purple-500 ring-1 ring-purple-500', text: 'text-purple-600 dark:text-purple-400' },
  { bar: 'bg-cyan-500/20 dark:bg-cyan-500/30', fill: 'bg-cyan-500', active: 'border-cyan-500 ring-1 ring-cyan-500', text: 'text-cyan-600 dark:text-cyan-400' },
];

const BG_COLORS = [
  null, // Default
  '#d3f1df', // pastel green
  '#fdf4c8', // pastel yellow
  '#fdedd8', // pastel orange
  '#ffdce0', // pastel red
  '#e8dffe', // pastel purple
  '#cce0ff', // pastel blue
];

const POLL_BASE_W = 380;

export default function PollBlock({
  element,
  editable,
  editing,
  selected,
  onEditProps,
  votes,
  boardId,
  castPollVote,
  removePollVote,
}) {
  const { props } = element;

  // Scale all text proportionally with element width, clamped for readability.
  const textScale = Math.min(1.6, Math.max(0.7, element.w / POLL_BASE_W));
  const fs = (base) => Math.round(base * textScale);
  const options = useMemo(() => props.options || [], [props.options]);
  const pollId = element.id;

  const userData = useMemo(() => JSON.parse(localStorage.getItem('userData') || '{}'), []);
  const myEmail = userData.email || 'anon';
  const myName = userData.name || 'Anonymous';
  
  // Get all votes for this poll
  const pollVotes = votes?.[pollId] || {};
  
  // Group votes by option
  const optionsVotes = useMemo(() => {
    const grouped = {};
    Object.values(pollVotes).forEach(v => {
      if (!grouped[v.optionId]) grouped[v.optionId] = [];
      grouped[v.optionId].push(v);
    });
    return grouped;
  }, [pollVotes]);

  const counts = options.map((o) => optionsVotes[o.id]?.length || 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const myVote = pollVotes[myEmail]?.optionId || null;

  const castVote = (optionId) => {
    if (editing) return;
    
    if (myVote === optionId) {
      removePollVote(pollId, myEmail);
    } else {
      castPollVote(pollId, optionId, { email: myEmail, name: myName, color: '#94a3b8' }); // Fallback color if myColor not available
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
  const textMain = hasColor ? 'text-slate-900' : 'text-slate-900 dark:text-slate-100';
  const textSub = hasColor ? 'text-slate-700' : 'text-slate-700 dark:text-slate-300';
  const textMuted = hasColor ? 'text-slate-600' : 'text-slate-500 dark:text-slate-400';
  const inputBg = hasColor ? 'bg-white/60 border-slate-300 text-slate-900 placeholder:text-slate-500' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200';
  const btnBase = hasColor ? 'border-slate-300 hover:border-slate-400 bg-white/50' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-transparent';
  const footerBorder = hasColor ? 'border-slate-300/40' : 'border-slate-100 dark:border-slate-800';
  const unvotedCircle = hasColor ? 'border-slate-400 group-hover:border-slate-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-slate-400 dark:group-hover:border-slate-500';
  const footerDot = hasColor ? 'border-[#22272b]/20 bg-slate-400' : 'border-white dark:border-[#22272b] bg-slate-300 dark:bg-slate-600';

  // Responsive spacing — scales with the same ratio as text so layout stays proportional.
  const pad = fs(16);
  const rowGap = fs(10);
  const iconSz = fs(28);
  const iconIconSz = fs(14);

  return (
    <div
      className="w-full h-full rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex flex-col overflow-hidden transition-colors"
      style={{ backgroundColor: props.bgColor || undefined, padding: pad, gap: rowGap }}
    >
      <div className={`absolute inset-0 -z-10 ${!hasColor ? 'bg-white dark:bg-[#22272b]' : ''} rounded-2xl pointer-events-none`} />

      {/* Header / Question */}
      <div className="flex gap-2 items-start shrink-0 z-10">
        <div
          className="mt-0.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shrink-0 shadow-sm"
          style={{ width: iconSz, height: iconSz, minWidth: iconSz }}
        >
          <BarChart2 className="text-white" style={{ width: iconIconSz, height: iconIconSz }} />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              ref={questionRef}
              value={props.question}
              onChange={(e) => onEditProps({ question: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="Ask a question…"
              className={`w-full bg-transparent outline-none font-bold ${textMain} placeholder:text-slate-400`}
              style={{ fontSize: fs(26) }}
            />
          ) : (
            <div className={`font-bold ${textMain} break-words leading-snug`} style={{ fontSize: fs(26) }}>
              {props.question || <span className="text-slate-400 font-semibold italic">Untitled poll</span>}
            </div>
          )}
        </div>
      </div>

      {/* Options */}
      <div className="flex-1 flex flex-col overflow-y-auto pr-1 z-10" style={{ gap: fs(8) }} onPointerDown={(e) => editing && e.stopPropagation()}>
        {options.map((opt, i) => {
          const pct = total ? Math.round((counts[i] / total) * 100) : 0;
          const mine = myVote === opt.id;
          const theme = OPTION_COLORS[i % OPTION_COLORS.length];
          const votersForOption = optionsVotes[opt.id] || [];
          
          if (editing) {
            return (
              <div key={opt.id} className="flex items-center gap-2 group">
                <div className={`w-3 h-3 rounded-full shrink-0 ${theme.fill}`} />
                <input
                  value={opt.label}
                  onChange={(e) => setOptionLabel(opt.id, e.target.value)}
                  className={`flex-1 min-w-0 border focus:border-slate-400 dark:focus:border-slate-500 rounded-lg outline-none transition-colors ${inputBg}`}
                  style={{ fontSize: fs(18), padding: `${fs(6)}px ${fs(10)}px` }}
                />
                {options.length > 2 && (
                  <button onClick={() => removeOption(opt.id)} className="text-slate-400 hover:text-rose-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1" title="Remove option">
                    <Trash2 className="w-4 h-4" />
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
                mine ? theme.active + (hasColor ? ' bg-white/70' : ' bg-slate-50 dark:bg-slate-800/30') : btnBase
              }`}
            >
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-500 ease-out ${mine ? theme.bar : (hasColor ? 'bg-white/40' : 'bg-slate-100 dark:bg-slate-800')}`}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex-1 flex items-center justify-between" style={{ padding: `${fs(8)}px ${fs(14)}px`, minHeight: fs(40) }}>
                <div className="flex items-center gap-3">
                  {mine ? (
                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${theme.text}`} />
                  ) : (
                    <div className={`w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${unvotedCircle}`} />
                  )}
                  <span className={`font-medium break-words ${mine ? textMain : textSub}`} style={{ fontSize: fs(18) }}>
                    {opt.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <div className="flex -space-x-1.5">
                    {votersForOption.slice(0, 4).map((voter) => (
                      <div
                        key={voter.email}
                        title={voter.name}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 ${hasColor ? 'border-white/60' : 'border-white dark:border-slate-800'} shadow-sm`}
                        style={{ backgroundColor: voter.color || '#94a3b8' }}
                      >
                        {voter.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    ))}
                  </div>
                  <span className={`font-bold tabular-nums ${mine ? theme.text : textMuted}`} style={{ fontSize: fs(17) }}>
                    {pct}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}

        {editing && editable && (
          <div className="flex flex-col" style={{ gap: fs(8), marginTop: fs(6) }}>
            <button onClick={addOption} className={`flex w-max items-center gap-1.5 font-semibold self-start px-2 py-1 rounded transition-colors ${hasColor ? 'text-slate-700 hover:bg-white/40' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`} style={{ fontSize: fs(17) }}>
              <Plus className="w-5 h-5" /> Add another option
            </button>

            <div className={`flex items-center gap-2 pt-2 border-t ${footerBorder}`}>
              <span className={`font-medium ${textMuted} mr-1`} style={{ fontSize: fs(15) }}>Color:</span>
              {BG_COLORS.map((c) => (
                <button
                  key={c || 'default'}
                  onClick={() => onEditProps({ bgColor: c })}
                  className={`w-6 h-6 rounded-full border transition-all ${props.bgColor === c ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 border-transparent' : 'border-slate-300 dark:border-slate-600 hover:scale-110'}`}
                  style={{ backgroundColor: c || 'transparent' }}
                  title={c ? 'Color' : 'Default'}
                >
                  {!c && <div className="w-full h-full rounded-full bg-white dark:bg-[#22272b] border border-slate-200 dark:border-slate-700" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {!editing && (
        <div className={`border-t flex items-center justify-between font-medium z-10 shrink-0 ${footerBorder} ${textMuted}`} style={{ fontSize: fs(15), paddingTop: fs(8), marginTop: fs(4) }}>
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1">
              {total > 0 && Array.from({ length: Math.min(total, 3) }).map((_, idx) => (
                 <div key={idx} className={`w-5 h-5 rounded-full border ${footerDot}`} />
              ))}
            </div>
            <span>{total} vote{total === 1 ? '' : 's'}</span>
          </div>
          {selected && editable && <span>Double-click to edit</span>}
        </div>
      )}
    </div>
  );
}
