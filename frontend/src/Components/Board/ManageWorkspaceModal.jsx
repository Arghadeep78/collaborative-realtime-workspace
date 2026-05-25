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
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0 ${
      tone === 'indigo' ? 'bg-gradient-to-br from-blue-600 to-indigo-600' : 'bg-gradient-to-br from-slate-500 to-slate-600'
    }`}>
      {email?.[0]?.toUpperCase()}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm rb-anim-fade p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-edge-subtle flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="text-content font-semibold text-lg tracking-tight truncate">Manage &ldquo;{workspaceName || data?.workspace?.name || 'Workspace'}&rdquo;</h2>
            <p className="text-content-muted text-xs mt-0.5">Members see every board as a viewer; elevate them per board below.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-content-subtle hover:text-content hover:bg-hover rounded-full transition-colors cursor-pointer shrink-0">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : (
          <div className="overflow-y-auto p-6 space-y-7">
            {/* ── Workspace members ─────────────────────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-content">
                <Users size={16} />
                <h3 className="text-sm font-semibold">Workspace members</h3>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') shareWorkspace(); }}
                  placeholder="Add a person by email"
                  className="flex-1 min-w-0 bg-surface border border-edge-strong rounded-lg px-3 py-2 text-content text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-sm"
                />
                <button
                  onClick={shareWorkspace}
                  disabled={!shareEmail.trim() || busy}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all shadow-sm active:scale-95"
                >
                  Share
                </button>
              </div>

              <div className="space-y-2">
                {/* Owner row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar email={data?.workspace?.owner} tone="indigo" />
                    <div className="min-w-0">
                      <p className="text-content text-sm font-medium truncate">{data?.workspace?.owner}</p>
                      <p className="text-content-muted text-xs">Owner</p>
                    </div>
                  </div>
                </div>
                {members.length === 0 ? (
                  <p className="text-content-subtle text-sm py-1">No members yet. Share the workspace to add people.</p>
                ) : members.map((m) => (
                  <div key={m.email} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar email={m.email} />
                      <div className="min-w-0">
                        <p className="text-content text-sm font-medium truncate">{m.name || m.email}</p>
                        <p className="text-content-muted text-xs">Member · viewer baseline</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeMember(m.email)}
                      className="text-content-subtle hover:text-red-500 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Remove from workspace"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Per-board access ──────────────────────────────────────── */}
            <section className="space-y-3 pt-5 border-t border-edge-subtle">
              <div className="flex items-center gap-2 text-content">
                <Layers size={16} />
                <h3 className="text-sm font-semibold">Board access</h3>
              </div>

              {boards.length === 0 ? (
                <p className="text-content-subtle text-sm">This workspace has no boards yet.</p>
              ) : boards.map((board) => {
                const participants = participantsFor(board);
                return (
                  <div key={board.id} className="rounded-xl border border-edge-subtle bg-muted/40 p-3">
                    <p className="text-content text-sm font-semibold mb-2 truncate">{board.title}</p>
                    {participants.length === 0 ? (
                      <p className="text-content-subtle text-xs">No one shared on this board yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {participants.map((p) => (
                          <div key={p.email} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Avatar email={p.email} />
                              <span className="text-content text-sm truncate">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                value={p.role}
                                onChange={(e) => setBoardRole(board.id, p.email, e.target.value)}
                                className="bg-surface border border-edge-strong rounded-lg px-2 py-1 text-content-muted text-xs focus:outline-none cursor-pointer"
                              >
                                {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                              </select>
                              {p.source === 'board' && (
                                <button
                                  onClick={() => removeBoardCollab(board.id, p.email)}
                                  className="text-content-subtle hover:text-red-500 p-1 rounded-md transition-colors cursor-pointer"
                                  title="Remove from board"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-muted border-t border-edge-subtle flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-content hover:opacity-90 text-app text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
