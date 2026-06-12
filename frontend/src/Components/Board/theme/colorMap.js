export const themeColors = {
  // ── Board canvas ───────────────────────────────────────────────────────────
  // Dark canvas sits on a true neutral slate (#1e2227) so colored elements read
  // as accents against it rather than competing with a warm/greenish surface.
  boardBg:         { light: '#ffffff',   dark: '#1e2227' },
  boardGrid:       { light: 'rgba(15,23,42,0.07)',  dark: 'rgba(255,255,255,0.05)' },
  boardGridLighter:{ light: 'rgba(15,23,42,0.06)',  dark: 'rgba(255,255,255,0.035)' },

  // ── Semantic named tokens ──────────────────────────────────────────────────
  // Kanban list text / icon color (previously hardcoded #172b4d / #b6c2cf)
  kanbanText: { light: '#172b4d', dark: '#c7d1db' },
  // Kanban card + modal background (previously hardcoded #22272b)
  kanbanCardBg: { light: '#ffffff', dark: '#262c33' },
  // Kanban empty-list background (previously hardcoded #f1f2f4)
  kanbanEmptyBg: { light: '#f1f2f4', dark: '#22272e' },
  // Kanban modal list-title chip (previously hardcoded #d3f1df / teal-800/400)
  kanbanChipBg:   { light: '#d3f1df', dark: '#16352a' },
  kanbanChipText: { light: '#115e59', dark: '#5eead4' },

  // Connector arrow + selected-edge accent (was inline #94a3b8 / #475569 / #2563eb)
  connectorArrow:    { light: '#475569', dark: '#9aa7b4' },
  connectorSelected: { light: '#2563eb', dark: '#7eb0ff' },

  // Task card surfaces — one per status. `todo` is a lighter amber to distinguish
  // from the deeper orange of `in_progress`. `done` is muted grey; `in_review`
  // is purple. Each entry also carries a `shadow` rgba used for the drop-shadow.
  // Consumed by TaskCard via TASK_STATUS_COLORS (exported below).
  taskCard_todo:        { light: '#f59e0b', dark: '#d97706' },
  taskCard_in_progress: { light: '#ea580c', dark: '#c2410c' },
  taskCard_in_review:   { light: '#7c3aed', dark: '#6d28d9' },
  taskCard_done:        { light: '#6b7280', dark: '#4b5563' },

  // Primary UI accent (selection rings, layer-glyph highlight — was #3b82f6)
  uiAccent: { light: '#3b82f6', dark: '#7eb0ff' },

  // ── Sticky note backgrounds (STICKY_COLORS — 7 colors) ────────────────────
  // Dark variants are deep, low-saturation tints of the same hue (~14% L) so the
  // palette stays harmonious and dark text (resolved separately) reads on them.
  '#fdf4c8': { light: '#fdf4c8', dark: '#3e3411' }, // yellow
  '#d3f1df': { light: '#d3f1df', dark: '#16382a' }, // green
  '#cce0ff': { light: '#cce0ff', dark: '#15304d' }, // blue
  '#fdedd8': { light: '#fdedd8', dark: '#412c12' }, // orange
  '#ffdce0': { light: '#ffdce0', dark: '#46161e' }, // red/pink
  '#e8dffe': { light: '#e8dffe', dark: '#2d2348' }, // purple
  '#d1fae5': { light: '#d1fae5', dark: '#0d3b2c' }, // mint (7th)

  // ── Shape fill colors (FILL_COLORS — 10 colors) ────────────────────────────
  // Deep, low-saturation tints (~14-16% lightness) in the SAME language as the
  // sticky backgrounds above, so fills read as quiet colored accents on the
  // slate canvas instead of muddy mid-tones. Default text inverts to light
  // (#e2e8f0) in dark mode, which stays crisply legible on every one.
  '#a5b4fc': { light: '#a5b4fc', dark: '#29275c' }, // indigo
  '#fca5a5': { light: '#fca5a5', dark: '#46161e' }, // red
  '#6ee7b7': { light: '#6ee7b7', dark: '#0d3b2c' }, // emerald
  '#fcd34d': { light: '#fcd34d', dark: '#3e3411' }, // amber
  '#f9a8d4': { light: '#f9a8d4', dark: '#43203a' }, // pink
  '#93c5fd': { light: '#93c5fd', dark: '#15304d' }, // sky
  '#d1d5db': { light: '#d1d5db', dark: '#2f3742' }, // gray
  '#ffffff':  { light: '#ffffff',  dark: '#262c33' }, // white → neutral dark surface
  '#1e293b': { light: '#1e293b', dark: '#e2e8f0' }, // dark → light surface
  '#f97316': { light: '#f97316', dark: '#412c12' }, // orange (10th)

  // ── Shape / text stroke colors (STROKE_OPTIONS — 7 including transparent) ──
  // Strokes brighten in dark mode (lighter, vivid) so borders/text stay crisp.
  '#6366f1': { light: '#6366f1', dark: '#8b93f8' }, // indigo
  '#ef4444': { light: '#ef4444', dark: '#f87171' }, // red
  '#10b981': { light: '#10b981', dark: '#34d399' }, // green
  '#f59e0b': { light: '#f59e0b', dark: '#fbbf24' }, // amber
  '#ec4899': { light: '#ec4899', dark: '#f472b6' }, // pink (new stroke)
  '#3b82f6': { light: '#3b82f6', dark: '#7eb0ff' }, // blue (new stroke)
  '#9ca3af': { light: '#9ca3af', dark: '#9aa3af' }, // gray (new stroke)
  '#000000': { light: '#000000', dark: '#e8edf2' }, // black → near-white
  '#ea580c': { light: '#ea580c', dark: '#fb923c' }, // orange
  'transparent': { light: 'transparent', dark: 'transparent' },

  // ── Kanban list background pastels (LIST_COLORS) ───────────────────────────
  // Kept in lockstep with the sticky dark tints above so a "green list" and a
  // "green sticky" share the exact same dark surface.
  '#4bce97': { light: '#d3f1df', dark: '#16382a' },
  '#f5cd47': { light: '#fdf4c8', dark: '#3e3411' },
  '#fea362': { light: '#fdedd8', dark: '#412c12' },
  '#f87168': { light: '#ffdce0', dark: '#46161e' },
  '#9f8fef': { light: '#e8dffe', dark: '#2d2348' },
  '#579dff': { light: '#cce0ff', dark: '#15304d' },

  // ── Poll block background colors (POLL_BG_COLORS — 7 including null/default)
  // null means "no color / default surface" — handled in PollBlock, not here.
  // Deep tints in lockstep with the sticky/fill language so a "green poll" and a
  // "green sticky" sit in the same hue/lightness band:
  '#bbf7d0': { light: '#bbf7d0', dark: '#16382a' }, // green tint
  '#fef08a': { light: '#fef08a', dark: '#3e3411' }, // yellow tint
  '#fed7aa': { light: '#fed7aa', dark: '#412c12' }, // orange tint
  '#fecaca': { light: '#fecaca', dark: '#46161e' }, // red tint
  '#e9d5ff': { light: '#e9d5ff', dark: '#2d2348' }, // purple tint
  '#bfdbfe': { light: '#bfdbfe', dark: '#15304d' }, // blue tint (6th poll color)

  // ── General fallbacks ──────────────────────────────────────────────────────
  // Neutral ramp inverts cleanly so light↔dark surfaces stay balanced.
  '#f8fafc': { light: '#f8fafc', dark: '#1e2227' },
  '#e2e8f0': { light: '#e2e8f0', dark: '#262c33' },
  '#94a3b8': { light: '#94a3b8', dark: '#3a4250' },
  '#475569': { light: '#475569', dark: '#c7d1db' },
  '#0f172a': { light: '#0f172a', dark: '#e8edf2' },
  '#dbeafe': { light: '#dbeafe', dark: '#173256' },
  '#fbcfe8': { light: '#fbcfe8', dark: '#4d1a38' },

  default: { light: '#ffffff', dark: '#1e2227' },
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

// Default text color when an element has no saved `textColor`. Must be a member
// of TEXT_COLORS so the format-toolbar swatch highlights as selected by default.
// It is itself a key in `themeColors` above, so getThemeColor() maps it to its
// dark variant (#f1f5f9) automatically.
export const DEFAULT_TEXT_COLOR = TEXT_COLORS[0]; // '#1e293b'

// 7 poll block background options (null = default surface, no bg color)
export const POLL_BG_COLORS = [
  null,
  '#bbf7d0', '#fef08a', '#fed7aa', '#fecaca', '#e9d5ff', '#bfdbfe',
];

// Kanban list / label colors. Keys are the saved "label color"; values are the
// light-mode pastel background. The light→dark resolution for each pastel lives
// in `themeColors` above — this map is only the label→pastel association so the
// swatch picker and list rendering share one definition.
export const LIST_COLORS = {
  '#4bce97': '#d3f1df', // pastel green
  '#f5cd47': '#fdf4c8', // pastel yellow
  '#fea362': '#fdedd8', // pastel orange
  '#f87168': '#ffdce0', // pastel red
  '#9f8fef': '#e8dffe', // pastel purple
  '#579dff': '#cce0ff', // pastel blue
};

// Per-session avatar / presence palette (shared by boardConstants.myColor and
// task-card's deterministic avatar colors).
export const AVATAR_COLORS = [
  '#e0457b', '#0b69ff', '#0a9d62', '#f5821f', '#7c4dff', '#0bb4c4',
];

// Fallback avatar fills for users with no assigned color. These are flat data
// values (not light/dark-resolved): the Avatar component renders them as-is.
//   - FALLBACK: generic "no color" (poll voters, board presence)
//   - MEMBER:   a participant/member row in share & workspace lists
//   - OWNER:    the workspace/board owner, on the amber-tinted owner row
export const AVATAR_FALLBACK = '#94a3b8';
export const AVATAR_MEMBER   = '#64748b';
export const AVATAR_OWNER    = '#f59e0b';

// Slide/board background swatches offered in the TopUtilityBar picker. Each is
// a key in `themeColors` above, so getThemeColor() resolves its dark variant.
// Neutrals light→dark, then hues by spectrum.
export const BOARD_BG_COLORS = [
  '#ffffff', '#f8fafc', '#e2e8f0', '#94a3b8', '#475569', '#1e293b', '#0f172a',
  '#dbeafe', '#bbf7d0', '#fef08a', '#fed7aa', '#fecaca', '#e9d5ff', '#fbcfe8',
];

// Flat fills that telegraph each element type in the sidebar slide preview.
export const SIDEBAR_SWATCH = {
  sticky: STICKY_COLORS[0],
  task: '#ffffff',
  text: 'transparent',
  poll: '#c7d2fe',
  iframe: '#cbd5e1',
};

// Per-status task card colours consumed by TaskCard.
// `bg` keys match entries in themeColors (taskCard_*); resolved via isDark.
// `shadow` is the drop-shadow rgba string applied directly.
export const TASK_STATUS_COLORS = {
  todo:        { light: themeColors.taskCard_todo.light,        dark: themeColors.taskCard_todo.dark,        shadow: 'rgba(245,158,11,0.30)' },
  in_progress: { light: themeColors.taskCard_in_progress.light, dark: themeColors.taskCard_in_progress.dark, shadow: 'rgba(234,88,12,0.28)'  },
  in_review:   { light: themeColors.taskCard_in_review.light,   dark: themeColors.taskCard_in_review.dark,   shadow: 'rgba(124,58,237,0.28)' },
  done:        { light: themeColors.taskCard_done.light,        dark: themeColors.taskCard_done.dark,        shadow: 'rgba(107,114,128,0.30)' },
};
