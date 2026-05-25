import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SLIDE_W, SLIDE_H, SPAWN_TOOLS, clamp } from './boardConstants.js';
import BoardElement from './BoardElement.jsx';
import ConnectorLayer from './ConnectorLayer.jsx';
import PresenceLayer from './PresenceLayer.jsx';
import RadialMenu from './RadialMenu.jsx';
import { getThemeColor } from './theme/themeUtils.js';
import { themeColors } from './theme/colorMap.js';

const FIT_PADDING = 64; // breathing room around the slide within the viewport

export function getSlideBackground(bg, isDark) {
  const defaultBg = isDark ? themeColors.boardBg.dark : themeColors.boardBg.light;
  let bgColor = bg?.value || defaultBg;
  bgColor = getThemeColor(bgColor, isDark); // Map custom board colors if any

  const gridColor = isDark ? themeColors.boardGrid.dark : themeColors.boardGrid.light;
  const gridColorLighter = isDark ? themeColors.boardGridLighter.dark : themeColors.boardGridLighter.light;

  if (!bg || bg.type === 'dots' || !bg.type) {
    return {
      backgroundImage: `radial-gradient(circle, ${gridColor} 1px, transparent 1px)`,
      backgroundSize: '32px 32px',
      backgroundColor: bgColor,
    };
  }
  if (bg.type === 'grid') {
    return {
      backgroundImage:
        `linear-gradient(to right, ${gridColorLighter} 1px, transparent 1px), linear-gradient(to bottom, ${gridColorLighter} 1px, transparent 1px)`,
      backgroundSize: '32px 32px',
      backgroundColor: bgColor,
    };
  }
  if (bg.type === 'lines') {
    return {
      backgroundImage: `linear-gradient(to bottom, ${gridColorLighter} 1px, transparent 1px)`,
      backgroundSize: '32px 32px',
      backgroundColor: bgColor,
    };
  }
  if (bg.type === 'isometric') {
    return {
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M0 20 L20 0 L40 20 L20 40 Z' fill='none' stroke='${encodeURIComponent(gridColorLighter)}' stroke-width='1'/%3E%3C/svg%3E")`,
      backgroundSize: '40px 40px',
      backgroundColor: bgColor,
    };
  }
  if (bg.type === 'none') {
    return { backgroundColor: bgColor };
  }
  if (bg.type === 'solid') {
    return { backgroundColor: bgColor };
  }
  if (bg.type === 'image') {
    return {
      backgroundImage: bg.value ? `url(${bg.value})` : undefined,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: defaultBg,
    };
  }
  return { backgroundColor: bgColor, backgroundImage: `radial-gradient(circle, ${gridColor} 1px, transparent 1px)`, backgroundSize: '32px 32px' };
}

/**
 * The main canvas: one discrete fixed-size slide (presentation-style), scaled to
 * fit the available space and centred. Elements are absolutely positioned in
 * slide units. Also handles empty-canvas clicks (deselect / tool-spawn /
 * connector cancel), draws connector edges, and broadcasts this user's cursor in
 * slide coordinates for the PresenceLayer.
 *
 * Pointer tool drag on empty canvas draws a marquee selection rectangle; on
 * pointer-up all overlapping elements are added to selectedIds.
 */
export function ZoomControls({ zoomMult, setZoomMult, zoomIn, zoomOut, zoomFit }) {
  if (!setZoomMult) return null;
  return (
    <div className="flex items-center gap-1.5 pointer-events-auto">
      {/* Zoom out */}
      <button
        onClick={zoomOut}
        title="Zoom out"
        className="w-6 h-6 flex items-center justify-center rounded-full text-content-muted hover:bg-hover hover:text-content transition shrink-0"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
        </svg>
      </button>

      {/* Log-scale slider: 0→200 maps 0.25× → 1× (midpoint) → 4× */}
      <input
        type="range"
        min="0"
        max="200"
        step="1"
        value={Math.round(Math.log(zoomMult / 0.25) / Math.log(16) * 200)}
        onChange={(e) => setZoomMult(0.25 * Math.pow(16, Number(e.target.value) / 200))}
        title="Drag to zoom"
        className="w-20 h-1 accent-blue-500 cursor-pointer"
      />

      {/* Zoom in */}
      <button
        onClick={zoomIn}
        title="Zoom in"
        className="w-6 h-6 flex items-center justify-center rounded-full text-content-muted hover:bg-hover hover:text-content transition shrink-0"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Percentage / fit reset */}
      <button
        onClick={zoomFit}
        title="Reset to fit view"
        className="min-w-10 text-[11px] font-semibold text-content-muted text-center hover:text-blue-600 dark:hover:text-blue-400 transition tabular-nums"
      >
        {Math.abs(zoomMult - 1) < 0.01 ? 'Fit' : `${Math.round(zoomMult * 100)}%`}
      </button>
    </div>
  );
}

