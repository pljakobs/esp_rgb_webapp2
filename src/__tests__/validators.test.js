import { describe, it, expect } from "vitest";
import {
  required,
  ipAddress,
  hostname,
  numberRange,
  minLength,
  maxLength,
  hsvColor,
  rgbColor,
} from "../services/validators";

describe("Validators Service", () => {
  describe("required", () => {
    it("accepts non-empty values", () => {
      expect(required("test")).toBe(true);
      expect(required(123)).toBe(true);
      expect(required(0)).toBe(true);
    });

    it("rejects empty values", () => {
      expect(required("")).toBe("This field is required");
      expect(required(null)).toBe("This field is required");
      expect(required(undefined)).toBe("This field is required");
    });
  });

  describe("ipAddress", () => {
    it("accepts valid IP addresses", () => {
      expect(ipAddress("192.168.1.1")).toBe(true);
      expect(ipAddress("10.0.0.1")).toBe(true);
      expect(ipAddress("255.255.255.255")).toBe(true);
    });

    it("rejects invalid IP addresses", () => {
      expect(ipAddress("256.1.1.1")).toContain("255");
      expect(ipAddress("192.168.1")).toContain("format");
      expect(ipAddress("abc.def.ghi.jkl")).toContain("format");
    });

    it("allows empty value", () => {
      expect(ipAddress("")).toBe(true);
    });
  });

  describe("hostname", () => {
    it("accepts valid hostnames", () => {
      expect(hostname("example")).toBe(true);
      expect(hostname("my-device")).toBe(true);
      expect(hostname("device123")).toBe(true);
    });

    it("rejects invalid hostnames", () => {
      expect(hostname("_invalid")).toContain("format");
      expect(hostname("invalid.")).toContain("format");
      expect(hostname("-invalid")).toContain("format");
    });
  });

  describe("numberRange", () => {
    it("accepts numbers in range", () => {
      const validator = numberRange(0, 100);
      expect(validator(50)).toBe(true);
      expect(validator(0)).toBe(true);
      expect(validator(100)).toBe(true);
    });

    it("rejects numbers out of range", () => {
      const validator = numberRange(0, 100);
      expect(validator(-1)).toContain("between");
      expect(validator(101)).toContain("between");
    });

    it("rejects non-numbers", () => {
      const validator = numberRange(0, 100);
      expect(validator("abc")).toContain("number");
    });
  });

  describe("minLength and maxLength", () => {
    it("validates minimum length", () => {
      const validator = minLength(5);
      expect(validator("hello")).toBe(true);
      expect(validator("test")).toContain("at least");
    });

    it("validates maximum length", () => {
      const validator = maxLength(10);
      expect(validator("hello")).toBe(true);
      expect(validator("this is too long")).toContain("no more than");
    });
  });

  describe("hsvColor", () => {
    it("accepts valid HSV colors", () => {
      expect(hsvColor({ h: 180, s: 50, v: 100 })).toBe(true);
      expect(hsvColor({ h: 0, s: 0, v: 0 })).toBe(true);
      expect(hsvColor({ h: 360, s: 100, v: 100 })).toBe(true);
    });

    it("rejects invalid HSV colors", () => {
      expect(hsvColor({ h: 400, s: 50, v: 100 })).toContain("Hue");
      expect(hsvColor({ h: 180, s: 150, v: 100 })).toContain("Saturation");
      expect(hsvColor({ h: 180, s: 50, v: 150 })).toContain("Value");
      expect(hsvColor({ h: 180, s: 50 })).toContain("properties");
    });
  });

  describe("rgbColor", () => {
    it("accepts valid RGB colors", () => {
      expect(rgbColor({ r: 255, g: 0, b: 0 })).toBe(true);
      expect(rgbColor({ r: 0, g: 0, b: 0 })).toBe(true);
      expect(rgbColor({ r: 128, g: 128, b: 128 })).toBe(true);
    });

    it("rejects invalid RGB colors", () => {
      expect(rgbColor({ r: 256, g: 0, b: 0 })).toContain("0 and 255");
      expect(rgbColor({ r: 100, g: 100 })).toContain("properties");
    });
  });
});
