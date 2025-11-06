import { describe, it, expect } from 'vitest'
import { hsvToRgbStyle, safeHsvToRgb, colorToRgbStyle } from '../services/colorUtils'

describe('Color Utils Service', () => {
  describe('hsvToRgbStyle', () => {
    it('converts HSV to RGB style string', () => {
      const result = hsvToRgbStyle({ h: 0, s: 100, v: 100 })
      expect(result).toBe('rgb(255, 0, 0)')
    })

    it('handles blue color', () => {
      const result = hsvToRgbStyle({ h: 240, s: 100, v: 100 })
      expect(result).toBe('rgb(0, 0, 255)')
    })

    it('handles grayscale', () => {
      const result = hsvToRgbStyle({ h: 0, s: 0, v: 50 })
      expect(result).toMatch(/rgb\(127, 127, 127\)|rgb\(128, 128, 128\)/)
    })
  })

  describe('safeHsvToRgb', () => {
    it('converts valid HSV to RGB', () => {
      const result = safeHsvToRgb({ h: 120, s: 100, v: 100 })
      expect(result).toEqual({ r: 0, g: 255, b: 0 })
    })

    it('handles missing properties with defaults', () => {
      const result = safeHsvToRgb({ h: 0 })
      expect(result.r).toBeGreaterThanOrEqual(0)
      expect(result.r).toBeLessThanOrEqual(255)
    })

    it('handles null input', () => {
      const result = safeHsvToRgb(null)
      expect(result).toEqual({ r: 0, g: 0, b: 0 })
    })

    it('handles undefined input', () => {
      const result = safeHsvToRgb(undefined)
      expect(result).toEqual({ r: 0, g: 0, b: 0 })
    })
  })

  describe('colorToRgbStyle', () => {
    it('converts HSV color object', () => {
      const color = { hsv: { h: 0, s: 100, v: 100 } }
      const result = colorToRgbStyle(color)
      expect(result).toBe('rgb(255, 0, 0)')
    })

    it('converts RAW color object', () => {
      const color = { raw: { r: 100, g: 150, b: 200 } }
      const result = colorToRgbStyle(color)
      expect(result).toBe('rgb(100, 150, 200)')
    })

    it('converts Preset with resolver function', () => {
      const color = { Preset: { id: 'preset-1' } }
      const getPresetColor = (id) => {
        if (id === 'preset-1') {
          return { hsv: { h: 240, s: 100, v: 100 } }
        }
        return null
      }
      const result = colorToRgbStyle(color, getPresetColor)
      expect(result).toBe('rgb(0, 0, 255)')
    })

    it('returns empty string for null color', () => {
      const result = colorToRgbStyle(null)
      expect(result).toBe('')
    })

    it('returns empty string for unresolved preset', () => {
      const color = { Preset: { id: 'unknown' } }
      const getPresetColor = () => null
      const result = colorToRgbStyle(color, getPresetColor)
      expect(result).toBe('')
    })
  })
})
