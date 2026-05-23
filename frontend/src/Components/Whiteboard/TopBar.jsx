import { UI } from './whiteboardConstants.js';

export default function TopBar({
  board,
  role,
  isEditingTitle,
  titleInput,
  setTitleInput,
  saveTitle,
  setEditTitle,
  showExport,
  setShowExport,
  handleExport,
  handleSaveSnapshot,
  handleVote,
  canComment,
  commenting,
  setCommenting,
  timeLeft,
  timerExpired,
  showTimerPicker,
  setShowTimerPicker,
  startTimer,
  cancelTimer,
  isSpotlighting,
  handleSpotlight,
  showAI,
  setShowAI,
  peers,
  followUserId,
  toggleFollow,
  userData,
  showUserMenu,
  setShowUserMenu,
  navigate,
  handleSignOut,
  setShowShare,
  isDark,
  toggleTheme,
}) {
  return (
    <>
      {/* Top Center: Logo, Export & Title */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-2xl px-3 py-2 ${UI.surface}`}>
        <button onClick={() => navigate('/dashboard')} className={`${UI.iconBtn} group relative`} title="Back to Dashboard">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-800 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Home</span>
        </button>

        <div className="h-5 w-px bg-gray-200 dark:bg-slate-700"></div>

        <div className="flex items-center gap-2 px-1">
          <span className={UI.logo}>Collab</span>
          <span className={UI.lite}>Board</span>
        </div>

        <div className="relative">
          <button onClick={() => setShowExport(!showExport)} className={UI.iconBtn} title="Export">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          </button>
          {showExport && (
            <div className={`absolute left-0 mt-2 w-44 rounded-xl py-1.5 z-50 ${UI.surfaceSolid}`}>
              <button onClick={() => handleExport('png')} className="w-full text-left px-4 py-2 text-xs text-gray-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5">Export as PNG</button>
              <button onClick={() => handleExport('svg')} className="w-full text-left px-4 py-2 text-xs text-gray-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5">Export as SVG</button>
              <div className="border-t border-gray-200 dark:border-slate-700 my-1"></div>
              <button onClick={handleSaveSnapshot} className="w-full text-left px-4 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-black/5 dark:hover:bg-white/5">Save Snapshot</button>
            </div>
          )}
        </div>

        <div className="h-5 w-px bg-gray-200 dark:bg-slate-700"></div>
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
              className="text-gray-900 dark:text-slate-100 font-medium text-sm hover:bg-black/5 dark:hover:bg-white/5 px-2 py-1 rounded-lg transition-colors max-w-30 sm:max-w-xs truncate"
            >
              {board?.title || 'Untitled Board'}
            </button>
          )}
          {role === 'viewer' && <span className={UI.chip}>View Only</span>}
        </div>
      </div>

      {/* Top Right: Tools & Share */}
      <div className={`absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-2xl pl-2.5 pr-1.5 py-1.5 ${UI.surface}`}>
        <div className="flex items-center gap-1.5">
          {/* Vote */}
          <button onClick={handleVote} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" title="Vote on selected shapes">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
          </button>

          {/* Comment */}
          {canComment && (
            <button
              onClick={() => setCommenting(!commenting)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${commenting ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50' : 'text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              title="Add a comment pin"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          )}

          {/* Timer */}
          <div className="relative">
            {timeLeft ? (
              <div className="w-9 h-9 flex flex-col items-center justify-center relative bg-indigo-50 rounded-xl">
                <div className={`text-[9px] font-mono font-bold ${timerExpired ? 'text-rose-600 animate-pulse' : 'text-indigo-700'}`}>{timeLeft}</div>
                {role === 'editor' && (
                  <button onClick={cancelTimer} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center hover:bg-rose-200" title="Cancel timer">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ) : role === 'editor' ? (
              <button
                onClick={() => setShowTimerPicker(!showTimerPicker)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${showTimerPicker ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                title="Set a timer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
              </button>
            ) : null}

            {showTimerPicker && (
              <div className={`absolute right-0 top-full mt-2 w-36 rounded-xl py-1.5 z-50 ${UI.surfaceSolid} border border-slate-100 dark:border-slate-700 shadow-xl`}>
                <p className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Set Timer</p>
                {[1, 3, 5, 10, 15, 30].map(m => (
                  <button key={m} onClick={() => startTimer(m)} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors">
                    {m} minute{m > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Spotlight */}
          {role === 'editor' && (
            <button
              onClick={handleSpotlight}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all relative ${isSpotlighting ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700/50' : 'text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              title={isSpotlighting ? 'Stop presenting' : 'Present — others follow your view'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
              {isSpotlighting && (
                <span className="absolute top-0.5 right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
              )}
            </button>
          )}

          {/* AI */}
          <button
            id="ai-panel-btn"
            onClick={() => setShowAI(v => !v)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${showAI ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            title="AI Assistant"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" />
              <path d="M19 2L19.9 4.6L22.5 5.5L19.9 6.4L19 9L18.1 6.4L15.5 5.5L18.1 4.6L19 2Z" />
              <path d="M5 17L5.7 19.3L8 20L5.7 20.7L5 23L4.3 20.7L2 20L4.3 19.3L5 17Z" />
            </svg>
          </button>
        </div>

        <div className="h-6 w-px bg-slate-200/80 dark:bg-slate-700/80 mx-0.5"></div>

        {/* Peer avatars */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center -space-x-1.5">
            {peers.slice(0, window.innerWidth < 640 ? 2 : peers.length).map(peer => (
              <button
                key={peer.clientId}
                title={followUserId === peer.clientId ? `Following ${peer.name}` : `Follow ${peer.name}`}
                onClick={() => toggleFollow(peer.clientId)}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold border-2 border-white shadow-sm transition-transform hover:scale-110 hover:z-10 ${followUserId === peer.clientId ? 'ring-2 ring-blue-400' : ''}`}
                style={{ backgroundColor: peer.color }}
              >
                {peer.name?.[0]?.toUpperCase() || '?'}
              </button>
            ))}
          </div>

          {/* User menu */}
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

            {showUserMenu && (
              <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl py-2 z-50 ${UI.surfaceSolid}`}>
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{userData.name || 'User'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{userData.email || ''}</p>
                </div>
                <button onClick={() => { setShowUserMenu(false); navigate('/dashboard'); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5 transition-colors">
                  <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                  Dashboard
                </button>
                <button onClick={() => { setShowUserMenu(false); navigate('/profile'); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5 transition-colors">
                  <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Profile
                </button>
                <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                {/* Theme toggle */}
                <button onClick={() => { toggleTheme(); setShowUserMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5 transition-colors">
                  {isDark ? (
                    <>
                      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                      Switch to Light Mode
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                      Switch to Dark Mode
                    </>
                  )}
                </button>
                <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2.5 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Share */}
        <button
          onClick={() => setShowShare(true)}
          className={`ml-1 ${UI.primaryBtn} text-sm font-medium px-4 py-1.5 rounded-full flex items-center gap-1.5`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          Share
        </button>
      </div>
    </>
  );
}
