import { UI, GRID_COLORS } from './whiteboardConstants.js';

export default function LeftToolbar({
  toolbarRef,
  activeTool,
  activeColor,
  handleToolSelect,
  handleUndo,
  handleRedo,
}) {
  const colorHex = GRID_COLORS.find(c => c.id === activeColor)?.hex ?? '#3b82f6';

  const colorDot = (
    <span
      className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full border border-white shadow-sm pointer-events-none"
      style={{ backgroundColor: colorHex }}
    />
  );

  const Btn = ({ tool, title, hasColorDot, isActive, children }) => {
    const active = isActive ?? activeTool === tool;
    return (
      <button
        onClick={() => handleToolSelect(tool)}
        title={title}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative
          ${active
            ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
      >
        {children}
        {hasColorDot && active && colorDot}
      </button>
    );
  };

  const geoActive = activeTool === 'geo' || activeTool === 'line' || activeTool === 'arrow';

  return (
    <div
      ref={toolbarRef}
      className="absolute left-4 top-1/2 -translate-y-1/2 z-30"
      style={{ maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}
    >
      <div className={`rounded-[20px] p-2 flex flex-col gap-1 ${UI.surfaceSolid}`}>

        {/* Select */}
        <Btn tool="select" title="Select (V)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" />
          </svg>
        </Btn>

        {/* Hand */}
        <Btn tool="hand" title="Hand (H)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
            <path d="M18 11v5a8 8 0 0 1-16 0v-5a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v0" />
            <path d="M6 14v-1a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v0" />
          </svg>
        </Btn>

        <div className="h-px bg-slate-100 dark:bg-slate-700 mx-1 my-0.5" />

        {/* Pen */}
        <Btn tool="draw" title="Pen (P)" hasColorDot isActive={activeTool === 'draw' || activeTool === 'highlight'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
        </Btn>

        {/* Eraser */}
        <Btn tool="eraser" title="Eraser (E)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L20 9C20.5 9.5 20.5 10.5 20 11L11 20H20V20Z" />
          </svg>
        </Btn>

        <div className="h-px bg-slate-100 dark:bg-slate-700 mx-1 my-0.5" />

        {/* Shapes (geo) */}
        <Btn tool="geo" title="Shapes" hasColorDot isActive={geoActive}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <circle cx="17.5" cy="6.5" r="3.5" />
            <polygon points="6.5,14 10,21 3,21" strokeLinejoin="round" />
            <path d="M14 14l6 6m0-6v6h-6" />
          </svg>
        </Btn>

        {/* Line */}
        <Btn tool="line" title="Line" hasColorDot>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="20" x2="20" y2="4" />
          </svg>
        </Btn>

        {/* Arrow */}
        <Btn tool="arrow" title="Arrow" hasColorDot>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="20" x2="20" y2="4" /><polyline points="14 4 20 4 20 10" />
          </svg>
        </Btn>

        <div className="h-px bg-slate-100 dark:bg-slate-700 mx-1 my-0.5" />

        {/* Sticky Note */}
        <Btn tool="note" title="Sticky Note (N)" hasColorDot>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 15l-6 6H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
            <path d="M19 15l-6 6v-6h6z" />
          </svg>
        </Btn>

        {/* Text */}
        <Btn tool="text" title="Text (T)" hasColorDot>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7V4h16v3" /><path d="M12 4v16" /><path d="M8 20h8" />
          </svg>
        </Btn>

        <div className="h-px bg-slate-100 dark:bg-slate-700 mx-1 my-0.5" />

        {/* Undo */}
        <button
          onClick={handleUndo}
          title="Undo (⌘Z)"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v6h6" /><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
          </svg>
        </button>

        {/* Redo */}
        <button
          onClick={handleRedo}
          title="Redo (⌘⇧Z)"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 7v6h-6" /><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7" />
          </svg>
        </button>

      </div>
    </div>
  );
}
