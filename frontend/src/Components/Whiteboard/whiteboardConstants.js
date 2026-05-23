export const USER_COLORS = ['#e03', '#06d', '#0a0', '#f80', '#90f', '#0cc'];
export const myColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];

export const UI = {
  surface: "bg-white/90 border border-slate-200/80 shadow-[0_16px_40px_rgba(12,18,36,0.12)] backdrop-blur-xl",
  surfaceSolid: "bg-white/95 border border-slate-200/80 shadow-[0_16px_40px_rgba(12,18,36,0.12)]",
  iconBtn: "inline-flex items-center justify-center w-8 h-8 rounded-[10px] border border-slate-900/10 bg-slate-900/5 text-slate-500 transition hover:bg-white hover:text-slate-900 hover:shadow-[0_10px_20px_rgba(12,18,36,0.12)]",
  iconBtnWarn: "bg-amber-400/20 text-amber-900 border-amber-300/70",
  iconBtnActive: "bg-blue-500/15 text-blue-700 border-blue-400/50",
  primaryBtn: "bg-gradient-to-br from-[#4262ff] to-[#2f49e7] text-white border border-blue-400/40 shadow-[0_12px_28px_rgba(66,98,255,0.28)] hover:brightness-95 hover:-translate-y-0.5 transition",
  input: "bg-slate-50/90 border border-slate-900/10 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500/70 focus:ring-4 focus:ring-blue-500/15 transition",
  chip: "bg-slate-900/5 border border-slate-900/10 text-slate-500 text-[10px] font-bold tracking-[0.16em] uppercase rounded-full px-2 py-0.5",
  timer: "bg-emerald-500/15 border border-emerald-500/35 text-emerald-700 text-[11px] font-bold tracking-[0.08em] rounded-full px-2 py-0.5",
  timerExpired: "bg-rose-500/15 border-rose-400/50 text-rose-700",
  logo: "font-bold text-[1.05rem] tracking-[-0.03em] text-slate-900",
  lite: "bg-amber-200/60 text-amber-950 border border-amber-300/70 rounded-full text-[9px] font-bold tracking-[0.2em] uppercase px-2 py-0.5",
};

export const boardShellClass = "fixed inset-0 w-screen h-screen overflow-hidden bg-slate-50 [background:radial-gradient(1200px_540px_at_10%_-15%,rgba(66,98,255,0.2),transparent_65%),radial-gradient(900px_420px_at_90%_0%,rgba(0,167,116,0.15),transparent_60%),radial-gradient(700px_360px_at_40%_110%,rgba(255,204,102,0.18),transparent_65%)] [&_button]:cursor-pointer";
export const tldrawHostClass = "absolute inset-0 overflow-hidden [&_[title*='license']]:hidden [&_[aria-label*='license']]:hidden [&_[href*='license']]:hidden";

export const GRID_COLORS = [
  { id: 'black', hex: '#1d1d1d', tl: 'black' },
  { id: 'grey', hex: '#9d9d9d', tl: 'grey' },
  { id: 'violet', hex: '#b15eff', tl: 'violet' },
  { id: 'light-violet', hex: '#e1c4ff', tl: 'light-violet' },
  { id: 'blue', hex: '#3b82f6', tl: 'blue' },
  { id: 'light-blue', hex: '#c4e2ff', tl: 'light-blue' },
  { id: 'yellow', hex: '#ffc600', tl: 'yellow' },
  { id: 'orange', hex: '#ff9900', tl: 'orange' },
  { id: 'green', hex: '#22c55e', tl: 'green' },
  { id: 'light-green', hex: '#c4ffc4', tl: 'light-green' },
  { id: 'red', hex: '#ef4444', tl: 'red' },
  { id: 'light-red', hex: '#ffc4c4', tl: 'light-red' },
];

export const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
};

export const getClosestTldrawColor = (hex) => {
  const target = hexToRgb(hex);
  if (!target) return GRID_COLORS[0];
  let closest = GRID_COLORS[0];
  let minDistance = Infinity;
  for (const c of GRID_COLORS) {
    const rgb = hexToRgb(c.hex);
    if (!rgb) continue;
    const dist = Math.sqrt(Math.pow(target.r - rgb.r, 2) + Math.pow(target.g - rgb.g, 2) + Math.pow(target.b - rgb.b, 2));
    if (dist < minDistance) {
      minDistance = dist;
      closest = c;
    }
  }
  return closest;
};

export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 4;
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
