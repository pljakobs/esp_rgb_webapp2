/**
 * Color conversion utilities
 * Wraps Quasar's color functions with application-specific helpers
 */
import { colors } from "quasar";

const { hsvToRgb, rgbToHsv, hexToRgb, rgbToHex } = colors;

/**
 * Converts HSV to RGB inline style string
 * @param {Object} hsv - HSV color object with h, s, v properties
 * @param {number} hsv.h - Hue (0-360)
 * @param {number} hsv.s - Saturation (0-100)
 * @param {number} hsv.v - Value/Brightness (0-100)
 * @returns {string} RGB color string like "rgb(255, 0, 0)"
 */
export function hsvToRgbStyle(hsv) {
  const rgb = hsvToRgb(hsv);
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/**
 * Safely converts HSV to RGB with fallback for invalid input
 * @param {Object} hsv - HSV color object
 * @returns {Object} RGB object { r, g, b } or black if invalid
 */
export function safeHsvToRgb(hsv) {
  // Return black if input is null or undefined
  if (!hsv || typeof hsv !== "object") {
    return { r: 0, g: 0, b: 0 };
  }

  try {
    // Ensure all required properties exist
    const safeHsv = {
      h: hsv.h ?? 0,
      s: hsv.s ?? 100,
      v: hsv.v ?? 100,
    };
    return hsvToRgb(safeHsv);
  } catch (error) {
    console.error("Error converting HSV to RGB:", error);
    return { r: 0, g: 0, b: 0 };
  }
}

/**
 * Converts color object (HSV, RAW, or Preset) to RGB style string
 * @param {Object} color - Color object with hsv, raw, or Preset property
 * @param {Function} getPresetColor - Optional function to resolve preset colors
 * @returns {string} RGB color string or empty string if invalid
 */
export function colorToRgbStyle(color, getPresetColor = null) {
  if (!color) return "";

  if (color.hsv) {
    return hsvToRgbStyle(color.hsv);
  }

  if (color.raw) {
    return `rgb(${color.raw.r}, ${color.raw.g}, ${color.raw.b})`;
  }

  if (color.Preset && getPresetColor) {
    const presetColor = getPresetColor(color.Preset.id);
    if (presetColor) {
      return colorToRgbStyle(presetColor);
    }
  }

  return "";
}

// Re-export Quasar color functions for direct use
export { hsvToRgb, rgbToHsv, hexToRgb, rgbToHex };
