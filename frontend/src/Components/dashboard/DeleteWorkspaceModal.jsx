import { useState } from 'react';
import { TrashIcon } from '../common/icons.jsx';

export default function DeleteWorkspaceModal({ workspace, boardCount, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-surface border border-edge rounded-2xl shadow-2xl w-full max-w-sm p-6 rb-anim-pop" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/15 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
            <TrashIcon />
          </div>
          <h2 className="text-content font-semibold text-base">Delete &ldquo;{workspace.name}&rdquo;?</h2>
        </div>
        <p className="text-sm text-content-muted mb-5">
          {boardCount > 0 ? (
            <>This permanently deletes the workspace and the <span className="font-semibold text-content">{boardCount} project{boardCount === 1 ? '' : 's'}</span> you own inside it. This can&apos;t be undone.</>
          ) : (
            <>This permanently deletes the workspace. Projects shared into it by others stay with their owners.</>
          )}
        </p>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-content-muted hover:text-content border border-edge rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={() => { setBusy(true); onConfirm(); }} disabled={busy}
            className="flex-1 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg disabled:opacity-50 hover:bg-red-700 transition-colors">
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