export default function SlideCanvas({
  elements,
  activePageId,
  editable,
  activeTool,
  onSelectTool,
  onToolConsumed,
  selectedId,
  selectedIds,
  editingId,
  onSelect,
  onToggleSelect,
  onSelectGroup,
  onStartEdit,
  onStopEdit,
  onUpdate,
  onUpdateProps,
  onDelete,
  onElementContextMenu,
  onCreate,
  peers,
  onCursor,
  onCursorLeave,
  // Multi-select group drag
  groupDragOffset,
  onGroupDragPreview,
  onGroupDragCommit,
  onGroupDragEnd,
  // Connector link-mode
  connectFromId,
  onConnectClick,
  onConnectCancel,
  // Graduation drag
  snapStep = 0,
  graduationTargetId,
  onDragMove,
  onDragEnd,
  // Poll wiring
  votes,
  castPollVote,
  removePollVote,
  canVote,
  canComment,
  boardId,
  // Kanban assignee options
  members,
  photoMap = {},
  // Active page (background)
  activePage,
  isDark,
  zoomMult,
  setZoomMult,
  zoomIn,
  zoomOut,
  zoomFit,
  presentationMode,
}) {
  const containerRef = useRef(null);
  const slideRef = useRef(null);
  const [fitScale, setFitScale] = useState(1);
  const scale = fitScale * zoomMult;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const fitScaleRef = useRef(fitScale);
  fitScaleRef.current = fitScale;
  const getScale = useCallback(() => scaleRef.current, []);

  // Double-click-empty radial quick-spawn (container-relative coords + slide pt).
  const [radial, setRadial] = useState(null);

  const connectMode = editable && activeTool === 'connector';
  const laserMode = activeTool === 'laser';
  const [linkPoint, setLinkPoint] = useState(null);   // rubber-band pointer (slide coords)
  const [laserClient, setLaserClient] = useState(null); // local laser dot (screen coords)
  const connectRef = useRef({ on: false, from: null });
  const activeToolRef = useRef(activeTool);
  connectRef.current = { on: connectMode, from: connectFromId };
  activeToolRef.current = activeTool;

  // Marquee selection state (slide coordinates)
  const [marquee, setMarquee] = useState(null); // { start: {x,y}, end: {x,y} }
  const marqueeCleanup = useRef(null);

  // Track the laser dot in screen coordinates at the window level so it floats
  // above ALL UI — including the top toolbar, which lives in its own stacking
  // context and would otherwise clip/cover a dot rendered inside the slide.
  useEffect(() => {
    if (!laserMode) { setLaserClient(null); return; }
    const onMove = (e) => setLaserClient({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [laserMode]);

  // Fit the slide to the container whenever either resizes.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const recompute = () => {
      const { clientWidth: cw, clientHeight: ch } = el;
      // We subtract this from the available height so the fitScale shrinks the slide
      // enough that its centered top edge clears the toolbar without creating a massive bottom gap.
      const heightFit = (ch - FIT_PADDING) / SLIDE_H;
      const widthFit = (cw - FIT_PADDING) / SLIDE_W;
      const next = clamp(Math.min(heightFit, widthFit), 0.35, 2);
      setFitScale(next);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [presentationMode]);

  // Stores the cursor's slide-space position + viewport offset just before each
  // wheel zoom so the layout effect can scroll to keep that point fixed.
  const zoomAnchorRef = useRef(null);

  // After every zoomMult change triggered by the wheel, shift scroll so the
  // cursor-pinned slide point stays visually fixed under the pointer.
  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    if (!anchor) return;
    zoomAnchorRef.current = null;
    const container = containerRef.current;
    const slide = slideRef.current;
    if (!container || !slide) return;

    // Where the anchored slide point now appears in the viewport (new scale,
    // scroll not yet adjusted — getBoundingClientRect reflects live DOM).
    const sr = slide.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    const currentX = sr.left - cr.left + anchor.cursorSlideX * scale;
    const currentY = sr.top - cr.top + anchor.cursorSlideY * scale;

    container.scrollLeft += currentX - anchor.viewportX;
    container.scrollTop += currentY - anchor.viewportY;
  }, [zoomMult]); // scale is derived from zoomMult so it's up-to-date here

  // Ctrl+wheel zoom — capture cursor anchor synchronously before updating state.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const cr = el.getBoundingClientRect();
      if (e.clientX < cr.left || e.clientX > cr.right || e.clientY < cr.top || e.clientY > cr.bottom) return;
      e.preventDefault();

      const slide = slideRef.current;
      if (slide) {
        const sr = slide.getBoundingClientRect();
        zoomAnchorRef.current = {
          cursorSlideX: (e.clientX - sr.left) / scaleRef.current,
          cursorSlideY: (e.clientY - sr.top) / scaleRef.current,
          viewportX: e.clientX - cr.left,
          viewportY: e.clientY - cr.top,
        };
      }

      const factor = e.deltaY < 0 ? 1.04 : 1 / 1.04;
      setZoomMult(prev => clamp(prev * factor, 0.1 / fitScaleRef.current, 4 / fitScaleRef.current));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setZoomMult]);

  // Split the active slide's elements: connectors paint in their own SVG layer;
  // everything else paints back-to-front by z as positioned divs.
  const { pageElements, pageConnectors } = useMemo(() => {
    const all = Object.values(elements).filter((e) => e.pageId === activePageId);
    return {
      pageElements: all
        .filter((e) => e.type !== 'connector')
        .sort((a, b) => (a.z ?? 0) - (b.z ?? 0)),
      pageConnectors: all.filter((e) => e.type === 'connector'),
    };
  }, [elements, activePageId]);

  // Keep a ref so the marquee pointerup closure sees the latest elements
  const pageElementsRef = useRef(pageElements);
  pageElementsRef.current = pageElements;

  // Convert a screen point to slide coordinates via the slide's live rect.
  const toSlide = useCallback((clientX, clientY) => {
    const rect = slideRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (clientX - rect.left) / scaleRef.current,
      y: (clientY - rect.top) / scaleRef.current,
    };
  }, []);

  // Throttle cursor broadcasts (and the link rubber-band) to one per frame.
  const cursorRaf = useRef(null);
  const lastPoint = useRef({ x: 0, y: 0 });
  const handlePointerMove = useCallback(
    (e) => {
      lastPoint.current = { x: e.clientX, y: e.clientY };
      if (cursorRaf.current) return;
      cursorRaf.current = requestAnimationFrame(() => {
        cursorRaf.current = null;
        const pt = toSlide(lastPoint.current.x, lastPoint.current.y);
        if (!pt) return;
        onCursor(pt.x, pt.y, activeToolRef.current === 'laser');
        if (connectRef.current.on && connectRef.current.from) setLinkPoint(pt);
      });
    },
    [toSlide, onCursor],
  );

  useEffect(() => () => cursorRaf.current && cancelAnimationFrame(cursorRaf.current), []);
  useEffect(() => { if (!connectMode || !connectFromId) setLinkPoint(null); }, [connectMode, connectFromId]);

  // Cancel active marquee when switching away from pointer tool
  useEffect(() => {
    if (activeTool !== 'pointer' && marqueeCleanup.current) {
      marqueeCleanup.current();
      marqueeCleanup.current = null;
      setMarquee(null);
    }
  }, [activeTool]);

  // Unified pointer-down handler attached to the outer container so drags can
  // start from the grey area outside the slide, not just on the white surface.
  // Element clicks never reach here because BoardElement calls stopPropagation.
  const handleContainerPointerDown = (e) => {
    if (e.button !== 0) return;

    const pt = toSlide(e.clientX, e.clientY);
    const isOnSlide = pt && pt.x >= 0 && pt.x <= SLIDE_W && pt.y >= 0 && pt.y <= SLIDE_H;

    if (connectMode) {
      // Cancel connect from anywhere; only meaningful if click was on slide
      if (isOnSlide) { onConnectCancel(); onSelect(null); }
      return;
    }
    if (!editable) {
      onSelect(null);
      onStopEdit();
      return;
    }

    // Spawn tools only place elements on the slide surface
    if (activeTool && SPAWN_TOOLS.includes(activeTool) && isOnSlide && pt) {
      onCreate(activeTool, pt.x, pt.y);
      onToolConsumed();
      return;
    }

    // Pointer tool: start a marquee drag from anywhere in the container
    if ((!activeTool || activeTool === 'pointer') && pt) {
      onStopEdit();
      let end = { ...pt };
      setMarquee({ start: { ...pt }, end });

      const onMove = (ev) => {
        const movePt = toSlide(ev.clientX, ev.clientY);
        if (!movePt) return;
        end = movePt;
        setMarquee((m) => (m ? { start: m.start, end: movePt } : null));
      };

      const onUp = () => {
        cleanup();
        const w = Math.abs(end.x - pt.x);
        const h = Math.abs(end.y - pt.y);
        setMarquee(null);
        if (w < 5 && h < 5) {
          // Tiny drag = click → deselect all
          onSelect(null);
        } else {
          const left = Math.min(pt.x, end.x);
          const top = Math.min(pt.y, end.y);
          const right = Math.max(pt.x, end.x);
          const bot = Math.max(pt.y, end.y);
          const ids = pageElementsRef.current
            .filter((el) => el.x < right && el.x + el.w > left && el.y < bot && el.y + el.h > top)
            .map((el) => el.id);
          onSelectGroup(ids);
        }
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        marqueeCleanup.current = null;
      };

      marqueeCleanup.current = cleanup;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      return;
    }

    onSelect(null);
    onStopEdit();
  };

  const creating = editable && SPAWN_TOOLS.includes(activeTool);

  // Double-click on empty slide → radial quick-spawn at that point.
  const handleSlideDoubleClick = (e) => {
    if (!editable || connectMode || e.target !== slideRef.current) return;
    const cRect = containerRef.current?.getBoundingClientRect();
    const pt = toSlide(e.clientX, e.clientY);
    if (!cRect || !pt) return;
    setRadial({
      menuX: e.clientX - cRect.left + (containerRef.current?.scrollLeft ?? 0),
      menuY: e.clientY - cRect.top + (containerRef.current?.scrollTop ?? 0),
      slideX: pt.x, slideY: pt.y,
    });
  };

  const slideBg = getSlideBackground(activePage?.background, isDark);

  return (
    <div className="relative flex-1 min-h-0">
      {/* Local laser dot — portaled to <body> in screen coords so it floats above
        every layer (toolbar included), never clipped by the slide or header. */}
      {laserMode && laserClient && createPortal(
        <div
          className="fixed pointer-events-none rounded-full"
          style={{
            width: 10, height: 10,
            left: laserClient.x - 5,
            top: laserClient.y - 5,
            background: '#FF4A4A',
            boxShadow: '0 0 0 3px rgba(255,74,74,0.35), 0 0 10px 4px rgba(255,74,74,0.55)',
            zIndex: 2147483000,
          }}
        />,
        document.body,
      )}
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-auto"
        style={{ scrollbarGutter: 'stable', cursor: creating || connectMode ? 'crosshair' : undefined }}
        onPointerDown={handleContainerPointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={onCursorLeave}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: '0px',
            minWidth: SLIDE_W * scale + FIT_PADDING,
            minHeight: SLIDE_H * scale + FIT_PADDING,
            width: '100%',
            height: '100%',
          }}
        >
          <div className="relative shrink-0" style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}>
            <div
              ref={slideRef}
              onDoubleClick={handleSlideDoubleClick}
              className="absolute top-0 left-0 rounded-2xl shadow-[0_30px_80px_rgba(15,23,42,0.25)] ring-1 ring-black/5"
              style={{
                width: SLIDE_W,
                height: SLIDE_H,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                cursor: creating || connectMode ? 'crosshair' : laserMode ? 'none' : 'default',
                ...slideBg,
              }}
            >
              {/* Connectors sit beneath elements */}
              <ConnectorLayer
                connectors={pageConnectors}
                elements={elements}
                obstacles={pageElements}
                editable={editable}
                selectable={editable && activeTool === 'pointer'}
                selectedId={selectedId}
                onSelect={onSelect}
                onDelete={onDelete}
                pending={connectMode && connectFromId ? { fromId: connectFromId, point: linkPoint } : null}
                scale={scale}
              />

              {pageElements.map((el) => (
                <BoardElement
                  key={el.id}
                  element={el}
                  getScale={getScale}
                  selectedIds={selectedIds}
                  editing={editingId === el.id}
                  editable={editable}
                  onSelect={onSelect}
                  onToggleSelect={onToggleSelect}
                  onStartEdit={onStartEdit}
                  onUpdate={onUpdate}
                  onUpdateProps={onUpdateProps}
                  onDelete={onDelete}
                  onContextMenu={onElementContextMenu}
                  connectMode={connectMode}
                  connectSource={connectFromId === el.id}
                  onConnectClick={onConnectClick}
                  snapStep={snapStep}
                  graduationTarget={graduationTargetId === el.id}
                  onDragMove={onDragMove}
                  onDragEnd={onDragEnd}
                  groupDragOffset={groupDragOffset}
                  onGroupDragPreview={onGroupDragPreview}
                  onGroupDragCommit={onGroupDragCommit}
                  onGroupDragEnd={onGroupDragEnd}
                  votes={votes}
                  castPollVote={castPollVote}
                  removePollVote={removePollVote}
                  canVote={canVote}
                  canComment={canComment}
                  boardId={boardId}
                  members={members}
                  activeTool={activeTool}
                  peers={peers}
                  photoMap={photoMap}
                />
              ))}

              <PresenceLayer peers={peers} activePageId={activePageId} scale={scale} />

              {/* Marquee selection rectangle — clamped to slide bounds since drag
            may have started in the grey area outside the slide surface */}
              {marquee && (() => {
                const left = clamp(Math.min(marquee.start.x, marquee.end.x), 0, SLIDE_W);
                const top = clamp(Math.min(marquee.start.y, marquee.end.y), 0, SLIDE_H);
                const right = clamp(Math.max(marquee.start.x, marquee.end.x), 0, SLIDE_W);
                const bot = clamp(Math.max(marquee.start.y, marquee.end.y), 0, SLIDE_H);
                const w = right - left;
                const h = bot - top;
                if (w < 1 || h < 1) return null;
                return (
                  <div
                    className="absolute pointer-events-none rounded border border-blue-500 bg-blue-400/10"
                    style={{ left, top, width: w, height: h, zIndex: 9500 }}
                  />
                );
              })()}
            </div>
          </div>
        </div>

        {radial && (
          <RadialMenu
            x={radial.menuX}
            y={radial.menuY}
            onPick={(type) => {
              if (SPAWN_TOOLS.includes(type)) {
                onCreate(type, radial.slideX, radial.slideY);
              } else if (onSelectTool) {
                onSelectTool(type);
              }
              setRadial(null);
            }}
            onClose={() => setRadial(null)}
          />
        )}
      </div>

      {/* Zoom controls — floats over the canvas, anchored to the outer wrapper */}
      {!presentationMode && (
        <div className="absolute bottom-5 right-4 z-50 bg-surface/90 backdrop-blur-md px-2.5 py-1.5 rounded-full shadow-lg border border-edge select-none">
          <ZoomControls zoomMult={zoomMult} setZoomMult={setZoomMult} zoomIn={zoomIn} zoomOut={zoomOut} zoomFit={zoomFit} />
        </div>
      )}
    </div>
  );
}
