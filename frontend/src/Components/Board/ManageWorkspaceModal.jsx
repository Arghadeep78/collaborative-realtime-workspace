import { useCallback, useEffect, useState } from 'react';
import { BACKEND_URL } from '../../constants/apiConfig.js';
import { X, Trash2, Users, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

const ROLES = ['viewer', 'commenter', 'editor'];
const roleLabel = (r) => r.charAt(0).toUpperCase() + r.slice(1);

/**
 * Owner-only dialog for managing a workspace's access:
 *   • Members — people with view-only access to every board in the workspace.
 *   • Board access — per-board roles (viewer / commenter / editor), where the
 *     owner can elevate a member on a specific board.
 *
 * Reused from the dashboard and from inside a board (TopUtilityBar → ShareModal).
 */
export default function ManageWorkspaceModal({ workspaceId, workspaceName, onClose, onChanged }) {
  const [data, setData]       = useState(null); // { workspace, boards }
  const [loading, setLoading] = useState(true);
  const [shareEmail, setShareEmail] = useState('');
  const [busy, setBusy]       = useState(false);

  const token = () => localStorage.getItem('token');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/workspaces/${workspaceId}/manage`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load workspace');
      setData(d);
    } catch (e) {
      toast.error(e.message);
      onClose?.();
    } finally {
      setLoading(false);
    }
  }, [workspaceId, onClose]);

  useEffect(() => { load(); }, [load]);

  const members = data?.workspace?.members || [];
  const memberEmails = new Set(members.map((m) => m.email));
  const boards = data?.boards || [];

  const updateBoardCollabs = (boardId, collaborators) =>
    setData((prev) => ({
      ...prev,
      boards: prev.boards.map((b) => (b.id === boardId ? { ...b, collaborators: collaborators || [] } : b)),
    }));

  const shareWorkspace = async () => {
    const email = shareEmail.trim();
    if (!email) return;
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND_URL}/workspaces/${workspaceId}/share`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to share');
      setData((prev) => ({ ...prev, workspace: d }));
      setShareEmail('');
      toast.success(`Shared with ${email}`);
      onChanged?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (email) => {
    try {
      const res = await fetch(`${BACKEND_URL}/workspaces/${workspaceId}/members/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to remove member');
      // Membership removal also strips their per-board collaborator entries —
      // reload so the board lists reflect that.
      await load();
      toast.success(`Removed ${email}`);
      onChanged?.();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Change a participant's role on one board.
  //   • viewer + workspace member → unshare (falls back to the viewer baseline)
  //   • otherwise → share at the chosen role
  const setBoardRole = async (boardId, email, role) => {
    const isMember = memberEmails.has(email);
    try {
      if (role === 'viewer' && isMember) {
        const res = await fetch(`${BACKEND_URL}/boards/unshare/${boardId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        updateBoardCollabs(boardId, d.collaborators);
      } else {
        const res = await fetch(`${BACKEND_URL}/boards/share/${boardId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        updateBoardCollabs(boardId, d.collaborators);
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  const removeBoardCollab = async (boardId, email) => {
    try {
      const res = await fetch(`${BACKEND_URL}/boards/unshare/${boardId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      updateBoardCollabs(boardId, d.collaborators);
      toast.success('Access updated');
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Everyone who can touch a board: workspace members (viewer baseline) merged
  // with explicit collaborators (their role wins).
  const participantsFor = (board) => {
    const map = new Map();
    members.forEach((m) => map.set(m.email, { email: m.email, name: m.name || m.email, role: 'viewer', source: 'workspace' }));
    (board.collaborators || []).forEach((c) =>
      map.set(c.email, { email: c.email, name: c.name || c.email, role: c.role, source: 'board' }));
    return [...map.values()];
  };

  const Avatar = ({ email, tone = 'slate' }) => (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-extrabold shadow-sm shrink-0 transition-transform hover:scale-105 ${
      tone === 'indigo' ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/30' : 'bg-gradient-to-br from-slate-600 to-slate-800 dark:from-slate-700 dark:to-slate-900 shadow-slate-500/20'
    }`}>
      {email?.[0]?.toUpperCase()}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-all" />
      <div className="relative w-full max-w-[900px] h-full max-h-[85vh] flex flex-col rb-anim-pop" onClick={e => e.stopPropagation()}>
        
        {/* Premium Glass Container */}
        <div className="flex-1 flex flex-col rounded-3xl overflow-hidden bg-surface/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
           
           {/* Top Animated Header */}
           <div className="relative px-8 py-8 shrink-0 overflow-hidden bg-surface">
             <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl opacity-70 animate-pulse" />
             <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl opacity-70 animate-pulse" style={{ animationDelay: '2s' }} />
             
             <div className="relative flex justify-between items-start z-10">
               <div>
                 <h2 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                   Access Control
                 </h2>
                 <p className="mt-1.5 text-content-muted text-sm font-medium">
                   Manage who collaborates in <span className="text-content font-bold">{workspaceName || data?.workspace?.name || 'Workspace'}</span>
                 </p>
               </div>
               <button onClick={onClose} className="p-2 bg-muted hover:bg-hover rounded-full transition-all text-content-subtle hover:text-content shadow-sm">
                 <X size={20} />
               </button>
             </div>
           </div>

           {loading ? (
             <div className="flex-1 flex items-center justify-center bg-muted/20">
               <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin" />
             </div>
           ) : (
             <div className="flex-1 flex flex-col md:flex-row overflow-hidden border-t border-edge-subtle">
               
               {/* Left: Members */}
               <div className="w-full md:w-[45%] flex flex-col bg-muted/30 border-r border-edge-subtle">
                  <div className="p-6 shrink-0 border-b border-edge-subtle bg-surface/50">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        <Users size={18} />
                      </div>
                      <h3 className="font-bold text-content text-lg">Workspace Team</h3>
                    </div>
                    
                    {/* Share Input */}
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-[2px]" />
                      <div className="relative flex gap-2 bg-surface p-1.5 rounded-xl border border-edge-subtle shadow-inner">
                        <input
                          value={shareEmail}
                          onChange={(e) => setShareEmail(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') shareWorkspace(); }}
                          placeholder="Invite via email..."
                          className="flex-1 bg-transparent px-3 text-sm text-content focus:outline-none placeholder:text-content-subtle"
                        />
                        <button
                          onClick={shareWorkspace}
                          disabled={!shareEmail.trim() || busy}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:scale-100"
                        >
                          Invite
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                    {/* Owner */}
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-transparent border border-indigo-500/20 shadow-sm">
                      <div className="flex items-center gap-3.5">
                        <Avatar email={data?.workspace?.owner} tone="indigo" />
                        <div>
                          <p className="text-sm font-bold text-content">{data?.workspace?.owner}</p>
                          <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-0.5">Owner</p>
                        </div>
                      </div>
                    </div>
                    {/* Members */}
                    {members.map(m => (
                      <div key={m.email} className="group flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-edge-subtle hover:border-indigo-500/30 hover:shadow-md transition-all duration-300">
                        <div className="flex items-center gap-3.5">
                          <Avatar email={m.email} />
                          <div>
                            <p className="text-sm font-semibold text-content">{m.name || m.email}</p>
                            <p className="text-xs text-content-subtle font-medium mt-0.5">Viewer baseline</p>
                          </div>
                        </div>
                        <button onClick={() => removeMember(m.email)} className="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all" title="Remove member">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {members.length === 0 && (
                       <p className="text-center text-sm text-content-subtle py-8">No extra members yet.</p>
                    )}
                  </div>
               </div>

               {/* Right: Board Access */}
               <div className="w-full md:w-[55%] flex flex-col bg-surface/50">
                  <div className="p-6 shrink-0 border-b border-edge-subtle bg-surface/50">
                    <div className="flex items-center gap-3 mb-1.5">
                      <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        <Layers size={18} />
                      </div>
                      <h3 className="font-bold text-content text-lg">Board Permissions</h3>
                    </div>
                    <p className="text-xs text-content-subtle ml-[52px]">Elevate member roles on specific boards</p>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                    {boards.length === 0 ? (
                      <div className="text-center py-10 text-content-subtle border-2 border-dashed border-edge-subtle rounded-2xl">No boards to manage yet</div>
                    ) : boards.map((board) => {
                       const participants = participantsFor(board);
                       return (
                         <div key={board.id} className="relative overflow-hidden rounded-2xl bg-surface border border-edge-subtle hover:border-purple-500/30 hover:shadow-xl shadow-sm transition-all duration-300">
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-indigo-500 opacity-60" />
                            <div className="p-5 pl-6">
                              <h4 className="font-bold text-content text-sm mb-4 truncate">{board.title}</h4>
                              <div className="space-y-2.5">
                                 {participants.length === 0 ? (
                                    <p className="text-xs text-content-subtle py-2">No active collaborators</p>
                                 ) : participants.map(p => (
                                    <div key={p.email} className="flex items-center justify-between bg-muted/30 rounded-xl p-2 border border-transparent hover:border-edge-subtle transition-colors">
                                       <div className="flex items-center gap-3 min-w-0">
                                          <Avatar email={p.email} />
                                          <span className="text-sm font-medium text-content truncate">{p.name}</span>
                                       </div>
                                       <div className="flex items-center gap-2 shrink-0">
                                          <div className="relative">
                                            <select
                                              value={p.role}
                                              onChange={(e) => setBoardRole(board.id, p.email, e.target.value)}
                                              className="appearance-none bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 border border-transparent hover:border-indigo-500/30 rounded-lg pl-3 pr-7 py-1.5 text-xs font-bold tracking-wide focus:outline-none cursor-pointer transition-all uppercase"
                                            >
                                              {ROLES.map(r => <option key={r} value={r} className="text-black">{roleLabel(r)}</option>)}
                                            </select>
                                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-500">
                                               <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                            </div>
                                          </div>
                                          {p.source === 'board' && (
                                            <button onClick={() => removeBoardCollab(board.id, p.email)} className="p-1.5 text-content-subtle hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all" title="Remove from board">
                                               <Trash2 size={15} />
                                            </button>
                                          )}
                                       </div>
                                    </div>
                                 ))}
                              </div>
                            </div>
                         </div>
                       )
                    })}
                  </div>
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
