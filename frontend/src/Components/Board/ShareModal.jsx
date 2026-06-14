import { useState, useEffect, useCallback } from 'react';
import { BACKEND_URL } from '../../constants/apiConfig.js';
import { Globe, Lock, Copy, X, Crown, Eye, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Avatar from '../common/Avatar.jsx';
import { AVATAR_OWNER, AVATAR_MEMBER } from './theme/colorMap.js';

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

// `readOnly` renders a view-only variant for non-owners: just the
// "People with access" list (no invite, no role editing, no general-access /
// link controls). Owners get the full management UI.
export default function ShareModal({ boardId, board, workspace, onClose, readOnly = false }) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole]   = useState('editor');

  // Merged access data (workspace members + board collaborators), loaded like ManageBoardAccessModal did.
  const [accessLoading, setAccessLoading] = useState(true);
  const [owner, setOwner]   = useState({ email: board?.owner, name: board?.owner, profilePicture: '' });
  const [members, setMembers] = useState([]); // workspace members (viewer baseline)

  const [isPublic, setIsPublic]       = useState(false);
  const [publicRole, setPublicRole]   = useState('viewer');

  // Combined general-access value: 'restricted' | 'viewer' | 'commenter' | 'editor'
  const generalAccess = isPublic ? publicRole : 'restricted';
  const handleGeneralAccess = (val) => {
    if (val === 'restricted') handleUpdateGeneralAccess(false, publicRole);
    else handleUpdateGeneralAccess(true, val);
  };

  const [collaborators, setCollabs]   = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copying, setCopying]         = useState(false);

  const token = () => localStorage.getItem('token');
  // Strip any existing share token so re-copying a different role doesn't stack params.
  const baseUrl = (() => {
    const u = new URL(window.location.href);
    u.searchParams.delete('st');
    return u.toString();
  })();

  // Load workspace members (viewer baseline) + the board's current collaborators.
  // We always re-fetch the board so people who joined via a share link (recorded
  // server-side on connect) show up even when the board has no workspace and even
  // if the `board` prop is stale from an earlier page load.
  const loadAccess = useCallback(async () => {
    setAccessLoading(true);
    try {
      // The /workspaces/:id/manage endpoint is owner-only, so the read-only
      // (non-owner) variant always falls back to the public GET /projects/:id,
      // which returns the collaborator list without requiring ownership.
      if (workspace?.id && !readOnly) {
        const res = await fetch(`${BACKEND_URL}/workspaces/${workspace.id}/manage`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Failed to load access');
        const ws = d.workspace || {};
        setOwner({ email: ws.owner, name: ws.ownerName || '', profilePicture: ws.ownerProfilePicture || '' });
        setMembers(ws.members || []);
        const b = (d.projects || []).find((x) => x.id === boardId);
        if (b?.collaborators) setCollabs(b.collaborators);
      } else {
        // Non-owner or no workspace: pull the latest board data.
        const res = await fetch(`${BACKEND_URL}/projects/${boardId}`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        const b = await res.json();
        if (!res.ok) throw new Error(b.error || 'Failed to load access');
        if (Array.isArray(b.collaborators)) setCollabs(b.collaborators);
        if (typeof b.isPublic === 'boolean') setIsPublic(b.isPublic);
        if (b.publicRole) setPublicRole(b.publicRole);
        // workspaceMembers is now embedded in the board response with resolved names.
        if (b.owner) setOwner({ email: b.owner, name: b.ownerName || b.owner, profilePicture: '' });
        if (Array.isArray(b.workspaceMembers)) setMembers(b.workspaceMembers);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAccessLoading(false);
    }
  }, [workspace?.id, boardId, readOnly]);

  useEffect(() => { loadAccess(); }, [loadAccess]);

  const memberEmails = new Set(members.map((m) => m.email));

  // Merge workspace members (viewer baseline) with explicit collaborators.
  // Exclude the owner — they are already rendered in their own dedicated row.
  const participants = (() => {
    const map = new Map();
    members.forEach((m) => {
      if (m.email === owner?.email) return;
      map.set(m.email, { email: m.email, name: m.name || '', profilePicture: m.profilePicture || '', role: 'viewer', source: 'workspace' });
    });
    collaborators.forEach((c) => {
      if (c.email === owner?.email) return;
      map.set(c.email, { email: c.email, name: c.name || '', profilePicture: c.profilePicture || '', role: c.role, source: 'board' });
    });
    return [...map.values()];
  })();

  const setRole = async (email, role) => {
    const isMember = memberEmails.has(email);
    try {
      if (role === 'viewer' && isMember) {
        // Downgrade back to workspace baseline — just unshare the board entry.
        const res = await fetch(`${BACKEND_URL}/projects/unshare/${boardId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        setCollabs(d.collaborators || []);
      } else {
        const res = await fetch(`${BACKEND_URL}/projects/share/${boardId}`, {
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

  const copyLink = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(baseUrl);
      toast.success('Link copied');
    } catch (e) {
      toast.error('Failed to copy link');
    } finally {
      setCopying(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/projects/share/${boardId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to share');
      setCollabs(data.collaborators || []);
      setInviteEmail('');
      toast.success(`Invited ${inviteEmail}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemove = async (email) => {
    try {
      const res = await fetch(`${BACKEND_URL}/projects/unshare/${boardId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCollabs(data.collaborators || []);
      toast.success(`Access removed for ${email}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleUpdateGeneralAccess = async (newIsPublic, newRole) => {
    setIsProcessing(true);
    try {
      if (newIsPublic) {
        const res = await fetch(`${BACKEND_URL}/publish/${boardId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole })
        });
        if (!res.ok) throw new Error('Failed to publish');
        setIsPublic(true);
        setPublicRole(newRole);
        toast.success('General access updated to Public');
      } else {
        const res = await fetch(`${BACKEND_URL}/publish/${boardId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error('Failed to unpublish');
        setIsPublic(false);
        toast.success('General access updated to Restricted');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const inputClass = "bg-surface border border-edge-strong rounded-lg px-3 py-2 text-content text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm rb-anim-fade">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-130 overflow-hidden m-4">
        {/* Header */}
        <div className="px-6 py-5 border-b border-edge-subtle flex items-center justify-between bg-surface">
          <h2 className="text-content font-semibold text-xl tracking-tight">{readOnly ? `People with access to "${board?.title || 'Project'}"` : `Share "${board?.title || 'Project'}"`}</h2>
          <button onClick={onClose} className="p-1.5 text-content-subtle hover:text-content hover:bg-hover rounded-full transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-7 bg-surface">
          {/* Invite Section — owner only */}
          {!readOnly && (
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="Add people or groups by email"
              className={`flex-1 min-w-0 ${inputClass} shadow-sm`}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
            />
            <div className="flex gap-3">
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="flex-1 sm:flex-none bg-surface border border-edge-strong rounded-lg px-3 py-2 text-content-muted text-sm focus:outline-none shadow-sm cursor-pointer"
              >
                <option value="viewer">Viewer</option>
                <option value="commenter">Commenter</option>
                <option value="editor">Editor</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || isProcessing}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all shadow-sm active:scale-95"
              >
                Invite
              </button>
            </div>
          </div>
          )}

          {/* People with access */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-content">People with access</h3>
            {accessLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-7 h-7 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {/* Owner row */}
                <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar email={owner?.email} name={owner?.name} src={owner?.profilePicture} size={36} shapeClass="rounded-xl" color={AVATAR_OWNER} borderClass="border-transparent" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-content truncate">{owner?.name || owner?.email}</p>
                      {owner?.name && (
                        <p className="text-[11px] text-content-subtle truncate">{owner.email} · Project owner</p>
                      )}
                      {!owner?.name && (
                        <p className="text-[11px] text-content-subtle truncate">Project owner</p>
                      )}
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
                      <Avatar email={p.email} name={p.name} src={p.profilePicture} size={36} shapeClass="rounded-xl" color={AVATAR_MEMBER} borderClass="border-transparent" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-content truncate">{p.name || p.email}</p>
                        {p.name && (
                          <p className="text-[11px] text-content-subtle truncate">{p.email} · {p.source === 'workspace' ? 'Workspace member' : 'Project collaborator'}</p>
                        )}
                        {!p.name && (
                          <p className="text-[11px] text-content-subtle truncate">{p.source === 'workspace' ? 'Workspace member' : 'Project collaborator'}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {readOnly ? (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wide ${roleColor(p.role)}`}>
                          {roleIcon(p.role)}
                          {roleLabel(p.role)}
                        </div>
                      ) : (
                        <>
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
                              onClick={() => handleRemove(p.email)}
                              className="p-1.5 text-content-subtle hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                              title="Remove from project"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {participants.length === 0 && (
                  <p className="text-center text-sm text-content-subtle py-8">
                    No members or collaborators on this project
                  </p>
                )}
              </div>
            )}
          </div>

          {/* General Access — owner only */}
          {!readOnly && (
          <div className="pt-5 border-t border-edge-subtle">
            <h3 className="text-sm font-semibold text-content mb-3">General access</h3>
            <div className="flex items-center gap-4 p-4 bg-muted rounded-xl border border-edge-subtle">
              <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center shadow-sm border border-edge text-content-muted">
                {isPublic ? <Globe className="text-emerald-600" size={20} /> : <Lock className="text-content-muted" size={20} />}
              </div>
              <div className="flex-1">
                <select
                  value={generalAccess}
                  onChange={e => handleGeneralAccess(e.target.value)}
                  className="font-semibold text-content bg-transparent text-sm focus:outline-none cursor-pointer -ml-1 hover:bg-hover rounded px-1 py-0.5 transition-colors"
                  disabled={isProcessing}
                >
                  <option value="restricted">Restricted</option>
                  <option value="viewer">Anyone with the link — Viewer</option>
                  <option value="commenter">Anyone with the link — Commenter</option>
                  <option value="editor">Anyone with the link — Editor</option>
                </select>
                <p className="text-[13px] text-content-muted mt-0.5">
                  {isPublic
                    ? "Anyone on the internet with the link can access"
                    : "Only people with access can open with the link"}
                </p>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted border-t border-edge-subtle flex items-center justify-end gap-2">
          {!readOnly && (
          <div className="flex items-center gap-2 mr-auto">
            <button
              onClick={copyLink}
              disabled={copying}
              className="flex items-center gap-2 px-5 py-2.5 bg-surface border border-edge-strong hover:bg-hover hover:border-edge-strong text-content text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Copy size={16} />
              {copying ? 'Copying…' : 'Copy link'}
            </button>
          </div>
          )}
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
