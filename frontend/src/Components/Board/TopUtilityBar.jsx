import { useState } from 'react';
import { UI, TOOLS } from './boardConstants.js';
import { getThemeColor } from './theme/themeUtils';
import { BOARD_BG_COLORS as BG_COLORS, AVATAR_FALLBACK } from './theme/colorMap.js';
import Avatar from '../common/Avatar.jsx';

const BG_PATTERNS = [
  { id: 'dots', label: 'Dots', preview: 'radial-gradient(circle, rgba(15,23,42,0.25) 1.5px, transparent 1.5px)', darkPreview: 'radial-gradient(circle, rgba(255,255,255,0.2) 1.5px, transparent 1.5px)', size: '12px 12px' },
  { id: 'grid', label: 'Grid', preview: 'linear-gradient(to right,rgba(15,23,42,0.12) 1px,transparent 1px),linear-gradient(to bottom,rgba(15,23,42,0.12) 1px,transparent 1px)', darkPreview: 'linear-gradient(to right,rgba(255,255,255,0.12) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.12) 1px,transparent 1px)', size: '12px 12px' },
  { id: 'lines', label: 'Lines', preview: 'linear-gradient(to bottom,rgba(15,23,42,0.12) 1px,transparent 1px)', darkPreview: 'linear-gradient(to bottom,rgba(255,255,255,0.12) 1px,transparent 1px)', size: '12px 12px' },
  { id: 'none', label: 'Clean', preview: 'none', darkPreview: 'none', size: 'auto' },
];

