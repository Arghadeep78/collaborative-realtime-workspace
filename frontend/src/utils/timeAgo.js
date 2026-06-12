// Compact "x ago" relative-time formatter.
export function timeAgo(dateStr) {
  const d = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}
