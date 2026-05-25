import { PRESENCE_RED } from './boardConstants.js';

/**
 * Live teammate cursors. Two modes per peer:
 *  • laser=true  → glowing red laser dot + name tag (presentation mode)
 *  • laser=false → red arrow cursor + name tag (default)
 *
 * Rendered inside the scaled slide so positions are plain slide coordinates;
 * each cursor is counter-scaled by 1/scale so the icon stays a constant
 * on-screen size regardless of zoom. Only peers on the active slide are shown.
 */
export default function PresenceLayer({ peers, activePageId, scale }) {
  const inv = 1 / (scale || 1);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 5000 }}>
      {peers.map((peer) => {
        const c = peer.cursor;
        if (!c || c.pageId !== activePageId) return null;
        const isLaser = !!c.laser;

        return (
          <div
            key={peer.clientId}
            className="absolute top-0 left-0 will-change-transform"
            style={{
              transform: `translate(${c.x}px, ${c.y}px) scale(${inv})`,
              transformOrigin: 'top left',
              transition: 'transform 80ms linear',
            }}
          >
            {isLaser ? (
              /* Glowing laser dot */
              <>
                <div
                  className="rounded-full"
                  style={{
                    width: 10, height: 10,
                    marginLeft: -5, marginTop: -5,
                    background: PRESENCE_RED,
                    boxShadow: `0 0 0 2px ${PRESENCE_RED}55, 0 0 8px 3px ${PRESENCE_RED}80`,
                  }}
                />
                <span
                  className="absolute px-1.5 py-0.5 rounded-md text-white text-[11px] font-semibold whitespace-nowrap shadow-sm"
                  style={{ background: peer.color || PRESENCE_RED, left: 14, top: 14 }}
                >
                  {peer.name || 'Guest'}
                </span>
              </>
            ) : (
              /* Arrow cursor */
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="drop-shadow">
                  <path
                    d="M5 3l14 8-6 1.5L9.5 19 5 3z"
                    fill={PRESENCE_RED}
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  className="absolute px-1.5 py-0.5 rounded-md text-white text-[11px] font-semibold whitespace-nowrap shadow-sm"
                  style={{ background: peer.color || PRESENCE_RED, left: 16, top: 16 }}
                >
                  {peer.name || 'Guest'}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
