const GRID_COLORS = [
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

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
};

const getClosestTldrawColor = (hex) => {
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

const testColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#ffffff', '#000000', '#888888'];
for (const c of testColors) {
  console.log(c, '->', getClosestTldrawColor(c).id);
}
