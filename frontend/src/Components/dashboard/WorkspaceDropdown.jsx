import { PlusIcon, CheckIcon } from '../common/icons.jsx';

export default function WorkspaceDropdown({ workspaces, activeWorkspace, onSelect, onCreate }) {
  return (
    <div className="absolute left-0 top-full mt-1 w-64 bg-surface border border-edge rounded-xl shadow-2xl overflow-hidden z-30 py-2 rb-anim-pop" onClick={e => e.stopPropagation()}>
      <p className="px-3 py-1.5 text-xs text-content-subtle font-medium uppercase tracking-widest">Workspaces</p>
      {workspaces.map(ws => (
        <button key={ws.id} onClick={() => onSelect(ws)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${activeWorkspace?.id === ws.id ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'text-content-muted hover:bg-hover hover:text-content'}`}>
          <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {ws.name[0]?.toUpperCase()}
          </div>
          <span className="truncate font-medium">{ws.name}</span>
          {!ws.isOwner && <span className="ml-auto text-[10px] font-medium text-content-subtle bg-muted px-1.5 py-0.5 rounded">Shared</span>}
          {activeWorkspace?.id === ws.id && <CheckIcon />}
        </button>
      ))}
      <div className="h-px bg-edge-subtle my-1.5" />
      <button onClick={onCreate}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-content-muted hover:text-content hover:bg-hover transition-colors">
        <div className="w-6 h-6 rounded border-2 border-dashed border-edge-strong flex items-center justify-center flex-shrink-0">
          <PlusIcon />
        </div>
        Create workspace
      </button>
    </div>
  );
}
