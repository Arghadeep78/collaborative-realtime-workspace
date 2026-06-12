import { useState } from 'react';
import { XIcon } from '../common/icons.jsx';

export default function CreateWorkspaceModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await onCreate(name.trim());
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-surface border border-edge rounded-2xl shadow-2xl w-full max-w-sm p-6 rb-anim-pop" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-content font-semibold text-base">New workspace</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-content-muted hover:text-content hover:bg-hover transition-colors"><XIcon /></button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose(); }}
          placeholder="Workspace name"
          className="w-full bg-muted text-content text-sm px-3 py-2.5 rounded-lg border border-edge outline-none focus:border-indigo-500 placeholder:text-content-subtle transition-colors mb-5"
        />
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-content-muted hover:text-content border border-edge rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={!name.trim() || busy}
            className="flex-1 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors">
            {busy ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
