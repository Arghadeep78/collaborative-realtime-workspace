import { useCallback, useEffect, useState } from 'react';
import { BACKEND_URL } from '../../constants/apiConfig.js';
import { X, Trash2, Crown, Eye, MessageSquare, Pencil, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const ROLES = ['editor', 'commenter', 'viewer'];
const roleLabel = (r) => r.charAt(0).toUpperCase() + r.slice(1);

const roleColor = (r) => {
  if (r === 'owner')     return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';
  if (r === 'editor')    return 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
  if (r === 'commenter') return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  return 'text-slate-500 dark:text-slate-400 bg-slate-500/10 border-slate-500/20';
};

const roleIcon = (r) => {
  if (r === 'owner')     return <Crown size={13} />;
  if (r === 'editor')    return <Pencil size={13} />;
  if (r === 'commenter') return <MessageSquare size={13} />;
  return <Eye size={13} />;
};

/**
 * Focused board-access panel: shows who has access to this one board
 * and lets the owner change individual roles or remove people.
 * onBack — called when the user wants to go back (to ShareModal).
 */
export default function ManageBoardAccessModal({ boardId, boardTitle, workspaceId, onClose, onBack }) {
  const [loading, setLoading] = useState(true);
  const [owner, setOwner]     = useState(null);
  const [members, setMembers] = useState([]);   // workspace members (viewer baseline)
  const [collabs, setCollabs] = useState([]);   // explicit board collaborators

  const token = () => localStorage.getItem('token');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/workspaces/${workspaceId}/manage`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setOwner(d.workspace?.owner || null);
      setMembers(d.workspace?.members || []);
      const board = (d.boards || []).find((b) => b.id === boardId);
      setCollabs(board?.collaborators || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, boardId]);

  useEffect(() => { load(); }, [load]);

  const memberEmails = new Set(members.map((m) => m.email));

  // Merge workspace members (viewer baseline) with explicit collaborators.
  const participants = (() => {
    const map = new Map();
    members.forEach((m) =>
      map.set(m.email, { email: m.email, name: m.name || m.email, role: 'viewer', source: 'workspace' })
    );
    collabs.forEach((c) =>
      map.set(c.email, { email: c.email, name: c.name || c.email, role: c.role, source: 'board' })
    );
    return [...map.values()];
  })();

  const setRole = async (email, role) => {
    const isMember = memberEmails.has(email);
    try {
      if (role === 'viewer' && isMember) {
        // Downgrade back to workspace baseline — just unshare the board entry
        const res = await fetch(`${BACKEND_URL}/boards/unshare/${boardId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        setCollabs(d.collaborators || []);
      } else {
        const res = await fetch(`${BACKEND_URL}/boards/share/${boardId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        setCollabs(d.collaborators || []);
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  const removeCollab = async (email) => {
    try {
      const res = await fetch(`${BACKEND_URL}/boards/unshare/${boardId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setCollabs(d.collaborators || []);
      toast.success('Access removed');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const Avatar = ({ email }) => (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-extrabold shadow-sm shrink-0 bg-linear-to-br from-slate-600 to-slate-800 dark:from-slate-700 dark:to-slate-900">
      {email?.[0]?.toUpperCase()}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <div
        className="relative w-full max-w-md flex flex-col rb-anim-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col rounded-3xl overflow-hidden bg-surface/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] max-h-[85vh]">

          {/* Header */}
          <div className="relative px-6 py-6 shrink-0 overflow-hidden bg-surface">
            <div className="absolute -top-32 -right-32 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl opacity-60 animate-pulse" />
            <div className="relative flex items-center gap-3 z-10">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 bg-muted hover:bg-hover rounded-full transition-all text-content-subtle hover:text-content shrink-0"
                >
                  <ChevronLeft size={18} />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-extrabold tracking-tight text-transparent bg-clip-text bg-linear-to-br from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                  Manage Access
                </h2>
                <p className="mt-0.5 text-content-subtle text-xs font-medium truncate">
                  {boardTitle}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-muted hover:bg-hover rounded-full transition-all text-content-subtle hover:text-content shrink-0"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 border-t border-edge-subtle">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Owner row */}
                <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-extrabold shadow-sm bg-linear-to-br from-amber-400 to-amber-600 shrink-0">
                      {owner?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-content truncate">{owner}</p>
                      <p className="text-[11px] text-content-subtle">Board owner</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wide ${roleColor('owner')}`}>
                    {roleIcon('owner')}
                    Owner
                  </div>
                </div>

                {/* All other participants */}
                {participants.map((p) => (
                  <div key={p.email} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-surface border border-edge-subtle hover:border-indigo-500/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar email={p.email} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-content truncate">{p.name}</p>
                        <p className="text-[11px] text-content-subtle">
                          {p.source === 'workspace' ? 'Workspace member' : 'Board collaborator'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative">
                        <select
                          value={p.role}
                          onChange={(e) => setRole(p.email, e.target.value)}
                          className={`appearance-none border rounded-lg pl-3 pr-7 py-1.5 text-xs font-bold tracking-wide uppercase focus:outline-none cursor-pointer transition-all ${roleColor(p.role)}`}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r} className="text-black dark:text-white bg-white dark:bg-gray-800">
                              {roleLabel(r)}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </div>

                      {p.source === 'board' && (
                        <button
                          onClick={() => removeCollab(p.email)}
                          className="p-1.5 text-content-subtle hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Remove from board"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {participants.length === 0 && (
                  <p className="text-center text-sm text-content-subtle py-10">
                    No members or collaborators on this board
                  </p>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-edge-subtle bg-muted/30 shrink-0">
            <p className="text-[11px] text-content-subtle text-center">
              Workspace members always have at least viewer access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
