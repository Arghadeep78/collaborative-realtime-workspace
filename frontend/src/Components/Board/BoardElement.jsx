import { useEffect, useRef, useState } from 'react';
import { useElementDrag } from './useElementDrag.js';
import { useElementResize } from './useElementResize.js';
import StickyNote from './elements/StickyNote.jsx';
import KanbanCard from './elements/KanbanCard.jsx';
import TextBox from './elements/TextBox.jsx';
import PollBlock from './elements/PollBlock.jsx';
import IframeWindow from './elements/IframeWindow.jsx';
import ShapeBlock from './elements/ShapeBlock.jsx';
import { SLIDE_W, SLIDE_H, clamp } from './boardConstants.js';

const RENDERERS = {
  sticky: StickyNote,
  kanban: KanbanCard,
  text: TextBox,
  poll: PollBlock,
  iframe: IframeWindow,
  shape: ShapeBlock,
};

/**
 * Positions one element on the slide and owns its interaction surface:
 * selection, native-pointer drag, SE-corner resize, double-click-to-edit, and a
 * delete affordance. During a gesture it renders from local `live` geometry for
 * smooth motion while throttled writes flow to Yjs underneath; once the gesture
 * ends, `live` clears and the element renders straight from synced state.
 */
export default function BoardElement({
  element,
  getScale,
  selected,
  editing,
  editable,
  onSelect,
  onStartEdit,
  onUpdate,
  onUpdateProps,
  onDelete,
  onBringToFront,
  // Connector link-mode
  connectMode,
  connectSource,
  onConnectClick,
  // Graduation drag (stickies → kanban)
  snapStep = 0,
  graduationTarget,
  onDragMove,
  onDragEnd,
  // Poll-specific wiring
  votes,
  bumpVote,
  boardId,
  // Kanban assignee options (board members)
  members,
  activeTool,
}) {
  const [live, setLive] = useState(null); // { x?, y?, w?, h? } gesture override
  const lastClickRef = useRef({ time: 0, x: 0, y: 0 }); // track clicks for double-click detection

  // Keep elements inside the slide so content never flows off the page.
  const clampX = (x) => clamp(x, 0, Math.max(0, SLIDE_W - element.w));
  const clampY = (y) => clamp(y, 0, Math.max(0, SLIDE_H - element.h));
  const fitW = (w) => Math.min(w, SLIDE_W - element.x);
  const fitH = (h) => Math.min(h, SLIDE_H - element.y);

  const { dragging, startDrag } = useElementDrag({
    getScale,
    snapStep,
    onPreview: (x, y) => {
      const cx = clampX(x);
      const cy = clampY(y);
      setLive((p) => ({ ...p, x: cx, y: cy }));
      onDragMove?.(element.id, cx, cy);
    },
    onCommit: (x, y) => onUpdate(element.id, { x: clampX(x), y: clampY(y) }),
    onEnd: (x, y) => onDragEnd?.(element.id, clampX(x), clampY(y)),
  });

  const { resizing, startResize } = useElementResize({
    getScale,
    onPreview: (w, h) => setLive((p) => ({ ...p, w: fitW(w), h: fitH(h) })),
    onCommit: (w, h) => onUpdate(element.id, { w: fitW(w), h: fitH(h) }),
  });

  // Once both gestures settle, drop the local override (synced value now matches).
  useEffect(() => {
    if (!dragging && !resizing) setLive(null);
  }, [dragging, resizing]);

  const geom = {
    x: live?.x ?? element.x,
    y: live?.y ?? element.y,
    w: live?.w ?? element.w,
    h: live?.h ?? element.h,
  };

  const Renderer = RENDERERS[element.type];
  if (!Renderer) return null;

  const handleBodyPointerDown = (e) => {
    // Stop the slide background from treating this as an empty-canvas click
    // (which would deselect or spawn a new element).
    e.stopPropagation();
    // Connector tool: clicking an element picks it as a link endpoint instead
    // of selecting/dragging.
    if (connectMode) {
      onConnectClick(element.id);
      return;
    }
    onSelect(element.id);
    onBringToFront(element.id);

    // Prevent drag from starting on the first click of a double-click
    // (300ms threshold, ~20px distance threshold)
    const now = performance.now();
    const lastClick = lastClickRef.current;
    const timeSinceLastClick = now - lastClick.time;
    const distSinceLastClick = Math.sqrt(Math.pow(e.clientX - lastClick.x, 2) + Math.pow(e.clientY - lastClick.y, 2));
    const isDoubleClickCandidate = timeSinceLastClick < 300 && distSinceLastClick < 20;

    lastClickRef.current = { time: now, x: e.clientX, y: e.clientY };

    if (editable && !editing && !isDoubleClickCandidate) startDrag(e, element);
  };

  return (
    <div
      className="absolute select-none"
      style={{
        left: geom.x,
        top: geom.y,
        width: geom.w,
        height: geom.h,
        zIndex: (element.z ?? 1) + (selected ? 1000 : 0),
        cursor: connectMode ? 'crosshair' : editing ? 'text' : 'move',
        pointerEvents: (activeTool && activeTool !== 'pointer' && !connectMode && !editing) ? 'none' : 'auto',
      }}
      onPointerDown={handleBodyPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (editable && !connectMode) onStartEdit(element.id);
      }}
    >
      {/* Selection ring */}
      {selected && !connectMode && (
        <div className="absolute -inset-0.75 rounded-[9px] ring-2 ring-blue-500/80 pointer-events-none" />
      )}
      {/* Connector affordance: highlight the chosen source / hint targets */}
      {connectMode && (
        <div
          className={`absolute -inset-0.75 rounded-[9px] pointer-events-none ring-2 ${
            connectSource ? 'ring-blue-500' : 'ring-blue-400/40'
          }`}
        />
      )}
      {/* Graduation drop-zone: this card is the active drop target for a sticky */}
      {graduationTarget && (
        <div className="absolute -inset-1 rounded-xl pointer-events-none ring-2 ring-emerald-500 ring-offset-2 ring-offset-transparent bg-emerald-500/10" />
      )}
      {/* Hint shown on a sticky as it's dragged over a drop target */}
      {dragging && element.type === 'sticky' && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-semibold whitespace-nowrap shadow pointer-events-none opacity-90">
          Drop on a card to graduate →
        </div>
      )}

      <Renderer
        element={{ ...element, ...geom }}
        editable={editable}
        editing={editing}
        selected={selected}
        onEditProps={(patch) => onUpdateProps(element.id, patch)}
        onUpdateElement={(patch) => onUpdate(element.id, patch)}
        votes={votes}
        bumpVote={bumpVote}
        boardId={boardId}
        members={members}
        getScale={getScale}
      />

      {/* Delete + resize affordances (editor only, when selected) */}
      {selected && editable && !connectMode && (
        <>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(element.id);
            }}
            className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-rose-500 text-white shadow-md flex items-center justify-center hover:bg-rose-600 transition"
            style={{ cursor: 'pointer' }}
            title="Delete element"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div
            onPointerDown={(e) => startResize(e, element)}
            className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-sm bg-white border-2 border-blue-500 cursor-nwse-resize shadow"
            title="Resize"
          />
        </>
      )}
    </div>
  );
}
