import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../../constants/apiConfig.js';

// ── Icons ─────────────────────────────────────────────────────────────────────
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const LayoutIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
);
const MoreIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
);
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
);
const LogOutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
);
const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);
const ImageIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
);
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

// ── Preset thumbnails ─────────────────────────────────────────────────────────
const PRESETS = [
  { id: 'p1',  label: 'Ocean',     value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'p2',  label: 'Sunset',    value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'p3',  label: 'Forest',    value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 'p4',  label: 'Mint',      value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { id: 'p5',  label: 'Blaze',     value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { id: 'p6',  label: 'Night',     value: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
  { id: 'p7',  label: 'Peach',     value: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { id: 'p8',  label: 'Indigo',    value: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { id: 'p9',  label: 'Lava',      value: 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)' },
  { id: 'p10', label: 'Sky',       value: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)' },
  { id: 'p11', label: 'Slate',     value: 'linear-gradient(135deg, #434343 0%, #000000 100%)' },
  { id: 'p12', label: 'Emerald',   value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
];

// ── ThumbnailPicker modal ─────────────────────────────────────────────────────
function ThumbnailPicker({ currentThumbnail, onSelect, onClose }) {
  const [customUrl, setCustomUrl]   = useState('');
  const [previewErr, setPreviewErr] = useState(false);
  const fileRef = useRef(null);

  const isGradient = (v) => v && v.startsWith('linear-gradient');

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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#141414] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 rb-anim-pop"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-base">Change cover</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <XIcon />
          </button>
        </div>

        {/* Presets grid */}
        <p className="text-white/40 text-xs font-medium uppercase tracking-widest mb-3">Gradients</p>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {PRESETS.map(p => {
            const active = currentThumbnail === p.value;
            return (
              <button
                key={p.id}
                title={p.label}
                onClick={() => onSelect(p.value)}
                className="relative h-14 rounded-lg overflow-hidden ring-2 transition-all hover:ring-white/40 focus:outline-none"
                style={{
                  background: p.value,
                  ringColor: active ? 'white' : 'transparent',
                  outline: active ? '2px solid white' : '2px solid transparent',
                  outlineOffset: '2px',
                }}
              >
                {active && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="text-white"><CheckIcon /></div>
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
            className="w-full mb-4 py-2 text-sm text-white/50 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors"
          >
            Remove cover
          </button>
        )}

        {/* Custom image */}
        <p className="text-white/40 text-xs font-medium uppercase tracking-widest mb-3">Custom image</p>
        <div className="flex gap-2 mb-3">
          <input
            value={customUrl}
            onChange={e => { setCustomUrl(e.target.value); setPreviewErr(false); }}
            placeholder="Paste image URL..."
            className="flex-1 bg-white/[0.05] text-white text-sm px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-white/25 placeholder:text-white/25 transition-colors"
          />
          <button
            onClick={handleCustomApply}
            disabled={!customUrl.trim()}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg disabled:opacity-30 hover:bg-white/90 transition-colors"
          >
            Apply
          </button>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full py-2.5 flex items-center justify-center gap-2 text-sm text-white/60 hover:text-white border border-dashed border-white/15 hover:border-white/30 rounded-lg transition-colors"
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
function BoardCard({ board, onNavigate, onRename, onDelete, onChangeThumbnail, openMenu, setOpenMenu, renamingId, renameVal, setRenameVal, saveRename, setRenamingId }) {
  const isGradient = (v) => v && v.startsWith('linear-gradient');

  return (
    <div
      className="group relative bg-[#111111] border border-white/[0.07] hover:border-white/[0.18] rounded-xl overflow-hidden cursor-pointer transition-all duration-200 flex flex-col"
      onClick={() => onNavigate(board.id)}
    >
      {/* Thumbnail */}
      <div className="h-36 relative overflow-hidden flex items-center justify-center">
        {board.thumbnail ? (
          isGradient(board.thumbnail) ? (
            <div className="absolute inset-0" style={{ background: board.thumbnail }} />
          ) : (
            <img src={board.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          )
        ) : (
          <div className="absolute inset-0 bg-[#1a1a1a]" />
        )}
        {/* Default icon */}
        {!board.thumbnail && (
          <div className="relative text-white/10 group-hover:text-white/20 transition-colors duration-300 group-hover:scale-110 transform transition-transform">
            <LayoutIcon />
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>

      {/* Card body */}
      <div className="px-4 py-3.5 flex items-start justify-between gap-3">
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
              className="w-full bg-white/10 text-white text-sm px-2 py-1 rounded border border-white/20 outline-none focus:border-white/40"
            />
          ) : (
            <p className="text-white text-sm font-medium truncate">{board.title}</p>
          )}
          <p className="text-white/35 text-xs mt-1 flex items-center gap-1.5">
            {timeAgo(board.updatedAt || board.createdAt)}
            {board.isPublic && (
              <>
                <span className="w-0.5 h-0.5 rounded-full bg-white/20 inline-block" />
                <span className="text-white/50">Public</span>
              </>
            )}
          </p>
          {/* Collaborator avatars */}
          {board.collaborators?.length > 0 && (
            <div className="flex mt-2.5 -space-x-1.5">
              {board.collaborators.slice(0, 4).map(c => (
                <div key={c.email} title={c.name || c.email}
                  className="w-5 h-5 rounded-full bg-[#222] border border-[#333] flex items-center justify-center text-white text-[9px] font-medium">
                  {c.email?.[0]?.toUpperCase()}
                </div>
              ))}
              {board.collaborators.length > 4 && (
                <div className="w-5 h-5 rounded-full bg-[#222] border border-[#333] flex items-center justify-center text-white/50 text-[9px] font-medium">
                  +{board.collaborators.length - 4}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3-dot menu */}
        <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setOpenMenu(openMenu === board.id ? null : board.id)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <MoreIcon />
          </button>
          {openMenu === board.id && (
            <div className="absolute right-0 top-8 w-44 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20 rb-anim-pop py-1">
              <button onClick={() => { onRename(board); }}
                className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2.5">
                <EditIcon /> Rename
              </button>
              <button onClick={() => { onChangeThumbnail(board); setOpenMenu(null); }}
                className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2.5">
                <ImageIcon /> Change cover
              </button>
              <div className="h-px bg-white/[0.06] my-1" />
              <button onClick={() => { onDelete(board.id); setOpenMenu(null); }}
                className="w-full text-left px-3 py-2 text-sm text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-colors flex items-center gap-2.5">
                <TrashIcon /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── timeAgo helper (module-level so BoardCard can use it) ─────────────────────
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
  const [pickerBoard, setPickerBoard] = useState(null); // board whose cover is being changed
  const navigate = useNavigate();

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
      const res  = await fetch(`${BACKEND_URL}/boards/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled Board' }),
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
    if (!window.confirm('Delete this board?')) return;
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
    <div className="flex h-screen bg-[#0d0d0d] text-[#ededed] font-sans overflow-hidden selection:bg-white/20">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-[220px] flex-shrink-0 flex flex-col border-r border-white/[0.07] bg-[#0d0d0d] py-5 px-3">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-2 mb-7 cursor-pointer select-none">
          <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-black font-bold text-sm shadow-sm">
            C
          </div>
          <span className="font-semibold text-[15px] tracking-tight text-white">CollabBoard</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.07] text-white text-sm font-medium">
            <HomeIcon />
            Home
          </button>
        </nav>

        {/* User section */}
        <div className="mt-auto pt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
              {userData.name?.[0] || userData.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[13px] font-medium truncate leading-tight">
                {userData.name || userData.email?.split('@')[0]}
              </p>
              <p className="text-white/35 text-[11px] truncate leading-tight">{userData.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.05] text-sm transition-colors"
          >
            <LogOutIcon />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 flex items-center justify-between px-8 py-4 border-b border-white/[0.07]">
          <h1 className="text-xl font-semibold text-white tracking-tight">Recent</h1>
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/30 group-focus-within:text-white/60 transition-colors">
                <SearchIcon />
              </div>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search boards..."
                className="w-56 bg-white/[0.04] text-white text-sm pl-9 pr-4 py-2 rounded-lg border border-white/[0.08] outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all placeholder:text-white/25"
              />
            </div>
            <button
              onClick={createBoard}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-black font-medium text-sm rounded-lg hover:bg-white/90 disabled:opacity-50 transition-colors"
            >
              <PlusIcon />
              {creating ? 'Creating...' : 'New board'}
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-8 py-7">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.05] rounded-xl overflow-hidden animate-pulse">
                  <div className="h-36 bg-white/[0.03]" />
                  <div className="p-4 space-y-2">
                    <div className="h-3.5 bg-white/[0.05] rounded w-3/4" />
                    <div className="h-3 bg-white/[0.04] rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4 text-white/20">
                <LayoutIcon />
              </div>
              <h3 className="text-white font-semibold text-lg mb-1.5">
                {search ? 'No results found' : 'No boards yet'}
              </h3>
              <p className="text-white/40 text-sm mb-6 max-w-xs">
                {search ? 'Try a different search.' : 'Create your first board to get started.'}
              </p>
              {!search && (
                <button onClick={createBoard} className="flex items-center gap-2 px-5 py-2.5 bg-white text-black font-medium text-sm rounded-lg hover:bg-white/90 transition-colors">
                  <PlusIcon /> New board
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {/* New board card */}
              <button
                onClick={createBoard}
                disabled={creating}
                className="group h-full min-h-[200px] flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/[0.1] hover:border-white/25 text-white/30 hover:text-white/60 transition-all duration-200 hover:bg-white/[0.02] disabled:opacity-50"
              >
                <div className="w-9 h-9 rounded-full border border-current flex items-center justify-center transition-transform group-hover:scale-110">
                  <PlusIcon />
                </div>
                <span className="text-sm font-medium">{creating ? 'Creating...' : 'New board'}</span>
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
                />
              ))}
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