function BackgroundPicker({ activePage, onUpdateBackground, editable, isDark }) {
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
        title="Project background"
        className={`relative overflow-hidden inline-flex items-center justify-center w-9 h-9 rounded-xl border transition-colors duration-200
          ${open
            ? 'border-lime-400/60 bg-lime-100 text-lime-800 shadow-sm dark:border-lime-500/40 dark:bg-lime-950/30 dark:text-lime-200'
            : 'border-slate-900/10 bg-lime-50 text-lime-700 shadow-sm hover:border-lime-300 hover:bg-lime-100 hover:text-lime-800 dark:border-white/10 dark:bg-lime-950/20 dark:text-lime-300 dark:hover:border-lime-500/40 dark:hover:bg-lime-950/30 dark:hover:text-lime-200'
          }`}
      >
        {/* Paint-palette icon — subtle, professional cue for background settings */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" className="relative z-10">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z"
            stroke="currentColor" strokeWidth="1.8" />
          <circle cx="7" cy="11" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="10" cy="7.5" r="1.2" fill="currentColor" stroke="none" opacity="0.8" />
          <circle cx="14.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" opacity="0.6" />
          <circle cx="17.5" cy="11" r="1.2" fill="currentColor" stroke="none" opacity="0.8" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full mt-2 right-0 w-72 rounded-2xl z-50 overflow-hidden"
            style={{ boxShadow: '0 8px 24px rgba(12,18,36,0.14), 0 1px 4px rgba(12,18,36,0.08)' }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="bg-surface border border-edge">

              {/* Pattern */}
              <div className="px-4 pt-4 pb-3">
                <p className="text-[10px] font-bold tracking-widest uppercase text-content-subtle mb-2.5">Pattern</p>
                <div className="grid grid-cols-4 gap-2">
                  {BG_PATTERNS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => set({ type: p.id, value: bg?.value || '' })}
                      title={p.label}
                      className={`flex flex-col items-center gap-1.5 rounded-xl p-1.5 border-2 transition-all ${currentType === p.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                          : 'border-transparent hover:border-edge hover:bg-hover'
                        }`}
                    >
                      <div
                        className="w-full rounded-lg border border-edge bg-muted"
                        style={{ height: 34, backgroundImage: isDark ? p.darkPreview : p.preview, backgroundSize: p.size }}
                      />
                      <span className="text-[10px] text-content-muted font-medium leading-none">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-edge-subtle mx-4" />

              {/* Color */}
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold tracking-widest uppercase text-content-subtle mb-2.5">Color</p>
                {/* 7 cols × 2 rows = 14 swatches + rainbow fits exactly */}
                <div className="grid grid-cols-8 gap-1.5">
                  {BG_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => set({ type: currentType === 'image' ? 'solid' : currentType, value: c })}
                      title={c}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${bg?.value === c ? 'border-blue-500 scale-110 shadow-sm' : 'border-edge hover:border-blue-400 hover:scale-105'
                        }`}
                      style={{ backgroundColor: getThemeColor(c, isDark) }}
                    />
                  ))}
                  {/* Custom colour — must be 15th cell so it lands in row 2, col 7 */}
                  <label
                    title="Custom color"
                    className={`relative w-6 h-6 rounded-full border-2 cursor-pointer transition-all overflow-hidden ${bg?.value && !BG_COLORS.includes(bg.value) ? 'border-blue-500 scale-110' : 'border-edge hover:border-blue-400 hover:scale-105'
                      }`}
                    style={{ background: 'conic-gradient(from 180deg at 50% 50%, #ff0000 0deg, #ff8a00 60deg, #ffe500 120deg, #14ff00 180deg, #00a3ff 240deg, #0500ff 300deg, #ff0000 360deg)' }}
                  >
                    <input
                      type="color"
                      value={bg?.value && bg.value.startsWith('#') ? bg.value : '#ffffff'}
                      onChange={(e) => set({ type: currentType === 'image' ? 'solid' : currentType, value: e.target.value })}
                      className="opacity-0 w-[150%] h-[150%] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              <div className="h-px bg-edge-subtle mx-4" />

              {/* Image URL */}
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold tracking-widest uppercase text-content-subtle mb-2.5">Image URL</p>
                <div className="flex gap-2">
                  <input
                    value={imgUrl}
                    onChange={(e) => setImgUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && imgUrl.trim()) { set({ type: 'image', value: imgUrl.trim() }); setImgUrl(''); } }}
                    placeholder="https://…"
                    className="flex-1 text-[12px] bg-muted border border-edge rounded-xl px-3 py-1.5 text-content placeholder:text-content-subtle focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition"
                  />
                  <button
                    onClick={() => { if (imgUrl.trim()) { set({ type: 'image', value: imgUrl.trim() }); setImgUrl(''); } }}
                    className="px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-colors shrink-0"
                  >
                    Set
                  </button>
                </div>

                {currentType === 'image' && bg?.value && (
                  <button
                    onClick={() => set({ type: 'dots', value: '' })}
                    className="mt-2.5 text-[11px] text-rose-500 hover:text-rose-600 font-medium transition-colors"
                  >
                    Remove image
                  </button>
                )}
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ToolGlyph({ id }) {
  const common = { className: 'w-[18px] h-[18px]', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (id) {
    case 'pointer':
      return <svg {...common}><path d="M3 3l7.5 18 2.3-7.2L20 11.5 3 3z" /></svg>;
    case 'sticky':
      return <svg {...common}><path d="M4 4h16v11l-5 5H4z" /><path d="M20 15h-5v5" /></svg>;
    case 'task':
      return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 12l2.5 2.5L16 9" /></svg>;
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
    case 'media':
      return (
        <svg {...common}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
        </svg>
      );
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

function PeersMenu({ peers, board }) {
  const [open, setOpen] = useState(false);

  const getRole = (email) => {
    if (!email) return 'viewer';
    if (board?.owner === email) return 'editor';
    const collab = board?.collaborators?.find((c) => c.email === email);
    if (collab) return collab.role;
    return board?.publicRole || 'viewer';
  };

  if (!peers || peers.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center -space-x-1.5 hover:opacity-90 transition-opacity"
        title="View collaborators"
      >
        {peers.slice(0, 3).map((peer, i) => (
          <div key={peer.clientId} className="relative" style={{ zIndex: 10 - i }}>
            <Avatar
              email={peer.email}
              name={peer.name}
              src={peer.profilePic}
              color={peer.color}
              size={28}
            />
          </div>
        ))}
        {peers.length > 3 && (
          <div className="w-7 h-7 rounded-full flex items-center justify-center bg-muted text-content-muted text-[10px] font-bold border-2 border-surface shadow-sm z-0">
            +{peers.length - 3}
          </div>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full mt-2 right-0 w-64 rounded-2xl z-50 overflow-hidden bg-surface border border-edge shadow-xl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-edge-subtle">
              <h3 className="text-xs font-semibold text-content">Active Members ({peers.length})</h3>
            </div>
            <div className="max-h-60 overflow-y-auto px-2 py-2 flex flex-col gap-1">
              {peers.map((peer) => (
                <div key={peer.clientId} className="flex items-center gap-3 p-2 rounded-xl hover:bg-hover transition">
                  <Avatar email={peer.email} name={peer.name} src={peer.profilePic} color={peer.color} size={32} borderClass="border-transparent" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content truncate">{peer.name}</p>
                    <p className="text-[11px] text-content-muted capitalize">{getRole(peer.email)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ToolbarCore({
  activeTool,
  onSelectTool,
  editable,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  activePage,
  onUpdateBackground,
  isDark,
  presentationMode,
}) {
  return (
    <div className={`flex items-center justify-center gap-2 ${presentationMode ? 'flex-nowrap' : 'flex-wrap px-1'}`}>
      <div className={`flex items-center gap-1 shrink-0 ${presentationMode ? '' : `rounded-2xl p-1.5 ${UI.surface}`}`}>
        {TOOLS.map((tool) => {
          const active = activeTool === tool.id;
          const disabled = tool.disabled || (!editable && tool.id !== 'pointer' && tool.id !== 'laser');
          return (
            <button
              key={tool.id}
              disabled={disabled}
              onClick={() => onSelectTool(tool.id)}
              title={`${tool.label}${tool.disabled ? ' (coming soon)' : ` · ${tool.key}`}`}
              className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition ${active
                  ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400/50'
                  : 'text-content-muted hover:bg-hover'
                } ${disabled ? 'opacity-35 cursor-not-allowed' : ''}`}
            >
              <ToolGlyph id={tool.id} />
              <span className="absolute bottom-0.5 right-1 text-[8px] font-bold text-content-subtle">{tool.key}</span>
            </button>
          );
        })}
      </div>

      {editable && (
        <div className={`flex items-center gap-1 shrink-0 ${presentationMode ? '' : `rounded-2xl p-1.5 ${UI.surface}`}`}>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo your last change (⌘Z)"
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${canUndo
                ? 'text-content-muted hover:bg-hover'
                : 'text-content-subtle opacity-35 cursor-not-allowed'
              }`}
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
            </svg>
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (⌘⇧Z)"
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${canRedo
                ? 'text-content-muted hover:bg-hover'
                : 'text-content-subtle opacity-35 cursor-not-allowed'
              }`}
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 14l5-5-5-5" />
              <path d="M20 9H10a6 6 0 0 0 0 12h3" />
            </svg>
          </button>
        </div>
      )}

      {!presentationMode && (
        <div className="shrink-0">
          <BackgroundPicker activePage={activePage} onUpdateBackground={onUpdateBackground} editable={editable} isDark={isDark} />
        </div>
      )}
    </div>
  );
}

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
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  peers,
  userData,
  showUserMenu,
  setShowUserMenu,
  navigate,
  onSignOut,
  canShare,
  onShare,
  onToggleTasks,
  tasksOpen,
  isDark,
  toggleTheme,
  activePage,
  onUpdateBackground,
  onPresent,
}) {
  // Renaming the project is owner-only; editors/commenters/viewers cannot.
  const isOwner = role === 'owner';

  const toolbar = (
    <ToolbarCore
      activeTool={activeTool}
      onSelectTool={onSelectTool}
      editable={editable}
      onUndo={onUndo}
      onRedo={onRedo}
      canUndo={canUndo}
      canRedo={canRedo}
      activePage={activePage}
      onUpdateBackground={onUpdateBackground}
      isDark={isDark}
    />
  );

  return (
    <header className="relative z-50 shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      {/* ── Left: identity ─────────────────────────────────────────── */}
      <div className={`flex items-center gap-2.5 rounded-2xl px-3 py-1.5 min-w-0 shrink-0 ${UI.surface}`}>
        <button onClick={() => navigate('/dashboard')} className={UI.iconBtn} title="Back to dashboard">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </button>
        <div className="hidden sm:flex items-center gap-2">
          <span className={UI.logo}>Collab</span>
          <span className={UI.lite}>Project</span>
        </div>
        <div className="h-5 w-px bg-edge" />
        {isEditingTitle ? (
          <input
            autoFocus
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
            className={`${UI.input} text-sm w-28 sm:w-40 lg:w-48 max-w-48 py-1 min-w-0`}
          />
        ) : (
          // Only the project owner can rename it. Non-owners (editors included)
          // see the title as a plain, non-interactive label.
          <button
            onClick={() => isOwner && setEditTitle(true)}
            disabled={!isOwner}
            title={isOwner ? 'Rename project' : undefined}
            className={`text-content font-medium text-sm px-2 py-1 rounded-lg transition max-w-28 sm:max-w-44 lg:max-w-56 min-w-0 truncate block ${isOwner ? 'hover:bg-hover cursor-pointer' : 'cursor-default'}`}
          >
            {board?.title || 'Untitled Project'}
          </button>
        )}
        {role === 'viewer' && <span className={UI.chip}>View Only</span>}
        {role === 'commenter' && <span className={UI.chip}>Comments Only</span>}
      </div>

      {/* ── Centre: element toolbar — inline on lg+, full-width row below on smaller ── */}
      <div className="hidden lg:flex flex-1 min-w-0 items-center justify-center">
        {toolbar}
      </div>

      {/* ── Right: presence + account + share ──────────────────────── */}
      <div className={`relative z-20 flex items-center gap-2 rounded-2xl pl-2.5 pr-1.5 py-1.5 shrink-0 ml-auto lg:ml-0 ${UI.surface}`}>
        <div className="hidden sm:flex items-center mr-1">
          <PeersMenu peers={peers} board={board} />
        </div>

        {/* Theme toggle moved out from user menu */}
        <div className="mr-2">
          <button
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition text-content-muted hover:bg-hover border border-edge bg-surface shadow-sm"
          >
            {isDark ? (
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
            ) : (
              <svg className="w-4 h-4 text-content-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
            )}
          </button>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-1 bg-emerald-50/80 dark:bg-emerald-900/30 pl-1.5 pr-1 py-1 rounded-full border border-emerald-100/80 dark:border-emerald-800/50 shadow-sm hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 transition"
          >
            <Avatar
              email={userData.email}
              name={userData.name}
              src={userData.profilePic || userData.profilePicture}
              color="#10b981"
              size={24}
              borderClass="border-transparent"
            />
            <svg className={`w-3 h-3 text-content-muted transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showUserMenu && (
            <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl py-2 z-50 ${UI.surfaceSolid}`}>
              <div className="px-4 py-2 border-b border-edge-subtle">
                <p className="text-sm font-semibold text-content truncate">{userData.name || 'User'}</p>
                <p className="text-xs text-content-muted truncate">{userData.email || ''}</p>
              </div>
              <button onClick={() => { setShowUserMenu(false); navigate('/dashboard'); }} className="w-full text-left px-4 py-2 text-sm text-content hover:bg-hover flex items-center gap-2.5 transition">
                <svg className="w-4 h-4 text-content-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                Dashboard
              </button>
              <button onClick={() => { setShowUserMenu(false); navigate('/profile'); }} className="w-full text-left px-4 py-2 text-sm text-content hover:bg-hover flex items-center gap-2.5 transition">
                <svg className="w-4 h-4 text-content-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Profile
              </button>
              <div className="border-t border-edge-subtle my-1" />
              <div className="border-t border-edge-subtle my-1" />
              <button onClick={onSignOut} className="w-full text-left px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2.5 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Sign Out
              </button>
            </div>
          )}
        </div>

        <button onClick={onPresent} className="w-8 h-8 rounded-full flex items-center justify-center bg-indigo-500 text-white hover:bg-indigo-600 active:bg-indigo-700 transition-colors shadow-sm" title="Present (fullscreen)">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
        </button>

        {canShare && (
          <button onClick={onShare} className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 transition-colors shadow-sm" title="Share project">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          </button>
        )}
      </div>

      {/* ── Right: Tasks ───────────────────────────────────────────── */}
      <button
        onClick={onToggleTasks}
        title="Tasks"
        className={`px-3 py-1.5 flex items-center gap-2 rounded-xl transition border shadow-sm font-medium text-sm ml-auto lg:ml-0 ${tasksOpen
          ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/50'
          : 'text-content hover:bg-hover border-edge bg-surface'}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="M4 6l1 1 1.5-1.5M4 12l1 1 1.5-1.5M4 18l1 1 1.5-1.5" />
        </svg>
        Tasks
      </button>

      {/* ── Toolbar row 2: shown below lg breakpoint ────────────────── */}
      <div className="flex lg:hidden w-full items-center justify-center pb-0.5">
        {toolbar}
      </div>
    </header>
  );
}
