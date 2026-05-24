const fs = require('fs');
const file = '/Users/arghadeep/Desktop/distributed-vector-workspace/frontend/src/Components/Board/BoardRoom.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. imports and useBoardSync
content = content.replace(
  '    votes,\n    bumpVote,\n    addElement,',
  '    votes,\n    castPollVote,\n    removePollVote,\n    addElement,'
);

// 2. State & effects
const stateReplacement = `
  const [boardId, setBoardId] = useState(id);
  const [synced, setSynced] = useState(false);

  const boardRoomRef = useRef(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setSidebarCollapsed(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setPresentationMode(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);
`;
content = content.replace(
  '  const [boardId, setBoardId] = useState(id);\n  const [synced, setSynced] = useState(false);',
  stateReplacement
);

// 3. Slide navigation keyboard shortcuts
const keyNav = `
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
  }, [pages, activePageId, selectPage]);

  // ── Sync connection ────────────────────────────────────────────────────────
`;
content = content.replace('  // ── Sync connection ────────────────────────────────────────────────────────', keyNav);

// 4. Return statement modifications
content = content.replace('<div className={`w-screen h-screen flex flex-col transition-colors', '<div ref={boardRoomRef} className={`w-screen h-screen flex flex-col transition-colors');

const topBarRepl = `
      {!presentationMode && (
        <TopUtilityBar
`;
content = content.replace('      <TopUtilityBar', topBarRepl);

content = content.replace('onUpdateBackground={handleUpdateBackground}\n        />', 'onUpdateBackground={handleUpdateBackground}\n          onPresent={() => boardRoomRef.current?.requestFullscreen().catch(e => console.error(e))}\n        />\n      )}');

const layoutRepl = `
      <div className="flex-1 flex min-h-0 relative">
        {!presentationMode && (
          <Sidebar
            pages={pages}
            elements={elements}
            activePageId={activePageId}
            editable={editable}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(c => !c)}
            onSelectPage={selectPage}
            onAddPage={() => { const id = addPage(); if (id) selectPage(id); }}
            onRenamePage={renamePage}
            onDeletePage={deletePage}
          />
        )}

        <div className="flex-1 relative min-w-0 flex flex-col">
          <SlideCanvas
`;

content = content.replace(
  '      <div className="flex-1 flex min-h-0">\n        <Sidebar\n          pages={pages}\n          elements={elements}\n          activePageId={activePageId}\n          editable={editable}\n          collapsed={sidebarCollapsed}\n          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}\n          onSelectPage={selectPage}\n          onAddPage={() => { const id = addPage(); if (id) selectPage(id); }}\n          onRenamePage={renamePage}\n          onDeletePage={deletePage}\n        />\n\n        <SlideCanvas',
  layoutRepl
);

content = content.replace('bumpVote={bumpVote}', 'castPollVote={castPollVote}\n            removePollVote={removePollVote}');

const navButtons = `
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
`;
content = content.replace('isDark={isDark}\n        />\n      </div>', 'isDark={isDark}\n          />\n' + navButtons);

fs.writeFileSync(file, content);
