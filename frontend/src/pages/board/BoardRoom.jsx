import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useYjsBoard } from '../../crdt/useYjsBoard.js';
import { useBoardHistory } from '../../crdt/useBoardHistory.js';
import { useBoardSync } from '../../components/board/useBoardSync.js';
import { convertLegacyBoard } from '../../components/board/convertLegacyBoard.js';
import { arrangeElements } from '../../components/board/layout.js';
import { BACKEND_URL } from '../../constants/apiConfig.js';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { ELEMENT_DEFAULTS, GRID_STEP, SLIDE_W, SLIDE_H, clamp, myColor, boardShellClass } from '../../components/board/boardConstants.js';
import { resolveTaskLocation } from '../../components/board/taskConstants.js';

import Sidebar from '../../components/board/Sidebar.jsx';
import TopUtilityBar, { ToolbarCore } from '../../components/board/TopUtilityBar.jsx';
import SlideCanvas, { ZoomControls } from '../../components/board/SlideCanvas.jsx';
import ShareModal from '../../components/board/ShareModal.jsx';
import ElementContextMenu from '../../components/board/ElementContextMenu.jsx';
import CommentsDialog from '../../components/board/CommentsDialog.jsx';
import TaskPanel from '../../components/board/TaskPanel.jsx';
import TaskModal from '../../components/board/TaskModal.jsx';

export function PageSlider({ pages, activePageId, selectPage }) {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => {
          const idx = pages.findIndex((p) => p.id === activePageId);
          if (idx > 0) selectPage(pages[idx - 1].id);
        }}
        disabled={pages.findIndex((p) => p.id === activePageId) <= 0}
        className="text-content-muted hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-30 transition"
        title="Previous Subsection (Left Arrow)"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
      </button>

      <span className="text-sm font-semibold text-content min-w-[3rem] text-center select-none">
        {pages.findIndex((p) => p.id === activePageId) + 1} / {pages.length}
      </span>

      <button
        onClick={() => {
          const idx = pages.findIndex((p) => p.id === activePageId);
          if (idx < pages.length - 1) selectPage(pages[idx + 1].id);
        }}
        disabled={pages.findIndex((p) => p.id === activePageId) >= pages.length - 1}
        className="text-content-muted hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-30 transition"
        title="Next Subsection (Right Arrow)"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );
}

/**
 * The 3-pane discussion board: slide sidebar · top utility bar · slide canvas.
 * Owns transport (Yjs), the board↔React sync, role/permissions, presence
 * (awareness → peers + cursor broadcast), and the active slide / tool / select
 * state that the panes coordinate around.
 */
