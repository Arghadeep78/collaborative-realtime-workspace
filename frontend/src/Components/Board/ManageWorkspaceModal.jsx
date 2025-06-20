import { useCallback, useEffect, useState } from 'react';
import { BACKEND_URL } from '../../constants/apiConfig.js';
import { X, Trash2, Users, ChevronRight, ChevronDown, Crown, Eye, MessageSquare, Pencil, UserMinus } from 'lucide-react';
import toast from 'react-hot-toast';
import Avatar from '../common/Avatar.jsx';
import { AVATAR_OWNER, AVATAR_MEMBER } from './theme/colorMap.js';

const ROLES = ['owner', 'editor', 'commenter', 'viewer'];

const roleLabel = (r) => r.charAt(0).toUpperCase() + r.slice(1);

const roleIcon = (r) => {
  if (r === 'owner')     return <Crown size={13} />;
  if (r === 'editor')    return <Pencil size={13} />;
  if (r === 'commenter') return <MessageSquare size={13} />;
  return <Eye size={13} />;
};

const roleColor = (r) => {
  if (r === 'owner')     return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';
  if (r === 'editor')    return 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
  if (r === 'commenter') return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  return 'text-slate-500 dark:text-slate-400 bg-slate-500/10 border-slate-500/20';
};

/**
 * Owner-only dialog: lists all boards in the workspace.
 * Click a board to expand its per-user role panel.
 * focusBoardId — if provided, that board starts expanded.
 */
