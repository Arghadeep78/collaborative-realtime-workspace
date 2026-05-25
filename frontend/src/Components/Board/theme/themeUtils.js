import { themeColors } from './colorMap.js';

/**
 * Maps a given base color to its theme equivalent.
 * 
 * @param {string} color The stored literal color string.
 * @param {boolean} isDark Whether dark theme is currently active.
 * @returns {string} The mapped color.
 */
export function getThemeColor(color, isDark) {
  if (!color) return 'transparent'; // Fallback
  // Ensure we match case (stored colors are mostly lowercase hex)
  const normalizedColor = color.toLowerCase();
  
  const mapping = themeColors[normalizedColor] || themeColors[color];
  if (mapping) {
    return isDark ? (mapping.dark || mapping.light || color) : (mapping.light || color);
  }
  return color;
}
