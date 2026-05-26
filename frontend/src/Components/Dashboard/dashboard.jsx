import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BACKEND_URL } from '../../constants/apiConfig.js';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import ManageWorkspaceModal from '../Board/ManageWorkspaceModal.jsx';
import Avatar from '../common/Avatar.jsx';

// ── Icons ─────────────────────────────────────────────────────────────────────
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);
const LayoutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
);
const MoreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
);
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);
const LogOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
);
const ImageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
);
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
);
const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
);
const StarIcon = ({ filled }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
);
const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
);
const LogoIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 4H9L12 20H8L5 4Z" fill="#F59E0B" />
    <path d="M11 4H15L18 20H14L11 4Z" fill="#F97316" />
    <path d="M17 4H21L24 20H20L17 4Z" fill="#EA580C" />
  </svg>
);
const BuildingIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
);
const MoveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" /></svg>
);
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
);
const UsersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);

// ── Cute Thumbnails ───────────────────────────────────────────────────────────
const CUTE_THUMBNAILS = [
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Felix&backgroundColor=ffdfbf',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Aneka&backgroundColor=c0aede',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Oliver&backgroundColor=d1d4f9',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Sam&backgroundColor=b6e3f4',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Mia&backgroundColor=ffd5dc',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Buster&backgroundColor=c2e8c2',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Bella&backgroundColor=e6e6fa',
  'https://api.dicebear.com/8.x/lorelei/svg?seed=Lily&backgroundColor=c0aede',
  'https://api.dicebear.com/8.x/lorelei/svg?seed=Oscar&backgroundColor=ffd5dc',
  'https://api.dicebear.com/8.x/lorelei/svg?seed=George&backgroundColor=e6e6fa',
  'https://api.dicebear.com/8.x/micah/svg?seed=Leo&backgroundColor=ffeeb5',
  'https://api.dicebear.com/8.x/micah/svg?seed=Max&backgroundColor=b6e3f4',
  'https://api.dicebear.com/8.x/micah/svg?seed=Charlie&backgroundColor=d1d4f9',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Jack&backgroundColor=c2e8c2',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Nala&backgroundColor=ffeeb5',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Milo&backgroundColor=ffdfbf',
];

