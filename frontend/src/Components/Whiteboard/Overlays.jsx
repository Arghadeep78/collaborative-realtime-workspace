import { track } from '@tldraw/tldraw';

const Overlays = track(({ editor, votes, comments, peers = [], presenceTick, myVotes, onToggleVote, onDeleteComment }) => {
  if (!editor) return null;
  const shapes = editor.getCurrentPageShapes();
  const viewport = editor.getViewportScreenBounds();
  const now = presenceTick || Date.now();
  const center = { x: viewport.w / 2, y: viewport.h / 2 };
  const edgePadding = 18;

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Votes */}
      {shapes.map(s => {
        const count = votes[s.id];
        if (!count) return null;
        const bounds = editor.getShapePageBounds(s);
        if (!bounds) return null;
        const pt = editor.pageToViewport({ x: bounds.maxX, y: bounds.minY });
        const isMyVote = myVotes?.[s.id];
        return (
          <div
            key={`vote-${s.id}`}
            onClick={() => onToggleVote && onToggleVote(s.id)}
            className={`absolute pointer-events-auto cursor-pointer transition-transform hover:scale-110 text-[10px] font-bold rounded-full px-1.5 py-0.5 shadow-md ${isMyVote ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-200'}`}
            style={{ transform: `translate(${pt.x - 10}px, ${pt.y - 10}px)` }}
            title={isMyVote ? "Click to unvote" : "Click to vote"}
          >
            👍 {count}
          </div>
        );
      })}

      {/* Comments */}
      {comments.map((c, i) => {
        const pt = editor.pageToViewport({ x: c.x, y: c.y });
        return (
          <div key={`comment-${i}`} className="absolute group pointer-events-auto" style={{ transform: `translate(${pt.x}px, ${pt.y}px)` }}>
            <div className="w-5 h-5 bg-yellow-400 border-2 border-yellow-600 rounded-full shadow-lg cursor-pointer transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[10px]">
              💬
            </div>
            <div className="hidden group-hover:block absolute top-4 left-4 bg-white text-gray-900 text-xs p-2 rounded shadow-xl border border-gray-200 w-48 whitespace-pre-wrap">
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-[10px] text-gray-500">{c.user}</span>
                {onDeleteComment && (
                  <button
                    onClick={() => onDeleteComment(i)}
                    className="text-gray-400 hover:text-rose-500 transition-colors p-0.5 rounded"
                    title="Delete comment"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              {c.text}
            </div>
          </div>
        );
      })}

      {/* Live Cursors + Off-screen Indicators */}
      {peers.map(peer => {
        if (!peer.cursor) return null;
        const idleMs = now - (peer.cursor.lastMove || 0);
        if (idleMs > 30000) return null;
        const opacity = idleMs > 5000 ? 0.3 : 1;
        const pt = editor.pageToViewport({ x: peer.cursor.x, y: peer.cursor.y });
        const inView = pt.x >= 0 && pt.x <= viewport.w && pt.y >= 0 && pt.y <= viewport.h;
        const label = peer.name || 'Guest';

        if (inView) {
          return (
            <div
              key={`cursor-${peer.clientId}`}
              className="absolute pointer-events-none"
              style={{ transform: `translate(${pt.x}px, ${pt.y}px)`, opacity }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" className="absolute" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.3))' }}>
                <path d="M5 2.5 L5 19 L9.2 14.8 L12 21 L15 19.7 L12.2 13.6 L18 13 Z" fill={peer.color} stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              <div
                className="absolute top-[18px] left-[14px] px-1.5 py-0.5 text-[10px] font-semibold rounded-md text-white shadow whitespace-nowrap"
                style={{ backgroundColor: peer.color }}
              >
                {label}
              </div>
            </div>
          );
        }

        const dx = pt.x - center.x;
        const dy = pt.y - center.y;
        const angle = Math.atan2(dy, dx);
        const radiusX = Math.max(0, center.x - edgePadding);
        const radiusY = Math.max(0, center.y - edgePadding);
        const edgeX = center.x + Math.cos(angle) * radiusX;
        const edgeY = center.y + Math.sin(angle) * radiusY;

        return (
          <div
            key={`cursor-off-${peer.clientId}`}
            className="absolute pointer-events-none"
            style={{ transform: `translate(${edgeX}px, ${edgeY}px)`, opacity }}
          >
            <div className="absolute" style={{ transform: 'translate(-50%, -50%)' }}>
              <div className="relative">
                <div className="w-7 h-7 rounded-full border-2 border-white shadow text-[10px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: peer.color }}>
                  {label[0]?.toUpperCase() || '?'}
                </div>
                <div
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-x-[4px] border-x-transparent border-b-[6px]"
                  style={{ borderBottomColor: peer.color, transform: `translate(-50%, -50%) rotate(${angle * 57.2958 + 90}deg)` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default Overlays;
