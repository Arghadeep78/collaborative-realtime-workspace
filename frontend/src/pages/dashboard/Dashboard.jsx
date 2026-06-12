import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BACKEND_URL } from '../../constants/apiConfig.js';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import ManageWorkspaceModal from '../../components/board/ManageWorkspaceModal.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import {
  SearchIcon, LayoutIcon, EditIcon, TrashIcon, LogOutIcon,
  XIcon, SunIcon, MoonIcon, StarIcon, ChevronDownIcon, LogoIcon,
  BuildingIcon, MenuIcon, UsersIcon,
} from '../../components/common/icons.jsx';
import { CUTE_THUMBNAILS } from './dashboardConstants.js';
import ThumbnailPicker from '../../components/dashboard/ThumbnailPicker.jsx';
import CreateWorkspaceModal from '../../components/dashboard/CreateWorkspaceModal.jsx';
import MoveToWorkspaceModal from '../../components/dashboard/MoveToWorkspaceModal.jsx';
import DeleteWorkspaceModal from '../../components/dashboard/DeleteWorkspaceModal.jsx';
import WorkspaceDropdown from '../../components/dashboard/WorkspaceDropdown.jsx';
import BoardCard from '../../components/dashboard/BoardCard.jsx';

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

  const sharedWorkspaces = useMemo(() => {
    const myWsIds = new Set(workspaces.map(w => w.id));
    const map = new Map();
    boards.forEach(b => {
      if (!b.workspaceId || myWsIds.has(b.workspaceId)) return;
      if (!map.has(b.workspaceId)) {
        map.set(b.workspaceId, {
          id: b.workspaceId,
          name: b.workspaceName || 'Shared workspace',
          owner: b.workspaceOwner || '',
          boardIds: [],
          isShared: true,
        });
      }
      map.get(b.workspaceId).boardIds.push(b.id);
    });
    return [...map.values()];
  }, [boards, workspaces]);

  const token = () => localStorage.getItem('token');
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');

  // ── Fetch boards ────────────────────────────────────────────────────────────
  const fetchBoards = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/projects/list`, { headers: { Authorization: `Bearer ${token()}` } });
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

  // After boards finish loading, check if the stored activeWorkspaceId belongs to a
  // sharedWorkspace (not in the user's own workspace list). If so, switch to it so
  // the user lands on the right workspace after visiting a board via share link.
  useEffect(() => {
    if (loading) return;
    const storedId = localStorage.getItem('activeWorkspaceId');
    if (!storedId) return;
    const inOwnList = workspaces.some(w => w.id === storedId);
    if (inOwnList) return; // fetchWorkspaces already set it correctly
    const shared = sharedWorkspaces.find(w => w.id === storedId);
    if (shared) setActiveWs(shared);
  }, [loading, sharedWorkspaces]);

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
      const res = await fetch(`${BACKEND_URL}/projects/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled Project', thumbnail: randomThumbnail }),
      });
      const data = await res.json();
      if (data.id) {
        // Only the workspace owner can file boards into it; members are view-only.
        if (activeWorkspace?.id && activeWorkspace?.isOwner) {
          await fetch(`${BACKEND_URL}/workspaces/${activeWorkspace.id}/add-project`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: data.id }),
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
    if (!window.confirm('Delete this project?')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/projects/delete/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || 'Failed to delete project');
      }
      setBoards(bs => bs.filter(b => b.id !== id));
    } catch (e) {
      toast.error(e.message || 'Failed to delete project');
    }
  };

  const leaveBoard = async (id) => {
    if (!window.confirm('Leave this project? You will lose access unless re-invited.')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/projects/leave/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || 'Failed to leave project');
      }
      setBoards(bs => bs.filter(b => b.id !== id));
    } catch (e) {
      toast.error(e.message || 'Failed to leave project');
    }
  };

  const startRename = (board) => {
    setRenamingId(board.id);
    setRenameVal(board.title);
    setOpenMenu(null);
  };

  const saveRename = async (id) => {
    try {
      const res = await fetch(`${BACKEND_URL}/projects/title/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameVal }),
      });
      if (!res.ok) throw new Error('Failed to rename project');
      setBoards(bs => bs.map(b => b.id === id ? { ...b, title: renameVal } : b));
    } catch (e) {
      toast.error(e.message || 'Failed to rename project');
    } finally {
      setRenamingId(null);
    }
  };

  const saveThumbnail = async (boardId, thumbnail) => {
    try {
      const res = await fetch(`${BACKEND_URL}/projects/thumbnail/${boardId}`, {
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
      const res = await fetch(`${BACKEND_URL}/projects/favorite/${boardId}`, {
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
    if (!window.confirm(`Leave "${ws.name}"? You will lose access to all its projects unless re-invited.`)) return;
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
      const res = await fetch(`${BACKEND_URL}/workspaces/${targetWorkspaceId}/add-project`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: boardId }),
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
      toast.success('Project moved');
    } catch (e) {
      toast.error(e.message || 'Failed to move project');
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
          <span className="font-bold text-lg tracking-tight text-content">Collab Space</span>
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
              workspaces={[...workspaces, ...sharedWorkspaces]}
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
                Rename Workspace
              </button>
              <button
                onClick={() => setDeletingWs(activeWorkspace)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-content-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors"
              >
                <TrashIcon />
                Delete Workspace
              </button>
            </div>
          )}
          {/* Shared-with-me (workspace member): leave option */}
          {activeWorkspace && !activeWorkspace.isOwner && !activeWorkspace.isShared && (
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
          {/* Project-level collaborator: read-only notice, no workspace controls */}
          {activeWorkspace?.isShared && (
            <div className="mt-2 flex flex-col space-y-1">
              <p className="px-2 text-xs text-content-subtle flex items-center gap-1.5">
                <UsersIcon /> Project access only
              </p>
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
            Team projects
          </button>
          <button
            onClick={() => { setActiveView('favorites'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeView === 'favorites' ? 'bg-hover text-content' : 'text-content-muted hover:text-content hover:bg-hover'}`}
          >
            <StarIcon filled={activeView === 'favorites'} />
            Favorite projects
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
              placeholder="Search collab projects..."
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
            {activeView === 'favorites' ? 'Favorite Projects' : 'Team Projects'}
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
                  <span className="text-base font-semibold">{creating ? 'Creating...' : 'New project'}</span>
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
                      <p className="mt-3 text-sm">No favorites yet — star a project to pin it here</p>
                    </>
                  ) : search ? (
                    <>
                      <SearchIcon />
                      <p className="mt-3 text-sm">No projects found matching "{search}"</p>
                    </>
                  ) : (
                    <>
                      <BuildingIcon />
                      <p className="mt-3 text-sm">No projects in this workspace yet</p>
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
