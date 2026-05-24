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

export default function PollBlock({
  element,
  editable,
  editing,
  selected,
  onEditProps,
  votes,
  boardId,
  bumpVote,
}) {
  const { props } = element;
  const options = useMemo(() => props.options || [], [props.options]);
  const pollId = element.id;

  const choiceStorageKey = `pollvote:${boardId}:${pollId}`;
  const [choice, setChoice] = useState(() => localStorage.getItem(choiceStorageKey) || null);

  useEffect(() => {
    if (choice && !options.some((o) => o.id === choice)) {
      localStorage.removeItem(choiceStorageKey);
      setChoice(null);
    }
  }, [choice, options, choiceStorageKey]);

  const counts = options.map((o) => votes?.[voteKey(pollId, o.id)] || 0);
  const total = counts.reduce((a, b) => a + b, 0);

  const castVote = (optionId) => {
    if (editing) return;
    if (choice === optionId) {
      bumpVote(voteKey(pollId, optionId), -1);
      localStorage.removeItem(choiceStorageKey);
      setChoice(null);
    } else {
      if (choice) bumpVote(voteKey(pollId, choice), -1);
      bumpVote(voteKey(pollId, optionId), +1);
      localStorage.setItem(choiceStorageKey, optionId);
      setChoice(optionId);
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

  return (
    <div 
      className="w-full h-full rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex flex-col p-5 gap-4 overflow-hidden transition-colors"
      style={{ backgroundColor: props.bgColor || undefined }}
    >
      <div className={`absolute inset-0 -z-10 ${!hasColor ? 'bg-white dark:bg-[#22272b]' : ''} rounded-2xl pointer-events-none`} />
      
      {/* Header / Question */}
      <div className="flex gap-3 items-start shrink-0 z-10">
        <div className="mt-1 bg-gradient-to-br from-indigo-500 to-purple-500 w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm">
          <BarChart2 className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              ref={questionRef}
              value={props.question}
              onChange={(e) => onEditProps({ question: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="Ask a question…"
              className={`w-full bg-transparent outline-none text-[26px] font-bold ${textMain} placeholder:text-slate-400`}
            />
          ) : (
            <div className={`text-[26px] font-bold ${textMain} break-words leading-snug`}>
              {props.question || <span className="text-slate-400 font-semibold italic">Untitled poll</span>}
            </div>
          )}
        </div>
      </div>

      {/* Options */}
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1 z-10" onPointerDown={(e) => editing && e.stopPropagation()}>
        {options.map((opt, i) => {
          const pct = total ? Math.round((counts[i] / total) * 100) : 0;
          const mine = choice === opt.id;
          const theme = OPTION_COLORS[i % OPTION_COLORS.length];
          
          if (editing) {
            return (
              <div key={opt.id} className="flex items-center gap-2 group">
                <div className={`w-3 h-3 rounded-full shrink-0 ${theme.fill}`} />
                <input
                  value={opt.label}
                  onChange={(e) => setOptionLabel(opt.id, e.target.value)}
                  className={`flex-1 min-w-0 text-[18px] border focus:border-slate-400 dark:focus:border-slate-500 rounded-lg px-3 py-2 outline-none transition-colors ${inputBg}`}
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
              <div className="relative flex-1 flex items-center justify-between px-4 py-3 min-h-[48px]">
                <div className="flex items-center gap-3">
                  {mine ? (
                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${theme.text}`} />
                  ) : (
                    <div className={`w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${unvotedCircle}`} />
                  )}
                  <span className={`text-[18px] font-medium break-words ${mine ? textMain : textSub}`}>
                    {opt.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className={`text-[17px] font-bold tabular-nums ${mine ? theme.text : textMuted}`}>
                    {pct}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}

        {editing && editable && (
          <div className="flex flex-col gap-3 mt-2">
            <button onClick={addOption} className={`flex w-max items-center gap-1.5 text-[17px] font-semibold self-start px-2 py-1 rounded transition-colors ${hasColor ? 'text-slate-700 hover:bg-white/40' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <Plus className="w-5 h-5" /> Add another option
            </button>

            <div className={`flex items-center gap-2 pt-2 border-t ${footerBorder}`}>
              <span className={`text-[15px] font-medium ${textMuted} mr-1`}>Color:</span>
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
        <div className={`mt-2 pt-3 border-t flex items-center justify-between text-[15px] font-medium z-10 ${footerBorder} ${textMuted}`}>
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
