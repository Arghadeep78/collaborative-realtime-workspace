import { useState } from 'react';
import { useUserPhoto } from '../../hooks/usePhotoResolver.js';

// One avatar for the whole app. Pass an email and it resolves the picture from
// the shared photo cache (backend-authoritative). Pass `src` to override with a
// URL you already trust (own localStorage, peer awareness broadcast); the
// resolver result is used as a fallback when no override is given.
export default function Avatar({
  email,
  name,
  src,
  size = 28,
  color = '#94a3b8',
  borderClass = 'border-surface',
  shapeClass = 'rounded-full',
  className = '',
}) {
  const [imgError, setImgError] = useState(false);
  const resolved = useUserPhoto(email);
  const url = src || resolved;
  const initial = (name || email)?.[0]?.toUpperCase() || '?';

  if (url && !imgError) {
    return (
      <img
        src={url}
        alt={name || email}
        title={name || email}
        crossOrigin="anonymous"
        onError={() => setImgError(true)}
        className={`${shapeClass} object-cover border-2 ${borderClass} shadow-sm shrink-0 ${className}`}
        style={{ width: size, height: size, minWidth: size }}
      />
    );
  }

  return (
    <div
      title={name || email}
      className={`${shapeClass} flex items-center justify-center text-white font-bold border-2 ${borderClass} shadow-sm shrink-0 ${className}`}
      style={{ width: size, height: size, minWidth: size, backgroundColor: color, fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </div>
  );
}
