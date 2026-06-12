import { useState } from 'react';
import { AVATAR_COLORS } from './theme/colorMap.js';

const pickColor = (s = '') =>
  AVATAR_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const initial = (s = '') => (s.trim()[0] || '?').toUpperCase();

/**
 * Shared avatar for task-area components (TaskModal, TaskPanel, TaskCard).
 * Shows a profile picture when `src` is provided; falls back to a coloured
 * initial derived from `label`. Extra styling is passed via `className` and
 * the caller-controlled `ring` string (border / ring utilities).
 */
export default function MemberAvatar({ label = '', src, size = 24, ring = '', className = '' }) {
  const [imgFailed, setImgFailed] = useState(false);
  const base = `rounded-full shrink-0 ${ring} ${className}`.trim();

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={label}
        title={label}
        className={`object-cover ${base}`}
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span
      title={label}
      className={`inline-flex items-center justify-center text-white font-bold ${base}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: pickColor(label) }}
    >
      {initial(label)}
    </span>
  );
}
