import { useEffect, useRef, useState } from 'react';
import { useElementDrag } from './useElementDrag.js';
import { useElementResize } from './useElementResize.js';
import StickyNote from './elements/StickyNote.jsx';
import TaskCard from './elements/TaskCard.jsx';
import TextBox from './elements/TextBox.jsx';
import PollBlock from './elements/PollBlock.jsx';
import IframeWindow from './elements/IframeWindow.jsx';
import ShapeBlock from './elements/ShapeBlock.jsx';
import MediaBlock from './elements/MediaBlock.jsx';
import { SLIDE_W, SLIDE_H, clamp, MIN_FONT, ELEMENT_MIN_DIMS, COMMENTABLE_TYPES } from './boardConstants.js';

const RENDERERS = {
  sticky: StickyNote,
  task: TaskCard,
  text: TextBox,
  poll: PollBlock,
  iframe: IframeWindow,
  shape: ShapeBlock,
  media: MediaBlock,
};

/**
 * Positions one element on the slide and owns its interaction surface:
 * selection, native-pointer drag, SE-corner resize, double-click-to-edit, and a
 * delete affordance. During a gesture it renders from local `live` geometry for
 * smooth motion while throttled writes flow to Yjs underneath; once the gesture
 * ends, `live` clears and the element renders straight from synced state.
 *
 * Multi-select: when selectedIds contains >1 element and this element is one of
 * them, dragging it mirrors the displacement to all other selected elements via
 * onGroupDragPreview/onGroupDragCommit. Non-dragged group members show the
 * offset as a positional shift (groupDragOffset applied to left/top).
 */
