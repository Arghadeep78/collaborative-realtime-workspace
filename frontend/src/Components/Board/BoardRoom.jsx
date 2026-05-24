import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useYjsBoard } from '../../crdt/useYjsBoard.js';
import { useBoardSync } from './useBoardSync.js';
import { convertLegacyBoard } from './convertLegacyBoard.js';
import { arrangeElements } from './layout.js';
import { BACKEND_URL } from '../../constants/apiConfig.js';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { ELEMENT_DEFAULTS, GRID_STEP, SLIDE_W, SLIDE_H, clamp, myColor, boardShellClass } from './boardConstants.js';

import Sidebar from './Sidebar.jsx';
import TopUtilityBar from './TopUtilityBar.jsx';
import SlideCanvas from './SlideCanvas.jsx';
import ShareModal from './ShareModal.jsx';

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

  const { ydoc, provider, synced } = useYjsBoard(boardId);
  const {
    pages,
    elements,
    votes,
    castPollVote,
    removePollVote,
    addElement,
    updateElement,
    updateElementProps,
    bulkUpdate,
    removeElement,
    bringToFront,
    addPage,
    updatePage,
    renamePage,
    deletePage,
    ensureFirstPage,
  } = useBoardSync(ydoc);

  // ── Board metadata / role ───────────────────────────────────────────────
  const [board, setBoard] = useState(null);
  const [role, setRole] = useState('editor');
  const [isEditingTitle, setEditTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const editable = role === 'editor';

  // ── Canvas / interaction state ──────────────────────────────────────────
  const [activePageId, setActivePageId] = useState(null);
  const [activeTool, setActiveTool] = useState('pointer');
  const [layoutMode, setLayoutMode] = useState('freeform');
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1024);
  const [presentationMode, setPresentationMode] = useState(false);
  const boardRoomRef = useRef(null);

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
  const [graduationTargetId, setGraduationTargetId] = useState(null); // kanban drop target

  // ── Presence ─────────────────────────────────────────────────────────────
  const [peers, setPeers] = useState([]);
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

  // Assignable people for Kanban cards: the board's owner + collaborators.
  const members = useMemo(() => {
    if (!board) return [];
    const list = [];
    const seen = new Set();
    const push = (email, name) => {
      if (!email || seen.has(email)) return;
      seen.add(email);
      list.push({ email, name: name || email });
    };
    push(board.owner, board.owner === userData.email ? userData.name : board.owner);
    board.collaborators?.forEach((c) => push(c.email));
    return list;
  }, [board, userData.email, userData.name]);

  // ── Fetch board metadata + resolve role ───────────────────────────────────
  useEffect(() => {
    if (!boardId) return;
    fetch(`${BACKEND_URL}/boards/${boardId}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || 'Board not found');
        }
        return r.json();
      })
      .then((data) => {
        setBoard(data);
        setTitleInput(data.title || '');
        const email = userData.email;
        const token = localStorage.getItem('token');

        if (!data.isPublic) {
          if (!token) { toast.error('Please login to access this board.', { id: 'auth-toast' }); navigate('/login'); return; }
          const isOwner = data.owner === email;
          const isCollab = data.collaborators?.some((c) => c.email === email);
          if (!isOwner && !isCollab) { toast.error("You don't have access to this private board.", { id: 'auth-toast' }); navigate('/dashboard'); return; }
        }

        if (data.owner === email) setRole('editor');
        else {
          const collab = data.collaborators?.find((c) => c.email === email);
          if (collab) setRole(collab.role);
          else if (data.isPublic) setRole(data.publicRole || 'viewer');
        }
      })
      .catch((err) => {
        toast.error(err.message || 'Board not found', { id: 'board-error-toast' });
        navigate('/dashboard');
      });
  }, [boardId, navigate, userData.email]);

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
  }, [provider, userData.name, userData.email]);

  // Drop our cursor when the tab is hidden so stale pointers don't linger.
  useEffect(() => {
    if (!provider) return;
    const onVis = () => { if (document.hidden) provider.awareness.setLocalStateField('cursor', null); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [provider]);

  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

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
      props: { ...def.props },
      createdBy: userData.email || userData.name || 'anon',
    });
    setSelectedId(id);
    setEditingId(id); // drop straight into text entry
  }, [addElement, nextZ, userData.email, userData.name]);

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
    setSelectedId((s) => (s === id ? null : s));
    setEditingId((ed) => (ed === id ? null : ed));
  }, [removeElement, elements]);

  // Leaving the connector tool clears any half-built link.
  useEffect(() => {
    if (activeTool !== 'connector') setConnectFromId(null);
  }, [activeTool]);

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

  // ── Graduation drag (sticky → kanban card) ─────────────────────────────────
  // While a sticky is dragged, highlight the kanban card it most overlaps.
  const handleDragMove = useCallback((id, x, y) => {
    const dragged = elements[id];
    if (!dragged || dragged.type !== 'sticky') {
      setGraduationTargetId((p) => (p ? null : p));
      return;
    }
    let bestId = null;
    let bestArea = 0;
    Object.values(elements).forEach((e) => {
      if (e.type !== 'kanban' || e.pageId !== dragged.pageId) return;
      const ix = Math.max(0, Math.min(x + dragged.w, e.x + e.w) - Math.max(x, e.x));
      const iy = Math.max(0, Math.min(y + dragged.h, e.y + e.h) - Math.max(y, e.y));
      const area = ix * iy;
      if (area > bestArea) { bestArea = area; bestId = e.id; }
    });
    const target = bestArea > 0.15 * dragged.w * dragged.h ? bestId : null;
    setGraduationTargetId((p) => (p === target ? p : target));
  }, [elements]);

  // On drop onto a card, convert the sticky into a kanban card (text → title),
  // re-pointing any connectors from the sticky to the new card.
  const handleDragEnd = useCallback((id, x, y) => {
    const dragged = elements[id];
    if (dragged?.type === 'sticky' && graduationTargetId) {
      const title = dragged.props?.text || '';
      const newId = addElement({
        type: 'kanban',
        pageId: dragged.pageId,
        x: clamp(x, 0, SLIDE_W - ELEMENT_DEFAULTS.kanban.w),
        y: clamp(y, 0, SLIDE_H - ELEMENT_DEFAULTS.kanban.h),
        w: ELEMENT_DEFAULTS.kanban.w,
        h: ELEMENT_DEFAULTS.kanban.h,
        z: nextZ(),
        props: { ...ELEMENT_DEFAULTS.kanban.props, title },
        createdBy: userData.email || userData.name || 'anon',
      });
      Object.values(elements).forEach((e) => {
        if (e.type !== 'connector') return;
        const p = e.props || {};
        if (p.fromId === id || p.toId === id) {
          updateElementProps(e.id, {
            fromId: p.fromId === id ? newId : p.fromId,
            toId: p.toId === id ? newId : p.toId,
          });
        }
      });
      removeElement(id);
      setSelectedId(newId);
    }
    setGraduationTargetId(null);
  }, [elements, graduationTargetId, addElement, removeElement, updateElementProps, nextZ, userData.email, userData.name]);

  // ── Keyboard: tool shortcuts, delete, escape ──────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
      if (e.key === 'Escape') { setSelectedId(null); setEditingId(null); setActiveTool('pointer'); return; }
      if (typing) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && editable) {
        e.preventDefault();
        handleDelete(selectedId);
        return;
      }
      const map = { 1: 'pointer', 2: 'sticky', 3: 'kanban', 4: 'text', 5: 'connector', 6: 'poll', 7: 'iframe', 8: 'shape', l: 'laser', L: 'laser' };
      if (map[e.key] && (editable || e.key === 'l' || e.key === 'L')) setActiveTool(map[e.key]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, editable, handleDelete]);

  // Switching slides clears transient selection/edit.
  const selectPage = useCallback((id) => {
    setActivePageId(id);
    setSelectedId(null);
    setEditingId(null);
  }, []);

  // ── Title save ─────────────────────────────────────────────────────────────
  const saveTitle = useCallback(async () => {
    if (!titleInput.trim() || titleInput === board?.title) { setEditTitle(false); return; }
    const token = localStorage.getItem('token');
    await fetch(`${BACKEND_URL}/boards/title/${boardId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleInput }),
    });
    setBoard((b) => ({ ...b, title: titleInput }));
    setEditTitle(false);
  }, [titleInput, board, boardId]);

  const handleSignOut = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    navigate('/login');
  }, [navigate]);

  // ── Loading gate ───────────────────────────────────────────────────────────
  if (!synced) {
    return (
    <div ref={boardRoomRef} className={`w-screen h-screen flex flex-col transition-colors duration-300 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-14 h-14 border-4 border-slate-200 dark:border-slate-700 rounded-full" />
          <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute inset-0" />
        </div>
        <div className="text-center">
          <p className="font-medium">Joining board…</p>
          <p className="text-slate-500 text-sm mt-1">Syncing with collaborators</p>
        </div>
      </div>
    </div>
    );
  }

  return (
    <div ref={boardRoomRef} className={`${boardShellClass} flex flex-col w-screen h-screen ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`} onClick={() => showUserMenu && setShowUserMenu(false)}>
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
        layoutMode={layoutMode}
        onSelectLayout={applyLayout}
        peers={peers}
        userData={userData}
        showUserMenu={showUserMenu}
        setShowUserMenu={setShowUserMenu}
        navigate={navigate}
        onSignOut={handleSignOut}
        onShare={() => setShowShare(true)}
        isDark={isDark}
        toggleTheme={toggleTheme}
        activePage={activePage}
        onUpdateBackground={handleUpdateBackground}
        onPresent={() => boardRoomRef.current?.requestFullscreen().catch(e => console.error(e))}
      />
      )}

      <div className="flex-1 flex min-h-0 relative">
        {!presentationMode && (
          <Sidebar
          pages={pages}
          elements={elements}
          activePageId={activePageId}
          editable={editable}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onSelectPage={selectPage}
          onAddPage={() => { const id = addPage(); if (id) selectPage(id); }}
          onRenamePage={renamePage}
          onDeletePage={deletePage}
          />
        )}

        <div className="flex-1 relative min-w-0 flex flex-col">
          <SlideCanvas
            ydoc={ydoc}
          elements={elements}
          activePageId={activePageId}
          editable={editable}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          onToolConsumed={() => setActiveTool('pointer')}
          selectedId={selectedId}
          editingId={editingId}
          onSelect={setSelectedId}
          onStartEdit={setEditingId}
          onStopEdit={() => setEditingId(null)}
          onUpdate={updateElement}
          onUpdateProps={updateElementProps}
          onDelete={handleDelete}
          onBringToFront={bringToFront}
          onCreate={handleCreate}
          peers={peers}
          onCursor={broadcastCursor}
          onCursorLeave={clearCursor}
          connectFromId={connectFromId}
          onConnectClick={handleConnectClick}
          onConnectCancel={() => setConnectFromId(null)}
          snapStep={snapStep}
          graduationTargetId={graduationTargetId}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          votes={votes}
          castPollVote={castPollVote}
          removePollVote={removePollVote}
          boardId={boardId}
          members={members}
          activePage={activePage}
          isDark={isDark}
          />

          {/* Slide Navigation (Bottom Center) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 z-50">
            <button
              onClick={() => {
                const idx = pages.findIndex((p) => p.id === activePageId);
                if (idx > 0) selectPage(pages[idx - 1].id);
              }}
              disabled={pages.findIndex((p) => p.id === activePageId) <= 0}
              className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-30 disabled:hover:text-slate-600 transition"
              title="Previous Slide (Left Arrow)"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-[3rem] text-center select-none">
              {pages.findIndex((p) => p.id === activePageId) + 1} / {pages.length}
            </span>
            
            <button
              onClick={() => {
                const idx = pages.findIndex((p) => p.id === activePageId);
                if (idx < pages.length - 1) selectPage(pages[idx + 1].id);
              }}
              disabled={pages.findIndex((p) => p.id === activePageId) >= pages.length - 1}
              className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-30 disabled:hover:text-slate-600 transition"
              title="Next Slide (Right Arrow)"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </div>

      {showShare && <ShareModal boardId={boardId} board={board} onClose={() => setShowShare(false)} />}
    </div>
  );
}
