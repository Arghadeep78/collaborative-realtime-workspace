export const themeColors = {
  // ── Board canvas ───────────────────────────────────────────────────────────
  boardBg:         { light: '#ffffff',   dark: '#282e33' },
  boardGrid:       { light: 'rgba(15,23,42,0.07)',  dark: 'rgba(255,255,255,0.06)' },
  boardGridLighter:{ light: 'rgba(15,23,42,0.06)',  dark: 'rgba(255,255,255,0.04)' },

  // ── Semantic named tokens ──────────────────────────────────────────────────
  // Kanban list text / icon color (previously hardcoded #172b4d / #b6c2cf)
  kanbanText: { light: '#172b4d', dark: '#b6c2cf' },
  // Kanban card + modal background (previously hardcoded #22272b)
  kanbanCardBg: { light: '#ffffff', dark: '#22272b' },
  // Kanban empty-list background (previously hardcoded #f1f2f4)
  kanbanEmptyBg: { light: '#f1f2f4', dark: '#22272b' },

  // ── Sticky note backgrounds (STICKY_COLORS — 7 colors) ────────────────────
  '#fdf4c8': { light: '#fdf4c8', dark: '#5c5218' }, // yellow
  '#d3f1df': { light: '#d3f1df', dark: '#1a3d28' }, // green
  '#cce0ff': { light: '#cce0ff', dark: '#1a2d3d' }, // blue
  '#fdedd8': { light: '#fdedd8', dark: '#4a331c' }, // orange
  '#ffdce0': { light: '#ffdce0', dark: '#4a1820' }, // red/pink
  '#e8dffe': { light: '#e8dffe', dark: '#2a1f3d' }, // purple
  '#d1fae5': { light: '#d1fae5', dark: '#064e3b' }, // mint (7th)

  // ── Shape fill colors (FILL_COLORS — 10 colors) ────────────────────────────
  '#a5b4fc': { light: '#a5b4fc', dark: '#3730a3' }, // indigo
  '#fca5a5': { light: '#fca5a5', dark: '#991b1b' }, // red
  '#6ee7b7': { light: '#6ee7b7', dark: '#065f46' }, // emerald
  '#fcd34d': { light: '#fcd34d', dark: '#92400e' }, // amber
  '#f9a8d4': { light: '#f9a8d4', dark: '#9d174d' }, // pink
  '#93c5fd': { light: '#93c5fd', dark: '#1e3a8a' }, // sky
  '#d1d5db': { light: '#d1d5db', dark: '#374151' }, // gray
  '#ffffff':  { light: '#ffffff',  dark: '#1e293b' }, // white
  '#1e293b': { light: '#1e293b', dark: '#f1f5f9' }, // dark
  '#f97316': { light: '#f97316', dark: '#7c2d12' }, // orange (10th)

  // ── Shape / text stroke colors (STROKE_OPTIONS — 7 including transparent) ──
  '#6366f1': { light: '#6366f1', dark: '#818cf8' }, // indigo
  '#ef4444': { light: '#ef4444', dark: '#f87171' }, // red
  '#10b981': { light: '#10b981', dark: '#34d399' }, // green
  '#f59e0b': { light: '#f59e0b', dark: '#fbbf24' }, // amber
  '#ec4899': { light: '#ec4899', dark: '#f472b6' }, // pink (new stroke)
  '#3b82f6': { light: '#3b82f6', dark: '#60a5fa' }, // blue (new stroke)
  '#9ca3af': { light: '#9ca3af', dark: '#6b7280' }, // gray (new stroke)
  '#000000': { light: '#000000', dark: '#ffffff' }, // black
  '#ea580c': { light: '#ea580c', dark: '#fb923c' }, // orange
  'transparent': { light: 'transparent', dark: 'transparent' },

  // ── Kanban list background pastels (LIST_COLORS) ───────────────────────────
  '#4bce97': { light: '#d3f1df', dark: '#1a3d28' },
  '#f5cd47': { light: '#fdf4c8', dark: '#3d3413' },
  '#fea362': { light: '#fdedd8', dark: '#3d2813' },
  '#f87168': { light: '#ffdce0', dark: '#3d1820' },
  '#9f8fef': { light: '#e8dffe', dark: '#2a1f3d' },
  '#579dff': { light: '#cce0ff', dark: '#1a2d3d' },

  // ── Poll block background colors (POLL_BG_COLORS — 7 including null/default)
  // null means "no color / default surface" — handled in PollBlock, not here.
  // The 6 color values are pastel backgrounds matching sticky palette:
  '#bbf7d0': { light: '#bbf7d0', dark: '#14532d' }, // green tint
  '#fef08a': { light: '#fef08a', dark: '#713f12' }, // yellow tint
  '#fed7aa': { light: '#fed7aa', dark: '#7c2d12' }, // orange tint
  '#fecaca': { light: '#fecaca', dark: '#7f1d1d' }, // red tint
  '#e9d5ff': { light: '#e9d5ff', dark: '#4c1d95' }, // purple tint
  '#bfdbfe': { light: '#bfdbfe', dark: '#1e3a8a' }, // blue tint (6th poll color)

  // ── General fallbacks ──────────────────────────────────────────────────────
  '#f8fafc': { light: '#f8fafc', dark: '#0f172a' },
  '#e2e8f0': { light: '#e2e8f0', dark: '#1e293b' },
  '#94a3b8': { light: '#94a3b8', dark: '#334155' },
  '#475569': { light: '#475569', dark: '#cbd5e1' },
  '#0f172a': { light: '#0f172a', dark: '#f8fafc' },
  '#dbeafe': { light: '#dbeafe', dark: '#1e3a8a' },
  '#fbcfe8': { light: '#fbcfe8', dark: '#831843' },

  default: { light: '#ffffff', dark: '#282e33' },
};

// ── Named palettes consumed by UI components ───────────────────────────────

// 7 sticky note background colors
export const STICKY_COLORS = [
  '#fdf4c8', '#d3f1df', '#cce0ff', '#fdedd8', '#ffdce0', '#e8dffe', '#d1fae5',
];

// 10 shape fill colors
export const FILL_COLORS = [
  '#a5b4fc', '#fca5a5', '#6ee7b7', '#fcd34d', '#f9a8d4',
  '#93c5fd', '#d1d5db', '#ffffff', '#1e293b', '#f97316',
];

// 7 shape / connector stroke colors (transparent = no border)
export const STROKE_OPTIONS = [
  { v: 'transparent', label: '×' },
  { v: '#6366f1' }, { v: '#ef4444' }, { v: '#10b981' },
  { v: '#f59e0b' }, { v: '#ec4899' }, { v: '#3b82f6' },
];

// 10 text colors for TextFormatToolbar (transparent excluded — text must be visible)
export const TEXT_COLORS = [
  '#1e293b', '#ffffff', '#6366f1', '#ef4444', '#10b981',
  '#f59e0b', '#ec4899', '#3b82f6', '#9ca3af', '#ea580c',
];

// 7 poll block background options (null = default surface, no bg color)
export const POLL_BG_COLORS = [
  null,
  '#bbf7d0', '#fef08a', '#fed7aa', '#fecaca', '#e9d5ff', '#bfdbfe',
];
