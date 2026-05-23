import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../../constants/apiConfig.js';

// --- Icons ---
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
);
const LayoutIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
);
const MoreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
);
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
);
const LogOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
);
const EmptyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
);

export default function Dashboard({ logout }) {
  const [boards, setBoards]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [creating, setCreating]     = useState(false);
  const [openMenu, setOpenMenu]     = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal]   = useState('');
  const navigate                    = useNavigate();
  const token                       = () => localStorage.getItem('token');
  const userData                    = JSON.parse(localStorage.getItem('userData') || '{}');

  const fetchBoards = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/boards/list`, {
        headers: { 'Authorization': `Bearer ${token()}` }
      });
      const data = await res.json();
      setBoards(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBoards(); }, []);

  // Close the open card menu when clicking anywhere outside it
  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenu]);

  const createBoard = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/boards/create`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
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
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token()}` },
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
      headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: renameVal }),
    });
    setBoards(bs => bs.map(b => b.id === id ? { ...b, title: renameVal } : b));
    setRenamingId(null);
  };

  const filtered = boards.filter(b =>
    b.title?.toLowerCase().includes(search.toLowerCase())
  );

  const timeAgo = (dateStr) => {
    const d = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (d < 60)   return 'just now';
    if (d < 3600) return `${Math.floor(d/60)}m ago`;
    if (d < 86400) return `${Math.floor(d/3600)}h ago`;
    return `${Math.floor(d/86400)}d ago`;
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0a] text-[#ededed] font-sans selection:bg-white/20">
      {/* ── Nav ───────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 flex items-center justify-between px-8 py-5 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/[0.08]">
        <div className="flex items-center gap-3 cursor-pointer select-none">
          <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center text-black font-semibold text-lg shadow-sm">
            C
          </div>
          <span className="font-semibold tracking-tight text-[17px] text-white">CollabBoard</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-medium text-white">
              {userData.name?.[0] || userData.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="text-sm font-medium text-white/80 hidden sm:block">{userData.name || userData.email}</span>
          </div>
          <div className="w-[1px] h-4 bg-white/10 hidden sm:block"></div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-white/60 hover:text-white text-sm font-medium transition-colors"
          >
            <LogOutIcon />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </nav>

      {/* ── Main ──────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-8 py-12 rb-anim-fade">
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <h1 className="text-3xl font-medium tracking-tight text-white mb-2">Projects</h1>
            <p className="text-white/50 text-sm">{boards.length} workspace{boards.length !== 1 ? 's' : ''}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
            <div className="relative w-full sm:w-64 group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/40 group-focus-within:text-white/80 transition-colors">
                <SearchIcon />
              </div>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-white/[0.03] text-white text-sm pl-10 pr-4 py-2.5 rounded-lg border border-white/[0.08] outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all placeholder:text-white/30"
              />
            </div>
            <button
              onClick={createBoard}
              disabled={creating}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-white/90 disabled:bg-white/50 font-medium text-sm rounded-lg transition-all"
            >
              <PlusIcon />
              {creating ? 'Creating...' : 'New Project'}
            </button>
          </div>
        </div>

        {/* Board grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden animate-pulse">
                <div className="h-40 bg-white/[0.02]" />
                <div className="p-4 flex flex-col gap-3">
                  <div className="h-4 bg-white/[0.05] rounded w-2/3" />
                  <div className="h-3 bg-white/[0.05] rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white/[0.01] border border-white/[0.05] rounded-2xl border-dashed">
            <div className="text-white/20 mb-4">
              <EmptyIcon />
            </div>
            <h3 className="text-white font-medium text-lg mb-1">
              {search ? 'No results found' : 'No projects yet'}
            </h3>
            <p className="text-white/50 text-sm mb-6 max-w-sm">
              {search ? 'Try adjusting your search query.' : 'Get started by creating your first collaborative workspace.'}
            </p>
            {!search && (
              <button onClick={createBoard} className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-white text-sm font-medium rounded-lg transition-colors">
                <PlusIcon /> Create Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((board) => (
              <div
                key={board.id}
                className="group relative bg-white/[0.02] border border-white/[0.08] hover:border-white/20 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 flex flex-col h-full"
                onClick={() => navigate(`/board/${board.id}`)}
              >
                {/* Thumbnail */}
                <div className="h-40 bg-white/[0.01] flex items-center justify-center relative overflow-hidden border-b border-white/[0.04]">
                  {board.thumbnail ? (
                    <img src={board.thumbnail} alt={board.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="text-white/10 transition-transform duration-500 group-hover:scale-110 group-hover:text-white/20">
                      <LayoutIcon />
                    </div>
                  )}
                  {/* Hover overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>

                {/* Info */}
                <div className="p-4 flex-grow flex flex-col justify-between bg-[#0a0a0a]/50">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      {renamingId === board.id ? (
                        <input
                          autoFocus
                          value={renameVal}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setRenameVal(e.target.value)}
                          onBlur={() => saveRename(board.id)}
                          onKeyDown={e => { if (e.key === 'Enter') saveRename(board.id); if (e.key === 'Escape') setRenamingId(null); }}
                          className="w-full bg-white/10 text-white text-sm px-2 py-1 rounded border border-white/20 outline-none focus:border-white/40"
                        />
                      ) : (
                        <h3 className="text-white text-[15px] font-medium truncate group-hover:text-white/90 transition-colors">
                          {board.title}
                        </h3>
                      )}
                      <p className="text-white/40 text-[13px] mt-1.5 flex items-center gap-2">
                        {timeAgo(board.updatedAt || board.createdAt)}
                        {board.isPublic && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-white/20"></span>
                            <span className="text-white/60">Public</span>
                          </>
                        )}
                      </p>
                    </div>

                    {/* 3-dot menu */}
                    <div className="relative" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenMenu(openMenu === board.id ? null : board.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <MoreIcon />
                      </button>
                      {openMenu === board.id && (
                        <div className="absolute right-0 top-8 w-40 bg-[#121212] border border-white/10 rounded-lg shadow-2xl overflow-hidden z-20 rb-anim-pop py-1">
                          <button onClick={() => startRename(board)}
                            className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2.5">
                            <EditIcon />
                            Rename
                          </button>
                          <div className="h-[1px] bg-white/5 my-1"></div>
                          <button onClick={() => { deleteBoard(board.id); setOpenMenu(null); }}
                            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center gap-2.5">
                            <TrashIcon />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Collaborator avatars */}
                  {board.collaborators?.length > 0 && (
                    <div className="flex mt-4 -space-x-1.5">
                      {board.collaborators.slice(0, 4).map(c => (
                        <div key={c.email} title={c.name || c.email}
                          className="w-6 h-6 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-white text-[10px] font-medium shadow-sm">
                          {c.email?.[0]?.toUpperCase()}
                        </div>
                      ))}
                      {board.collaborators.length > 4 && (
                        <div className="w-6 h-6 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-white/60 text-[10px] font-medium shadow-sm">
                          +{board.collaborators.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}