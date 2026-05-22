import { useState } from 'react';
import { BACKEND_URL } from '../../constants/apiConfig.js';

const roleBadgeColor = {
  editor:    'bg-indigo-100 text-indigo-800',
  commenter: 'bg-yellow-100 text-yellow-800',
  viewer:    'bg-gray-100 text-gray-700',
};

export default function ShareModal({ boardId, board, onClose }) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole]   = useState('editor');
  const [publicRole, setPublicRole]   = useState(board?.publicRole || 'viewer');
  const [publishing, setPublishing]   = useState(false);
  const [shareUrl, setShareUrl]       = useState(board?.isPublic ? window.location.href : '');
  const [collaborators, setCollabs]   = useState(board?.collaborators || []);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  const token = () => localStorage.getItem('token');

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setSuccess('Link copied!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setError(''); setSuccess('');
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
      setSuccess(`Invited ${inviteEmail}`);
    } catch (e) {
      setError(e.message);
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
    } catch (e) {
      setError(e.message);
    }
  };

  const handlePublish = async () => {
    setPublishing(true); setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/publish/${boardId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: publicRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish');
      // Backend returns 202 with shareUrl path — construct full URL
      const fullUrl = data.shareUrl 
        ? `${window.location.origin}${data.shareUrl}` 
        : window.location.href;
      setShareUrl(fullUrl);
      setSuccess('Board is now public!');
    } catch (e) {
      setError(e.message);
    } finally {
      setPublishing(false);
    }
  };

  const surfaceClass = "bg-white/90 border border-slate-200/80 shadow-[0_16px_40px_rgba(12,18,36,0.12)] backdrop-blur-xl";
  const inputClass = "bg-slate-50/90 border border-slate-900/10 rounded-xl px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-500/70 focus:ring-4 focus:ring-blue-500/15 transition";
  const secondaryBtnClass = "bg-white text-slate-900 border border-slate-900/10 shadow-[0_10px_20px_rgba(12,18,36,0.08)] hover:bg-slate-50 hover:-translate-y-0.5 transition text-sm font-medium rounded-xl";
  const primaryBtnClass = "bg-gradient-to-br from-[#4262ff] to-[#2f49e7] text-white border border-blue-400/40 shadow-[0_12px_28px_rgba(66,98,255,0.28)] hover:brightness-95 hover:-translate-y-0.5 transition text-sm font-semibold rounded-xl";
  const emeraldBtnClass = "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border border-emerald-400/50 shadow-[0_12px_28px_rgba(16,185,129,0.28)] hover:brightness-95 hover:-translate-y-0.5 transition text-sm font-bold rounded-xl disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`rounded-3xl p-8 w-full max-w-md flex flex-col gap-5 ${surfaceClass}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-gray-900 font-bold text-lg">Share Board</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-xl">×</button>
        </div>

        {/* Copy link */}
        <div className="flex gap-2">
          <input readOnly value={window.location.href}
            className={`flex-1 truncate ${inputClass}`} />
          <button onClick={copyLink}
            className={`px-5 py-2.5 ${secondaryBtnClass}`}>
            Copy
          </button>
        </div>

        {/* Invite by email */}
        <div className="flex flex-col gap-2">
          <label className="text-gray-600 text-xs font-medium">Invite by email</label>
          <div className="flex gap-2">
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@email.com"
              className={`flex-1 ${inputClass}`} />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
              className={`${inputClass} cursor-pointer`}>
              <option value="editor">Editor</option>
              <option value="commenter">Commenter</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button onClick={handleInvite}
            className={`py-2.5 ${primaryBtnClass}`}>
            Send Invite
          </button>
        </div>

        {/* Collaborators list */}
        {collaborators.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-gray-600 text-xs font-medium">People with access</label>
            {collaborators.map(c => (
              <div key={c.email} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                    {c.email?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-gray-900 text-sm font-medium">{c.name || c.email}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold capitalize ${roleBadgeColor[c.role] || roleBadgeColor.viewer}`}>
                      {c.role}
                    </span>
                  </div>
                </div>
                <button onClick={() => handleRemove(c.email)}
                  className="text-gray-400 hover:text-red-500 text-xs font-medium transition-colors">Remove</button>
              </div>
            ))}
          </div>
        )}

        {/* Publish board */}
        <div className="border-t border-gray-200 pt-4">
          {shareUrl ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <p className="text-green-700 text-xs font-medium mb-1">✓ Board is public (Anyone can {publicRole})</p>
              <p className="text-green-600 text-xs break-all">{shareUrl}</p>
            </div>
          ) : (
            <div className="flex gap-2">
              <select value={publicRole} onChange={e => setPublicRole(e.target.value)}
                className={`${inputClass} cursor-pointer`}>
                <option value="viewer">Anyone can View</option>
                <option value="commenter">Anyone can Comment</option>
                <option value="editor">Anyone can Edit</option>
              </select>
              <button onClick={handlePublish} disabled={publishing}
                className={`flex-1 py-3 ${emeraldBtnClass}`}>
                {publishing ? 'Publishing…' : '🌐 Publish'}
              </button>
            </div>
          )}
        </div>

        {error   && <p className="text-red-500 text-xs font-medium">{error}</p>}
        {success && <p className="text-green-600 text-xs font-medium">{success}</p>}
      </div>
    </div>
  );
}