export default function ManageWorkspaceModal({ workspaceId, workspaceName, focusBoardId, onClose, onChanged }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [shareEmail, setShareEmail] = useState('');
  const [busy, setBusy]           = useState(false);
  const [expandedBoard, setExpandedBoard] = useState(focusBoardId || null);

  const token = () => localStorage.getItem('token');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/workspaces/${workspaceId}/manage`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Failed to load workspace');
      setData(body.data);
    } catch (e) {
      toast.error(e.message);
      onClose?.();
    } finally {
      setLoading(false);
    }
  }, [workspaceId, onClose]);

  useEffect(() => { load(); }, [load]);

  const members     = data?.workspace?.members || [];
  const memberEmails = new Set(members.map((m) => m.email));
  const boards      = data?.projects || [];

  const updateBoardCollabs = (boardId, collaborators) =>
    setData((prev) => ({
      ...prev,
      projects: prev.projects.map((b) =>
        b.id === boardId ? { ...b, collaborators: collaborators || [] } : b
      ),
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
      if (!res.ok) throw new Error(d.message || 'Failed to share');
      setData((prev) => ({ ...prev, workspace: d.data }));
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
      const res = await fetch(
        `${BACKEND_URL}/workspaces/${workspaceId}/members/${encodeURIComponent(email)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || 'Failed to remove member');
      await load();
      toast.success(`Removed ${email}`);
      onChanged?.();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // viewer + workspace-member → unshare (falls back to viewer baseline)
  // anything else → share at chosen role
  const setBoardRole = async (boardId, email, role) => {
    const isMember = memberEmails.has(email);
    try {
      if (role === 'viewer' && isMember) {
        const res = await fetch(`${BACKEND_URL}/projects/unshare/${boardId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.message);
        updateBoardCollabs(boardId, d.data?.collaborators);
      } else {
        const res = await fetch(`${BACKEND_URL}/projects/share/${boardId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.message);
        updateBoardCollabs(boardId, d.data?.collaborators);
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  const removeBoardCollab = async (boardId, email) => {
    try {
      const res = await fetch(`${BACKEND_URL}/projects/unshare/${boardId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      updateBoardCollabs(boardId, d.data?.collaborators);
      toast.success('Access updated');
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Workspace members (viewer baseline) merged with explicit board collaborators.
  const participantsFor = (board) => {
    const map = new Map();
    members.forEach((m) =>
      map.set(m.email, { email: m.email, name: m.name || '', profilePicture: m.profilePicture || '', role: 'viewer', source: 'workspace' })
    );
    (board.collaborators || []).forEach((c) =>
      map.set(c.email, { email: c.email, name: c.name || '', profilePicture: c.profilePicture || '', role: c.role, source: 'board' })
    );
    return [...map.values()];
  };

  const MemberAvatar = ({ email, name, profilePicture, tone = 'slate' }) => (
    <Avatar
      email={email}
      name={name || email}
      src={profilePicture}
      size={36}
      shapeClass="rounded-xl"
      color={tone === 'indigo' ? '#8b5cf6' : AVATAR_MEMBER}
      borderClass="border-transparent"
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-all" />
      <div
        className="relative w-full max-w-175 max-h-[88vh] flex flex-col rb-anim-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 flex flex-col rounded-3xl overflow-hidden bg-surface/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">

          {/* Header */}
          <div className="relative px-8 py-7 shrink-0 overflow-hidden bg-surface">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl opacity-70 animate-pulse" />
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl opacity-70 animate-pulse" style={{ animationDelay: '2s' }} />
            <div className="relative flex justify-between items-start z-10">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                  Manage Access
                </h2>
                <p className="mt-1 text-content-muted text-sm font-medium">
                  <span className="text-content font-bold">{workspaceName || data?.workspace?.name || 'Workspace'}</span>
                  {' '}— click a project to manage its permissions
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-muted hover:bg-hover rounded-full transition-all text-content-subtle hover:text-content shadow-sm"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-muted/20">
              <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden border-t border-edge-subtle">

              {/* Workspace member invite bar */}
              <div className="px-6 py-4 shrink-0 bg-muted/30 border-b border-edge-subtle">
                <div className="flex items-center gap-2 mb-3">
                  <Users size={15} className="text-indigo-500" />
                  <span className="text-xs font-bold text-content uppercase tracking-wider">Workspace Members</span>
                  <span className="ml-1 text-xs text-content-subtle">({members.length} member{members.length !== 1 ? 's' : ''})</span>
                </div>
                <div className="flex gap-2">
                  <input
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') shareWorkspace(); }}
                    placeholder="Invite member by email (viewer baseline on all projects)…"
                    className="flex-1 bg-surface border border-edge-subtle rounded-lg px-3 py-2 text-sm text-content focus:outline-none focus:border-indigo-500 placeholder:text-content-subtle"
                  />
                  <button
                    onClick={shareWorkspace}
                    disabled={!shareEmail.trim() || busy}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50 shrink-0"
                  >
                    Invite
                  </button>
                </div>

                {/* Member pills */}
                {members.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {/* Owner pill */}
                    <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
                      <Avatar email={data?.workspace?.owner} name={data?.workspace?.ownerName || data?.workspace?.owner} size={20} color={AVATAR_OWNER} borderClass="border-transparent" />
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        {data?.workspace?.ownerName || data?.workspace?.owner}
                      </span>
                      {data?.workspace?.ownerName && (
                        <span className="text-xs text-amber-600/70 dark:text-amber-400/60">({data.workspace.owner})</span>
                      )}
                      <Crown size={11} className="text-amber-500 ml-0.5" />
                    </div>
                    {members.map((m) => (
                      <div key={m.email} className="group flex items-center gap-1.5 bg-surface border border-edge-subtle rounded-full pl-1.5 pr-2 py-1 hover:border-red-400/50 transition-colors">
                        <Avatar email={m.email} name={m.name || m.email} size={20} color={AVATAR_MEMBER} borderClass="border-transparent" />
                        <span className="text-xs font-medium text-content">
                          {m.name || m.email}
                          {m.name && <span className="text-content-subtle font-normal ml-1">({m.email})</span>}
                        </span>
                        <button
                          onClick={() => removeMember(m.email)}
                          className="ml-0.5 text-content-subtle hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove member"
                        >
                          <UserMinus size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Board list */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                {boards.length === 0 ? (
                  <div className="text-center py-10 text-content-subtle border-2 border-dashed border-edge-subtle rounded-2xl text-sm">
                    No projects in this workspace yet
                  </div>
                ) : boards.map((board) => {
                  const isOpen       = expandedBoard === board.id;
                  const participants = participantsFor(board);
                  const collabCount  = (board.collaborators || []).length;

                  return (
                    <div
                      key={board.id}
                      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                        isOpen
                          ? 'border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                          : 'border-edge-subtle hover:border-indigo-500/30 hover:shadow-md'
                      } bg-surface`}
                    >
                      {/* Board row — click to expand */}
                      <button
                        className="w-full flex items-center gap-4 px-5 py-4 text-left"
                        onClick={() => setExpandedBoard(isOpen ? null : board.id)}
                      >
                        {/* Colour accent */}
                        <div className="w-1.5 h-10 rounded-full bg-linear-to-b from-indigo-500 to-purple-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-content text-sm truncate">{board.title}</p>
                          <p className="text-xs text-content-subtle mt-0.5">
                            {collabCount > 0
                              ? `${collabCount} explicit collaborator${collabCount !== 1 ? 's' : ''}`
                              : 'Workspace viewer baseline only'}
                          </p>
                        </div>
                        <div className="shrink-0 text-content-subtle">
                          {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </div>
                      </button>

                      {/* Expanded permission panel */}
                      {isOpen && (
                        <div className="border-t border-edge-subtle bg-muted/20 px-5 py-4 space-y-2">
                          {/* Owner row (always first, not editable) */}
                          <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                            <div className="flex items-center gap-3 min-w-0">
                              <MemberAvatar email={data?.workspace?.owner} tone="indigo" />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-content truncate">
                                  {data?.workspace?.ownerName || data?.workspace?.owner}
                                </p>
                                <p className="text-[11px] text-content-subtle truncate">
                                  {data?.workspace?.ownerName
                                    ? `${data.workspace.owner} · Project owner`
                                    : 'Project owner'}
                                </p>
                              </div>
                            </div>
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wide ${roleColor('owner')}`}>
                              {roleIcon('owner')}
                              Owner
                            </div>
                          </div>

                          {/* All other participants */}
                          {participants.map((p) => (
                            <div key={p.email} className="flex items-center justify-between py-2 px-3 rounded-xl bg-surface border border-edge-subtle hover:border-indigo-500/20 transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <MemberAvatar email={p.email} name={p.name} profilePicture={p.profilePicture} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-content truncate">
                                    {p.name || p.email}
                                  </p>
                                  <p className="text-[11px] text-content-subtle truncate">
                                    {p.name
                                      ? `${p.email} · ${p.source === 'workspace' ? 'Workspace member' : 'Project collaborator'}`
                                      : `${p.source === 'workspace' ? 'Workspace member' : 'Project collaborator'} · not registered`}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {/* Role selector — owner option only for the workspace owner */}
                                <div className="relative">
                                  <select
                                    value={p.role}
                                    onChange={(e) => setBoardRole(board.id, p.email, e.target.value)}
                                    className={`appearance-none border rounded-lg pl-3 pr-7 py-1.5 text-xs font-bold tracking-wide uppercase focus:outline-none cursor-pointer transition-all ${roleColor(p.role)}`}
                                  >
                                    {ROLES.filter((r) => r !== 'owner').map((r) => (
                                      <option key={r} value={r} className="text-black dark:text-white bg-white dark:bg-gray-800">
                                        {roleLabel(r)}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60">
                                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                  </div>
                                </div>

                                {/* Remove (only for explicit board collabs) */}
                                {p.source === 'board' && (
                                  <button
                                    onClick={() => removeBoardCollab(board.id, p.email)}
                                    className="p-1.5 text-content-subtle hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                    title="Remove from project"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}

                          {participants.length === 0 && (
                            <p className="text-xs text-content-subtle py-3 text-center">
                              No members or collaborators on this project yet
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
