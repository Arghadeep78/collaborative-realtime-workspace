import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../../constants/apiConfig.js';

export default function Dashboard({ logout }) {
  const [boards, setBoards]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [creating, setCreating]     = useState(false);
  const [openMenu, setOpenMenu]     = useState(null);    // boardId of open 3-dot menu
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
    <div className="h-full min-h-full overflow-auto bg-gray-950 text-white font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black">
      {/* ── Nav ───────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-y-4 px-6 py-4 bg-gray-900/60 backdrop-blur-xl border-b border-gray-800/50 shadow-sm">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-all duration-300 transform group-hover:scale-105">C</div>
          <span className="font-bold tracking-tight text-lg bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">CollabBoard</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-700/50 backdrop-blur-sm">
            <div className="w-5 h-5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
              {userData.name?.[0] || userData.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="text-gray-300 text-sm font-medium">{userData.name || userData.email}</span>
          </div>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-white text-sm font-medium transition-colors hover:bg-gray-800/50 px-3 py-1.5 rounded-lg"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* ── Main ──────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-6 py-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400">My Boards</h1>
            <p className="text-gray-400 text-sm mt-1 font-medium">{boards.length} workspace{boards.length !== 1 ? 's' : ''} available</p>
          </div>
          <button
            onClick={createBoard}
            disabled={creating}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold text-sm rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transform hover:-translate-y-0.5 active:translate-y-0 disabled:transform-none disabled:shadow-none disabled:opacity-70"
          >
            <span className="text-xl leading-none font-light">+</span>
            {creating ? 'Initializing…' : 'New Board'}
          </button>
        </div>

        {/* Search */}
        <div className="mb-8 relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-500 group-focus-within:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search boards…"
            className="w-full max-w-md bg-gray-900/50 text-white text-sm pl-11 pr-4 py-3 rounded-xl border border-gray-700/80 outline-none focus:border-indigo-500 focus:bg-gray-800/80 focus:ring-4 focus:ring-indigo-500/10 transition-all backdrop-blur-sm placeholder-gray-500 shadow-inner"
          />
        </div>

        {/* Board grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-32 bg-gray-800" />
                <div className="p-3 flex flex-col gap-2">
                  <div className="h-3 bg-gray-800 rounded w-3/4" />
                  <div className="h-2 bg-gray-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center bg-gray-900/30 border border-gray-800/50 rounded-3xl backdrop-blur-sm border-dashed">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-4xl mb-6 shadow-xl border border-gray-700/50 shadow-black/50">📋</div>
            <p className="text-gray-200 font-semibold text-lg mb-2">
              {search ? 'No boards match your search' : 'No boards yet'}
            </p>
            <p className="text-gray-500 text-sm mb-8 max-w-xs">
              {search ? 'Try adjusting your filters or search terms.' : 'Create your first collaborative whiteboard to get started and share ideas.'}
            </p>
            {!search && (
              <button onClick={createBoard} className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-sm font-medium rounded-xl transition-colors shadow-lg">
                Create First Board
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-[fadeIn_0.3s_ease-out]">
            {filtered.map((board, i) => (
              <div
                key={board.id}
                style={{ animationDelay: `${i * 50}ms` }}
                className="group relative bg-gray-900/40 backdrop-blur-md border border-gray-700/50 rounded-2xl overflow-hidden hover:border-indigo-500/50 cursor-pointer animate-in fade-in zoom-in-95 hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-950/40 transition-all duration-200"
                onClick={() => navigate(`/board/${board.id}`)}
              >
                {/* Thumbnail */}
                <div className="h-36 bg-gradient-to-br from-gray-800/80 to-gray-900 flex items-center justify-center relative overflow-hidden group-hover:from-indigo-900/40 group-hover:to-gray-900 transition-colors duration-500">
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] animate-[shimmer_2s_infinite] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  {board.thumbnail ? (
                    <img src={board.thumbnail} alt={board.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <span className="text-5xl opacity-30 group-hover:opacity-60 transition-opacity duration-300 transform group-hover:scale-110 drop-shadow-lg">📌</span>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 bg-gray-900/60 backdrop-blur-sm border-t border-gray-800/50">
                  {renamingId === board.id ? (
                    <input
                      autoFocus
                      value={renameVal}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setRenameVal(e.target.value)}
                      onBlur={() => saveRename(board.id)}
                      onKeyDown={e => { if (e.key === 'Enter') saveRename(board.id); if (e.key === 'Escape') setRenamingId(null); }}
                      className="w-full bg-gray-800/80 text-white text-sm px-2 py-1.5 rounded border border-indigo-500 outline-none shadow-[0_0_10px_rgba(99,102,241,0.2)] focus:ring-2 focus:ring-indigo-500/30"
                    />
                  ) : (
                    <p className="text-gray-100 text-[15px] font-semibold truncate group-hover:text-indigo-300 transition-colors">{board.title}</p>
                  )}
                  <p className="text-gray-500 text-xs mt-1 font-medium">{timeAgo(board.updatedAt || board.createdAt)}</p>

                  {/* Collaborator avatars */}
                  {board.collaborators?.length > 0 && (
                    <div className="flex mt-3 -space-x-2">
                      {board.collaborators.slice(0, 4).map(c => (
                        <div key={c.email} title={c.name || c.email}
                          className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-800 border-2 border-gray-900 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                          {c.email?.[0]?.toUpperCase()}
                        </div>
                      ))}
                      {board.collaborators.length > 4 && (
                        <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-gray-300 text-[10px] font-bold shadow-sm">
                          +{board.collaborators.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3-dot menu */}
                <div className="absolute top-3 right-3" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenMenu(openMenu === board.id ? null : board.id)}
                    className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg bg-gray-900/80 backdrop-blur-md flex items-center justify-center text-gray-300 hover:text-white hover:bg-gray-800 border border-gray-700/50 shadow-lg transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                  </button>
                  {openMenu === board.id && (
                    <div className="absolute right-0 top-10 w-36 bg-gray-800/95 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-20 animate-in zoom-in-95 duration-100">
                      <button onClick={() => startRename(board)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        Rename
                      </button>
                      <button onClick={() => { deleteBoard(board.id); setOpenMenu(null); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Public badge */}
                {board.isPublic && (
                  <div className="absolute top-3 left-3 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-wider uppercase rounded-md backdrop-blur-md shadow-sm">
                    Public
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}