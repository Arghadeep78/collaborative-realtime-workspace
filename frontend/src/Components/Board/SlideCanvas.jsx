import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SLIDE_W, SLIDE_H, SPAWN_TOOLS, clamp } from './boardConstants.js';
import BoardElement from './BoardElement.jsx';
import ConnectorLayer from './ConnectorLayer.jsx';
import PresenceLayer from './PresenceLayer.jsx';
import RadialMenu from './RadialMenu.jsx';

const FIT_PADDING = 64; // breathing room around the slide within the viewport

function getSlideBackground(bg, isDark) {
  const defaultBg = isDark ? '#282e33' : '#ffffff';
  const bgColor = bg?.value || defaultBg;
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)';
  const gridColorLighter = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.06)';

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
  onBringToFront,
  onCreate,
  peers,
  onCursor,
  onCursorLeave,
  // Multi-select group drag
  groupDragOffset,
  onGroupDragPreview,
  onGroupDragCommit,
  onGroupDragEnd,
  onGroupDragCancel,
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
  bumpVote,
  castPollVote,
  removePollVote,
  boardId,
  // Kanban assignee options
  members,
  // Active page (background)
  activePage,
  isDark,
}) {
  const containerRef = useRef(null);
  const slideRef = useRef(null);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  scaleRef.current = scale;
  const getScale = useCallback(() => scaleRef.current, []);

  // Double-click-empty radial quick-spawn (container-relative coords + slide pt).
  const [radial, setRadial] = useState(null);

  const connectMode = editable && activeTool === 'connector';
  const laserMode   = activeTool === 'laser';
  const [linkPoint, setLinkPoint] = useState(null);   // rubber-band pointer (slide coords)
  const [laserPos, setLaserPos]   = useState(null);   // local laser dot (slide coords)
  const connectRef = useRef({ on: false, from: null });
  const activeToolRef = useRef(activeTool);
  connectRef.current = { on: connectMode, from: connectFromId };
  activeToolRef.current = activeTool;

  // Marquee selection state (slide coordinates)
  const [marquee, setMarquee] = useState(null); // { start: {x,y}, end: {x,y} }
  const marqueeCleanup = useRef(null);

  // Clear laser dot when tool changes away
  useEffect(() => { if (!laserMode) setLaserPos(null); }, [laserMode]);

  // Fit the slide to the container whenever either resizes.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const recompute = () => {
      const { clientWidth: cw, clientHeight: ch } = el;
      const heightFit = (ch - FIT_PADDING) / SLIDE_H;
      const widthFit = (cw - FIT_PADDING) / SLIDE_W;
      const next = clamp(Math.min(heightFit, widthFit), 0.35, 2);
      setScale(next);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
        if (activeToolRef.current === 'laser') setLaserPos(pt);
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
          const left  = Math.min(pt.x, end.x);
          const top   = Math.min(pt.y, end.y);
          const right = Math.max(pt.x, end.x);
          const bot   = Math.max(pt.y, end.y);
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
    setRadial({ menuX: e.clientX - cRect.left, menuY: e.clientY - cRect.top, slideX: pt.x, slideY: pt.y });
  };

  const slideBg = getSlideBackground(activePage?.background, isDark);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full overflow-auto"
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
          minWidth: SLIDE_W * scale + FIT_PADDING,
          minHeight: SLIDE_H * scale + FIT_PADDING,
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
            onBringToFront={onBringToFront}
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
            bumpVote={bumpVote}
            castPollVote={castPollVote}
            removePollVote={removePollVote}
            boardId={boardId}
            members={members}
            activeTool={activeTool}
          />
        ))}

        <PresenceLayer peers={peers} activePageId={activePageId} scale={scale} />

        {/* Local laser dot — only visible when the laser tool is active */}
        {laserMode && laserPos && (
          <div
            className="absolute pointer-events-none rounded-full"
            style={{
              width: 20, height: 20,
              left: laserPos.x - 10,
              top: laserPos.y - 10,
              background: '#FF4A4A',
              boxShadow: '0 0 0 5px rgba(255,74,74,0.35), 0 0 20px 8px rgba(255,74,74,0.55)',
              zIndex: 9000,
            }}
          />
        )}

        {/* Marquee selection rectangle — clamped to slide bounds since drag
            may have started in the grey area outside the slide surface */}
        {marquee && (() => {
          const left  = clamp(Math.min(marquee.start.x, marquee.end.x), 0, SLIDE_W);
          const top   = clamp(Math.min(marquee.start.y, marquee.end.y), 0, SLIDE_H);
          const right = clamp(Math.max(marquee.start.x, marquee.end.x), 0, SLIDE_W);
          const bot   = clamp(Math.max(marquee.start.y, marquee.end.y), 0, SLIDE_H);
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
  );
}
