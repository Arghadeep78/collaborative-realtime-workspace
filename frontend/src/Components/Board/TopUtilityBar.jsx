import { useState } from 'react';
import { UI, TOOLS, LAYOUT_MODES } from './boardConstants.js';

const BG_PATTERNS = [
  { id: 'dots',  label: 'Dots',  preview: 'radial-gradient(circle, rgba(15,23,42,0.15) 1.5px, transparent 1.5px)', size: '12px 12px' },
  { id: 'grid',  label: 'Grid',  preview: 'linear-gradient(to right,rgba(15,23,42,0.1) 1px,transparent 1px),linear-gradient(to bottom,rgba(15,23,42,0.1) 1px,transparent 1px)', size: '12px 12px' },
  { id: 'lines', label: 'Lines', preview: 'linear-gradient(to bottom,rgba(15,23,42,0.1) 1px,transparent 1px)', size: '12px 12px' },
  { id: 'none',  label: 'Clean', preview: 'none', size: 'auto' },
];

const BG_COLORS = [
  '#ffffff', '#f1f5f9', '#0f172a', '#eff6ff', 
  '#f0fdf4', '#fefce8', '#fef2f2',
];

function BackgroundPicker({ activePage, onUpdateBackground, editable }) {
  const [open, setOpen] = useState(false);
  const [imgUrl, setImgUrl] = useState('');
  const bg = activePage?.background;

  if (!editable) return null;

  const set = (patch) => onUpdateBackground(patch);
  const currentType = bg?.type || 'dots';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Board background"
        className={`${UI.iconBtn} ${open ? UI.iconBtnActive : ''}`}
      >
        <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute top-full mt-2 right-0 w-64 rounded-2xl p-4 z-50 flex flex-col gap-3 ${UI.surfaceSolid}`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400">Pattern</p>
            <div className="grid grid-cols-4 gap-2">
              {BG_PATTERNS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => set({ type: p.id, value: bg?.value || '' })}
                  title={p.label}
                  className={`flex flex-col items-center gap-1 rounded-xl p-1.5 border-2 transition ${
                    currentType === p.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600'
                  }`}
                >
                  <div
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600"
                    style={{ height: 36, backgroundImage: p.preview, backgroundSize: p.size, backgroundColor: 'white' }}
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{p.label}</span>
                </button>
              ))}
            </div>

            <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400">Color</p>
            <div className="grid grid-cols-8 gap-1.5 items-center relative">
              {BG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => set({ type: currentType === 'image' || currentType === 'solid' ? 'solid' : currentType, value: c })}
                  title={c}
                  className={`w-7 h-7 rounded-full border-2 transition ${
                    bg?.value === c ? 'border-blue-500 scale-110' : 'border-transparent hover:border-slate-300'
                  }`}
                  style={{ backgroundColor: c, boxShadow: c === '#ffffff' ? '0 0 0 1px #e2e8f0 inset' : undefined }}
                />
              ))}
              
              {/* Custom Color Wheel */}
              <label 
                title="Custom Color"
                className={`relative w-7 h-7 rounded-full border-2 cursor-pointer transition flex items-center justify-center overflow-hidden shrink-0 ${
                  bg?.value && !BG_COLORS.includes(bg.value) ? 'border-blue-500 scale-110' : 'border-transparent hover:border-slate-300'
                }`}
                style={{
                  background: 'conic-gradient(from 180deg at 50% 50%, #ff0000 0deg, #ff8a00 60deg, #ffe500 120deg, #14ff00 180deg, #00a3ff 240deg, #0500ff 300deg, #ff0000 360deg)'
                }}
              >
                <input
                  type="color"
                  value={bg?.value || '#ffffff'}
                  onChange={(e) => set({ type: currentType === 'image' || currentType === 'solid' ? 'solid' : currentType, value: e.target.value })}
                  className="opacity-0 w-[150%] h-[150%] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                />
              </label>
            </div>

            <p className="text-[11px] font-bold tracking-widest uppercase text-slate-400">Image URL</p>
            <div className="flex gap-2">
              <input
                value={imgUrl}
                onChange={(e) => setImgUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && imgUrl.trim()) { set({ type: 'image', value: imgUrl.trim() }); setImgUrl(''); } }}
                placeholder="https://…"
                className={`flex-1 text-[12px] ${UI.input} py-1.5`}
              />
              <button
                onClick={() => { if (imgUrl.trim()) { set({ type: 'image', value: imgUrl.trim() }); setImgUrl(''); } }}
                className={`${UI.primaryBtn} px-3 py-1.5 rounded-xl text-[12px] font-semibold`}
              >
                Set
              </button>
            </div>
            
            <div className="flex items-center gap-2 mt-1">
              {[
                { id: 'clouds', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&q=80', label: 'Clouds' },
                { id: 'watercolor', url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&q=80', label: 'Watercolor' },
                { id: 'abstract', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&q=80', label: 'Abstract' },
                { id: 'stars', url: 'https://images.unsplash.com/photo-1534796636912-36528502c5c0?w=800&q=80', label: 'Stars' }
              ].map((img) => (
                <button
                  key={img.id}
                  title={img.label}
                  onClick={() => set({ type: 'image', value: img.url })}
                  className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition ${
                    bg?.value === img.url ? 'border-blue-500 scale-105 shadow-md' : 'border-transparent hover:border-slate-300'
                  }`}
                  style={{ backgroundImage: `url(${img.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                />
              ))}
            </div>

            {currentType === 'image' && bg?.value && (
              <button onClick={() => set({ type: 'dots', value: '' })} className="self-start text-[12px] text-rose-500 hover:text-rose-600 font-medium mt-1">
                Remove image
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Inline tool glyphs (we own our chrome — no library icon set).
function ToolGlyph({ id }) {
  const common = { className: 'w-[18px] h-[18px]', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (id) {
    case 'pointer':
      return <svg {...common}><path d="M3 3l7.5 18 2.3-7.2L20 11.5 3 3z" /></svg>;
    case 'sticky':
      return <svg {...common}><path d="M4 4h16v11l-5 5H4z" /><path d="M20 15h-5v5" /></svg>;
    case 'kanban':
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h10M7 13h6" /></svg>;
    case 'text':
      return <svg {...common}><path d="M4 6V4h16v2M9 20h6M12 4v16" /></svg>;
    case 'connector':
      return <svg {...common}><circle cx="5" cy="6" r="2" /><circle cx="19" cy="18" r="2" /><path d="M7 7l10 10" /></svg>;
    case 'poll':
      return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
    case 'iframe':
      return <svg {...common}><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 9h18M8 14h4" /></svg>;
    case 'shape':
      return <svg {...common}><rect x="4" y="4" width="7" height="7" rx="1" /><circle cx="17" cy="7" r="3" /><polygon points="12,16 16,22 8,22" /></svg>;
    case 'laser':
      return (
        <svg {...common} strokeWidth="2.5">
          <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
          <path d="M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * Fixed top bar: board identity (left), the element toolbar + layout-engine
 * toggle (centre), and presence / account / share (right). All bespoke chrome —
 * the only thing borrowed is the existing ShareModal it opens.
 */
export default function TopUtilityBar({
  board,
  role,
  editable,
  isEditingTitle,
  titleInput,
  setTitleInput,
  saveTitle,
  setEditTitle,
  activeTool,
  onSelectTool,
  layoutMode,
  onSelectLayout,
  peers,
  userData,
  showUserMenu,
  setShowUserMenu,
  navigate,
  onSignOut,
  onShare,
  isDark,
  toggleTheme,
  activePage,
  onUpdateBackground,
  onPresent,
}) {
  return (
    <header className="relative z-50 shrink-0 flex items-center gap-3 px-3 py-2.5">
      {/* ── Left: identity ─────────────────────────────────────────── */}
      <div className={`flex items-center gap-2.5 rounded-2xl px-3 py-1.5 ${UI.surface}`}>
        <button onClick={() => navigate('/dashboard')} className={UI.iconBtn} title="Back to dashboard">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </button>
        <div className="hidden sm:flex items-center gap-2">
          <span className={UI.logo}>Collab</span>
          <span className={UI.lite}>Board</span>
        </div>
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
        {isEditingTitle ? (
          <input
            autoFocus
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
            className={`${UI.input} text-sm w-32 sm:w-44 py-1`}
          />
        ) : (
          <button
            onClick={() => editable && setEditTitle(true)}
            className="text-slate-900 dark:text-slate-100 font-medium text-sm hover:bg-black/5 dark:hover:bg-white/5 px-2 py-1 rounded-lg transition max-w-32 sm:max-w-[14rem] truncate"
          >
            {board?.title || 'Untitled Board'}
          </button>
        )}
        {role === 'viewer' && <span className={UI.chip}>View Only</span>}
      </div>

      {/* ── Centre: element toolbar + layout engine ────────────────── */}
      <div className="flex-1 flex items-center justify-center gap-2">
        <div className={`flex items-center gap-1 rounded-2xl p-1.5 ${UI.surface}`}>
          {TOOLS.map((tool) => {
            const active = activeTool === tool.id;
            // Laser is always available (viewers can use it too); everything else requires editor role.
            const disabled = tool.disabled || (!editable && tool.id !== 'pointer' && tool.id !== 'laser');
            return (
              <button
                key={tool.id}
                disabled={disabled}
                onClick={() => onSelectTool(tool.id)}
                title={`${tool.label}${tool.disabled ? ' (coming soon)' : ` · ${tool.key}`}`}
                className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition ${
                  active
                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400/50'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/5'
                } ${disabled ? 'opacity-35 cursor-not-allowed' : ''}`}
              >
                <ToolGlyph id={tool.id} />
                <span className="absolute bottom-0.5 right-1 text-[8px] font-bold text-slate-400">{tool.key}</span>
              </button>
            );
          })}
        </div>

        {/* Layout engine toggle */}
        <div className={`hidden md:flex items-center gap-0.5 rounded-2xl p-1 ${UI.surface}`}>
          {LAYOUT_MODES.map((mode) => (
            <button
              key={mode.id}
              disabled={mode.disabled || !editable}
              onClick={() => onSelectLayout(mode.id)}
              title={mode.disabled ? `${mode.label} (coming soon)` : `${mode.label} layout`}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                layoutMode === mode.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-900/5 dark:hover:bg-white/5'
              } ${mode.disabled || !editable ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Background picker */}
        <BackgroundPicker activePage={activePage} onUpdateBackground={onUpdateBackground} editable={editable} />
      </div>

      {/* ── Right: presence + account + share ──────────────────────── */}
      <div className={`flex items-center gap-2 rounded-2xl pl-2.5 pr-1.5 py-1.5 ${UI.surface}`}>
        <div className="flex items-center -space-x-1.5">
          {peers.slice(0, 4).map((peer) => (
            <div
              key={peer.clientId}
              title={peer.name}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold border-2 border-white dark:border-slate-800 shadow-sm"
              style={{ backgroundColor: peer.color }}
            >
              {peer.name?.[0]?.toUpperCase() || '?'}
            </div>
          ))}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-1 bg-emerald-50/80 dark:bg-emerald-900/30 pl-1.5 pr-1 py-1 rounded-full border border-emerald-100/80 dark:border-emerald-800/50 shadow-sm hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 transition"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-[11px] font-bold">
              {userData.name?.[0]?.toUpperCase() || userData.email?.[0]?.toUpperCase() || '?'}
            </div>
            <svg className={`w-3 h-3 text-slate-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showUserMenu && (
            <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl py-2 z-50 ${UI.surfaceSolid}`}>
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{userData.name || 'User'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{userData.email || ''}</p>
              </div>
              <button onClick={() => { setShowUserMenu(false); navigate('/dashboard'); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5 transition">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                Dashboard
              </button>
              <button onClick={() => { setShowUserMenu(false); navigate('/profile'); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5 transition">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Profile
              </button>
              <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
              <button onClick={() => { toggleTheme(); setShowUserMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5 transition">
                {isDark ? (
                  <>
                    <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
                    Switch to Light Mode
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
                    Switch to Dark Mode
                  </>
                )}
              </button>
              <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
              <button onClick={onSignOut} className="w-full text-left px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2.5 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Sign Out
              </button>
            </div>
          )}
        </div>

        <button onClick={onPresent} className={`text-sm font-semibold px-4 py-1.5 rounded-full flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all`}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
          Present
        </button>

        <button onClick={onShare} className={`text-sm font-semibold px-4 py-1.5 rounded-full flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all`}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          Share
        </button>
      </div>
    </header>
  );
}
