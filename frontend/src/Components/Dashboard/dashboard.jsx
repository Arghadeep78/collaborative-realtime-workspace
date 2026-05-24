import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../../constants/apiConfig.js';
import { useTheme } from '../../contexts/ThemeContext.jsx';

// ── Icons ─────────────────────────────────────────────────────────────────────
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const LayoutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
);
const MoreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
);
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
);
const LogOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
);
const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);
const ImageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
);
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
);
const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
);
const StarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
);
const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
);
const LogoIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 4H9L12 20H8L5 4Z" fill="#F59E0B"/>
    <path d="M11 4H15L18 20H14L11 4Z" fill="#F97316"/>
    <path d="M17 4H21L24 20H20L17 4Z" fill="#EA580C"/>
  </svg>
);

// ── Cute Illustration Generators ──────────────────────────────────────────────
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
  'https://api.dicebear.com/8.x/bottts/svg?seed=Milo&backgroundColor=ffdfbf'
];

// ── ThumbnailPicker modal ─────────────────────────────────────────────────────
function ThumbnailPicker({ currentThumbnail, onSelect, onClose }) {
  const [customUrl, setCustomUrl]   = useState('');
  const [previewErr, setPreviewErr] = useState(false);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onSelect(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleCustomApply = () => {
    if (customUrl.trim()) {
      onSelect(customUrl.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 rb-anim-pop"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-gray-900 dark:text-white font-semibold text-base">Change cover</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 dark:text-white/40 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <XIcon />
          </button>
        </div>

        {/* Illustrations grid */}
        <p className="text-gray-500 dark:text-white/40 text-xs font-medium uppercase tracking-widest mb-3">Cute Faces</p>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {CUTE_THUMBNAILS.map((url, i) => {
            const active = currentThumbnail === url;
            return (
              <button
                key={`cute-${i}`}
                title={`Cute Face ${i+1}`}
                onClick={() => onSelect(url)}
                className="relative h-14 rounded-lg overflow-hidden ring-2 transition-all hover:ring-gray-300 dark:hover:ring-white/40 focus:outline-none"
                style={{
                  ringColor: active ? (document.documentElement.classList.contains('dark') ? 'white' : '#4f46e5') : 'transparent',
                  outline: active ? '2px solid currentColor' : '2px solid transparent',
                  outlineOffset: '2px',
                }}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
                {active && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                    <CheckIcon />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Remove cover */}
        {currentThumbnail && (
          <button
            onClick={() => onSelect(null)}
            className="w-full mb-4 py-2 text-sm text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 rounded-lg transition-colors"
          >
            Remove cover
          </button>
        )}

        {/* Custom image */}
        <p className="text-gray-500 dark:text-white/40 text-xs font-medium uppercase tracking-widest mb-3">Custom image</p>
        <div className="flex gap-2 mb-3">
          <input
            value={customUrl}
            onChange={e => { setCustomUrl(e.target.value); setPreviewErr(false); }}
            placeholder="Paste image URL..."
            className="flex-1 bg-gray-50 dark:bg-white/[0.05] text-gray-900 dark:text-white text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 outline-none focus:border-indigo-500 dark:focus:border-white/25 placeholder:text-gray-400 dark:placeholder:text-white/25 transition-colors"
          />
          <button
            onClick={handleCustomApply}
            disabled={!customUrl.trim()}
            className="px-4 py-2 bg-indigo-600 dark:bg-white text-white dark:text-black text-sm font-medium rounded-lg disabled:opacity-30 hover:bg-indigo-700 dark:hover:bg-white/90 transition-colors"
          >
            Apply
          </button>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full py-2.5 flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white border border-dashed border-gray-300 dark:border-white/15 hover:border-gray-400 dark:hover:border-white/30 rounded-lg transition-colors"
        >
          <ImageIcon />
          Upload from device
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

// ── BoardCard ─────────────────────────────────────────────────────────────────
function BoardCard({ board, onNavigate, onRename, onDelete, onChangeThumbnail, openMenu, setOpenMenu, renamingId, renameVal, setRenameVal, saveRename, setRenamingId, userData }) {
  const isGradient = (v) => v && v.startsWith('linear-gradient');

  return (
    <div
      className="group relative bg-white dark:bg-[#2c2c2c] border border-gray-200 dark:border-white/[0.07] hover:shadow-lg dark:hover:border-white/[0.18] rounded-xl cursor-pointer transition-all duration-200 flex flex-col"
      onClick={() => onNavigate(board.id)}
    >
      {/* Thumbnail */}
      <div className="h-40 relative overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-[#333333] rounded-t-[11px]">
        {board.thumbnail ? (
          isGradient(board.thumbnail) ? (
            <div className="absolute inset-0" style={{ background: board.thumbnail }} />
          ) : (
            <img src={board.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-300 dark:text-white/10 group-hover:text-gray-400 dark:group-hover:text-white/20 transition-colors duration-300">
            <LayoutIcon />
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>

      {/* Card body */}
      <div className="px-4 py-3.5 flex items-start justify-between gap-3 bg-white dark:bg-[#2c2c2c] rounded-b-[11px]">
        <div className="flex-1 min-w-0">
          {renamingId === board.id ? (
            <input
              autoFocus
              value={renameVal}
              onClick={e => e.stopPropagation()}
              onChange={e => setRenameVal(e.target.value)}
              onBlur={() => saveRename(board.id)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveRename(board.id);
                if (e.key === 'Escape') setRenamingId(null);
              }}
              className="w-full bg-gray-50 dark:bg-white/10 text-gray-900 dark:text-white text-sm px-2 py-1 rounded border border-gray-300 dark:border-white/20 outline-none focus:border-indigo-500 dark:focus:border-white/40"
            />
          ) : (
            <p className="text-gray-900 dark:text-white text-sm font-medium truncate">{board.title}</p>
          )}
          <p className="text-gray-500 dark:text-white/35 text-xs mt-1 flex items-center gap-1.5">
            {timeAgo(board.updatedAt || board.createdAt)}
            {board.isPublic && (
              <>
                <span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-white/20 inline-block" />
                <span className="text-gray-400 dark:text-white/50">Public</span>
              </>
            )}
          </p>
        </div>

        {/* 3-dot menu and Favorite */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-gray-400 hover:text-yellow-500 dark:text-white/40 dark:hover:text-yellow-400 transition-all">
            <StarIcon />
          </button>
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === board.id ? null : board.id)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/10 transition-all"
            >
              <MoreIcon />
            </button>
            {openMenu === board.id && (
              <div className="absolute right-0 top-8 w-44 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden z-20 rb-anim-pop py-1">
                <button onClick={() => { onRename(board); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-white/70 dark:hover:bg-white/[0.06] dark:hover:text-white transition-colors flex items-center gap-2.5">
                  <EditIcon /> Rename
                </button>
                <button onClick={() => { onChangeThumbnail(board); setOpenMenu(null); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-white/70 dark:hover:bg-white/[0.06] dark:hover:text-white transition-colors flex items-center gap-2.5">
                  <ImageIcon /> Change cover
                </button>
                <div className="h-px bg-gray-100 dark:bg-white/[0.06] my-1" />
                <button onClick={() => { onDelete(board.id); setOpenMenu(null); }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400/80 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors flex items-center gap-2.5">
                  <TrashIcon /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── timeAgo helper ────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const d = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (d < 60)    return 'just now';
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard({ logout }) {
  const [boards, setBoards]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [creating, setCreating]     = useState(false);
  const [openMenu, setOpenMenu]     = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal]   = useState('');
  const [pickerBoard, setPickerBoard] = useState(null);
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  const token    = () => localStorage.getItem('token');
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');

  const fetchBoards = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/boards/list`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setBoards(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBoards(); }, []);

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenu]);

  const createBoard = async () => {
    setCreating(true);
    try {
      // Pick a random cute thumbnail
      const randomThumbnail = CUTE_THUMBNAILS[Math.floor(Math.random() * CUTE_THUMBNAILS.length)];

      const res  = await fetch(`${BACKEND_URL}/boards/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: 'Untitled Collab Board',
          thumbnail: randomThumbnail
        }),
      });
      const data = await res.json();
      if (data.id) navigate(`/board/${data.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const deleteBoard = async (id) => {
    if (!window.confirm('Delete this collab board?')) return;
    await fetch(`${BACKEND_URL}/boards/delete/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
    });
    setBoards(bs => bs.filter(b => b.id !== id));
  };

  const startRename = (board) => {
    setRenamingId(board.id);
    setRenameVal(board.title);
    setOpenMenu(null);
  };

  const saveRename = async (id) => {
    await fetch(`${BACKEND_URL}/boards/title/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: renameVal }),
    });
    setBoards(bs => bs.map(b => b.id === id ? { ...b, title: renameVal } : b));
    setRenamingId(null);
  };

  const saveThumbnail = async (boardId, thumbnail) => {
    await fetch(`${BACKEND_URL}/boards/thumbnail/${boardId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ thumbnail }),
    });
    setBoards(bs => bs.map(b => b.id === boardId ? { ...b, thumbnail } : b));
    setPickerBoard(null);
  };

  const filtered = boards.filter(b => b.title?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#212121] text-gray-900 dark:text-[#ededed] font-sans overflow-hidden selection:bg-indigo-500/30 dark:selection:bg-white/20">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-[240px] flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-white/[0.07] bg-white dark:bg-[#212121] py-5 px-4 shadow-sm z-10">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 mb-8 cursor-pointer select-none">
          <LogoIcon />
          <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-white">Collab Board</span>
        </div>

        {/* Workspace Selector (Stub) */}
        <div className="mb-6 px-2">
          <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors group">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                A
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-white/80 group-hover:text-gray-900 dark:group-hover:text-white">Acme Corp</span>
            </div>
            <div className="text-gray-400 group-hover:text-gray-600 dark:text-white/30 dark:group-hover:text-white/60">
              <ChevronDownIcon />
            </div>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-100 dark:bg-white/[0.07] text-gray-900 dark:text-white text-sm font-medium">
            <LayoutIcon />
            Team collab boards
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/[0.04] text-sm font-medium transition-colors">
            <StarIcon />
            Favorite collab boards
          </button>
        </nav>

        {/* User section (Logout) */}
        <div className="mt-auto pt-4">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-white/40 dark:hover:text-red-400 dark:hover:bg-red-500/10 text-sm font-medium transition-colors"
          >
            <LogOutIcon />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-[#212121]">
        {/* Top bar */}
        <header className="flex-shrink-0 flex items-center justify-between px-8 py-4 bg-white dark:bg-[#212121] border-b border-gray-200 dark:border-white/[0.07] z-0">
          <div className="relative group w-96">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-white/30 group-focus-within:text-indigo-500 dark:group-focus-within:text-white/60 transition-colors">
              <SearchIcon />
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search collab boards..."
              className="w-full bg-gray-100 dark:bg-white/[0.04] text-gray-900 dark:text-white text-sm pl-10 pr-4 py-2.5 rounded-lg border-none dark:border dark:border-white/[0.08] outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-0 dark:focus:border-white/20 dark:focus:bg-white/[0.06] transition-all placeholder:text-gray-500 dark:placeholder:text-white/25"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <button className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-white/70 dark:hover:text-white font-medium text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
              <PlusIcon />
              Invite members
            </button>
            <div className="w-px h-6 bg-gray-200 dark:bg-white/10" />
            <button 
              onClick={toggleTheme}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/10 rounded-full transition-colors"
              title="Toggle theme"
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 dark:bg-white/10 dark:border-white/15 flex items-center justify-center text-sm font-semibold text-indigo-700 dark:text-white shadow-sm cursor-pointer">
              {userData.name?.[0]?.toUpperCase() || userData.email?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-6">Team collab boards</h1>
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05] rounded-xl overflow-hidden animate-pulse shadow-sm">
                  <div className="h-40 bg-gray-200 dark:bg-white/[0.03]" />
                  <div className="p-4 space-y-2">
                    <div className="h-3.5 bg-gray-200 dark:bg-white/[0.05] rounded w-3/4" />
                    <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {/* New board card (Prominent Blue) */}
              <button
                onClick={createBoard}
                disabled={creating}
                className="group h-[240px] flex flex-col items-center justify-center gap-4 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 rounded-full border-2 border-white/30 group-hover:border-white/60 flex items-center justify-center transition-all group-hover:scale-110">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <span className="text-base font-semibold">{creating ? 'Creating...' : 'New collab board'}</span>
              </button>

              {filtered.map(board => (
                <BoardCard
                  key={board.id}
                  board={board}
                  onNavigate={(id) => navigate(`/board/${id}`)}
                  onRename={startRename}
                  onDelete={deleteBoard}
                  onChangeThumbnail={(b) => setPickerBoard(b)}
                  openMenu={openMenu}
                  setOpenMenu={setOpenMenu}
                  renamingId={renamingId}
                  renameVal={renameVal}
                  setRenameVal={setRenameVal}
                  saveRename={saveRename}
                  setRenamingId={setRenamingId}
                  userData={userData}
                />
              ))}
              
              {!loading && filtered.length === 0 && search && (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-500 dark:text-white/40">
                  <SearchIcon />
                  <p className="mt-3 text-sm">No collab boards found matching "{search}"</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── Thumbnail picker ─────────────────────────────────────────────── */}
      {pickerBoard && (
        <ThumbnailPicker
          currentThumbnail={pickerBoard.thumbnail}
          onSelect={(value) => saveThumbnail(pickerBoard.id, value)}
          onClose={() => setPickerBoard(null)}
        />
      )}
    </div>
  );
}