export default function BoardElement({
  element,
  getScale,
  selectedIds,
  groupDragOffset,
  onGroupDragPreview,
  onGroupDragCommit,
  onGroupDragEnd,
  editing,
  editable,
  onSelect,
  onToggleSelect,
  onStartEdit,
  onUpdate,
  onUpdateProps,
  onDelete,
  onContextMenu,
  onOpenTask,
  // Connector link-mode
  connectMode,
  connectSource,
  onConnectClick,
  snapStep = 0,
  // Poll-specific wiring
  votes,
  castPollVote,
  removePollVote,
  canVote,
  canComment,
  commentCount = 0,
  onOpenComments,
  boardId,
  // Kanban assignee options (board members)
  members,
  activeTool,
  peers = [],
  photoMap = {},
}) {
  const selected = selectedIds?.has(element.id) ?? false;
  const isMultiSelected = selected && (selectedIds?.size ?? 0) > 1;
  // Commenters (who aren't editors) may right-click commentable elements to
  // open the comment thread, even though they can't select/drag/edit them.
  const commentable = canComment && COMMENTABLE_TYPES.includes(element.type);

  const [live, setLive] = useState(null); // { x?, y?, w?, h?, props? } gesture override
  const lastClickRef = useRef({ time: 0, x: 0, y: 0 });
  const taskDownRef = useRef(null); // {x,y} pointer-down for task click-vs-drag detection
  const isTask = element.type === 'task';
  const resizeOriginRef = useRef(null); // captures font size at resize start
  const isGroupAnchor = useRef(false);   // true when this element is driving the group drag
  const dragOriginRef = useRef(null);    // {x,y} of this element at drag start

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
      if (isGroupAnchor.current && dragOriginRef.current) {
        onGroupDragPreview?.(
          element.id,
          cx - dragOriginRef.current.x,
          cy - dragOriginRef.current.y,
        );
      }
    },
    onCommit: (x, y) => {
      onUpdate(element.id, { x: clampX(x), y: clampY(y) });
    },
    onEnd: (x, y) => {
      const cx = clampX(x);
      const cy = clampY(y);
      if (isGroupAnchor.current && dragOriginRef.current) {
        const dx = cx - dragOriginRef.current.x;
        const dy = cy - dragOriginRef.current.y;
        const actuallyMoved = Math.abs(dx) > 2 || Math.abs(dy) > 2;
        if (actuallyMoved) {
          onGroupDragCommit?.(element.id, dx, dy);
          onGroupDragEnd?.();
        } else {
          // Tiny movement = click on group member → collapse to single selection
          onGroupDragEnd?.();
          onSelect(element.id);
        }
      }
      dragOriginRef.current = null;
      isGroupAnchor.current = false;
    },
  });

  // Returns the current font size and which prop name to write for text-bearing elements.
  const getFontInfo = (el) => {
    if (el.type === 'shape') return { fs: el.props?.fontSize ?? 28, prop: 'fontSize' };
    if (el.type === 'text') return { fs: el.props?.fontSize ?? el.props?.size ?? 34, prop: 'fontSize' };
    // Sticky: only when user has explicitly set a fontSize (otherwise autoSize formula scales naturally)
    if (el.type === 'sticky' && el.props?.fontSize) return { fs: el.props.fontSize, prop: 'fontSize' };
    return null;
  };

  const scaleFontSize = (origFs, origW, origH, newW, newH, isOverflowing) => {
    const scale = Math.sqrt((newW * newH) / (origW * origH));
    if (isOverflowing && scale > 1) return origFs;
    return Math.max(MIN_FONT, Math.round(origFs * scale));
  };

  const elementMinDims = ELEMENT_MIN_DIMS[element.type] ?? {};
  const { resizing, startResize } = useElementResize({
    getScale,
    ...elementMinDims,
    onPreview: (w, h) => {
      const fw = fitW(w), fh = fitH(h);
      const origin = resizeOriginRef.current;

      if (origin?.isOverflowing && origin.textContainer) {
        const stillOverflowing = origin.textContainer.scrollHeight > origin.textContainer.clientHeight + 2 || origin.textContainer.scrollWidth > origin.textContainer.clientWidth + 2;
        if (!stillOverflowing && fw >= origin.origW && fh >= origin.origH) {
          origin.origW = fw;
          origin.origH = fh;
          origin.isOverflowing = false;
        }
      }

      const propsPatch = origin?.fontInfo
        ? { [origin.fontInfo.prop]: scaleFontSize(origin.fontInfo.fs, origin.origW, origin.origH, fw, fh, origin.isOverflowing) }
        : null;
      setLive((p) => ({ ...p, w: fw, h: fh, ...(propsPatch && { props: propsPatch }) }));
    },
    onCommit: (w, h) => {
      const fw = fitW(w), fh = fitH(h);
      onUpdate(element.id, { w: fw, h: fh });
      const origin = resizeOriginRef.current;
      if (origin?.fontInfo) {
        onUpdateProps(element.id, { [origin.fontInfo.prop]: scaleFontSize(origin.fontInfo.fs, origin.origW, origin.origH, fw, fh, origin.isOverflowing) });
      }
    },
  });

  useEffect(() => {
    if (!dragging && !resizing) {
      setLive(null);
      resizeOriginRef.current = null;
    }
  }, [dragging, resizing]);

  // Non-anchor group members show their offset via shifted left/top.
  const groupShiftX = (isMultiSelected && !dragging && groupDragOffset) ? groupDragOffset.dx : 0;
  const groupShiftY = (isMultiSelected && !dragging && groupDragOffset) ? groupDragOffset.dy : 0;

  const geom = {
    x: (live?.x ?? element.x) + groupShiftX,
    y: (live?.y ?? element.y) + groupShiftY,
    w: live?.w ?? element.w,
    h: live?.h ?? element.h,
  };

  const Renderer = RENDERERS[element.type];
  if (!Renderer) return null;

  const handleBodyPointerDown = (e) => {
    // In draw/spawn mode let the event bubble through to the canvas for element creation
    if (editable && activeTool && activeTool !== 'pointer' && !connectMode && !editing) return;
    // Non-editors (e.g. commenters who may vote on polls) can't select or drag —
    // swallow the press here; the poll's own vote buttons stopPropagation first.
    if (!editable) { e.stopPropagation(); return; }
    e.stopPropagation();

    if (connectMode) {
      onConnectClick(element.id);
      return;
    }

    // Track the down point so a click (no drag) on a task opens its modal.
    if (isTask) taskDownRef.current = { x: e.clientX, y: e.clientY };

    // Shift+click: toggle this element in/out of the selection
    if (e.shiftKey && editable) {
      onToggleSelect?.(element.id);
      return;
    }

    // If already in a multi-selection, defer selection collapse to onEnd
    // so a drag moves all members without collapsing the selection first.
    if (isMultiSelected) {
      isGroupAnchor.current = true;
      dragOriginRef.current = { x: element.x, y: element.y };
    } else {
      isGroupAnchor.current = false;
      dragOriginRef.current = null;
      onSelect(element.id);
    }

    const now = performance.now();
    const lastClick = lastClickRef.current;
    const timeSinceLastClick = now - lastClick.time;
    const distSinceLastClick = Math.sqrt(
      Math.pow(e.clientX - lastClick.x, 2) + Math.pow(e.clientY - lastClick.y, 2),
    );
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
        width: element.type === 'task' ? Math.max(160, geom.w) : geom.w,
        height: element.type === 'task' ? Math.max(56, geom.h) : geom.h,
        zIndex: element.z ?? 1,
        cursor: connectMode ? 'crosshair' : editing ? 'text' : 'move',
        pointerEvents: (
          (!editable && !(element.type === 'poll' && canVote) && !commentable && !isTask) ||
          (activeTool && activeTool !== 'pointer' && !connectMode && !editing)
        ) ? 'none' : 'auto',
      }}
      onPointerDown={handleBodyPointerDown}
      onContextMenu={(e) => {
        // Editors get the full menu (layering + comments); commenters who can't
        // edit still get a right-click menu on commentable elements (comments
        // only). Spawn/connect modes suppress it.
        if (connectMode || (!editable && !commentable)) return;
        if (activeTool && activeTool !== 'pointer' && !editing) return;
        e.preventDefault();
        e.stopPropagation();
        if (editable) onSelect(element.id);
        onContextMenu?.(element.id, e.clientX, e.clientY);
      }}
      onClick={(e) => {
        // Non-editors clicking a task (viewers/commenters) - do nothing on single click.
        if (isTask && !editable && !connectMode) {
          e.stopPropagation();
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (isTask) {
          // Double-click opens the task modal for everyone.
          if (!connectMode) onOpenTask?.(element.id);
          return;
        }
        if (editable && !connectMode) onStartEdit(element.id);
      }}
    >
      {/* Selection ring — solid blue for single, dashed for multi-member */}
      {selected && !connectMode && (
        <div
          className="absolute -inset-0.75 rounded-[9px] pointer-events-none"
          style={{
            outline: isMultiSelected
              ? '2px dashed rgba(59,130,246,0.9)'
              : '2px solid rgba(59,130,246,0.8)',
            outlineOffset: '-1px',
          }}
        />
      )}
      {/* Connector affordance: highlight the chosen source / hint targets */}
      {connectMode && (
        <div
          className={`absolute -inset-0.75 rounded-[9px] pointer-events-none ring-2 ${connectSource ? 'ring-blue-500' : 'ring-blue-400/40'
            }`}
        />
      )}
      <Renderer
        element={{ ...element, ...geom, props: live?.props ? { ...element.props, ...live.props } : element.props }}
        editable={editable}
        editing={editing}
        selected={selected}
        onEditProps={(patch) => onUpdateProps(element.id, patch)}
        onUpdateElement={(patch) => onUpdate(element.id, patch)}
        votes={votes}
        castPollVote={castPollVote}
        removePollVote={removePollVote}
        canVote={canVote}
        boardId={boardId}
        members={members}
        getScale={getScale}
        peers={peers}
        photoMap={photoMap}
      />
      {/* Comment indicator — shown when the element has at least one comment.
          Clicking it opens the thread (works for viewers/commenters too, since
          the badge keeps its own pointer events even when the body is inert). */}
      {commentCount > 0 && !connectMode && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenComments?.(element.id);
          }}
          className="absolute -top-2.5 -left-2.5 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[11px] font-semibold flex items-center gap-0.5 shadow-md hover:bg-amber-600 transition"
          style={{ cursor: 'pointer', pointerEvents: 'auto', zIndex: 200 }}
          title={`${commentCount} comment${commentCount === 1 ? '' : 's'}`}
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2 4a2 2 0 012-2h16a2 2 0 012 2v11a2 2 0 01-2 2H7.414L4 20.414A1 1 0 012 19.707V4z" />
          </svg>
          {commentCount}
        </button>
      )}

      {/* Intercept pointer events from iframe during drag so pointermove reaches window */}
      {dragging && element.type === 'iframe' && (
        <div className="absolute inset-0 z-10" style={{ cursor: 'move' }} />
      )}

      {/* Block child content (video controls, upload zones, etc.) from capturing events in draw/spawn mode */}
      {editable && activeTool && activeTool !== 'pointer' && !connectMode && !editing && (
        <div className="absolute inset-0" style={{ zIndex: 100 }} />
      )}

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
            onPointerDown={(e) => {
              const elNode = e.target.closest('.absolute.select-none');
              const textContainer = elNode?.querySelector('.text-content-container');
              // Check if scrollHeight is strictly greater than clientHeight. Also check scrollWidth.
              // We use a small epsilon (e.g. 2px) to avoid false positives from browser subpixel rendering.
              const isOverflowing = textContainer ? textContainer.scrollHeight > textContainer.clientHeight + 2 || textContainer.scrollWidth > textContainer.clientWidth + 2 : false;
              resizeOriginRef.current = {
                origW: element.w,
                origH: element.h,
                fontInfo: getFontInfo(element),
                isOverflowing,
                textContainer
              };
              startResize(e, element);
            }}
            className={`absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-sm bg-white border-2 border-blue-500 cursor-nwse-resize shadow ${isTask ? 'hidden' : ''}`}
            title="Resize"
          />
        </>
      )}
    </div>
  );
}
