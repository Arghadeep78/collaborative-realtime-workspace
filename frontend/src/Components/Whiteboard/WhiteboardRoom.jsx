import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tldraw, track, DefaultColorStyle, DefaultSizeStyle, GeoShapeGeoStyle, useEditor } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import toast from 'react-hot-toast';

const CustomGrid = track(() => {
  const editor = useEditor();
  const cam = editor.getCamera();
  
  // Set the base grid size
  const gridSize = 40 * cam.z;
  const offsetX = cam.x * cam.z;
  const offsetY = cam.y * cam.z;

  return (
    <svg className="tl-grid" version="1.1" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <defs>
        <pattern id="grid-pattern" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse" patternTransform={`translate(${offsetX}, ${offsetY})`}>
          <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-pattern)" />
    </svg>
  );
});
import { useYjsBoard } from '../../crdt/useYjsBoard.js';
import { BACKEND_URL } from '../../constants/apiConfig.js';
import AIPanel    from './AIPanel.jsx';
import ShareModal from './ShareModal.jsx';

// Unique color per user session (stable per tab)
const USER_COLORS = ['#e03', '#06d', '#0a0', '#f80', '#90f', '#0cc'];
const myColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];

const UI = {
  surface: "bg-white/90 border border-slate-200/80 shadow-[0_16px_40px_rgba(12,18,36,0.12)] backdrop-blur-xl",
  surfaceSolid: "bg-white/95 border border-slate-200/80 shadow-[0_16px_40px_rgba(12,18,36,0.12)]",
  iconBtn: "inline-flex items-center justify-center w-8 h-8 rounded-[10px] border border-slate-900/10 bg-slate-900/5 text-slate-500 transition hover:bg-white hover:text-slate-900 hover:shadow-[0_10px_20px_rgba(12,18,36,0.12)]",
  iconBtnWarn: "bg-amber-400/20 text-amber-900 border-amber-300/70",
  iconBtnActive: "bg-blue-500/15 text-blue-700 border-blue-400/50",
  primaryBtn: "bg-gradient-to-br from-[#4262ff] to-[#2f49e7] text-white border border-blue-400/40 shadow-[0_12px_28px_rgba(66,98,255,0.28)] hover:brightness-95 hover:-translate-y-0.5 transition",
  input: "bg-slate-50/90 border border-slate-900/10 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500/70 focus:ring-4 focus:ring-blue-500/15 transition",
  chip: "bg-slate-900/5 border border-slate-900/10 text-slate-500 text-[10px] font-bold tracking-[0.16em] uppercase rounded-full px-2 py-0.5",
  timer: "bg-emerald-500/15 border border-emerald-500/35 text-emerald-700 text-[11px] font-bold tracking-[0.08em] rounded-full px-2 py-0.5",
  timerExpired: "bg-rose-500/15 border-rose-400/50 text-rose-700",
  logo: "font-bold text-[1.05rem] tracking-[-0.03em] text-slate-900",
  lite: "bg-amber-200/60 text-amber-950 border border-amber-300/70 rounded-full text-[9px] font-bold tracking-[0.2em] uppercase px-2 py-0.5",
};

const boardShellClass = "relative w-full h-full bg-slate-50 [background:radial-gradient(1200px_540px_at_10%_-15%,rgba(66,98,255,0.2),transparent_65%),radial-gradient(900px_420px_at_90%_0%,rgba(0,167,116,0.15),transparent_60%),radial-gradient(700px_360px_at_40%_110%,rgba(255,204,102,0.18),transparent_65%)]";
const tldrawHostClass = "w-full h-full [&_[title*='license']]:hidden [&_[aria-label*='license']]:hidden [&_[href*='license']]:hidden";

