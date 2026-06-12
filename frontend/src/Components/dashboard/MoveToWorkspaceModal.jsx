import { XIcon } from '../common/icons.jsx';

export default function MoveToWorkspaceModal({ board, workspaces, currentWorkspaceId, onMove, onClose }) {
  const others = workspaces.filter(w => w.isOwner && w.id !== currentWorkspaceId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-surface border border-edge rounded-2xl shadow-2xl w-full max-w-sm p-6 rb-anim-pop" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-content font-semibold text-base">Move to workspace</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-content-muted hover:text-content hover:bg-hover transition-colors"><XIcon /></button>
        </div>
        <p className="text-xs text-content-subtle mb-3 truncate">Moving: <span className="font-medium text-content">{board.title}</span></p>
        {others.length === 0 ? (
          <p className="text-sm text-content-subtle py-4 text-center">No other workspaces available.<br />Create one first.</p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {others.map(ws => (
              <button key={ws.id} onClick={() => onMove(ws.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-content-muted hover:bg-hover hover:text-content transition-colors">
                <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {ws.name[0]?.toUpperCase()}
                </div>
                <span className="truncate font-medium">{ws.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
