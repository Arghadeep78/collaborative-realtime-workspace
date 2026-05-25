import { useState } from 'react';
import { BACKEND_URL } from '../../constants/apiConfig.js';
import { Globe, Lock, Copy, X, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import ManageWorkspaceModal from './ManageWorkspaceModal.jsx';

export default function ShareModal({ boardId, board, workspace, onClose }) {
  const [showManageWs, setShowManageWs] = useState(false);
  const userEmail = (() => { try { return JSON.parse(localStorage.getItem('userData') || '{}').email; } catch { return null; } })();
  const ownsWorkspace = workspace?.id && workspace?.owner === userEmail;
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole]   = useState('editor');

  const [isPublic, setIsPublic]       = useState(board?.isPublic || false);
  const [publicRole, setPublicRole]   = useState(board?.publicRole || 'viewer');

  // Combined general-access value: 'restricted' | 'viewer' | 'commenter' | 'editor'
  const generalAccess = isPublic ? publicRole : 'restricted';
  const handleGeneralAccess = (val) => {
    if (val === 'restricted') handleUpdateGeneralAccess(false, publicRole);
    else handleUpdateGeneralAccess(true, val);
  };

  const [collaborators, setCollabs]   = useState(board?.collaborators || []);
  const [isProcessing, setIsProcessing] = useState(false);

  const token = () => localStorage.getItem('token');
  const shareUrl = window.location.href;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied to clipboard');
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/boards/share/${boardId}`, {
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
      const res = await fetch(`${BACKEND_URL}/boards/unshare/${boardId}`, {
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
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-[520px] overflow-hidden m-4">
        {/* Header */}
        <div className="px-6 py-5 border-b border-edge-subtle flex items-center justify-between bg-surface">
          <h2 className="text-content font-semibold text-xl tracking-tight">Share "{board?.title || 'Board'}"</h2>
          <button onClick={onClose} className="p-1.5 text-content-subtle hover:text-content hover:bg-hover rounded-full transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-7 bg-surface">
          {/* Invite Section */}
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

          {/* People with access */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-content">People with access</h3>
            <div className="max-h-[200px] overflow-y-auto space-y-3 pr-2">
              {/* Owner */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                    {board?.owner?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-content text-sm font-medium">{board?.owner}</p>
                    <p className="text-content-muted text-xs">Owner</p>
                  </div>
                </div>
              </div>

              {/* Collaborators */}
              {collaborators.map(c => (
                <div key={c.email} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                      {c.email?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-content text-sm font-medium">{c.name || c.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-content-muted text-sm font-medium bg-muted px-2.5 py-1 rounded-md">
                      {c.role.charAt(0).toUpperCase() + c.role.slice(1)}
                    </span>
                    <button
                      onClick={() => handleRemove(c.email)}
                      className="text-content-subtle hover:text-red-500 text-sm px-2 opacity-0 group-hover:opacity-100 transition-all font-medium cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* General Access */}
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted border-t border-edge-subtle flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="flex items-center gap-2 px-5 py-2.5 bg-surface border border-edge-strong hover:bg-hover hover:border-edge-strong text-content text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Copy size={16} />
              Copy link
            </button>
            {ownsWorkspace && (
              <button
                onClick={() => setShowManageWs(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-edge-strong hover:bg-hover text-content text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
                title="Share or manage the whole workspace"
              >
                <Settings size={16} />
                <span className="hidden sm:inline">Workspace</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-content hover:opacity-90 text-app text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {showManageWs && (
        <ManageWorkspaceModal
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          onClose={() => setShowManageWs(false)}
        />
      )}
    </div>
  );
}