// ── ThumbnailPicker ───────────────────────────────────────────────────────────
function ThumbnailPicker({ currentThumbnail, onSelect, onClose }) {
  const [draftThumbnail, setDraftThumbnail] = useState(currentThumbnail || null);
  const [customUrl, setCustomUrl] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    setDraftThumbnail(currentThumbnail || null);
    setCustomUrl('');
  }, [currentThumbnail]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setDraftThumbnail(ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-surface border border-edge rounded-2xl shadow-2xl w-full max-w-md p-6 rb-anim-pop" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-content font-semibold text-base">Change cover</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-content-muted hover:text-content hover:bg-hover transition-colors"><XIcon /></button>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {CUTE_THUMBNAILS.map((url, i) => {
            const active = draftThumbnail === url;
            return (
              <button key={i} onClick={() => setDraftThumbnail(url)}
                className="relative h-14 rounded-lg overflow-hidden ring-2 transition-all hover:ring-edge-strong focus:outline-none"
                style={{ outline: active ? '2px solid #6366f1' : '2px solid transparent', outlineOffset: '2px' }}>
                <img src={url} alt="" className="w-full h-full object-cover" />
                {active && <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white"><CheckIcon /></div>}
              </button>
            );
          })}
        </div>
        {draftThumbnail && (
          <button onClick={() => setDraftThumbnail(null)}
            className="w-full mb-4 py-2 text-sm text-content-muted hover:text-content border border-edge hover:border-edge-strong rounded-lg transition-colors">
            Remove cover
          </button>
        )}
        <p className="text-content-subtle text-xs font-medium uppercase tracking-widest mb-3">Custom image</p>
        <div className="flex gap-2 mb-3">
          <input value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder="Paste image URL..."
            className="flex-1 bg-muted text-content text-sm px-3 py-2 rounded-lg border border-edge outline-none focus:border-indigo-500 placeholder:text-content-subtle transition-colors" />
          <button onClick={() => { if (customUrl.trim()) { setDraftThumbnail(customUrl.trim()); setCustomUrl(''); } }}
            disabled={!customUrl.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg disabled:opacity-30 hover:bg-indigo-700 transition-colors">
            Apply
          </button>
        </div>
        <button onClick={() => fileRef.current?.click()}
          className="w-full py-2.5 flex items-center justify-center gap-2 text-sm text-content-muted hover:text-content border border-dashed border-edge-strong hover:border-edge-strong rounded-lg transition-colors">
          <ImageIcon /> Upload from device
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <div className="mt-5 flex items-center gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-content-muted hover:text-content border border-edge hover:border-edge-strong rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={() => onSelect(draftThumbnail)} disabled={draftThumbnail === currentThumbnail}
            className="flex-1 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors">
            Apply cover
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CreateWorkspaceModal ──────────────────────────────────────────────────────
function CreateWorkspaceModal({ onClose, onCreate }) {
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

// ── MoveToWorkspaceModal ──────────────────────────────────────────────────────
function MoveToWorkspaceModal({ board, workspaces, currentWorkspaceId, onMove, onClose }) {
  const others = workspaces.filter(w => w.isOwner && w.id !== currentWorkspaceId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-surface border border-edge rounded-2xl shadow-2xl w-full max-w-sm p-6 rb-anim-pop" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-content font-semibold text-base">Move to workspace</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-content-muted hover:text-content hover:bg-hover transition-colors"><XIcon /></button>
        </div>
        <p className="text-xs text-content-subtle mb-3 truncate">Moving: <span className="font-medium text-content">{board.title}</span></p>
        {others.length === 0 ? (
          <p className="text-sm text-content-subtle py-4 text-center">No other workspaces available.<br />Create one first.</p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {others.map(ws => (
              <button key={ws.id} onClick={() => onMove(ws.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-content-muted hover:bg-hover hover:text-content transition-colors">
                <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {ws.name[0]?.toUpperCase()}
                </div>
                <span className="truncate font-medium">{ws.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── RoleBadge ─────────────────────────────────────────────────────────────────
const ROLE_BADGE = {
  owner:     'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
  editor:    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  commenter: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  viewer:    'bg-edge text-content-subtle',
};
function RoleBadge({ role }) {
  if (!role) return null;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${ROLE_BADGE[role] ?? ROLE_BADGE.viewer}`}>
      {role}
    </span>
  );
}

// ── BoardCard ─────────────────────────────────────────────────────────────────
function BoardCard({ board, onNavigate, onRename, onDelete, onChangeThumbnail, onToggleFavorite, onMoveToWorkspace, onLeaveBoard, canMove, openMenu, setOpenMenu, renamingId, renameVal, setRenameVal, saveRename, setRenamingId }) {
  const isGradient = (v) => v && v.startsWith('linear-gradient');
  const canEdit = board.myRole === 'owner' || board.myRole === 'editor';
  const canDelete = board.myRole === 'owner';
  const canLeave = board.myRole && board.myRole !== 'owner';
  const hasMenu = canEdit || canDelete || canMove || canLeave;

  return (
    <div
      className="group relative bg-surface border border-edge hover:shadow-lg hover:border-edge-strong rounded-xl cursor-pointer transition-all duration-200 flex flex-col"
      onClick={() => onNavigate(board.id)}
    >
      <div className="h-40 relative overflow-hidden flex items-center justify-center bg-muted rounded-t-[11px]">
        {board.thumbnail ? (
          isGradient(board.thumbnail) ? (
            <div className="absolute inset-0" style={{ background: board.thumbnail }} />
          ) : (
            <img src={board.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-content-subtle/40 group-hover:text-content-subtle transition-colors duration-300">
            <LayoutIcon />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>

      <div className="px-4 py-3.5 flex items-start justify-between gap-3 bg-surface rounded-b-[11px]">
        <div className="flex-1 min-w-0">
          {renamingId === board.id && canEdit ? (
            <input autoFocus value={renameVal} onClick={e => e.stopPropagation()}
              onChange={e => setRenameVal(e.target.value)}
              onBlur={() => saveRename(board.id)}
              onKeyDown={e => { if (e.key === 'Enter') saveRename(board.id); if (e.key === 'Escape') setRenamingId(null); }}
              className="w-full bg-muted text-content text-sm px-2 py-1 rounded border border-edge-strong outline-none focus:border-indigo-500"
            />
          ) : (
            <p className="text-content text-sm font-medium truncate">{board.title}</p>
          )}
          <p className="text-content-subtle text-xs mt-1 flex items-center gap-1.5">
            {timeAgo(board.updatedAt || board.createdAt)}
            {board.myRole && (
              <><span className="w-0.5 h-0.5 rounded-full bg-edge-strong inline-block" /><RoleBadge role={board.myRole} /></>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onToggleFavorite(board.id)}
            className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-md transition-all ${board.isFavorited ? 'opacity-100 text-yellow-500 dark:text-yellow-400' : 'text-content-subtle hover:text-yellow-500 dark:hover:text-yellow-400'}`}
            title={board.isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <StarIcon filled={board.isFavorited} />
          </button>
          {hasMenu && (
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === board.id ? null : board.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-content-subtle hover:text-content hover:bg-hover transition-all"
              >
                <MoreIcon />
              </button>
              {openMenu === board.id && (
                <div className="absolute right-0 top-8 w-44 bg-surface border border-edge rounded-xl shadow-xl overflow-hidden z-20 rb-anim-pop py-1">
                  {canEdit && (
                    <button onClick={() => onRename(board)} className="w-full text-left px-3 py-2 text-sm text-content-muted hover:bg-hover hover:text-content transition-colors flex items-center gap-2.5"><EditIcon /> Rename</button>
                  )}
                  {canEdit && (
                    <button onClick={() => { onChangeThumbnail(board); setOpenMenu(null); }} className="w-full text-left px-3 py-2 text-sm text-content-muted hover:bg-hover hover:text-content transition-colors flex items-center gap-2.5"><ImageIcon /> Change cover</button>
                  )}
                  {canMove && (
                    <button onClick={() => { onMoveToWorkspace(board); setOpenMenu(null); }} className="w-full text-left px-3 py-2 text-sm text-content-muted hover:bg-hover hover:text-content transition-colors flex items-center gap-2.5"><MoveIcon /> Move to workspace</button>
                  )}
                  {canDelete && (
                    <>
                      <div className="h-px bg-edge-subtle my-1" />
                      <button onClick={() => { onDelete(board.id); setOpenMenu(null); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400/80 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors flex items-center gap-2.5"><TrashIcon /> Delete</button>
                    </>
                  )}
                  {canLeave && (
                    <>
                      <div className="h-px bg-edge-subtle my-1" />
                      <button onClick={() => { onLeaveBoard(board.id); setOpenMenu(null); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400/80 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors flex items-center gap-2.5"><LogOutIcon /> Leave board</button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── timeAgo helper ────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const d = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

// ── WorkspaceDropdown ─────────────────────────────────────────────────────────
function WorkspaceDropdown({ workspaces, activeWorkspace, onSelect, onCreate }) {
  return (
    <div className="absolute left-0 top-full mt-1 w-64 bg-surface border border-edge rounded-xl shadow-2xl overflow-hidden z-30 py-2 rb-anim-pop" onClick={e => e.stopPropagation()}>
      <p className="px-3 py-1.5 text-xs text-content-subtle font-medium uppercase tracking-widest">Workspaces</p>
      {workspaces.map(ws => (
        <button key={ws.id} onClick={() => onSelect(ws)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${activeWorkspace?.id === ws.id ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'text-content-muted hover:bg-hover hover:text-content'}`}>
          <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {ws.name[0]?.toUpperCase()}
          </div>
          <span className="truncate font-medium">{ws.name}</span>
          {!ws.isOwner && <span className="ml-auto text-[10px] font-medium text-content-subtle bg-muted px-1.5 py-0.5 rounded">Shared</span>}
          {activeWorkspace?.id === ws.id && <CheckIcon />}
        </button>
      ))}
      <div className="h-px bg-edge-subtle my-1.5" />
      <button onClick={onCreate}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-content-muted hover:text-content hover:bg-hover transition-colors">
        <div className="w-6 h-6 rounded border-2 border-dashed border-edge-strong flex items-center justify-center flex-shrink-0">
          <PlusIcon />
        </div>
        Create workspace
      </button>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard({ logout }) {
  const [boards, setBoards] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWs] = useState(null);
  const [activeView, setActiveView] = useState('all'); // 'all' | 'favorites'
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const [pickerBoard, setPickerBoard] = useState(null);
  const [showWsDropdown, setShowWsDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // off-canvas drawer (below lg)
  const [showCreateWs, setShowCreateWs] = useState(false);
  const [renamingWs, setRenamingWs] = useState(false);
  const [wsRenameVal, setWsRenameVal] = useState('');
  const [movingBoard, setMovingBoard] = useState(null); // board to move between workspaces
  const [showManageWs, setShowManageWs] = useState(false); // workspace members / board-access dialog
  const [deletingWs, setDeletingWs] = useState(null);  // workspace pending delete confirmation
  const wsDropdownRef = useRef(null);
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  const token = () => localStorage.getItem('token');
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');

  // ── Fetch boards ────────────────────────────────────────────────────────────
  const fetchBoards = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/boards/list`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setBoards(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch workspaces (or auto-create a default one) ─────────────────────────
  const fetchWorkspaces = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/workspaces/list`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];

      if (list.length === 0) {
        // Auto-create a default workspace named after the user
        const defaultName = userData.name ? `${userData.name}'s Workspace` : 'My Workspace';
        const cres = await fetch(`${BACKEND_URL}/workspaces/default`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ defaultName }),
        });
        const ws = await cres.json();
        setWorkspaces([ws]);
        setActiveWs(ws);
      } else {
        setWorkspaces(list);
        // Prefer the workspace the user last opened a board in (set by BoardRoom),
        // then their first owned workspace, then anything.
        const storedId = localStorage.getItem('activeWorkspaceId');
        const initial =
          list.find((w) => w.id === storedId) ||
          list.find((w) => w.isOwner) ||
          list[0];
        setActiveWs(initial);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBoards();
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    if (!openMenu && !showWsDropdown) return;
    const close = (e) => {
      setOpenMenu(null);
      if (!wsDropdownRef.current?.contains(e.target)) setShowWsDropdown(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenu, showWsDropdown]);

  // ── Board actions ───────────────────────────────────────────────────────────
  const createBoard = async () => {
    setCreating(true);
    try {
      const randomThumbnail = CUTE_THUMBNAILS[Math.floor(Math.random() * CUTE_THUMBNAILS.length)];
      const res = await fetch(`${BACKEND_URL}/boards/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled Collab Board', thumbnail: randomThumbnail }),
      });
      const data = await res.json();
      if (data.id) {
        // Only the workspace owner can file boards into it; members are view-only.
        if (activeWorkspace?.id && activeWorkspace?.isOwner) {
          await fetch(`${BACKEND_URL}/workspaces/${activeWorkspace.id}/add-board`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ boardId: data.id }),
          });
          setWorkspaces(ws => ws.map(w => w.id === activeWorkspace.id ? { ...w, boardIds: [...(w.boardIds || []), data.id] } : w));
          setActiveWs(prev => prev?.id === activeWorkspace.id ? { ...prev, boardIds: [...(prev.boardIds || []), data.id] } : prev);
        }
        navigate(`/board/${data.id}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const deleteBoard = async (id) => {
    if (!window.confirm('Delete this collab board?')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/boards/delete/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || 'Failed to delete board');
      }
      setBoards(bs => bs.filter(b => b.id !== id));
    } catch (e) {
      toast.error(e.message || 'Failed to delete board');
    }
  };

  const leaveBoard = async (id) => {
    if (!window.confirm('Leave this board? You will lose access unless re-invited.')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/boards/leave/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || 'Failed to leave board');
      }
      setBoards(bs => bs.filter(b => b.id !== id));
    } catch (e) {
      toast.error(e.message || 'Failed to leave board');
    }
  };

  const startRename = (board) => {
    setRenamingId(board.id);
    setRenameVal(board.title);
    setOpenMenu(null);
  };

  const saveRename = async (id) => {
    try {
      const res = await fetch(`${BACKEND_URL}/boards/title/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameVal }),
      });
      if (!res.ok) throw new Error('Failed to rename board');
      setBoards(bs => bs.map(b => b.id === id ? { ...b, title: renameVal } : b));
    } catch (e) {
      toast.error(e.message || 'Failed to rename board');
    } finally {
      setRenamingId(null);
    }
  };

  const saveThumbnail = async (boardId, thumbnail) => {
    try {
      const res = await fetch(`${BACKEND_URL}/boards/thumbnail/${boardId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ thumbnail }),
      });
      if (!res.ok) throw new Error('Failed to save thumbnail');
      setBoards(bs => bs.map(b => b.id === boardId ? { ...b, thumbnail } : b));
    } catch (e) {
      toast.error(e.message || 'Failed to save thumbnail');
    } finally {
      setPickerBoard(null);
    }
  };

  const toggleFavorite = async (boardId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/boards/favorite/${boardId}`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      setBoards(bs => bs.map(b => b.id === boardId ? { ...b, isFavorited: data.isFavorited } : b));
    } catch (e) {
      console.error(e);
    }
  };

  // ── Workspace actions ───────────────────────────────────────────────────────
  const createWorkspace = async (name) => {
    try {
      const res = await fetch(`${BACKEND_URL}/workspaces/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const ws = await res.json();
      setWorkspaces(prev => [ws, ...prev]);
      setActiveWs(ws);
      setShowCreateWs(false);
      setShowWsDropdown(false);
    } catch (e) {
      console.error(e);
    }
  };

  const saveRenameWorkspace = async () => {
    if (!wsRenameVal.trim() || !activeWorkspace) return;
    try {
      const res = await fetch(`${BACKEND_URL}/workspaces/${activeWorkspace.id}/rename`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: wsRenameVal }),
      });
      const ws = await res.json();
      setWorkspaces(prev => prev.map(w => w.id === ws.id ? ws : w));
      setActiveWs(ws);
      setRenamingWs(false);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteWorkspace = async (ws) => {
    try {
      const res = await fetch(`${BACKEND_URL}/workspaces/${ws.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || 'Failed to delete workspace');
      }
      const remaining = workspaces.filter((w) => w.id !== ws.id);
      setWorkspaces(remaining);
      if (activeWorkspace?.id === ws.id) {
        const next = remaining.find((w) => w.isOwner) || remaining[0] || null;
        setActiveWs(next);
        try { if (next) localStorage.setItem('activeWorkspaceId', next.id); } catch { /* ignore */ }
      }
      // Boards owned in that workspace were deleted server-side — refresh the grid.
      fetchBoards();
      setDeletingWs(null);
      toast.success('Workspace deleted');
    } catch (e) {
      toast.error(e.message || 'Failed to delete workspace');
      setDeletingWs(null);
    }
  };

  const leaveWorkspace = async (ws) => {
    if (!window.confirm(`Leave "${ws.name}"? You will lose access to all its boards unless re-invited.`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/workspaces/${ws.id}/leave`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || 'Failed to leave workspace');
      }
      const remaining = workspaces.filter(w => w.id !== ws.id);
      setWorkspaces(remaining);
      const next = remaining.find(w => w.isOwner) || remaining[0] || null;
      setActiveWs(next);
      try { if (next) localStorage.setItem('activeWorkspaceId', next.id); } catch { /* ignore */ }
      fetchBoards();
      toast.success(`Left "${ws.name}"`);
    } catch (e) {
      toast.error(e.message || 'Failed to leave workspace');
    }
  };

  const moveBoardToWorkspace = async (targetWorkspaceId) => {
    if (!movingBoard) return;
    const boardId = movingBoard.id;
    try {
      const res = await fetch(`${BACKEND_URL}/workspaces/${targetWorkspaceId}/add-board`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || 'Failed to move board');
      }
      // Update local workspace state: remove from all workspaces, add to target
      setWorkspaces(prev => prev.map(w => {
        if (w.id === targetWorkspaceId) return { ...w, boardIds: [...(w.boardIds || []).filter(id => id !== boardId), boardId] };
        return { ...w, boardIds: (w.boardIds || []).filter(id => id !== boardId) };
      }));
      setActiveWs(prev => {
        if (!prev) return prev;
        if (prev.id === targetWorkspaceId) return { ...prev, boardIds: [...(prev.boardIds || []).filter(id => id !== boardId), boardId] };
        return { ...prev, boardIds: (prev.boardIds || []).filter(id => id !== boardId) };
      });
      toast.success('Board moved');
    } catch (e) {
      toast.error(e.message || 'Failed to move board');
    } finally {
      setMovingBoard(null);
    }
  };

  // ── Filtered board list ─────────────────────────────────────────────────────
  const visibleBoards = boards.filter(b => {
    const matchesSearch = b.title?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (activeView === 'favorites') return b.isFavorited;
    // 'all' view — show only the boards belonging to the active workspace.
    // `boards` already contains only boards I can access, so for a workspace
    // shared with me at board level this naturally narrows to just those boards.
    if (activeWorkspace) {
      return (activeWorkspace.boardIds || []).includes(b.id);
    }
    return true;
  });

  const favCount = boards.filter(b => b.isFavorited).length;

  return (
    <div className="flex h-screen bg-app text-content font-sans overflow-hidden selection:bg-indigo-500/30">

      {/* Drawer backdrop — only below lg, when the sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-[240px] flex flex-col border-r border-edge bg-surface py-5 px-4 shadow-xl transition-transform duration-300 ease-in-out lg:static lg:z-10 lg:flex-shrink-0 lg:translate-x-0 lg:shadow-sm ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 mb-8 cursor-pointer select-none">
          <LogoIcon />
          <span className="font-bold text-lg tracking-tight text-content">Collab Board</span>
        </div>

        {/* Workspace Selector */}
        <div className="mb-6 px-2 relative" ref={wsDropdownRef}>
          {renamingWs ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={wsRenameVal}
                onChange={e => setWsRenameVal(e.target.value)}
                onBlur={saveRenameWorkspace}
                onKeyDown={e => { if (e.key === 'Enter') saveRenameWorkspace(); if (e.key === 'Escape') setRenamingWs(false); }}
                className="flex-1 text-sm px-2 py-1 rounded border border-edge-strong bg-muted text-content outline-none focus:border-indigo-500"
              />
              <button onClick={() => setRenamingWs(false)} className="p-1 text-content-subtle hover:text-content"><XIcon /></button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setShowWsDropdown(v => !v); }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-edge hover:bg-hover transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                  {activeWorkspace?.name?.[0]?.toUpperCase() || 'W'}
                </div>
                <span className="text-sm font-medium text-content-muted group-hover:text-content truncate">
                  {activeWorkspace?.name || 'My Workspace'}
                </span>
              </div>
              <div className="text-content-subtle group-hover:text-content-muted flex-shrink-0">
                <ChevronDownIcon />
              </div>
            </button>
          )}
          {showWsDropdown && (
            <WorkspaceDropdown
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              onSelect={(ws) => { setActiveWs(ws); try { localStorage.setItem('activeWorkspaceId', ws.id); } catch { /* ignore */ } setShowWsDropdown(false); setActiveView('all'); setSidebarOpen(false); }}
              onCreate={() => { setShowCreateWs(true); setShowWsDropdown(false); }}
            />
          )}
          {/* Owner controls — share/manage, rename, delete */}
          {activeWorkspace && !renamingWs && activeWorkspace.isOwner && (
            <div className="mt-2 flex flex-col space-y-1">
              <button
                onClick={() => setShowManageWs(true)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-content-muted hover:text-content hover:bg-hover transition-colors"
              >
                <UsersIcon />
                Manage Access
              </button>
              <button
                onClick={() => { setRenamingWs(true); setWsRenameVal(activeWorkspace.name); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-content-muted hover:text-content hover:bg-hover transition-colors"
              >
                <EditIcon />
                Rename workspace
              </button>
              <button
                onClick={() => setDeletingWs(activeWorkspace)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-content-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors"
              >
                <TrashIcon />
                Delete workspace
              </button>
            </div>
          )}
          {/* Shared-with-me: leave option */}
          {activeWorkspace && !activeWorkspace.isOwner && (
            <div className="mt-2 flex flex-col space-y-1">
              <p className="px-2 text-xs text-content-subtle flex items-center gap-1.5">
                <UsersIcon /> Shared with you · view access
              </p>
              <button
                onClick={() => leaveWorkspace(activeWorkspace)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-content-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors"
              >
                <LogOutIcon />
                Leave workspace
              </button>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          <button
            onClick={() => { setActiveView('all'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeView === 'all' ? 'bg-hover text-content' : 'text-content-muted hover:text-content hover:bg-hover'}`}
          >
            <LayoutIcon />
            Team collab boards
          </button>
          <button
            onClick={() => { setActiveView('favorites'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeView === 'favorites' ? 'bg-hover text-content' : 'text-content-muted hover:text-content hover:bg-hover'}`}
          >
            <StarIcon filled={activeView === 'favorites'} />
            Favorite boards
            {favCount > 0 && (
              <span className="ml-auto text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full">{favCount}</span>
            )}
          </button>
        </nav>

        {/* User section */}
        <div className="mt-auto pt-4">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-content-muted hover:text-red-600 hover:bg-red-500/10 dark:hover:text-red-400 text-sm font-medium transition-colors"
          >
            <LogOutIcon />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-app">
        {/* Top bar */}
        <header className="flex-shrink-0 flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-4 bg-surface border-b border-edge z-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex-shrink-0 p-2 -ml-1 text-content-muted hover:text-content hover:bg-hover rounded-lg transition-colors"
            title="Open menu"
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          <div className="relative group flex-1 min-w-0 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-content-subtle group-focus-within:text-indigo-500 transition-colors">
              <SearchIcon />
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search collab boards..."
              className="w-full bg-muted text-content text-sm pl-10 pr-4 py-2.5 rounded-lg border border-edge outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-content-subtle"
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 ml-auto">
            <div className="w-px h-6 bg-edge" />
            <button
              onClick={toggleTheme}
              className="p-2 text-content-muted hover:text-content hover:bg-hover rounded-full transition-colors"
              title="Toggle theme"
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="rounded-full cursor-pointer"
              title="Open profile"
            >
              <Avatar
                email={userData.email}
                name={userData.name}
                src={userData.profilePic || userData.profilePicture}
                size={32}
                borderClass="border-indigo-500/20"
              />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <h1 className="text-xl sm:text-2xl font-bold text-content tracking-tight mb-6">
            {activeView === 'favorites' ? 'Favorite boards' : 'Team collab boards'}
          </h1>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-surface border border-edge-subtle rounded-xl overflow-hidden animate-pulse shadow-sm">
                  <div className="h-40 bg-muted" />
                  <div className="p-4 space-y-2">
                    <div className="h-3.5 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-hover rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {/* New board card — only in 'all' view, and only for workspaces you own */}
              {activeView === 'all' && activeWorkspace?.isOwner && (
                <button
                  onClick={createBoard}
                  disabled={creating}
                  className="group h-[240px] flex flex-col items-center justify-center gap-4 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-white/30 group-hover:border-white/60 flex items-center justify-center transition-all group-hover:scale-110">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  </div>
                  <span className="text-base font-semibold">{creating ? 'Creating...' : 'New collab board'}</span>
                </button>
              )}

              {visibleBoards.map(board => (
                <BoardCard
                  key={board.id}
                  board={board}
                  onNavigate={(id) => navigate(`/board/${id}`)}
                  onRename={startRename}
                  onDelete={deleteBoard}
                  onLeaveBoard={leaveBoard}
                  onChangeThumbnail={(b) => setPickerBoard(b)}
                  onToggleFavorite={toggleFavorite}
                  onMoveToWorkspace={(b) => setMovingBoard(b)}
                  canMove={board.myRole === 'owner' && workspaces.filter(w => w.isOwner).length > 1}
                  openMenu={openMenu}
                  setOpenMenu={setOpenMenu}
                  renamingId={renamingId}
                  renameVal={renameVal}
                  setRenameVal={setRenameVal}
                  saveRename={saveRename}
                  setRenamingId={setRenamingId}
                />
              ))}

              {!loading && visibleBoards.length === 0 && (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-content-subtle">
                  {activeView === 'favorites' ? (
                    <>
                      <StarIcon filled={false} />
                      <p className="mt-3 text-sm">No favorites yet — star a board to pin it here</p>
                    </>
                  ) : search ? (
                    <>
                      <SearchIcon />
                      <p className="mt-3 text-sm">No boards found matching "{search}"</p>
                    </>
                  ) : (
                    <>
                      <BuildingIcon />
                      <p className="mt-3 text-sm">No boards in this workspace yet</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {pickerBoard && (
        <ThumbnailPicker
          currentThumbnail={pickerBoard.thumbnail}
          onSelect={(value) => saveThumbnail(pickerBoard.id, value)}
          onClose={() => setPickerBoard(null)}
        />
      )}
      {showCreateWs && (
        <CreateWorkspaceModal
          onClose={() => setShowCreateWs(false)}
          onCreate={createWorkspace}
        />
      )}
      {movingBoard && (
        <MoveToWorkspaceModal
          board={movingBoard}
          workspaces={workspaces}
          currentWorkspaceId={activeWorkspace?.id}
          onMove={moveBoardToWorkspace}
          onClose={() => setMovingBoard(null)}
        />
      )}
      {showManageWs && activeWorkspace?.isOwner && (
        <ManageWorkspaceModal
          workspaceId={activeWorkspace.id}
          workspaceName={activeWorkspace.name}
          onClose={() => setShowManageWs(false)}
          onChanged={() => { fetchWorkspaces(); fetchBoards(); }}
        />
      )}
      {deletingWs && (
        <DeleteWorkspaceModal
          workspace={deletingWs}
          boardCount={(deletingWs.boardIds || []).filter(id => boards.some(b => b.id === id && b.owner === userData.email)).length}
          onConfirm={() => deleteWorkspace(deletingWs)}
          onClose={() => setDeletingWs(null)}
        />
      )}
    </div>
  );
}

// ── DeleteWorkspaceModal ──────────────────────────────────────────────────────
function DeleteWorkspaceModal({ workspace, boardCount, onConfirm, onClose }) {
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
            <>This permanently deletes the workspace and the <span className="font-semibold text-content">{boardCount} board{boardCount === 1 ? '' : 's'}</span> you own inside it. This can&apos;t be undone.</>
          ) : (
            <>This permanently deletes the workspace. Boards shared into it by others stay with their owners.</>
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
