import { lightColors } from './lightThemeMap.js';
import { darkColors } from './darkThemeMap.js';

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
  
  if (isDark) {
    return darkColors[normalizedColor] || darkColors[color] || color;
  }
  return lightColors[normalizedColor] || lightColors[color] || color;
}
