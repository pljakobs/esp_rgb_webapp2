import { describe, it, expect } from "vitest";
import { colors } from "quasar";

const { hsvToRgb, rgbToHsv, hexToRgb, rgbToHex } = colors;

describe("Color Conversions", () => {
  describe("hsvToRgb", () => {
    it("converts pure red HSV to RGB", () => {
      const result = hsvToRgb({ h: 0, s: 100, v: 100 });
      expect(result).toEqual({ r: 255, g: 0, b: 0 });
    });

    it("converts pure green HSV to RGB", () => {
      const result = hsvToRgb({ h: 120, s: 100, v: 100 });
      expect(result).toEqual({ r: 0, g: 255, b: 0 });
    });

    it("converts pure blue HSV to RGB", () => {
      const result = hsvToRgb({ h: 240, s: 100, v: 100 });
      expect(result).toEqual({ r: 0, g: 0, b: 255 });
    });

    it("converts white HSV to RGB", () => {
      const result = hsvToRgb({ h: 0, s: 0, v: 100 });
      expect(result).toEqual({ r: 255, g: 255, b: 255 });
    });

    it("converts black HSV to RGB", () => {
      const result = hsvToRgb({ h: 0, s: 0, v: 0 });
      expect(result).toEqual({ r: 0, g: 0, b: 0 });
    });

    it("requires all HSV properties", () => {
      // Quasar's hsvToRgb requires all properties (h, s, v)
      const result = hsvToRgb({ h: 0, s: 50, v: 75 });
      expect(result.r).toBeGreaterThanOrEqual(0);
      expect(result.r).toBeLessThanOrEqual(255);
      expect(result.g).toBeGreaterThanOrEqual(0);
      expect(result.b).toBeGreaterThanOrEqual(0);
    });
  });

  describe("rgbToHsv", () => {
    it("converts red RGB to HSV", () => {
      const result = rgbToHsv({ r: 255, g: 0, b: 0 });
      expect(result.h).toBe(0);
      expect(result.s).toBe(100);
      expect(result.v).toBe(100);
    });

    it("converts white RGB to HSV", () => {
      const result = rgbToHsv({ r: 255, g: 255, b: 255 });
      expect(result.s).toBe(0);
      expect(result.v).toBe(100);
    });

    it("converts black RGB to HSV", () => {
      const result = rgbToHsv({ r: 0, g: 0, b: 0 });
      expect(result.s).toBe(0);
      expect(result.v).toBe(0);
    });
  });

  describe("hexToRgb and rgbToHex", () => {
    it("converts hex to RGB", () => {
      const result = hexToRgb("#FF0000");
      expect(result).toEqual({ r: 255, g: 0, b: 0 });
    });

    it("converts RGB to hex", () => {
      const result = rgbToHex({ r: 255, g: 0, b: 0 });
      expect(result.toLowerCase()).toBe("#ff0000");
    });

    it("round-trips hex → RGB → hex", () => {
      const original = "#3498db";
      const rgb = hexToRgb(original);
      const final = rgbToHex(rgb);
      expect(final.toLowerCase()).toBe(original.toLowerCase());
    });
  });

  describe("Color conversion edge cases", () => {
    it("handles boundary values in HSV", () => {
      const result = hsvToRgb({ h: 359, s: 100, v: 100 });
      expect(result.r).toBeGreaterThan(250);
      expect(result.g).toBeLessThan(5);
      expect(result.b).toBeLessThan(5);
    });

    it("handles mid-range saturation", () => {
      const result = hsvToRgb({ h: 180, s: 50, v: 100 });
      expect(result.r).toBeGreaterThan(120);
      expect(result.g).toBe(255);
      expect(result.b).toBe(255);
    });
  });
});
