import { useState, useEffect } from 'react';
import { AVATAR_COLORS } from './theme/colorMap.js';
import { useUserPhoto } from '../../hooks/usePhotoResolver.js';

const pickColor = (s = '') =>
  AVATAR_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const initial = (s = '') => (s.trim()[0] || '?').toUpperCase();

/**
 * Shared avatar for task-area components (TaskModal, TaskPanel, TaskCard).
 * The picture is resolved from the shared, email-keyed photo cache
 * (usePhotoResolver — the single source of truth, backend-authoritative); `email`
 * is the only photo input. Falls back to a coloured initial derived from `label`.
 * Presentation stays caller-controlled via `ring` / `className` (this is the
 * hash-coloured + ring variant, distinct from the bordered <Avatar/>).
 */
export default function MemberAvatar({ label = '', email = '', size = 24, ring = '', className = '' }) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = useUserPhoto(email);
  // Reset the failed flag when the resolved picture changes so a recycled
  // instance (lists keyed by email) doesn't suppress a valid new photo.
  useEffect(() => { setImgFailed(false); }, [src]);
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
