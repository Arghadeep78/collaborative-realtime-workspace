import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tldraw, DefaultColorStyle, DefaultSizeStyle, DefaultDashStyle, DefaultFillStyle, GeoShapeGeoStyle, exportAs } from '@tldraw/tldraw';
import { FixedNoteShapeUtil } from './FixedNoteShapeUtil.js';
import '@tldraw/tldraw/tldraw.css';
import toast from 'react-hot-toast';
import { useYjsBoard } from '../../crdt/useYjsBoard.js';
import { BACKEND_URL } from '../../constants/apiConfig.js';
import AIPanel from './AIPanel.jsx';
import ShareModal from './ShareModal.jsx';
import CustomGrid from './CustomGrid.jsx';
import Overlays from './Overlays.jsx';
import LeftToolbar from './LeftToolbar.jsx';
import ContextToolbar from './ContextToolbar.jsx';
import TopBar from './TopBar.jsx';
import { useWhiteboardSync } from './useWhiteboardSync.js';
import { UI, myColor, ZOOM_MIN, ZOOM_MAX, clamp, boardShellClass, tldrawHostClass } from './whiteboardConstants.js';

export default function WhiteboardRoom() {
  const { id: boardId } = useParams();
  const { ydoc, provider, synced } = useYjsBoard(boardId);
  const navigate = useNavigate();
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');

  // ── Board / role ──────────────────────────────────────────────────────────
  const [board, setBoard] = useState(null);
  const [role, setRole] = useState('editor');

  // ── Title editing ─────────────────────────────────────────────────────────
  const [isEditingTitle, setEditTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  // ── Peers / presence ─────────────────────────────────────────────────────
  const [peers, setPeers] = useState([]);
  const [presenceTick, setPresenceTick] = useState(Date.now());
  const [followUserId, setFollowUserId] = useState(null);

  // ── Editor refs ───────────────────────────────────────────────────────────
  const editorRef = useRef(null);
  const [editorReady, setEditorReady] = useState(false);

  // ── UI panels ─────────────────────────────────────────────────────────────
  const [showAI, setShowAI] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // ── Toolbar state ─────────────────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState('draw');
  const [activeColor, setActiveColor] = useState('blue');
  const [activeSize, setActiveSize] = useState('m');
  const [activeDash, setActiveDash] = useState('draw');
  const [activeFill, setActiveFill] = useState('none');
  const [activeShape, setActiveShape] = useState('rectangle');
  const [activeTextFont, setActiveTextFont] = useState('sans');
  const [activeTextAlign, setActiveTextAlign] = useState('start');
  const toolbarRef = useRef(null);

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);

  // ── Collaborative features ────────────────────────────────────────────────
  const [votes, setVotes] = useState({});
  const [myVotes, setMyVotes] = useState({});
  const [comments, setComments] = useState([]);
  const [commenting, setCommenting] = useState(false);
  const [newCommentPos, setNewCommentPos] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [timer, setTimer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerExpired, setTimerExpired] = useState(false);
  const [isSpotlighting, setIsSpotlighting] = useState(false);

  // ── Internal refs ─────────────────────────────────────────────────────────
  const followUserIdRef = useRef(null);
  const isApplyingFollowRef = useRef(false);
  const cursorRafRef = useRef(null);
  const lastPointerRef = useRef({ screenX: 0, screenY: 0, viewportX: 0, viewportY: 0, active: false });
  const cameraBroadcastRef = useRef(null);
  const spotlightTimerRef = useRef(null);
  const spotlightIntervalRef = useRef(null);
  const cameraStorageKey = boardId ? `board-camera:${boardId}` : null;

  const canEdit = role === 'editor';
  const canComment = role !== 'viewer';

  // ── CRDT sync ─────────────────────────────────────────────────────────────
  const { bindStore } = useWhiteboardSync({ ydoc, editorRef, setTimer, setVotes, setComments });

  // ── Keep followUserIdRef in sync ──────────────────────────────────────────
  useEffect(() => { followUserIdRef.current = followUserId; }, [followUserId]);

  // ── Presence tick (cursor staleness) ──────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setPresenceTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Fetch board metadata ──────────────────────────────────────────────────
  useEffect(() => {
    if (!boardId) return;
    fetch(`${BACKEND_URL}/boards/${boardId}`)
      .then(async r => {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.error || 'Board not found');
        }
        return r.json();
      })
      .then(data => {
        setBoard(data);
        setTitleInput(data.title || '');
        const token = localStorage.getItem('token');
        const localUser = JSON.parse(localStorage.getItem('userData') || '{}');
        const email = localUser.email;

        if (!data.isPublic) {
          if (!token) { toast.error("Please login to access this board."); navigate('/login'); return; }
          const isOwner = data.owner === email;
          const isCollab = data.collaborators?.some(c => c.email === email);
          if (!isOwner && !isCollab) { toast.error("You don't have access to this private board."); navigate('/dashboard'); return; }
        }

        if (data.owner === email) {
          setRole('editor');
        } else {
          const collab = data.collaborators?.find(c => c.email === email);
          if (collab) setRole(collab.role);
          else if (data.isPublic) setRole(data.publicRole || 'viewer');
        }
      })
      .catch(err => {
        console.error(err);
        toast.error(err.message || "Board not found");
        navigate('/dashboard');
      });
  }, [boardId, navigate]);

  // ── Camera persistence ────────────────────────────────────────────────────
  const persistCamera = useCallback((camera) => {
    if (!cameraStorageKey || !camera) return;
    try { localStorage.setItem(cameraStorageKey, JSON.stringify(camera)); } catch (_) {}
  }, [cameraStorageKey]);

  const restoreCamera = useCallback((editor) => {
    if (!cameraStorageKey || !editor) return;
    const raw = localStorage.getItem(cameraStorageKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (typeof saved?.x === 'number' && typeof saved?.y === 'number' && typeof saved?.z === 'number') {
        editor.setCamera(saved, { immediate: true });
        setZoom(saved.z);
      }
    } catch (_) {}
  }, [cameraStorageKey]);

  // ── Follow / spotlight ────────────────────────────────────────────────────
  const stopFollowing = useCallback(() => {
    setFollowUserId(null);
    if (editorRef.current) editorRef.current.setCameraOptions({ isLocked: false });
  }, []);

  const toggleFollow = useCallback((clientId) => {
    setFollowUserId(prev => prev === clientId ? null : clientId);
  }, []);

  // ── Pointer tracking ──────────────────────────────────────────────────────
  const handlePointerMove = useCallback((e) => {
    const editor = editorRef.current;
    if (!editor) return;
    const viewport = editor.getViewportScreenBounds();
    lastPointerRef.current = { screenX: e.clientX, screenY: e.clientY, viewportX: e.clientX - viewport.x, viewportY: e.clientY - viewport.y, active: true };

    if (!provider) return;
    if (cursorRafRef.current) return;
    cursorRafRef.current = requestAnimationFrame(() => {
      cursorRafRef.current = null;
      if (!editorRef.current) return;
      const pt = editorRef.current.screenToPage({ x: lastPointerRef.current.screenX, y: lastPointerRef.current.screenY });
      provider.awareness.setLocalStateField('cursor', { x: pt.x, y: pt.y, lastMove: Date.now() });
    });
  }, [provider]);

  const handlePointerLeave = useCallback(() => {
    lastPointerRef.current.active = false;
    if (provider) provider.awareness.setLocalStateField('cursor', null);
  }, [provider]);

  const handleLocalInteraction = useCallback(() => {
    if (followUserIdRef.current) stopFollowing();
  }, [stopFollowing]);

  const getZoomPoint = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return null;
    if (lastPointerRef.current.active) return { x: lastPointerRef.current.viewportX, y: lastPointerRef.current.viewportY };
    return editor.getViewportScreenCenter();
  }, []);

  // ── Presence: awareness → peers list ─────────────────────────────────────
  useEffect(() => {
    if (!provider) return;
    const localUser = JSON.parse(localStorage.getItem('userData') || '{}');
    provider.awareness.setLocalStateField('user', {
      name: localUser.name || localUser.email || 'Anonymous',
      color: myColor,
      email: localUser.email || '',
      role,
    });

    const updatePeers = () => {
      const states = [];
      let shouldFollow = null;
      provider.awareness.getStates().forEach((state, clientId) => {
        if (clientId !== provider.awareness.clientID && state?.user) {
          states.push({ clientId, ...state.user, cursor: state.cursor, camera: state.camera });
        }
        if (clientId !== provider.awareness.clientID && state?.followMe) {
          if (!shouldFollow || state.followMe.time > shouldFollow.time) shouldFollow = state.followMe;
        }
      });
      setPeers(states);

      if (shouldFollow) {
        if (followUserIdRef.current) setFollowUserId(null);
        if (editorRef.current && shouldFollow.camera) {
          editorRef.current.setCameraOptions({ isLocked: true });
          editorRef.current.setCamera(shouldFollow.camera, { animation: { duration: 200 } });
        }
        return;
      }

      if (followUserIdRef.current && editorRef.current) {
        const target = states.find(s => s.clientId === followUserIdRef.current);
        if (target && target.camera) {
          const age = Date.now() - (target.camera.time || 0);
          if (age < 10000) {
            try {
              isApplyingFollowRef.current = true;
              editorRef.current.setCameraOptions({ isLocked: true });
              editorRef.current.setCamera(target.camera);
              setZoom(editorRef.current.getCamera().z);
            } finally {
              isApplyingFollowRef.current = false;
            }
            return;
          }
        }
        return;
      }

      if (editorRef.current && !followUserIdRef.current) {
        editorRef.current.setCameraOptions({ isLocked: false });
      }
    };

    provider.awareness.on('change', updatePeers);
    return () => provider.awareness.off('change', updatePeers);
  }, [provider, role]);

  useEffect(() => {
    if (!provider) return;
    const handleVisibility = () => {
      if (document.hidden) provider.awareness.setLocalStateField('cursor', null);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [provider]);

  // ── Apply camera when starting to follow a peer ───────────────────────────
  useEffect(() => {
    if (!followUserId || !editorRef.current) return;
    const target = peers.find(p => p.clientId === followUserId);
    if (!target || !target.camera) { stopFollowing(); return; }
    const editor = editorRef.current;
    isApplyingFollowRef.current = true;
    editor.setCameraOptions({ isLocked: true });
    editor.setCamera({ x: target.camera.x, y: target.camera.y, z: target.camera.z }, { immediate: true });
    setZoom(editor.getCamera().z);
    isApplyingFollowRef.current = false;
  }, [followUserId, peers, stopFollowing]);

  // ── Camera broadcast (spotlight / follow) ────────────────────────────────
  useEffect(() => {
    if (!editorReady || !provider || !editorRef.current) return;
    const editor = editorRef.current;

    const pushCamera = () => {
      if (!provider || !editorRef.current) return;
      const cam = editorRef.current.getCamera();
      provider.awareness.setLocalStateField('camera', { x: cam.x, y: cam.y, z: cam.z, time: Date.now() });
    };

    const startBroadcast = () => {
      if (cameraBroadcastRef.current) return;
      pushCamera();
      cameraBroadcastRef.current = setInterval(pushCamera, 200);
    };

    const stopBroadcast = () => {
      if (cameraBroadcastRef.current) { clearInterval(cameraBroadcastRef.current); cameraBroadcastRef.current = null; }
    };

    const handleCameraStart = () => { if (!isApplyingFollowRef.current && !followUserIdRef.current) startBroadcast(); };
    const handleCameraEnd = () => {
      if (!isApplyingFollowRef.current && !followUserIdRef.current) {
        stopBroadcast();
        const cam = editor.getCamera();
        persistCamera(cam);
        setZoom(cam.z);
        pushCamera();
      }
    };

    const unsubStart = editor.performance.on('camera-start', handleCameraStart);
    const unsubEnd = editor.performance.on('camera-end', handleCameraEnd);
    pushCamera();
    persistCamera(editor.getCamera());

    return () => { unsubStart(); unsubEnd(); stopBroadcast(); };
  }, [editorReady, provider, persistCamera]);

  // ── Spotlight cleanup ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimeout(spotlightTimerRef.current);
      clearInterval(spotlightIntervalRef.current);
    };
  }, []);

  // ── Timer countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!timer || !timer.endTime) { setTimeLeft(null); setTimerExpired(false); return; }
    const interval = setInterval(() => {
      const remaining = Math.max(0, timer.endTime - Date.now());
      if (remaining === 0) {
        clearInterval(interval);
        setTimeLeft('00:00');
        setTimerExpired(true);
        setTimeout(() => { setTimerExpired(false); setTimeLeft(null); setTimer(null); }, 5000);
      } else {
        const m = Math.floor(remaining / 60000).toString().padStart(2, '0');
        const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
        setTimeLeft(`${m}:${s}`);
        setTimerExpired(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // ── Escape key handler ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (newCommentPos) { setNewCommentPos(null); setNewCommentText(''); }
        else if (commenting) setCommenting(false);
        setShowTimerPicker(false);
        setShowUserMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commenting, newCommentPos]);

  // Reset comment mode if role drops to viewer
  useEffect(() => {
    if (!canComment && commenting) { setCommenting(false); setNewCommentPos(null); setNewCommentText(''); }
  }, [canComment, commenting]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleToolSelect = (tool) => {
    setActiveTool(tool);
    if (editorRef.current) {
      if (tool !== 'select' && tool !== 'eraser' && tool !== 'hand') editorRef.current.selectNone();
      editorRef.current.setCurrentTool(tool);
      editorRef.current.updateInstanceState({ isToolLocked: true });
    }
  };

  const handleUndo = () => editorRef.current?.undo();
  const handleRedo = () => editorRef.current?.redo();

  const applyEditorStyle = (prop, value) => {
    const editor = editorRef.current;
    if (!editor) return;
    const styleMap = { color: DefaultColorStyle, size: DefaultSizeStyle, dash: DefaultDashStyle, fill: DefaultFillStyle };
    const style = styleMap[prop];
    if (style) { editor.setStyleForNextShapes(style, value); editor.setStyleForSelectedShapes(style, value); }
  };

  const handleColorSelect = (swatch) => { setActiveColor(swatch.id); applyEditorStyle('color', swatch.tl); };
  const handleSizeSelect = (size) => { setActiveSize(size); applyEditorStyle('size', size); };
  const handleDashSelect = (dash) => { setActiveDash(dash); applyEditorStyle('dash', dash); };
  const handleFillSelect = (fill) => { setActiveFill(fill); applyEditorStyle('fill', fill); };

  const handleShapeSelect = (type) => {
    setActiveShape(type);
    handleToolSelect('geo');
    const editor = editorRef.current;
    if (editor) editor.setStyleForNextShapes(GeoShapeGeoStyle, type);
  };

  const saveTitle = async () => {
    if (!titleInput.trim() || titleInput === board?.title) { setEditTitle(false); return; }
    const token = localStorage.getItem('token');
    await fetch(`${BACKEND_URL}/boards/title/${boardId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleInput }),
    });
    setBoard(b => ({ ...b, title: titleInput }));
    setEditTitle(false);
  };

  const handleExport = async (format) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const shapeIds = editor.getSelectedShapeIds().length > 0
      ? editor.getSelectedShapeIds()
      : Array.from(editor.getCurrentPageShapeIds());
    if (shapeIds.length === 0) { toast.error('No shapes to export'); return; }
    try {
      const toastId = toast.loading(`Exporting as ${format.toUpperCase()}...`);
      await exportAs(editor, shapeIds, { format, name: board?.title || 'board-export' });
      toast.dismiss(toastId);
      toast.success(`Exported as ${format.toUpperCase()}`);
      setShowExport(false);
    } catch (err) {
      console.error('Export failed', err);
      toast.error('Export failed — ' + (err.message || 'Unknown error'));
    }
  };

  const handleSaveSnapshot = async () => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const shapeIds = Array.from(editor.getCurrentPageShapeIds());
    if (shapeIds.length === 0) { toast.error('No shapes to save'); return; }
    try {
      const toastId = toast.loading('Saving snapshot...');
      await exportAs(editor, shapeIds, { format: 'png', name: `${board?.title || 'board'}-snapshot-${new Date().toISOString().slice(0, 10)}` });
      toast.dismiss(toastId);
      toast.success('Snapshot saved!');
      setShowExport(false);
    } catch (err) {
      console.error('Snapshot failed', err);
      toast.error('Snapshot failed — ' + (err.message || 'Unknown error'));
    }
  };

  const startTimer = (minutes) => {
    if (!ydoc) return;
    ydoc.getMap('system').set('timer', { endTime: Date.now() + minutes * 60000, duration: minutes });
    setShowTimerPicker(false);
  };

  const cancelTimer = () => {
    if (!ydoc) return;
    ydoc.getMap('system').set('timer', null);
    setTimer(null);
    setTimeLeft(null);
  };

  const handleSpotlight = () => {
    if (!provider || !editorRef.current) return;
    if (isSpotlighting) {
      clearTimeout(spotlightTimerRef.current);
      clearInterval(spotlightIntervalRef.current);
      provider.awareness.setLocalStateField('followMe', null);
      setIsSpotlighting(false);
      return;
    }
    setIsSpotlighting(true);
    const broadcastCamera = () => {
      if (!editorRef.current) return;
      provider.awareness.setLocalStateField('followMe', { time: Date.now(), camera: editorRef.current.getCamera() });
    };
    broadcastCamera();
    spotlightIntervalRef.current = setInterval(broadcastCamera, 200);
    spotlightTimerRef.current = setTimeout(() => {
      clearInterval(spotlightIntervalRef.current);
      provider.awareness.setLocalStateField('followMe', null);
      setIsSpotlighting(false);
    }, 30000);
  };

  const handleVote = () => {
    if (!editorRef.current || !ydoc) return;
    const yVotes = ydoc.getMap('votes');
    const selected = editorRef.current.getSelectedShapeIds();
    if (selected.length === 0) { toast('Select shapes to vote on them', { icon: '👆' }); return; }
    ydoc.transact(() => {
      const newMyVotes = { ...myVotes };
      selected.forEach(id => {
        if (newMyVotes[id]) {
          yVotes.set(id, Math.max(0, (yVotes.get(id) || 0) - 1));
          delete newMyVotes[id];
        } else {
          yVotes.set(id, (yVotes.get(id) || 0) + 1);
          newMyVotes[id] = true;
        }
      });
      setMyVotes(newMyVotes);
    });
  };

  const toggleVoteDirectly = useCallback((id) => {
    if (!ydoc) return;
    const yVotes = ydoc.getMap('votes');
    ydoc.transact(() => {
      const newMyVotes = { ...myVotes };
      if (newMyVotes[id]) {
        yVotes.set(id, Math.max(0, (yVotes.get(id) || 0) - 1));
        delete newMyVotes[id];
      } else {
        yVotes.set(id, (yVotes.get(id) || 0) + 1);
        newMyVotes[id] = true;
      }
      setMyVotes(newMyVotes);
    });
  }, [ydoc, myVotes]);

  const deleteComment = useCallback((index) => {
    if (!ydoc) return;
    ydoc.getArray('comments').delete(index, 1);
  }, [ydoc]);

  const handleCanvasClick = () => { setShowTimerPicker(false); setShowUserMenu(false); setShowExport(false); };

  const handleCommentOverlayClick = (e) => {
    if (!canComment || !commenting || !editorRef.current || newCommentPos) return;
    e.stopPropagation();
    const pt = editorRef.current.screenToPage({ x: e.clientX, y: e.clientY });
    setNewCommentPos({ screenX: e.clientX, screenY: e.clientY, pageX: pt.x, pageY: pt.y });
  };

  const submitComment = () => {
    if (!canComment || !newCommentText.trim() || !ydoc || !newCommentPos) { setNewCommentPos(null); return; }
    ydoc.getArray('comments').push([{
      x: newCommentPos.pageX, y: newCommentPos.pageY,
      text: newCommentText,
      user: userData.name || userData.email || 'Anonymous',
    }]);
    setNewCommentPos(null);
    setNewCommentText('');
    setCommenting(false);
    toast.success('Comment added');
  };

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    navigate('/login');
  };

  const setZoomLevel = (nextZoom) => {
    const editor = editorRef.current;
    if (!editor) return;
    const clamped = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
    editor.setCamera({ ...editor.getCamera(), z: clamped });
    setZoom(clamped);
  };

  const handleZoomIn = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const point = getZoomPoint();
    if (point) editor.zoomIn(point);
    setZoom(editor.getCamera().z);
  };

  const handleZoomOut = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const point = getZoomPoint();
    if (point) editor.zoomOut(point);
    setZoom(editor.getCamera().z);
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (!synced) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-900 gap-4">
        <div className="relative">
          <div className="w-14 h-14 border-4 border-gray-200 rounded-full" />
          <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute inset-0" />
        </div>
        <div className="text-center">
          <p className="font-medium">Joining board…</p>
          <p className="text-gray-500 text-sm mt-1">Syncing with collaborators</p>
        </div>
      </div>
    );
  }

  return (
    <div className={boardShellClass}>
      <TopBar
        board={board}
        role={role}
        isEditingTitle={isEditingTitle}
        titleInput={titleInput}
        setTitleInput={setTitleInput}
        saveTitle={saveTitle}
        setEditTitle={setEditTitle}
        showExport={showExport}
        setShowExport={setShowExport}
        handleExport={handleExport}
        handleSaveSnapshot={handleSaveSnapshot}
        handleVote={handleVote}
        canComment={canComment}
        commenting={commenting}
        setCommenting={setCommenting}
        timeLeft={timeLeft}
        timerExpired={timerExpired}
        showTimerPicker={showTimerPicker}
        setShowTimerPicker={setShowTimerPicker}
        startTimer={startTimer}
        cancelTimer={cancelTimer}
        isSpotlighting={isSpotlighting}
        handleSpotlight={handleSpotlight}
        showAI={showAI}
        setShowAI={setShowAI}
        peers={peers}
        followUserId={followUserId}
        toggleFollow={toggleFollow}
        userData={userData}
        showUserMenu={showUserMenu}
        setShowUserMenu={setShowUserMenu}
        navigate={navigate}
        handleSignOut={handleSignOut}
        setShowShare={setShowShare}
      />

      {/* tldraw canvas */}
      <style>{`.tl-watermark_SEE-LICENSE, [data-testid="tl-watermark-unlicensed"] { display: none !important; }`}</style>
      <div
        className={tldrawHostClass}
        onClick={handleCanvasClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handleLocalInteraction}
        onWheel={handleLocalInteraction}
      >
        <Tldraw
          key={ydoc ? 'tldraw-bound' : 'tldraw-init'}
          shapeUtils={[FixedNoteShapeUtil]}
          onMount={(editor) => {
            editorRef.current = editor;
            editor.setCameraOptions({ zoomSteps: [ZOOM_MIN, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, ZOOM_MAX] });
            editor.setCamera(editor.getCamera());
            restoreCamera(editor);
            setZoom(editor.getCamera().z);
            bindStore(editor);
            editor.updateInstanceState({ isGridMode: true });
            setEditorReady(true);
          }}
          isReadonly={!canEdit}
          components={{
            Grid: CustomGrid,
            Toolbar: () => null,
            QuickActions: () => null,
            StylePanel: () => null,
            NavigationPanel: () => null,
            PageMenu: () => null,
            ActionsMenu: () => null,
            HelpMenu: () => null,
            ZoomMenu: () => null,
            MainMenu: () => null,
            MenuPanel: () => null,
            TopPanel: () => null,
            SharePanel: () => null,
            PeopleMenu: () => null,
          }}
        >
          <Overlays
            editor={editorRef.current}
            votes={votes}
            comments={comments}
            peers={peers}
            presenceTick={presenceTick}
            myVotes={myVotes}
            onToggleVote={toggleVoteDirectly}
            onDeleteComment={deleteComment}
          />
        </Tldraw>
      </div>

      {/* Comment placement overlay */}
      {commenting && !newCommentPos && (
        <div
          className="absolute inset-0 z-25 cursor-crosshair"
          onClick={handleCommentOverlayClick}
          style={{ background: 'rgba(245, 158, 11, 0.03)' }}
        >
          <div className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full text-amber-800 text-xs font-medium shadow-lg flex items-center gap-2 rb-anim-slide-down">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            Click anywhere to place a comment · Press Esc to cancel
          </div>
        </div>
      )}

      <LeftToolbar
        toolbarRef={toolbarRef}
        activeTool={activeTool}
        activeColor={activeColor}
        handleToolSelect={handleToolSelect}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
      />

      <ContextToolbar
        activeTool={activeTool}
        activeColor={activeColor}
        activeSize={activeSize}
        activeDash={activeDash}
        activeFill={activeFill}
        activeShape={activeShape}
        activeTextFont={activeTextFont}
        activeTextAlign={activeTextAlign}
        handleColorSelect={handleColorSelect}
        handleSizeSelect={handleSizeSelect}
        handleDashSelect={handleDashSelect}
        handleFillSelect={handleFillSelect}
        handleShapeSelect={handleShapeSelect}
        setActiveTextFont={setActiveTextFont}
        setActiveTextAlign={setActiveTextAlign}
        editorRef={editorRef}
      />

      {/* Zoom controls — single control, bottom-left */}
      <div className={`absolute bottom-5 left-4 z-30 flex items-center gap-1 rounded-2xl px-2 py-1.5 ${UI.surface}`}>
        <button onClick={handleZoomOut} className={UI.iconBtn} title="Zoom out (−)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <button
          onClick={() => setZoomLevel(1)}
          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 px-1.5 min-w-11 text-center transition-colors"
          title="Reset zoom (100%)"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={handleZoomIn} className={UI.iconBtn} title="Zoom in (+)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
      </div>

      {/* New comment input */}
      {newCommentPos && (
        <div className={`absolute z-50 p-2 rounded-2xl flex flex-col gap-2 ${UI.surfaceSolid}`} style={{ left: newCommentPos.screenX, top: newCommentPos.screenY }}>
          <textarea
            autoFocus
            className={`${UI.input} text-sm w-52 resize-none`}
            rows="2"
            placeholder="Type comment..."
            value={newCommentText}
            onChange={e => setNewCommentText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
          />
          <div className="flex justify-end gap-1">
            <button onClick={() => setNewCommentPos(null)} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700">Cancel</button>
            <button onClick={submitComment} className={`${UI.primaryBtn} text-xs px-2.5 py-1 rounded-lg`}>Post</button>
          </div>
        </div>
      )}

      {showAI && <AIPanel editor={editorRef.current} onClose={() => setShowAI(false)} />}
      {showShare && <ShareModal boardId={boardId} board={board} onClose={() => setShowShare(false)} />}
    </div>
  );
}
