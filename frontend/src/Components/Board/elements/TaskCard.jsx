import { useTheme } from '../../../contexts/ThemeContext.jsx';
import { dueMeta } from '../taskConstants.js';
import { TASK_STATUS_COLORS } from '../theme/colorMap.js';
import { CheckCircle2, Clock } from 'lucide-react';
import MemberAvatar from '../MemberAvatar.jsx';

const RING = 'ring-[1.5px] ring-white/90 dark:ring-black/25 shadow-sm';
const MAX_AVATARS = 3;



export default function TaskCard({ element, members = [] }) {
  const { isDark } = useTheme();
  const { props = {} } = element;
  const assignees = props.assignees || [];
  const due = dueMeta(props.dueDate);
  const memberOf = (email) => members.find((m) => m.email === email);

  const shown = assignees.slice(0, MAX_AVATARS);
  const overflow = assignees.length - shown.length;

  const status = props.status || 'todo';
  const colors = TASK_STATUS_COLORS[status] || TASK_STATUS_COLORS.todo;
  const base = isDark ? colors.dark : colors.light;

  return (
    <div
      className="w-full h-full flex flex-col justify-center gap-0.5 px-2.5 py-1.5 rounded-md overflow-hidden ring-1 ring-inset ring-white/15 text-white"
      style={{
        backgroundImage: `linear-gradient(to bottom, ${base}, color-mix(in srgb, ${base} 82%, #000))`,
        boxShadow: `0 2px 8px ${colors.shadow}`,
      }}
    >
      <div className="flex items-center justify-between gap-1.5 w-full min-w-0">
        <div className="flex flex-col min-w-0 gap-0.5">
          <span className="flex items-center gap-1 text-[11px] font-bold tracking-widest uppercase shrink-0">
            <CheckCircle2 className="w-3 h-3 shrink-0" /> Task
          </span>
          {due && (
            <span className="flex items-center gap-1 px-1.5 py-px rounded-full bg-black/20 text-[10px] font-semibold leading-none self-start max-w-full truncate shrink-0">
              <Clock className="w-2.5 h-2.5 shrink-0" /> {due.label}
            </span>
          )}
        </div>

        {assignees.length > 0 && (
          <div className="flex flex-row-reverse items-center shrink-0">
            {overflow > 0 && (
              <span
                title={`+${overflow} more`}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/25 text-white text-[10px] font-bold ring-[1.5px] ring-white/90 dark:ring-black/25 leading-none -ml-1.5 relative z-0 pb-[2px]"
              >
                ...
              </span>
            )}
            {shown.slice().reverse().map((a, ri) => {
              const m = memberOf(a);
              const z = ri + 1;
              return (
                <div key={a} className="-ml-1.5 first:ml-0 relative flex shrink-0 items-center justify-center" style={{ zIndex: z }}>
                  <MemberAvatar label={m?.name || a} src={m?.profilePicture} size={16} ring={RING} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