export default function BoardRoom() {
  const { id: boardId } = useParams();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const userData = useMemo(() => JSON.parse(localStorage.getItem('userData') || '{}'), []);

  const { ydoc, provider, synced, liveRole, accessRevoked } = useYjsBoard(boardId);
  const {
    pages,
    sections,
    elements,
    votes,
    comments,
    castPollVote,
    removePollVote,
    addComment,
    removeComment,
    addElement,
    updateElement,
    updateElementProps,
    bulkUpdate,
    removeElement,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    addPage,
    updatePage,
    renamePage,
    deletePage,
    movePage,
    ensureFirstPage,
    addSection,
    renameSection,
    deleteSection,
  } = useBoardSync(ydoc);

  // Per-user undo/redo: only reverses work this client authored.
  const { undo, redo, canUndo, canRedo } = useBoardHistory(ydoc);

  // ── Board metadata / role ───────────────────────────────────────────────
  const [board, setBoard] = useState(null);
  const [role, setRole] = useState(null); // null = unresolved / no access (mirrors backend deny-by-default)
  const [isEditingTitle, setEditTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  // owner/editor edit freely; commenter may only vote in polls; viewer is read-only.
  const editable = role === 'owner' || role === 'editor';
  const canVote = !!role && role !== 'viewer';
  // owner / editor / commenter may comment; viewers (and unresolved role) cannot.
  const canComment = !!role && role !== 'viewer';
  const canShare = role === 'owner'; // only the owner can invite / manage access
  const isEditingTitleRef = useRef(false);
  isEditingTitleRef.current = isEditingTitle;

  // ── Canvas / interaction state ──────────────────────────────────────────
  const [activePageId, setActivePageId] = useState(null);
  const [activeTool, setActiveTool] = useState('pointer');
  const [layoutMode, setLayoutMode] = useState('freeform');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [groupDragOffset, setGroupDragOffset] = useState(null);
  // Derive single selectedId for ConnectorLayer and editing compatibility
  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1024);
  const [presentationMode, setPresentationMode] = useState(false);
  const boardRoomRef = useRef(null);
  const [spawnProps, setSpawnProps] = useState(null); // holds extra props for next spawn (e.g., shapeType)

  // ── Zoom State ─────────────────────────────────────────────────────────────
  const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
  const [zoomMult, setZoomMult] = useState(1);
  const zoomIn = useCallback(() => setZoomMult(prev => ZOOM_STEPS.find(s => s > prev + 0.01) ?? 3), []);
  const zoomOut = useCallback(() => setZoomMult(prev => [...ZOOM_STEPS].reverse().find(s => s < prev - 0.01) ?? 0.25), []);
  const zoomFit = useCallback(() => setZoomMult(1), []);

  // Auto-collapse on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setSidebarCollapsed(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const onFullscreenChange = () => {
      setPresentationMode(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Slide keyboard navigation
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        const idx = pages.findIndex((p) => p.id === activePageId);
        if (idx < pages.length - 1) selectPage(pages[idx + 1].id);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        const idx = pages.findIndex((p) => p.id === activePageId);
        if (idx > 0) selectPage(pages[idx - 1].id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pages, activePageId]);

  const [connectFromId, setConnectFromId] = useState(null); // pending connector source
  const [contextMenu, setContextMenu] = useState(null); // { id, x, y } element right-click menu
  const [commentsForId, setCommentsForId] = useState(null); // element id whose comment thread is open

  // ── Tasks ────────────────────────────────────────────────────────────────
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false); // global task drawer
  const [openTaskId, setOpenTaskId] = useState(null); // task element whose modal is open
  const [taskFocusRequest, setTaskFocusRequest] = useState(null); // { id, nonce } pan-to request

  // ── Presence ─────────────────────────────────────────────────────────────
  const [peers, setPeers] = useState([]);
  const [photoMap, setPhotoMap] = useState({}); // email → profilePicture URL
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const activePageRef = useRef(activePageId);
  activePageRef.current = activePageId;

  const activePage = useMemo(
    () => pages.find((p) => p.id === activePageId) || null,
    [pages, activePageId],
  );

  const handleUpdateBackground = useCallback(
    (bg) => { if (activePageId) updatePage(activePageId, { background: bg }); },
    [activePageId, updatePage],
  );

  // All participants (owner + workspace members + board collaborators) with profile pics.
  // Mirrors the ShareModal loadAccess logic so the same set of people appears everywhere.
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!board?.id) return;
    const token = localStorage.getItem('token');

    const buildFromBoardOnly = () => {
      // No workspace: owner + explicit board collaborators, then bulk-fetch photos.
      const map = new Map();
      const add = (email, name, profilePicture = '') => {
        if (!email || map.has(email)) return;
        map.set(email, { email, name: name || email, profilePicture });
      };
      add(board.owner, board.owner === userData.email ? userData.name : board.owner);
      (board.collaborators || []).forEach((c) => add(c.email, c.name, c.profilePicture || ''));

      const emails = [...map.keys()].filter(Boolean);
      if (!emails.length) { setMembers([]); return; }

      fetch(`${BACKEND_URL}/users/profiles?emails=${emails.join(',')}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.ok ? r.json() : [])
        .then((profiles) => {
          profiles.forEach((p) => {
            const m = map.get(p.email);
            if (m) m.profilePicture = p.profilePicture || '';
          });
          setMembers([...map.values()]);
        })
        .catch(() => setMembers([...map.values()]));
    };

    if (board.workspace?.id) {
      fetch(`${BACKEND_URL}/workspaces/${board.workspace.id}/manage`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (!d) { buildFromBoardOnly(); return; }
          const ws = d.workspace || {};
          // Merge: workspace owner + members (viewer baseline) + board collaborators.
          const map = new Map();
          const add = (email, name, profilePicture = '') => {
            if (!email || map.has(email)) return;
            map.set(email, { email, name: name || email, profilePicture });
          };
          add(ws.owner, ws.ownerName || '', ws.ownerProfilePicture || '');
          (ws.members || []).forEach((m) => add(m.email, m.name, m.profilePicture || ''));
          // Board collaborators may have richer profile pics already; prefer existing entry.
          const b = (d.projects || []).find((x) => x.id === boardId);
          (b?.collaborators || board.collaborators || []).forEach((c) => {
            if (!map.has(c.email)) add(c.email, c.name, c.profilePicture || '');
          });
          setMembers([...map.values()]);
        })
        .catch(() => buildFromBoardOnly());
    } else {
      buildFromBoardOnly();
    }
  }, [board?.id, board?.workspace?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch board metadata + resolve role ───────────────────────────────────
  // The backend resolves the caller's effective role (owner / editor /
  // commenter / viewer) — including workspace-membership viewer baseline — and
  // returns the workspace this board lives in, so we can land the user there.
  useEffect(() => {
    if (!boardId) return;
    const token = localStorage.getItem('token');
    // Forward any signed share token from the URL so the backend can resolve the
    // role it grants (raises a link visitor above the public viewer baseline).
    const st = new URLSearchParams(window.location.search).get('st');
    const url = `${BACKEND_URL}/projects/${boardId}${st ? `?st=${encodeURIComponent(st)}` : ''}`;
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || 'Project not found');
        }
        return r.json();
      })
      .then((data) => {
        setBoard(data);
        setTitleInput(data.title || '');

        // Remember which workspace this board belongs to so the dashboard opens
        // there when the user navigates back (requirement: invitee lands on the
        // board's workspace).
        if (data.workspace?.id) {
          try { localStorage.setItem('activeWorkspaceId', data.workspace.id); } catch { /* ignore */ }
        }

        if (!data.myRole) {
          if (!token) { toast.error('Please login to access this project.', { id: 'auth-toast' }); navigate('/login'); return; }
          toast.error("You don't have access to this project.", { id: 'auth-toast' }); navigate('/dashboard'); return;
        }
        setRole(data.myRole);
      })
      .catch((err) => {
        toast.error(err.message || 'Project not found', { id: 'board-error-toast' });
        navigate('/dashboard');
      });
  }, [boardId, navigate]);

  // ── Live role changes (mid-session demotion / promotion) ──────────────────
  // The server re-resolves a peer's role the instant the owner changes their
  // access and pushes the new role over the WS. Apply it so the toolbar locks
  // (demotion) or unlocks (promotion) immediately, without a reload. The server
  // sends the WS-flavoured role where the owner is 'editor'; never downgrade a
  // local 'owner' (it shares the same edit rights and keeps the manage-access
  // controls the owner still needs).
  useEffect(() => {
    if (!liveRole) return;
    setRole((prev) => {
      if (prev === 'owner') return prev;
      if (prev === liveRole) return prev;
      const verb = liveRole === 'viewer' || (prev !== 'viewer' && liveRole === 'commenter')
        ? 'reduced' : 'updated';
      toast(`Your access to this project was ${verb} to ${liveRole}.`, { id: 'role-change-toast', icon: '🔒' });
      return liveRole;
    });
  }, [liveRole]);

  // ── Access revoked mid-session ────────────────────────────────────────────
  // The server closed our socket because we lost all access (removed as a
  // collaborator, board unpublished, etc.). Route back to the dashboard.
  useEffect(() => {
    if (!accessRevoked) return;
    toast.error('Your access to this project was revoked.', { id: 'access-revoked-toast' });
    navigate('/dashboard');
  }, [accessRevoked, navigate]);

  // ── Live title sync via ySystem map ──────────────────────────────────────
  // Observe remote title changes so renaming propagates to every open tab.
  useEffect(() => {
    if (!ydoc) return;
    const ySystem = ydoc.getMap('system');
    const onSystemChange = () => {
      const t = ySystem.get('title');
      if (!t) return;
      setBoard((b) => (b ? { ...b, title: t } : b));
      if (!isEditingTitleRef.current) setTitleInput(t);
    };
    ySystem.observe(onSystemChange);
    return () => ySystem.unobserve(onSystemChange);
  }, [ydoc]);

  // Seed: write the REST-fetched title into ySystem once (first editor in room).
  const sysTitleSeededRef = useRef(false);
  useEffect(() => {
    if (!ydoc || !synced || !board?.title || sysTitleSeededRef.current) return;
    const ySystem = ydoc.getMap('system');
    if (!ySystem.get('title')) {
      ydoc.transact(() => ySystem.set('title', board.title));
    }
    sysTitleSeededRef.current = true;
  }, [ydoc, synced, board?.title]);

  // ── On first sync: migrate a legacy tldraw board, else seed a first slide ──
  const seededRef = useRef(false);
  useEffect(() => {
    if (!synced || !ydoc || seededRef.current) return;
    if (editable) {
      const migrated = convertLegacyBoard(ydoc, userData.email || userData.name || 'import');
      if (migrated) {
        toast.success(`Imported ${migrated.migrated} item${migrated.migrated === 1 ? '' : 's'} from the old board`);
      } else if (pages.length === 0) {
        ensureFirstPage();
      }
    }
    seededRef.current = true;
  }, [synced, ydoc, editable, pages.length, ensureFirstPage, userData.email, userData.name]);

  // ── Keep an active slide selected ─────────────────────────────────────────
  useEffect(() => {
    if (pages.length === 0) { setActivePageId(null); return; }
    if (!activePageId || !pages.some((p) => p.id === activePageId)) {
      setActivePageId(pages[0].id);
    }
  }, [pages, activePageId]);

  // ── Presence: publish identity, collect peers ─────────────────────────────
  useEffect(() => {
    if (!provider) return;
    provider.awareness.setLocalStateField('user', {
      name: userData.name || userData.email || 'Anonymous',
      color: myColor,
      email: userData.email || '',
      profilePic: userData.profilePic || userData.profilePicture || '',
    });

    const update = () => {
      const list = [];
      provider.awareness.getStates().forEach((state, clientId) => {
        if (clientId === provider.awareness.clientID || !state?.user) return;
        list.push({ clientId, ...state.user, cursor: state.cursor });
      });
      setPeers(list);
    };
    provider.awareness.on('change', update);
    update();
    return () => provider.awareness.off('change', update);
  }, [provider, userData.name, userData.email, userData.profilePic, userData.profilePicture]);

  // ── Photo map: resolve profile pictures for all voters ────────────────────
  // Collect every unique voter email from the Yjs votes map, diff against what
  // we already have, and fetch only the missing ones from the backend.
  useEffect(() => {
    const allEmails = new Set();
    Object.values(votes).forEach(pollVotes => {
      Object.keys(pollVotes).forEach(email => allEmails.add(email));
    });
    const missing = [...allEmails].filter(e => !(e in photoMap));
    if (!missing.length) return;
    const token = localStorage.getItem('token');
    fetch(`${BACKEND_URL}/users/profiles?emails=${missing.join(',')}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : [])
      .then(profiles => {
        if (!profiles.length) return;
        setPhotoMap(prev => {
          const next = { ...prev };
          profiles.forEach(p => { next[p.email] = p.profilePicture || ''; });
          return next;
        });
      })
      .catch(() => {});
  }, [votes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drop our cursor when the tab is hidden so stale pointers don't linger.
  useEffect(() => {
    if (!provider) return;
    const onVis = () => { if (document.hidden) provider.awareness.setLocalStateField('cursor', null); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [provider]);

  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  const clipboardRef = useRef(null);

  const broadcastCursor = useCallback((x, y, isLaser = false) => {
    if (!provider) return;
    provider.awareness.setLocalStateField('cursor', {
      x, y,
      pageId: activePageRef.current,
      laser: isLaser,
    });
  }, [provider]);

  const clearCursor = useCallback(() => {
    if (provider) provider.awareness.setLocalStateField('cursor', null);
  }, [provider]);

  // ── Element creation ───────────────────────────────────────────────────────
  const nextZ = useCallback(() => {
    let max = 0;
    Object.values(elements).forEach((e) => {
      if (e.pageId === activePageRef.current && (e.z ?? 0) > max) max = e.z;
    });
    return max + 1;
  }, [elements]);

  const handleCreate = useCallback((type, x, y) => {
    const def = ELEMENT_DEFAULTS[type];
    if (!def || !activePageRef.current) return;
    const id = addElement({
      type,
      pageId: activePageRef.current,
      x: clamp(Math.round(x - def.w / 2), 0, SLIDE_W - def.w),
      y: clamp(Math.round(y - def.h / 2), 0, SLIDE_H - def.h),
      w: def.w,
      h: def.h,
      z: nextZ(),
      props: { ...def.props, ...(spawnProps || {}) },
      createdBy: userData.email || userData.name || 'anon',
    });
    setSelectedIds(new Set([id]));
    // Tasks have no inline editing — open the modal so the spawn can be filled
    // in. Everything else drops straight into text entry.
    if (type === 'task') setOpenTaskId(id);
    else setEditingId(id);
    // clear spawn override if it was a one-off selection
    if (spawnProps) setSpawnProps(null);
  }, [addElement, nextZ, userData.email, userData.name, spawnProps, setSpawnProps]);

  const handlePickShape = useCallback((shapeType) => {
    if (!shapeType) return;
    setSpawnProps({ shapeType });
    setActiveTool('shape');
  }, [setSpawnProps]);

  // ── Connector link-mode ────────────────────────────────────────────────────
  const handleConnectClick = useCallback((elementId) => {
    setConnectFromId((from) => {
      if (!from) return elementId; // pick the source
      if (from === elementId) return null; // clicking the source again cancels
      // Avoid duplicate edges between the same pair (either direction).
      const exists = Object.values(elements).some(
        (e) =>
          e.type === 'connector' &&
          ((e.props?.fromId === from && e.props?.toId === elementId) ||
            (e.props?.fromId === elementId && e.props?.toId === from)),
      );
      if (!exists) {
        addElement({
          type: 'connector',
          pageId: activePageRef.current,
          x: 0, y: 0, w: 0, h: 0,
          z: 0,
          props: { fromId: from, toId: elementId, fromAnchor: null, toAnchor: null },
          createdBy: userData.email || userData.name || 'anon',
        });
      }
      setActiveTool('pointer');
      return null;
    });
  }, [elements, addElement, userData.email, userData.name]);

  // Delete an element (or connector) and cascade-remove edges that referenced it.
  const handleDelete = useCallback((id) => {
    removeElement(id);
    Object.values(elements).forEach((e) => {
      if (e.type === 'connector' && (e.props?.fromId === id || e.props?.toId === id)) {
        removeElement(e.id);
      }
    });
    setSelectedIds((s) => { const n = new Set(s); n.delete(id); return n; });
    setEditingId((ed) => (ed === id ? null : ed));
  }, [removeElement, elements]);

  // Leaving the connector tool clears any half-built link.
  useEffect(() => {
    if (activeTool !== 'connector') setConnectFromId(null);
  }, [activeTool]);

  // ── Layering (right-click) ──────────────────────────────────────────────────
  const handleElementContextMenu = useCallback((id, x, y) => {
    setContextMenu({ id, x, y });
  }, []);

  const handleLayerAction = useCallback((mode) => {
    const id = contextMenu?.id;
    if (!id) return;
    if (mode === 'front') bringToFront(id);
    else if (mode === 'back') sendToBack(id);
    else if (mode === 'forward') bringForward(id);
    else if (mode === 'backward') sendBackward(id);
  }, [contextMenu, bringToFront, sendToBack, bringForward, sendBackward]);

  // Whether the menu's target is already at the top/bottom of its page stack,
  // so the menu can disable the no-op directions.
  const contextMenuFlags = useMemo(() => {
    const el = contextMenu && elements[contextMenu.id];
    if (!el) return { atFront: false, atBack: false };
    const siblings = Object.values(elements)
      .filter((e) => e.pageId === el.pageId && e.type !== 'connector')
      .sort((a, b) => (a.z ?? 0) - (b.z ?? 0) || (a.id < b.id ? -1 : 1));
    const idx = siblings.findIndex((s) => s.id === contextMenu.id);
    return { atFront: idx === siblings.length - 1, atBack: idx === 0 };
  }, [contextMenu, elements]);

  // Close the layering menu if its target disappears (deleted by anyone).
  useEffect(() => {
    if (contextMenu && !elements[contextMenu.id]) setContextMenu(null);
  }, [contextMenu, elements]);

  // ── Comments ────────────────────────────────────────────────────────────────
  const handleAddComment = useCallback((text) => {
    if (!commentsForId) return;
    addComment(commentsForId, text, {
      name: userData.name || userData.email,
      email: userData.email,
      color: myColor,
    });
  }, [commentsForId, addComment, userData.name, userData.email]);

  const handleRemoveComment = useCallback((commentId) => {
    if (!commentsForId) return;
    // The owner may delete anyone's comment; everyone else may only delete
    // their own. Enforced here (not just in the dialog's button visibility) so
    // the rule holds for any caller path.
    const comment = comments[commentsForId]?.[commentId];
    const mine = comment?.authorEmail && comment.authorEmail === userData.email;
    if (role !== 'owner' && !mine) return;
    removeComment(commentsForId, commentId);
  }, [commentsForId, comments, removeComment, role, userData.email]);

  // A short human label for the comment-dialog header, per element type.
  const commentTargetTitle = useMemo(() => {
    const el = commentsForId && elements[commentsForId];
    if (!el) return '';
    const p = el.props || {};
    const text = (p.text || p.title || p.question || p.caption || '').trim();
    const labels = { sticky: 'sticky note', task: 'task', text: 'text box', poll: 'poll', iframe: 'embed', shape: 'shape' };
    const kind = labels[el.type] || el.type;
    return text ? `${kind} “${text.slice(0, 40)}”` : `this ${kind}`;
  }, [commentsForId, elements]);

  // Close the comments dialog if its element is deleted by anyone.
  useEffect(() => {
    if (commentsForId && !elements[commentsForId]) setCommentsForId(null);
  }, [commentsForId, elements]);

  // ── Layout engine ──────────────────────────────────────────────────────────
  const applyLayout = useCallback((mode) => {
    setLayoutMode(mode);
    if (mode === 'freeform') return;
    const pageEls = Object.values(elements).filter(
      (e) => e.pageId === activePageRef.current && e.type !== 'connector',
    );
    bulkUpdate(arrangeElements(pageEls, mode));
  }, [elements, bulkUpdate]);

  const snapStep = layoutMode === 'grid' ? GRID_STEP : 0;

  // ── Task helpers ───────────────────────────────────────────────────────────
  // Every `task` element across the whole project (the global panel is not
  // per-slide). Sorted by creation-ish id for a stable order within groups.
  const tasks = useMemo(
    () => Object.values(elements).filter((e) => e.type === 'task'),
    [elements],
  );

  const openTask = elements[openTaskId] || null;
  const openTaskLocation = useMemo(
    () => (openTask ? resolveTaskLocation(openTask.pageId, pages, sections) : null),
    [openTask, pages, sections],
  );

  // Panel row click: switch to the task's page, pan the canvas to it, open modal.
  const handleSelectTaskFromPanel = useCallback((task) => {
    if (task.pageId && task.pageId !== activePageRef.current) {
      setActivePageId(task.pageId);
      setSelectedIds(new Set());
      setEditingId(null);
    }
    setOpenTaskId(task.id);
    setTaskFocusRequest({ id: task.id, nonce: Date.now() });
  }, []);

  // Quick-create from the panel: drop a task at the centre of the chosen page.
  const handleCreateTaskFromPanel = useCallback(({ title, status, pageId }) => {
    const def = ELEMENT_DEFAULTS.task;
    const id = addElement({
      type: 'task',
      pageId,
      x: Math.round((SLIDE_W - def.w) / 2),
      y: Math.round((SLIDE_H - def.h) / 2),
      w: def.w,
      h: def.h,
      z: 1,
      props: { ...def.props, title, status },
      createdBy: userData.email || userData.name || 'anon',
    });
    if (pageId !== activePageRef.current) {
      setActivePageId(pageId);
      setSelectedIds(new Set());
      setEditingId(null);
    }
    setOpenTaskId(id);
    setTaskFocusRequest({ id, nonce: Date.now() });
  }, [addElement, userData.email, userData.name]);

  // Close the task modal if its element is deleted by anyone.
  useEffect(() => {
    if (openTaskId && !elements[openTaskId]) setOpenTaskId(null);
  }, [openTaskId, elements]);

  // ── Keyboard: tool shortcuts, delete, escape ──────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
      if (e.key === 'Escape') { setSelectedIds(new Set()); setEditingId(null); setActiveTool('pointer'); return; }
      if (typing) return;
      // Undo / redo — ⌘/Ctrl+Z, with Shift (or Ctrl+Y) for redo.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        if (!editable) return;
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y')) {
        if (!editable) return;
        e.preventDefault();
        redo();
        return;
      }
      // Copy selected elements to clipboard
      if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C')) {
        if (selectedIds.size === 0) return;
        e.preventDefault();
        const toCopy = [...selectedIds]
          .map(id => elements[id])
          .filter(Boolean);
        if (toCopy.length > 0) clipboardRef.current = toCopy;
        return;
      }
      // Cut selected elements — copy to clipboard, then delete
      if ((e.metaKey || e.ctrlKey) && (e.key === 'x' || e.key === 'X')) {
        if (!editable || selectedIds.size === 0) return;
        e.preventDefault();
        const toCut = [...selectedIds]
          .map(id => elements[id])
          .filter(Boolean);
        if (toCut.length > 0) {
          clipboardRef.current = toCut;
          toCut.forEach(el => handleDelete(el.id));
          setSelectedIds(new Set());
        }
        return;
      }
      // Paste elements from clipboard
      if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')) {
        if (!editable || !clipboardRef.current || !activePageRef.current) return;
        e.preventDefault();
        const offset = 20;
        const newIds = [];
        const idMap = {}; // original id → pasted id, so connectors can re-link to the copies
        // Paste nodes before connectors so endpoint ids are already mapped.
        const ordered = [...clipboardRef.current].sort(
          (a, b) => (a.type === 'connector' ? 1 : 0) - (b.type === 'connector' ? 1 : 0),
        );
        ordered.forEach((el) => {
          let props = el.props;
          if (el.type === 'connector') {
            const p = el.props || {};
            // Re-point to the pasted copies; keep the original endpoint if it wasn't copied.
            props = { ...p, fromId: idMap[p.fromId] ?? p.fromId, toId: idMap[p.toId] ?? p.toId };
          }
          const newId = addElement({
            ...el,
            id: undefined,
            pageId: activePageRef.current,
            x: clamp(el.x + offset, 0, SLIDE_W - el.w),
            y: clamp(el.y + offset, 0, SLIDE_H - el.h),
            z: nextZ(),
            props,
          });
          if (newId) { idMap[el.id] = newId; newIds.push(newId); }
        });
        if (newIds.length > 0) setSelectedIds(new Set(newIds));
        return;
      }
      // Layer shortcuts: Cmd/Ctrl+] = bring forward, Cmd/Ctrl+[ = send backward
      if ((e.metaKey || e.ctrlKey) && (e.key === ']' || e.key === '[')) {
        if (!editable || selectedIds.size === 0) return;
        e.preventDefault();
        selectedIds.forEach(id => {
          if (e.key === ']') bringForward(id);
          else sendBackward(id);
        });
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0 && editable) {
        e.preventDefault();
        [...selectedIds].forEach(id => handleDelete(id));
        return;
      }
      const map = { 1: 'pointer', 2: 'sticky', 3: 'task', 4: 'text', 5: 'connector', 6: 'poll', 7: 'iframe', 8: 'shape', l: 'laser', L: 'laser' };
      if (map[e.key] && (editable || e.key === 'l' || e.key === 'L')) setActiveTool(map[e.key]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, editable, handleDelete, undo, redo, elements, addElement, nextZ, bringForward, sendBackward]);

  // Switching slides clears transient selection/edit.
  const selectPage = useCallback((id) => {
    setActivePageId(id);
    setSelectedIds(new Set());
    setEditingId(null);
  }, []);

  // ── Multi-select group drag ────────────────────────────────────────────────
  const handleSelectGroup = useCallback((ids) => {
    setSelectedIds(new Set(ids));
  }, []);

  const handleGroupDragPreview = useCallback((_anchorId, dx, dy) => {
    setGroupDragOffset({ dx, dy });
  }, []);

  const handleGroupDragCommit = useCallback((anchorId, dx, dy) => {
    const updates = [];
    selectedIds.forEach(id => {
      if (id === anchorId) return;
      const el = elements[id];
      if (!el) return;
      updates.push({
        id,
        x: clamp(el.x + dx, 0, SLIDE_W - el.w),
        y: clamp(el.y + dy, 0, SLIDE_H - el.h),
      });
    });
    if (updates.length) bulkUpdate(updates);
  }, [selectedIds, elements, bulkUpdate]);

  const handleGroupDragEnd = useCallback(() => {
    setGroupDragOffset(null);
  }, []);

  // ── Title save ─────────────────────────────────────────────────────────────
  const saveTitle = useCallback(async () => {
    if (!titleInput.trim() || titleInput === board?.title) { setEditTitle(false); return; }
    // Broadcast live to all open tabs via Yjs, then persist to Mongo for the dashboard.
    if (ydoc) ydoc.transact(() => ydoc.getMap('system').set('title', titleInput));
    setBoard((b) => ({ ...b, title: titleInput }));
    setEditTitle(false);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${BACKEND_URL}/projects/title/${boardId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleInput }),
      });
      if (!res.ok) throw new Error('Could not save the board title');
    } catch (e) {
      toast.error(e.message || 'Could not save the board title');
    }
  }, [titleInput, board, boardId, ydoc]);

  const handleSignOut = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    navigate('/login');
  }, [navigate]);

  // ── Loading gate ───────────────────────────────────────────────────────────
  if (!synced || !board || role === null) {
    return (
      <div ref={boardRoomRef} className="w-screen h-screen flex flex-col transition-colors duration-300 bg-app text-content">
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 border-4 border-edge rounded-full" />
            <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute inset-0" />
          </div>
          <div className="text-center">
            <p className="font-medium">Joining project…</p>
            <p className="text-content-muted text-sm mt-1">Syncing with collaborators</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={boardRoomRef} className={`${boardShellClass} flex flex-col w-screen h-screen text-content`} onClick={() => showUserMenu && setShowUserMenu(false)}>
      {!presentationMode && (
        <TopUtilityBar
          board={board}
          role={role}
          editable={editable}
          isEditingTitle={isEditingTitle}
          titleInput={titleInput}
          setTitleInput={setTitleInput}
          saveTitle={saveTitle}
          setEditTitle={setEditTitle}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          onPickShape={handlePickShape}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          layoutMode={layoutMode}
          onSelectLayout={applyLayout}
          peers={peers}
          userData={userData}
          showUserMenu={showUserMenu}
          setShowUserMenu={setShowUserMenu}
          navigate={navigate}
          onSignOut={handleSignOut}
          canShare={canShare}
          onShare={() => setShowShare(true)}
          onToggleTasks={() => setIsTaskPanelOpen((o) => !o)}
          tasksOpen={isTaskPanelOpen}
          isDark={isDark}
          toggleTheme={toggleTheme}
          activePage={activePage}
          onUpdateBackground={handleUpdateBackground}
          onPresent={() => boardRoomRef.current?.requestFullscreen().catch(e => console.error(e))}
        />
      )}

      {presentationMode && (
        <div className="w-full flex justify-center pt-4 pb-2 shrink-0 z-[60]">
          <div className="dark flex items-center gap-4 bg-surface/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-edge text-content">
            <ToolbarCore
              activeTool={activeTool}
              onSelectTool={setActiveTool}
              editable={editable}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              activePage={activePage}
              onUpdateBackground={handleUpdateBackground}
              isDark={true}
              presentationMode={true}
            />
            <div className="h-6 w-px bg-edge" />
            <PageSlider pages={pages} activePageId={activePageId} selectPage={selectPage} />
            <div className="h-6 w-px bg-edge" />
            <ZoomControls zoomMult={zoomMult} setZoomMult={setZoomMult} zoomIn={zoomIn} zoomOut={zoomOut} zoomFit={zoomFit} />
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0 relative">
        {!presentationMode && (
          <Sidebar
            pages={pages}
            sections={sections}
            activePageId={activePageId}
            editable={editable}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            onSelectPage={selectPage}
            onAddPage={(sectionId) => { const id = addPage(undefined, sectionId); if (id) selectPage(id); }}
            onRenamePage={renamePage}
            onDeletePage={deletePage}
            onMovePage={movePage}
            onAddSection={() => addSection()}
            onRenameSection={renameSection}
            onDeleteSection={deleteSection}
          />
        )}

        <div className="flex-1 relative min-w-0 flex flex-col">
          <SlideCanvas
            elements={elements}
            activePageId={activePageId}
            editable={editable}
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            onToolConsumed={() => setActiveTool('pointer')}
            selectedId={selectedId}
            editingId={editingId}
            selectedIds={selectedIds}
            onSelect={(id) => setSelectedIds(id ? new Set([id]) : new Set())}
            onToggleSelect={(id) => setSelectedIds((prev) => {
              const n = new Set(prev);
              if (n.has(id)) n.delete(id); else n.add(id);
              return n;
            })}
            onSelectGroup={handleSelectGroup}
            groupDragOffset={groupDragOffset}
            onGroupDragPreview={handleGroupDragPreview}
            onGroupDragCommit={handleGroupDragCommit}
            onGroupDragEnd={handleGroupDragEnd}
            onStartEdit={setEditingId}
            onStopEdit={() => setEditingId(null)}
            onUpdate={updateElement}
            onUpdateProps={updateElementProps}
            onDelete={handleDelete}
            onElementContextMenu={handleElementContextMenu}
            onOpenTask={setOpenTaskId}
            onCreate={handleCreate}
            peers={peers}
            onCursor={broadcastCursor}
            onCursorLeave={clearCursor}
            connectFromId={connectFromId}
            onConnectClick={handleConnectClick}
            onConnectCancel={() => setConnectFromId(null)}
            snapStep={snapStep}
            focusRequest={taskFocusRequest}
            votes={votes}
            castPollVote={castPollVote}
            removePollVote={removePollVote}
            canVote={canVote}
            canComment={canComment}
            comments={comments}
            onOpenComments={setCommentsForId}
            boardId={boardId}
            members={members}
            photoMap={photoMap}
            activePage={activePage}
            isDark={isDark}
            zoomMult={zoomMult}
            setZoomMult={setZoomMult}
            zoomIn={zoomIn}
            zoomOut={zoomOut}
            zoomFit={zoomFit}
            presentationMode={presentationMode}
          />

          {/* Slide Navigation (Bottom Center) */}
          {!presentationMode && (
            <div className="absolute bottom-6 left-4 sm:left-1/2 sm:-translate-x-1/2 flex items-center gap-4 bg-surface/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-edge z-50">
              <PageSlider pages={pages} activePageId={activePageId} selectPage={selectPage} />
            </div>
          )}

          {/* Global task viewer — a right-side drawer, always mounted, toggled */}
          {!presentationMode && (
            <TaskPanel
              open={isTaskPanelOpen}
              onClose={() => setIsTaskPanelOpen(false)}
              tasks={tasks}
              pages={pages}
              sections={sections}
              members={members}
              editable={editable}
              activePageId={activePageId}
              onSelectTask={handleSelectTaskFromPanel}
              onCreateTask={handleCreateTaskFromPanel}
            />
          )}
        </div>
      </div>

      {contextMenu && (editable || canComment) && (
        <ElementContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          atFront={contextMenuFlags.atFront}
          atBack={contextMenuFlags.atBack}
          onAction={handleLayerAction}
          canLayer={editable}
          canComment={canComment}
          commentCount={Object.keys(comments[contextMenu.id] || {}).length}
          onComment={() => setCommentsForId(contextMenu.id)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {commentsForId && (
        <CommentsDialog
          elementTitle={commentTargetTitle}
          thread={comments[commentsForId] || {}}
          canComment={canComment}
          currentEmail={userData.email || ''}
          isOwner={role === 'owner'}
          onAdd={handleAddComment}
          onDelete={handleRemoveComment}
          onClose={() => setCommentsForId(null)}
        />
      )}

      {showShare && (
        <ShareModal
          boardId={boardId}
          board={board}
          workspace={board?.workspace}
          onClose={() => setShowShare(false)}
        />
      )}

      {openTask && (
        <TaskModal
          element={openTask}
          location={openTaskLocation}
          members={members}
          editable={editable}
          currentEmail={userData.email || ''}
          onUpdate={(patch) => updateElementProps(openTask.id, patch)}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </div>
  );
}
