import { useState } from 'react';
import { BACKEND_URL } from '../../constants/apiConfig.js';
import { Globe, Lock, Copy, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ShareModal({ boardId, board, onClose }) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole]   = useState('editor');

  const [isPublic, setIsPublic]       = useState(board?.isPublic || false);
  const [publicRole, setPublicRole]   = useState(board?.publicRole || 'viewer');

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

  const inputClass = "bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition";
  const selectClass = "bg-white border border-slate-200 hover:bg-slate-50 rounded-lg px-2 py-1 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer font-medium transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm rb-anim-fade">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] overflow-hidden m-4">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white">
          <h2 className="text-gray-900 font-semibold text-xl tracking-tight">Share "{board?.title || 'Board'}"</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-7 bg-white">
          {/* Invite Section */}
          <div className="flex gap-3">
            <input
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="Add people or groups by email"
              className={`flex-1 ${inputClass} shadow-sm`}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-700 text-sm focus:outline-none shadow-sm cursor-pointer"
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

          {/* People with access */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">People with access</h3>
            <div className="max-h-[200px] overflow-y-auto space-y-3 pr-2">
              {/* Owner */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                    {board?.owner?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-gray-900 text-sm font-medium">{board?.owner}</p>
                    <p className="text-slate-500 text-xs">Owner</p>
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
                      <p className="text-gray-900 text-sm font-medium">{c.name || c.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-600 text-sm font-medium bg-slate-100 px-2.5 py-1 rounded-md">
                      {c.role.charAt(0).toUpperCase() + c.role.slice(1)}
                    </span>
                    <button
                      onClick={() => handleRemove(c.email)}
                      className="text-slate-400 hover:text-red-500 text-sm px-2 opacity-0 group-hover:opacity-100 transition-all font-medium cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* General Access */}
          <div className="pt-5 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">General access</h3>
            <div className="flex items-center gap-4 p-4 bg-slate-50/80 rounded-xl border border-slate-100/50">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-200 text-slate-600">
                {isPublic ? <Globe className="text-emerald-600" size={20} /> : <Lock className="text-slate-500" size={20} />}
              </div>
              <div className="flex-1">
                <select
                  value={isPublic ? 'public' : 'restricted'}
                  onChange={e => handleUpdateGeneralAccess(e.target.value === 'public', publicRole)}
                  className="font-semibold text-slate-900 bg-transparent text-sm focus:outline-none cursor-pointer -ml-1 hover:bg-slate-200/50 rounded px-1 py-0.5 transition-colors"
                  disabled={isProcessing}
                >
                  <option value="restricted">Restricted</option>
                  <option value="public">Anyone with the link</option>
                </select>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  {isPublic
                    ? "Anyone on the internet with the link can access"
                    : "Only people with access can open with the link"}
                </p>
              </div>
              {isPublic && (
                <select
                  value={publicRole}
                  onChange={e => handleUpdateGeneralAccess(true, e.target.value)}
                  className={selectClass}
                  disabled={isProcessing}
                >
                  <option value="viewer">Viewer</option>
                  <option value="commenter">Commenter</option>
                  <option value="editor">Editor</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={copyLink}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 text-slate-700 text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Copy size={16} />
            Copy link
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