const GRID_COLORS = [
  { id: 'light-yellow', hex: '#FFF29B', tl: 'yellow' },
  { id: 'yellow', hex: '#FFE054', tl: 'yellow' },
  { id: 'light-orange', hex: '#FFB870', tl: 'orange' },
  { id: 'pink', hex: '#FF9494', tl: 'light-red' },
  { id: 'light-pink', hex: '#FFC4E8', tl: 'light-red' },
  { id: 'hot-pink', hex: '#FF8ADB', tl: 'red' },
  { id: 'light-blue', hex: '#A3C8FF', tl: 'light-blue' },
  { id: 'purple', hex: '#B8A6FF', tl: 'violet' },
  { id: 'cyan', hex: '#87E5FF', tl: 'light-blue' },
  { id: 'blue', hex: '#6D9EF0', tl: 'blue' },
  { id: 'teal', hex: '#77E0C9', tl: 'green' },
  { id: 'green', hex: '#63D979', tl: 'green' },
  { id: 'lime', hex: '#CDEDA4', tl: 'light-green' },
  { id: 'lime-green', hex: '#BDE459', tl: 'light-green' },
  { id: 'white', hex: '#FFFFFF', tl: 'white' },
  { id: 'black', hex: '#1E1E1E', tl: 'black' },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const Overlays = track(({ editor, votes, comments }) => {
  if (!editor) return null;
  const shapes = editor.getCurrentPageShapes();
  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Votes Overlay */}
      {shapes.map(s => {
         const count = votes[s.id];
         if (!count) return null;
         const bounds = editor.getShapePageBounds(s);
         if (!bounds) return null;
         const pt = editor.pageToViewport({ x: bounds.maxX, y: bounds.minY });
         return (
           <div key={`vote-${s.id}`} className="absolute bg-indigo-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 shadow-md" style={{ transform: `translate(${pt.x - 10}px, ${pt.y - 10}px)` }}>
             👍 {count}
           </div>
         );
      })}

      {/* Comments Overlay */}
      {comments.map((c, i) => {
        const pt = editor.pageToViewport({ x: c.x, y: c.y });
        return (
          <div key={`comment-${i}`} className="absolute group pointer-events-auto" style={{ transform: `translate(${pt.x}px, ${pt.y}px)` }}>
            <div className="w-5 h-5 bg-yellow-400 border-2 border-yellow-600 rounded-full shadow-lg cursor-pointer transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[10px]">
              💬
            </div>
            <div className="hidden group-hover:block absolute top-4 left-4 bg-white text-gray-900 text-xs p-2 rounded shadow-xl border border-gray-200 w-48 whitespace-pre-wrap">
              <span className="font-bold text-[10px] text-gray-500 block">{c.user}</span>
              {c.text}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default function WhiteboardRoom() {
  const { id: boardId } = useParams();
  const { ydoc, provider, synced } = useYjsBoard(boardId);

  const [board, setBoard]           = useState(null);
  const [peers, setPeers]           = useState([]);
  const [isEditingTitle, setEditTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const editorRef                   = useRef(null);
  const storeRef                    = useRef(null);
  const bindingActiveRef            = useRef(false);
  const bindingCleanupRef           = useRef(null);
  const boundYdocRef                = useRef(null);
  const [showAI, setShowAI]       = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [role, setRole]           = useState('editor');
  const [showExport, setShowExport] = useState(false);
  const [timer, setTimer] = useState(null);
  const [votes, setVotes] = useState({});
  const [comments, setComments] = useState([]);
  const [commenting, setCommenting] = useState(false);
  const [newCommentPos, setNewCommentPos] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [activeColor, setActiveColor] = useState('blue');
  const [activeTool, setActiveTool] = useState('draw');
  const [hoveredTool, setHoveredTool] = useState(null);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSpotlighting, setIsSpotlighting] = useState(false);
  const [myVotes, setMyVotes] = useState({}); // { shapeId: true } for current user's votes
  const spotlightTimerRef = useRef(null);
  const spotlightIntervalRef = useRef(null);
  const navigate = useNavigate();
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');

  const handleToolSelect = (tool) => {
    setActiveTool(tool);
    if (editorRef.current) {
      editorRef.current.setCurrentTool(tool);
      editorRef.current.updateInstanceState({ isToolLocked: true });
    }
  };

  const handleUndo = () => editorRef.current?.undo();
  const handleRedo = () => editorRef.current?.redo();
  const [zoom, setZoom] = useState(1);

  // ── Fetch board metadata (title, isPublic, etc.) ─────────────────────────
  useEffect(() => {
    if (!boardId) return;
    fetch(`${BACKEND_URL}/boards/${boardId}`)
      .then(r => r.json())
      .then(data => {
        setBoard(data);
        setTitleInput(data.title || '');
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const email = userData.email;
        if (data.owner === email) {
          setRole('editor');
        } else {
          const collab = data.collaborators?.find(c => c.email === email);
          if (collab) {
            setRole(collab.role);
          } else if (data.isPublic) {
            setRole(data.publicRole || 'viewer');
          }
        }
      })
      .catch(console.error);
  }, [boardId]);

  // ── Presence: read awareness states → peers list ─────────────────────────
  useEffect(() => {
    if (!provider) return;
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    provider.awareness.setLocalStateField('user', {
      name:  userData.name || userData.email || 'Anonymous',
      color: myColor,
      email: userData.email || '',
      role: role
    });

    const updatePeers = () => {
      const states = [];
      let shouldFollow = null;
      provider.awareness.getStates().forEach((state, clientId) => {
        if (clientId !== provider.awareness.clientID && state?.user) {
          states.push({ clientId, ...state.user });
        }
        if (clientId !== provider.awareness.clientID && state?.followMe) {
          if (!shouldFollow || state.followMe.time > shouldFollow.time) {
            shouldFollow = state.followMe;
          }
        }
      });
      setPeers(states);

      if (shouldFollow && Date.now() - shouldFollow.time < 5000) {
        if (editorRef.current && shouldFollow.camera) {
          editorRef.current.setCameraOptions({ isLocked: true });
          editorRef.current.setCamera(shouldFollow.camera);
        }
      } else if (editorRef.current) {
        editorRef.current.setCameraOptions({ isLocked: false });
      }
    };

    provider.awareness.on('change', updatePeers);
    return () => provider.awareness.off('change', updatePeers);
  }, [provider]);

  // ── Bind tldraw store ↔ Yjs Y.Map (incremental, debounced) ───────────────
  // Called once the tldraw editor mounts and Y.Doc is ready.
  // Returns a cleanup function. We track it in bindingCleanupRef so we can
  // tear down the old binding before creating a new one (e.g. after Tldraw
  // remounts or ydoc changes).
  const bindStore = useCallback((editor) => {
    if (!editor || !ydoc) return;

    // If we're already bound to this exact editor+ydoc pair, skip.
    if (bindingActiveRef.current && boundYdocRef.current === ydoc && editorRef.current === editor) return;

    // Clean up any previous binding first (stale editor or different ydoc)
    if (bindingCleanupRef.current) {
      bindingCleanupRef.current();
      bindingCleanupRef.current = null;
    }

    bindingActiveRef.current = true;
    boundYdocRef.current = ydoc;
    editorRef.current = editor;

    // We use a Y.Map keyed by record.id for incremental sync.
    // A "legacy" key 'snapshot' may still exist from the old full-snapshot
    // approach — we migrate from it on first load, then switch to incremental.
    const yRecords = ydoc.getMap('tldraw_records');
    const yMeta = ydoc.getMap('tldraw'); // legacy map, used for migration only

    // ── Flag to prevent echo (our own Yjs writes feeding back) ───────────
    let isApplyingRemote = false;
    let isApplyingLocal = false;

    // ── Initial state: migrate from legacy snapshot or load incremental ──
    if (yRecords.size === 0 && yMeta.size > 0) {
      // One-time migration from the old full-snapshot approach
      try {
        const raw = yMeta.get('snapshot');
        if (raw) {
          const snap = JSON.parse(raw);
          editor.store.loadSnapshot(snap);
          // Seed the incremental map
          ydoc.transact(() => {
            const allRecords = editor.store.allRecords();
            for (const rec of allRecords) {
              yRecords.set(rec.id, JSON.stringify(rec));
            }
          }, 'tldraw-init');
        }
      } catch (e) {
        console.warn('[tldraw] legacy snapshot migration failed:', e);
      }
    } else if (yRecords.size > 0) {
      // Load from incremental records
      try {
        isApplyingRemote = true;
        const records = [];
        yRecords.forEach((val) => {
          try { records.push(JSON.parse(val)); } catch (_) { /* skip bad entries */ }
        });
        if (records.length > 0) {
          editor.store.put(records);
        }
      } catch (e) {
        console.warn('[tldraw] incremental load failed:', e);
      } finally {
        isApplyingRemote = false;
      }
    }

    // ── tldraw → Yjs (debounced incremental) ─────────────────────────────
    let pendingChanges = { added: {}, updated: {}, removed: {} };
    let flushTimer = null;

    const flushToYjs = () => {
      flushTimer = null;
      const { added, updated, removed } = pendingChanges;
      pendingChanges = { added: {}, updated: {}, removed: {} };

      const addedEntries = Object.values(added);
      const updatedEntries = Object.values(updated);
      const removedIds = Object.keys(removed);

      if (addedEntries.length === 0 && updatedEntries.length === 0 && removedIds.length === 0) return;

      isApplyingLocal = true;
      ydoc.transact(() => {
        for (const rec of addedEntries) {
          yRecords.set(rec.id, JSON.stringify(rec));
        }
        for (const rec of updatedEntries) {
          yRecords.set(rec.id, JSON.stringify(rec));
        }
        for (const id of removedIds) {
          yRecords.delete(id);
        }
      }, 'tldraw');
      isApplyingLocal = false;
    };

    const unsubscribeTldraw = editor.store.listen(({ changes }) => {
      if (isApplyingRemote) return; // don't echo back remote changes
      if (!changes) return;

      // Merge into pending batch
      for (const rec of Object.values(changes.added)) {
        delete pendingChanges.removed[rec.id];
        pendingChanges.added[rec.id] = rec;
      }
      for (const [, to] of Object.values(changes.updated)) {
        if (pendingChanges.added[to.id]) {
          pendingChanges.added[to.id] = to;
        } else {
          pendingChanges.updated[to.id] = to;
        }
        delete pendingChanges.removed[to.id];
      }
      for (const rec of Object.values(changes.removed)) {
        delete pendingChanges.added[rec.id];
        delete pendingChanges.updated[rec.id];
        pendingChanges.removed[rec.id] = true;
      }

      // Debounce: flush after 100ms of inactivity
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(flushToYjs, 100);
    }, { scope: 'document' });

    // ── Yjs → tldraw (incremental, skip own writes) ─────────────────────
    const onYjsChange = (event, transaction) => {
      if (transaction.origin === 'tldraw' || transaction.origin === 'tldraw-init') return;
      if (isApplyingLocal) return;

      isApplyingRemote = true;
      try {
        const toPut = [];
        const toRemove = [];

        event.changes.keys.forEach((change, key) => {
          if (change.action === 'add' || change.action === 'update') {
            try {
              const rec = JSON.parse(yRecords.get(key));
              toPut.push(rec);
            } catch (_) { /* skip bad data */ }
          } else if (change.action === 'delete') {
            // We need the record schema for remove; create a minimal ref
            toRemove.push({ id: key, typeName: key.split(':')[0] });
          }
        });

        if (toPut.length > 0 || toRemove.length > 0) {
          editor.store.mergeRemoteChanges(() => {
            if (toPut.length > 0) editor.store.put(toPut);
            if (toRemove.length > 0) {
              // Only remove records that actually exist in the store
              const existingIds = toRemove
                .map(r => r.id)
                .filter(id => { try { return !!editor.store.get(id); } catch { return false; } });
              if (existingIds.length > 0) editor.store.remove(existingIds);
            }
          });
        }
      } catch (e) {
        console.warn('[tldraw] failed to apply Yjs incremental update:', e);
      } finally {
        isApplyingRemote = false;
      }
    };
    yRecords.observe(onYjsChange);

    // ── System maps (timer, votes, comments) ────────────────────────────
    const ySystem = ydoc.getMap('system');
    const yVotes = ydoc.getMap('votes');
    const yComments = ydoc.getArray('comments');

    const onSystemChange = () => {
      const currentTimer = ySystem.get('timer');
      if (currentTimer) setTimer(currentTimer);
    };

    const onVotesChange = () => setVotes(yVotes.toJSON());
    const onCommentsChange = () => setComments(yComments.toArray());

    ySystem.observe(onSystemChange);
    yVotes.observe(onVotesChange);
    yComments.observe(onCommentsChange);
    
    onSystemChange();
    onVotesChange();
    onCommentsChange();

    // Store the cleanup function so it can be called on remount or ydoc change
    const cleanup = () => {
      if (flushTimer) { clearTimeout(flushTimer); flushToYjs(); } // flush any pending
      unsubscribeTldraw();
      yRecords.unobserve(onYjsChange);
      ySystem.unobserve(onSystemChange);
      yVotes.unobserve(onVotesChange);
      yComments.unobserve(onCommentsChange);
      bindingActiveRef.current = false;
      boundYdocRef.current = null;
    };

    bindingCleanupRef.current = cleanup;
    return cleanup;
  }, [ydoc]);

  // ── Re-bind when ydoc becomes available ──────────────────────────────────
  useEffect(() => {
    if (ydoc && editorRef.current) {
      const cleanup = bindStore(editorRef.current);
      return cleanup;
    }
  }, [ydoc, bindStore]);

  // ── Clean up binding on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (bindingCleanupRef.current) {
        bindingCleanupRef.current();
        bindingCleanupRef.current = null;
      }
    };
  }, []);

  // ── Update board title ────────────────────────────────────────────────────
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
    if (shapeIds.length === 0) return alert('No shapes to export');

    try {
      import('@tldraw/tldraw').then(async ({ exportToBlob }) => {
        const blob = await exportToBlob({
          editor,
          ids: shapeIds,
          format: format,
          opts: { background: true }
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `board-export.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExport(false);
      });
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const startTimer = (minutes) => {
    if (!ydoc) return;
    const ySystem = ydoc.getMap('system');
    ySystem.set('timer', {
      endTime: Date.now() + minutes * 60000,
      duration: minutes
    });
    setShowTimerPicker(false);
  };

  const cancelTimer = () => {
    if (!ydoc) return;
    const ySystem = ydoc.getMap('system');
    ySystem.set('timer', null);
    setTimer(null);
    setTimeLeft(null);
  };

  const [timeLeft, setTimeLeft] = useState(null);
  const [timerExpired, setTimerExpired] = useState(false);
  useEffect(() => {
    if (!timer || !timer.endTime) {
      setTimeLeft(null);
      setTimerExpired(false);
      return;
    }
    const interval = setInterval(() => {
      const remaining = Math.max(0, timer.endTime - Date.now());
      if (remaining === 0) {
        clearInterval(interval);
        setTimeLeft('00:00');
        setTimerExpired(true);
        // Auto-clear after 5 seconds
        setTimeout(() => {
          setTimerExpired(false);
          setTimeLeft(null);
          setTimer(null);
        }, 5000);
      } else {
        const m = Math.floor(remaining / 60000).toString().padStart(2, '0');
        const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
        setTimeLeft(`${m}:${s}`);
        setTimerExpired(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleSpotlight = () => {
    if (!provider || !editorRef.current) return;
    
    if (isSpotlighting) {
      // Stop spotlight early
      clearTimeout(spotlightTimerRef.current);
      clearInterval(spotlightIntervalRef.current);
      provider.awareness.setLocalStateField('followMe', null);
      setIsSpotlighting(false);
      return;
    }

    setIsSpotlighting(true);
    
    // Continuously broadcast camera position while spotlighting
    const broadcastCamera = () => {
      if (!editorRef.current) return;
      provider.awareness.setLocalStateField('followMe', {
        time: Date.now(),
        camera: editorRef.current.getCamera()
      });
    };
    
    broadcastCamera();
    spotlightIntervalRef.current = setInterval(broadcastCamera, 200);
    
    // Auto-stop after 30 seconds
    spotlightTimerRef.current = setTimeout(() => {
      clearInterval(spotlightIntervalRef.current);
      provider.awareness.setLocalStateField('followMe', null);
      setIsSpotlighting(false);
    }, 30000);
  };

  // Cleanup spotlight on unmount
  useEffect(() => {
    return () => {
      clearTimeout(spotlightTimerRef.current);
      clearInterval(spotlightIntervalRef.current);
    };
  }, []);

  const handleVote = () => {
    if (!editorRef.current || !ydoc) return;
    const yVotes = ydoc.getMap('votes');
    const selected = editorRef.current.getSelectedShapeIds();
    if (selected.length === 0) {
      toast('Select shapes to vote on them', { icon: '👆' });
      return;
    }
    
    ydoc.transact(() => {
      const newMyVotes = { ...myVotes };
      selected.forEach(id => {
        if (newMyVotes[id]) {
          // Un-vote
          const current = yVotes.get(id) || 0;
          yVotes.set(id, Math.max(0, current - 1));
          delete newMyVotes[id];
        } else {
          // Vote
          const current = yVotes.get(id) || 0;
          yVotes.set(id, current + 1);
          newMyVotes[id] = true;
        }
      });
      setMyVotes(newMyVotes);
    });
  };

  const handleCanvasClick = () => {
    // Close menus when clicking canvas
    setShowTimerPicker(false);
    setShowUserMenu(false);
    setShowExport(false);
  };

  const handleCommentOverlayClick = (e) => {
    if (!commenting || !editorRef.current || newCommentPos) return;
    e.stopPropagation();
    const pt = editorRef.current.screenToPage({ x: e.clientX, y: e.clientY });
    setNewCommentPos({ screenX: e.clientX, screenY: e.clientY, pageX: pt.x, pageY: pt.y });
  };

  const submitComment = () => {
    if (!newCommentText.trim() || !ydoc || !newCommentPos) {
      setNewCommentPos(null);
      return;
    }
    ydoc.getArray('comments').push([{
      x: newCommentPos.pageX,
      y: newCommentPos.pageY,
      text: newCommentText,
      user: userData.name || userData.email || 'Anonymous'
    }]);
    setNewCommentPos(null);
    setNewCommentText('');
    setCommenting(false);
    toast.success('Comment added');
  };

  // Escape key to cancel comment mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (newCommentPos) {
          setNewCommentPos(null);
          setNewCommentText('');
        } else if (commenting) {
          setCommenting(false);
        }
        setShowTimerPicker(false);
        setShowUserMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commenting, newCommentPos]);

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    navigate('/login');
  };

  const applyEditorStyle = (prop, value) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (prop === 'color') {
      editor.setStyleForSelectedShapes(DefaultColorStyle, value);
      editor.setStyleForNextShapes(DefaultColorStyle, value);
    } else if (prop === 'size') {
      editor.setStyleForSelectedShapes(DefaultSizeStyle, value);
      editor.setStyleForNextShapes(DefaultSizeStyle, value);
    }
  };

  const handleColorSelect = (swatch) => {
    setActiveColor(swatch.id);
    applyEditorStyle('color', swatch.tl);
  };

  const handleShapeSelect = (type) => {
    handleToolSelect('geo');
    const editor = editorRef.current;
    if (!editor) return;
    editor.setStyleForSelectedShapes(GeoShapeGeoStyle, type);
    editor.setStyleForNextShapes(GeoShapeGeoStyle, type);
  };

  const setZoomLevel = (nextZoom) => {
    const editor = editorRef.current;
    if (!editor) return;
    const camera = editor.getCamera();
    const clamped = clamp(nextZoom, 0.2, 4);
    editor.setCamera({ ...camera, z: clamped });
    setZoom(clamped);
  };

  const handleZoomIn = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setZoomLevel(editor.getCamera().z * 1.1);
  };

  const handleZoomOut = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setZoomLevel(editor.getCamera().z * 0.9);
  };

  const renderColorFlyout = () => (
    <div className="absolute left-full top-0 pl-3 z-50">
      <div className={`rounded-[20px] p-3 flex flex-col gap-3 ${UI.surfaceSolid} w-[140px] shadow-xl`}>
        <div className="grid grid-cols-2 gap-2">
          {GRID_COLORS.map(c => (
            <button 
              key={c.id} 
              onClick={() => handleColorSelect(c)} 
              className="w-[48px] h-[40px] rounded border border-black/10 shadow-sm transition-transform hover:scale-105" 
              style={{ backgroundColor: c.hex }} 
            />
          ))}
        </div>
        <button className="flex items-center justify-center gap-2 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium rounded-lg">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="12" height="12" rx="2"/><path d="M8 20h12V8"/></svg>
          Stack
        </button>
        <button className="flex items-center justify-center w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium rounded-lg">
          Templates
        </button>
        <button className="flex items-center justify-center w-full py-1 text-slate-800 hover:text-slate-900 text-sm font-medium bg-transparent">
          Bulk mode
        </button>
      </div>
    </div>
  );

  const renderShapesFlyout = () => (
    <div className="absolute left-full top-0 pl-3 z-50">
      <div className={`rounded-[20px] p-3 flex flex-col gap-2 ${UI.surfaceSolid} w-[140px] shadow-xl`}>
        <div className="grid grid-cols-3 gap-2">
          {/* Rectangle */}
          <button onClick={() => handleShapeSelect('rectangle')} className="w-8 h-8 rounded border border-black/10 shadow-sm flex items-center justify-center hover:bg-slate-100 text-slate-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          </button>
          {/* Ellipse */}
          <button onClick={() => handleShapeSelect('ellipse')} className="w-8 h-8 rounded border border-black/10 shadow-sm flex items-center justify-center hover:bg-slate-100 text-slate-700">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/></svg>
          </button>
          {/* Triangle */}
          <button onClick={() => handleShapeSelect('triangle')} className="w-8 h-8 rounded border border-black/10 shadow-sm flex items-center justify-center hover:bg-slate-100 text-slate-700">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,3 21,21 3,21"/></svg>
          </button>
          {/* Diamond */}
          <button onClick={() => handleShapeSelect('diamond')} className="w-8 h-8 rounded border border-black/10 shadow-sm flex items-center justify-center hover:bg-slate-100 text-slate-700">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 22,12 12,22 2,12"/></svg>
          </button>
          {/* Hexagon */}
          <button onClick={() => handleShapeSelect('hexagon')} className="w-8 h-8 rounded border border-black/10 shadow-sm flex items-center justify-center hover:bg-slate-100 text-slate-700">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7"/></svg>
          </button>
          {/* Star */}
          <button onClick={() => handleShapeSelect('star')} className="w-8 h-8 rounded border border-black/10 shadow-sm flex items-center justify-center hover:bg-slate-100 text-slate-700">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 15,8 22,9 17,14 18,21 12,17 6,21 7,14 2,9 9,8"/></svg>
          </button>
        </div>
        <div className="h-px bg-slate-200 my-1"></div>
        {/* Lines and arrows */}
        <div className="grid grid-cols-2 gap-2">
           <button onClick={() => handleToolSelect('line')} className={`w-[48px] h-[32px] rounded border border-black/10 shadow-sm flex items-center justify-center hover:bg-slate-100 ${activeTool === 'line' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700'}`}>
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="20" x2="20" y2="4"/></svg>
           </button>
           <button onClick={() => handleToolSelect('arrow')} className={`w-[48px] h-[32px] rounded border border-black/10 shadow-sm flex items-center justify-center hover:bg-slate-100 ${activeTool === 'arrow' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700'}`}>
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="20" x2="20" y2="4"/><polyline points="14 4 20 4 20 10"/></svg>
           </button>
        </div>
      </div>
    </div>
  );

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
      {/* ── Top Center Floating Box: Logo, Export & Title ─────────────────────── */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-2xl px-3 py-2 ${UI.surface}`}>
        <div className="flex items-center gap-2">
          <span className={UI.logo}>board</span>
          <span className={UI.lite}>lite</span>
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowExport(!showExport)}
            className={UI.iconBtn}
            title="Export"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          </button>
          {showExport && (
            <div className={`absolute left-0 mt-2 w-44 rounded-xl py-1.5 z-50 ${UI.surfaceSolid}`}>
              <button onClick={() => handleExport('png')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-black/5">Export as PNG</button>
              <button onClick={() => handleExport('svg')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-black/5">Export as SVG</button>
              <div className="border-t border-gray-200 my-1"></div>
              <button onClick={() => { alert('Snapshot saved (Mock)'); setShowExport(false); }} className="w-full text-left px-4 py-2 text-xs text-blue-600 hover:bg-black/5">Save Snapshot</button>
            </div>
          )}
        </div>

        <div className="h-5 w-px bg-gray-200"></div>
        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <input
              autoFocus
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => e.key === 'Enter' && saveTitle()}
              className={`${UI.input} text-sm w-32 sm:w-48`}
            />
          ) : (
            <button
              onClick={() => setEditTitle(true)}
              className="text-gray-900 font-medium text-sm hover:bg-black/5 px-2 py-1 rounded-lg transition-colors max-w-[120px] sm:max-w-xs truncate"
            >
              {board?.title || 'Untitled Board'}
            </button>
          )}
          {role === 'viewer' && (
            <span className={UI.chip}>
              View Only
            </span>
          )}
        </div>
      </div>

      {/* ── Top Right Floating Box: Tools & Share ─────────────────────── */}
      <div className={`absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-2xl pl-2.5 pr-1.5 py-1.5 ${UI.surface}`}>
        
        {/* Tool buttons grouped */}
        <div className="flex items-center gap-1">
          {/* Vote button */}
          <button 
            onClick={handleVote} 
            className={`${UI.iconBtn} group relative`} 
            title="Vote on selected shapes (toggle)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-800 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Vote</span>
          </button>

          {/* Comment button */}
          <button 
            onClick={() => setCommenting(!commenting)} 
            className={`${UI.iconBtn} group relative ${commenting ? 'bg-amber-100 text-amber-700 border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]' : ''}`}
            title="Add a comment pin"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-800 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">{commenting ? 'Cancel' : 'Comment'}</span>
          </button>

          {/* Timer */}
          <div className="relative">
            {timeLeft ? (
              <div className="flex items-center gap-1">
                <div className={`${UI.timer} font-mono flex items-center gap-1.5 ${timerExpired ? `${UI.timerExpired} animate-pulse` : ''}`}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                  </svg>
                  {timeLeft}
                </div>
                {role === 'editor' && (
                  <button 
                    onClick={cancelTimer} 
                    className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center hover:bg-rose-200 transition-colors"
                    title="Cancel timer"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ) : role === 'editor' ? (
              <button 
                onClick={() => setShowTimerPicker(!showTimerPicker)} 
                className={`${UI.iconBtn} group relative ${showTimerPicker ? UI.iconBtnActive : ''}`}
                title="Set a timer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-800 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Timer</span>
              </button>
            ) : null}

            {/* Timer duration picker dropdown */}
            {showTimerPicker && (
              <div className={`absolute right-0 top-full mt-2 w-36 rounded-xl py-1.5 z-50 ${UI.surfaceSolid}`}>
                <p className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Set Timer</p>
                {[1, 3, 5, 10, 15, 30].map(m => (
                  <button 
                    key={m} 
                    onClick={() => startTimer(m)} 
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                  >
                    {m} minute{m > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Spotlight / Follow Me */}
          {role === 'editor' && (
            <button 
              onClick={handleSpotlight} 
              className={`${UI.iconBtn} group relative ${isSpotlighting ? 'bg-red-100 text-red-600 border-red-300 shadow-[0_0_12px_rgba(239,68,68,0.3)]' : ''}`}
              title={isSpotlighting ? 'Stop presenting (click to stop)' : 'Present — others follow your view'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
              {isSpotlighting && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-800 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">{isSpotlighting ? 'Stop' : 'Present'}</span>
            </button>
          )}

          {/* AI button — unchanged per user request */}
          <button id="ai-panel-btn" onClick={() => setShowAI(v => !v)} className={`${UI.iconBtn} text-sm ${showAI ? UI.iconBtnActive : ''}`} title="AI Assistant">✨</button>
        </div>

        <div className="h-6 w-px bg-slate-200/80 mx-0.5"></div>

        {/* Peer presence avatars */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center -space-x-1.5">
            {peers.slice(0, window.innerWidth < 640 ? 2 : peers.length).map(peer => (
              <div
                key={peer.clientId}
                title={peer.name}
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold border-2 border-white shadow-sm transition-transform hover:scale-110 hover:z-10"
                style={{ backgroundColor: peer.color }}
              >
                {peer.name?.[0]?.toUpperCase() || '?'}
              </div>
            ))}
          </div>

          {/* Current user avatar with dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)} 
              className="flex items-center gap-1 bg-emerald-50/80 pl-1.5 pr-1 py-1 rounded-full border border-emerald-100/80 shadow-sm cursor-pointer hover:bg-emerald-100/80 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
                {userData.name?.[0]?.toUpperCase() || userData.email?.[0]?.toUpperCase() || '?'}
              </div>
              <svg className={`w-3 h-3 text-slate-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>

            {/* User menu dropdown */}
            {showUserMenu && (
              <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl py-2 z-50 ${UI.surfaceSolid}`}>
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">{userData.name || 'User'}</p>
                  <p className="text-xs text-slate-500 truncate">{userData.email || ''}</p>
                </div>
                <button 
                  onClick={() => { setShowUserMenu(false); navigate('/dashboard'); }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                  Dashboard
                </button>
                <button 
                  onClick={() => { setShowUserMenu(false); navigate('/profile'); }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Profile
                </button>
                <div className="border-t border-slate-100 my-1"></div>
                <button 
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Share button */}
        <button
          onClick={() => setShowShare(true)}
          className={`ml-1 ${UI.primaryBtn} text-sm font-medium px-4 py-1.5 rounded-full flex items-center gap-1.5`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          Share
        </button>
      </div>

      {/* ── tldraw canvas (full screen) ─────────── */}
      <div className={tldrawHostClass} onClick={handleCanvasClick}>
        <Tldraw
          key={ydoc ? 'tldraw-bound' : 'tldraw-init'}
          onMount={(editor) => {
            editorRef.current = editor;
            setZoom(editor.getCamera().z);
            bindStore(editor);
            editor.updateInstanceState({ isGridMode: true });
          }}
          isReadonly={role === 'viewer'}
          components={{
            Grid: CustomGrid,
            PageMenu: () => null,
            ZoomMenu: () => null,
            NavigationPanel: () => null,
            HelpMenu: () => null,
            StylePanel: () => null,
            Toolbar: () => null,
            QuickActions: () => null,
          }}
        >
          <Overlays editor={editorRef.current} votes={votes} comments={comments} />
        </Tldraw>
      </div>

      {/* Comment mode overlay — sits above tldraw to intercept clicks */}
      {commenting && !newCommentPos && (
        <div 
          className="absolute inset-0 z-25 cursor-crosshair" 
          onClick={handleCommentOverlayClick}
          style={{ background: 'rgba(245, 158, 11, 0.03)' }}
        >
          <div className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full text-amber-800 text-xs font-medium shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            Click anywhere to place a comment · Press Esc to cancel
          </div>
        </div>
      )}

      {/* Custom Left Toolbar */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-3">
        {/* Main Tools Box */}
        <div className={`rounded-[20px] p-2 flex flex-col gap-2 ${UI.surfaceSolid}`}>
          
          {/* Pen Tool */}
          <div 
            className="relative group"
            onMouseEnter={() => setHoveredTool('pen')}
            onMouseLeave={() => setHoveredTool(null)}
          >
            <button 
              onClick={() => handleToolSelect('draw')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTool === 'draw' || activeTool === 'highlight' || activeTool === 'eraser' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            </button>
            {hoveredTool === 'pen' && (
              <div className="absolute left-full top-0 pl-3 z-50">
                <div className={`rounded-[20px] p-2 flex flex-col gap-2 ${UI.surfaceSolid} w-14 items-center shadow-xl`}>
                  <button onClick={() => handleToolSelect('draw')} className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeTool === 'draw' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-700 hover:bg-slate-100'}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                  </button>
                  <button onClick={() => handleToolSelect('highlight')} className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeTool === 'highlight' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-700 hover:bg-slate-100'}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"></path></svg>
                  </button>
                  <button onClick={() => handleToolSelect('eraser')} className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeTool === 'eraser' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-700 hover:bg-slate-100'}`}>
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L20 9C20.5 9.5 20.5 10.5 20 11L11 20H20V20Z"></path></svg>
                  </button>
                  <button onClick={() => handleToolSelect('select')} className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeTool === 'select' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-700 hover:bg-slate-100'}`}>
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4"><circle cx="12" cy="12" r="10"/></svg>
                  </button>
                  <div className="w-8 h-px bg-slate-200 my-1" />
                  <button onClick={() => applyEditorStyle('size', 's')} className="w-10 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg"><div className="w-1.5 h-1.5 rounded-full bg-slate-800" /></button>
                  <button onClick={() => applyEditorStyle('size', 'm')} className="w-10 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg"><div className="w-2.5 h-2.5 rounded-full bg-slate-800" /></button>
                  <button onClick={() => applyEditorStyle('size', 'l')} className="w-10 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg"><div className="w-4 h-4 rounded-full bg-slate-800" /></button>
                  <div className="w-8 h-px bg-slate-200 my-1" />
                  <button onClick={() => handleColorSelect({ id: 'blue', tl: 'blue' })} className="w-8 h-8 rounded-full border-2 border-indigo-500 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /></button>
                  <button onClick={() => handleColorSelect({ id: 'red', tl: 'red' })} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center mt-1 hover:border-slate-400 transition-colors"><div className="w-2 h-2 rounded-full bg-red-400" /></button>
                  <button onClick={() => handleColorSelect({ id: 'green', tl: 'green' })} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center mt-1 hover:border-slate-400 transition-colors"><div className="w-4 h-4 rounded-full bg-green-500" /></button>
                </div>
              </div>
            )}
          </div>

          {/* Shapes Tool */}
          <div 
            className="relative group"
            onMouseEnter={() => setHoveredTool('shapes')}
            onMouseLeave={() => setHoveredTool(null)}
          >
            <button 
              onClick={() => handleToolSelect('geo')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${(activeTool === 'geo' || activeTool === 'line' || activeTool === 'arrow') ? 'bg-indigo-100 text-indigo-600' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><circle cx="17.5" cy="6.5" r="3.5"/><polygon points="6.5,14 10,21 3,21" strokeLinejoin="round"/><path d="M14 14l6 6m0-6v6h-6"/></svg>
            </button>
            {hoveredTool === 'shapes' && renderShapesFlyout()}
          </div>

          {/* Sticky Note */}
          <div 
            className="relative group"
            onMouseEnter={() => setHoveredTool('note')}
            onMouseLeave={() => setHoveredTool(null)}
          >
            <button 
              onClick={() => handleToolSelect('note')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTool === 'note' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 15l-6 6H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10z"/><path d="M19 15l-6 6v-6h6z"/></svg>
            </button>
            {hoveredTool === 'note' && renderColorFlyout()}
          </div>

          {/* Text Tool */}
          <button 
            onClick={() => handleToolSelect('text')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTool === 'text' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3"/><path d="M12 4v16"/><path d="M8 20h8"/></svg>
          </button>



          {/* More */}
          <button className={`w-10 h-10 mt-1 rounded-xl flex items-center justify-center transition-all text-slate-700 hover:bg-slate-100`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 13l5 5 5-5"/><path d="M7 6l5 5 5-5"/></svg>
          </button>
        </div>

        {/* Undo/Redo Box */}
        <div className={`rounded-[20px] p-2 flex flex-col gap-2 ${UI.surfaceSolid}`}>
          <button onClick={handleUndo} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
          </button>
          <button onClick={handleRedo} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/></svg>
          </button>
        </div>
      </div>

      {/* Custom zoom controls */}
      <div className={`absolute bottom-6 right-6 z-30 rounded-full px-2 py-1.5 flex items-center gap-2 ${UI.surface}`}>
        <button onClick={handleZoomOut} className={UI.iconBtn} title="Zoom out">-</button>
        <button onClick={() => setZoomLevel(1)} className="text-xs font-semibold text-gray-700 px-2" title="Reset zoom">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={handleZoomIn} className={UI.iconBtn} title="Zoom in">+</button>
      </div>

      {/* New Comment Input Overlay */}
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

      {showAI && (
        <AIPanel editor={editorRef.current} boardId={boardId} onClose={() => setShowAI(false)} />
      )}
      {showShare && (
        <ShareModal boardId={boardId} board={board} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
