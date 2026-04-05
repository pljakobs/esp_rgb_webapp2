import { describe, it, expect } from "vitest";
import {
  validatePreset,
  validateScene,
  validateGroup,
  validateDataPayload,
  validateConfigPayload,
  validateHSV,
  validateRaw,
  validateTransition,
  validateBatch,
} from "../schemaValidator.js";

describe("schemaValidator", () => {
  describe("payload schema validation", () => {
    it("accepts valid app-data payload", () => {
      const payload = {
        groups: [
          {
            id: "group-1",
            name: "Group 1",
            ts: Date.now(),
            controller_ids: ["ctrl-1"],
          },
        ],
        scenes: [
          {
            id: "scene-1",
            name: "Scene 1",
            group_id: "group-1",
            ts: Date.now(),
            settings: [
              {
                controller_id: "ctrl-1",
                pos: 0,
                color: { id: "preset-1" },
              },
            ],
          },
        ],
      };

      const result = validateDataPayload(payload);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("rejects invalid app-data payload", () => {
      const payload = {
        scenes: [
          {
            id: "scene-1",
            group_id: "group-1",
            ts: Date.now(),
            settings: [],
          },
        ],
      };

      const result = validateDataPayload(payload);
      expect(result.valid).toBe(false);
      expect(result.schema).toBe("app-data.cfgdb");
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects invalid app-config payload types", () => {
      const payload = {
        network: {
          telemetry: {
            statsEnabled: "true",
          },
        },
      };

      const result = validateConfigPayload(payload);
      expect(result.valid).toBe(false);
      expect(result.schema).toBe("app-config.cfgdb");
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("validateHSV", () => {
    it("should validate a correct HSV color", () => {
      const hsv = { h: 180, s: 50, v: 75, ct: 5000 };
      const result = validateHSV(hsv);
      expect(result).toEqual({ h: 180, s: 50, v: 75, ct: 5000 });
    });

    it("should coerce float values to integers", () => {
      const hsv = { h: 180.7, s: 50.3, v: 75.9, ct: 5000.2 };
      const result = validateHSV(hsv);
      expect(result).toEqual({ h: 180, s: 50, v: 75, ct: 5000 });
    });

    it("should clamp h to valid range (0-359)", () => {
      expect(validateHSV({ h: 400, s: 50, v: 75 })).toMatchObject({ h: 359 });
      expect(validateHSV({ h: -10, s: 50, v: 75 })).toMatchObject({ h: 0 });
    });

    it("should clamp s and v to valid range (0-100)", () => {
      expect(validateHSV({ h: 180, s: 150, v: 75 })).toMatchObject({ s: 100 });
      expect(validateHSV({ h: 180, s: -10, v: 75 })).toMatchObject({ s: 0 });
      expect(validateHSV({ h: 180, s: 50, v: 150 })).toMatchObject({ v: 100 });
      expect(validateHSV({ h: 180, s: 50, v: -10 })).toMatchObject({ v: 0 });
    });

    it("should clamp ct to valid range (0-10000)", () => {
      expect(validateHSV({ h: 180, s: 50, v: 75, ct: 15000 })).toMatchObject({
        ct: 10000,
      });
      expect(validateHSV({ h: 180, s: 50, v: 75, ct: -100 })).toMatchObject({
        ct: 0,
      });
    });

    it("should default ct to 0 if not provided", () => {
      const result = validateHSV({ h: 180, s: 50, v: 75 });
      expect(result.ct).toBe(0);
    });

    it("should throw error if h, s, or v is missing", () => {
      expect(() => validateHSV({ s: 50, v: 75 })).toThrow(
        "HSV color must have h, s, and v",
      );
      expect(() => validateHSV({ h: 180, v: 75 })).toThrow(
        "HSV color must have h, s, and v",
      );
      expect(() => validateHSV({ h: 180, s: 50 })).toThrow(
        "HSV color must have h, s, and v",
      );
    });
  });

  describe("validateRaw", () => {
    it("should validate a correct raw color", () => {
      const raw = { r: 512, g: 256, b: 128, ww: 64, cw: 32 };
      const result = validateRaw(raw);
      expect(result).toEqual({ r: 512, g: 256, b: 128, ww: 64, cw: 32 });
    });

    it("should coerce float values to integers", () => {
      const raw = { r: 512.7, g: 256.3, b: 128.9, ww: 64.2, cw: 32.8 };
      const result = validateRaw(raw);
      expect(result).toEqual({ r: 512, g: 256, b: 128, ww: 64, cw: 32 });
    });

    it("should clamp values to valid range (0-1023)", () => {
      expect(
        validateRaw({ r: 1500, g: 256, b: 128, ww: 64, cw: 32 }),
      ).toMatchObject({ r: 1023 });
      expect(
        validateRaw({ r: -10, g: 256, b: 128, ww: 64, cw: 32 }),
      ).toMatchObject({ r: 0 });
      expect(
        validateRaw({ r: 512, g: 1500, b: 128, ww: 64, cw: 32 }),
      ).toMatchObject({ g: 1023 });
      expect(
        validateRaw({ r: 512, g: 256, b: -10, ww: 64, cw: 32 }),
      ).toMatchObject({ b: 0 });
    });

    it("should default ww and cw to 0 if not provided", () => {
      const result = validateRaw({ r: 512, g: 256, b: 128 });
      expect(result.ww).toBe(0);
      expect(result.cw).toBe(0);
    });

    it("should throw error if r, g, or b is missing", () => {
      expect(() => validateRaw({ g: 256, b: 128 })).toThrow(
        "Raw color must have r, g, and b",
      );
      expect(() => validateRaw({ r: 512, b: 128 })).toThrow(
        "Raw color must have r, g, and b",
      );
      expect(() => validateRaw({ r: 512, g: 256 })).toThrow(
        "Raw color must have r, g, and b",
      );
    });
  });

  describe("validateTransition", () => {
    it("should validate a correct transition", () => {
      const transition = {
        cmd: "fade",
        d: 1000,
        t: 500,
        s: 250,
        q: "0",
        r: false,
      };
      const result = validateTransition(transition);
      expect(result).toEqual({
        cmd: "fade",
        d: 1000,
        t: 500,
        s: 250,
        q: "0",
        r: false,
      });
    });

    it("should coerce d, t, s to integers", () => {
      const transition = {
        cmd: "fade",
        d: 1000.7,
        t: 500.3,
        s: 250.9,
        q: "0",
        r: false,
      };
      const result = validateTransition(transition);
      expect(result).toMatchObject({ d: 1000, t: 500, s: 250 });
    });

    it("should handle missing optional fields", () => {
      const transition = { cmd: "fade", d: 1000 };
      const result = validateTransition(transition);
      expect(result.cmd).toBe("fade");
      expect(result.d).toBe(1000);
    });

    it("should throw error if cmd is missing", () => {
      expect(() => validateTransition({ d: 1000 })).toThrow(
        "Transition must have a cmd",
      );
    });
  });

  describe("validatePreset", () => {
    it("should validate a correct preset with HSV color", () => {
      const preset = {
        id: "preset-1",
        name: "Test Preset",
        ts: 1234567890,
        favorite: true,
        icon: "palette",
        color: {
          hsv: { h: 180, s: 50, v: 75, ct: 5000 },
        },
      };
      const result = validatePreset(preset);
      expect(result.id).toBe("preset-1");
      expect(result.name).toBe("Test Preset");
      expect(result.ts).toBe(1234567890);
      expect(result.favorite).toBe(true);
      expect(result.color.hsv).toEqual({ h: 180, s: 50, v: 75, ct: 5000 });
    });

    it("should validate a correct preset with raw color", () => {
      const preset = {
        id: "preset-2",
        name: "Raw Preset",
        color: {
          raw: { r: 512, g: 256, b: 128, ww: 64, cw: 32 },
        },
      };
      const result = validatePreset(preset);
      expect(result.color.raw).toEqual({
        r: 512,
        g: 256,
        b: 128,
        ww: 64,
        cw: 32,
      });
    });

    it("should coerce ts to integer", () => {
      const preset = {
        id: "preset-3",
        name: "Float TS",
        ts: 1234567890.567,
        color: { hsv: { h: 180, s: 50, v: 75 } },
      };
      const result = validatePreset(preset);
      expect(result.ts).toBe(1234567890);
    });

    it("should generate ts if not provided", () => {
      const preset = {
        id: "preset-4",
        name: "No TS",
        color: { hsv: { h: 180, s: 50, v: 75 } },
      };
      const result = validatePreset(preset);
      expect(result.ts).toBeGreaterThan(0);
      expect(Number.isInteger(result.ts)).toBe(true);
    });

    it('should default icon to "palette" if not provided', () => {
      const preset = {
        id: "preset-5",
        name: "No Icon",
        color: { hsv: { h: 180, s: 50, v: 75 } },
      };
      const result = validatePreset(preset);
      expect(result.icon).toBe("palette");
    });

    it("should coerce favorite to boolean", () => {
      const preset1 = {
        id: "preset-6",
        name: "Truthy Favorite",
        favorite: "yes",
        color: { hsv: { h: 180, s: 50, v: 75 } },
      };
      expect(validatePreset(preset1).favorite).toBe(true);

      const preset2 = {
        id: "preset-7",
        name: "Falsy Favorite",
        favorite: 0,
        color: { hsv: { h: 180, s: 50, v: 75 } },
      };
      expect(validatePreset(preset2).favorite).toBe(false);
    });

    it("should coerce color HSV values to integers", () => {
      const preset = {
        id: "preset-8",
        name: "Float HSV",
        color: { hsv: { h: 180.7, s: 50.3, v: 75.9, ct: 5000.2 } },
      };
      const result = validatePreset(preset);
      expect(result.color.hsv).toEqual({ h: 180, s: 50, v: 75, ct: 5000 });
    });

    it("should coerce color raw values to integers", () => {
      const preset = {
        id: "preset-9",
        name: "Float Raw",
        color: { raw: { r: 512.7, g: 256.3, b: 128.9, ww: 64.2, cw: 32.8 } },
      };
      const result = validatePreset(preset);
      expect(result.color.raw).toEqual({
        r: 512,
        g: 256,
        b: 128,
        ww: 64,
        cw: 32,
      });
    });

    it("should throw error if id is missing", () => {
      expect(() =>
        validatePreset({
          name: "No ID",
          color: { hsv: { h: 180, s: 50, v: 75 } },
        }),
      ).toThrow("Preset must have a string id");
    });

    it("should throw error if name is missing", () => {
      expect(() =>
        validatePreset({
          id: "no-name",
          color: { hsv: { h: 180, s: 50, v: 75 } },
        }),
      ).toThrow("Preset must have a string name");
    });

    it("should throw error if color is missing", () => {
      expect(() =>
        validatePreset({ id: "no-color", name: "No Color" }),
      ).toThrow("Preset must have a color");
    });

    it("should throw error if color has neither hsv nor raw", () => {
      expect(() =>
        validatePreset({ id: "bad-color", name: "Bad Color", color: {} }),
      ).toThrow("Preset color must have either hsv or raw");
    });
  });

  describe("validateScene", () => {
    it("should validate a correct scene", () => {
      const scene = {
        id: "scene-1",
        name: "Test Scene",
        group_id: "group-1",
        ts: 1234567890,
        icon: "scene",
        transition: { cmd: "fade", d: 1000, t: 500, s: 250, q: "0", r: false },
        settings: [
          {
            controller_id: "ctrl-1",
            pos: 0,
            color: { hsv: { h: 180, s: 50, v: 75, ct: 5000 } },
          },
        ],
      };
      const result = validateScene(scene);
      expect(result.id).toBe("scene-1");
      expect(result.name).toBe("Test Scene");
      expect(result.group_id).toBe("group-1");
      expect(result.ts).toBe(1234567890);
      expect(result.transition.d).toBe(1000);
      expect(result.settings[0].pos).toBe(0);
      expect(result.settings[0].color.hsv).toEqual({
        h: 180,
        s: 50,
        v: 75,
        ct: 5000,
      });
    });

    it("should coerce ts to integer", () => {
      const scene = {
        id: "scene-2",
        name: "Float TS",
        group_id: "group-1",
        ts: 1234567890.567,
        settings: [],
      };
      const result = validateScene(scene);
      expect(result.ts).toBe(1234567890);
    });

    it("should generate ts if not provided", () => {
      const scene = {
        id: "scene-3",
        name: "No TS",
        group_id: "group-1",
        settings: [],
      };
      const result = validateScene(scene);
      expect(result.ts).toBeGreaterThan(0);
      expect(Number.isInteger(result.ts)).toBe(true);
    });

    it('should default icon to "scene" if not provided', () => {
      const scene = {
        id: "scene-4",
        name: "No Icon",
        group_id: "group-1",
        settings: [],
      };
      const result = validateScene(scene);
      expect(result.icon).toBe("scene");
    });

    it("should validate transition integers", () => {
      const scene = {
        id: "scene-5",
        name: "Float Transition",
        group_id: "group-1",
        transition: { cmd: "fade", d: 1000.7, t: 500.3, s: 250.9 },
        settings: [],
      };
      const result = validateScene(scene);
      expect(result.transition).toMatchObject({ d: 1000, t: 500, s: 250 });
    });

    it("should validate setting pos as integer", () => {
      const scene = {
        id: "scene-6",
        name: "Float Pos",
        group_id: "group-1",
        settings: [
          {
            controller_id: "ctrl-1",
            pos: 0.7,
            color: { hsv: { h: 180, s: 50, v: 75 } },
          },
        ],
      };
      const result = validateScene(scene);
      expect(result.settings[0].pos).toBe(0);
    });

    it("should validate setting color HSV integers", () => {
      const scene = {
        id: "scene-7",
        name: "Float Color",
        group_id: "group-1",
        settings: [
          {
            controller_id: "ctrl-1",
            pos: 0,
            color: { hsv: { h: 180.7, s: 50.3, v: 75.9, ct: 5000.2 } },
          },
        ],
      };
      const result = validateScene(scene);
      expect(result.settings[0].color.hsv).toEqual({
        h: 180,
        s: 50,
        v: 75,
        ct: 5000,
      });
    });

    it("should validate setting transition integers", () => {
      const scene = {
        id: "scene-8",
        name: "Float Setting Transition",
        group_id: "group-1",
        settings: [
          {
            controller_id: "ctrl-1",
            pos: 0,
            transition: { cmd: "fade", d: 1000.7, t: 500.3, s: 250.9 },
          },
        ],
      };
      const result = validateScene(scene);
      expect(result.settings[0].transition).toMatchObject({
        d: 1000,
        t: 500,
        s: 250,
      });
    });

    it("should throw error if id is missing", () => {
      expect(() =>
        validateScene({ name: "No ID", group_id: "group-1", settings: [] }),
      ).toThrow("Scene must have a string id");
    });

    it("should throw error if name is missing", () => {
      expect(() =>
        validateScene({ id: "no-name", group_id: "group-1", settings: [] }),
      ).toThrow("Scene must have a string name");
    });

    it("should throw error if group_id is missing", () => {
      expect(() =>
        validateScene({ id: "no-group", name: "No Group", settings: [] }),
      ).toThrow("Scene must have a string group_id");
    });

    it("should throw error if settings is not an array", () => {
      expect(() =>
        validateScene({
          id: "bad-settings",
          name: "Bad Settings",
          group_id: "group-1",
          settings: "not-array",
        }),
      ).toThrow("Scene must have a settings array");
    });

    it("should throw error if setting has no controller_id", () => {
      expect(() =>
        validateScene({
          id: "no-ctrl",
          name: "No Controller",
          group_id: "group-1",
          settings: [{ pos: 0, color: { hsv: { h: 180, s: 50, v: 75 } } }],
        }),
      ).toThrow("Scene setting must have a string controller_id");
    });
  });

  describe("validateGroup", () => {
    it("should validate a correct group", () => {
      const group = {
        id: "group-1",
        name: "Test Group",
        controller_ids: ["ctrl-1", "ctrl-2"],
        ts: 1234567890,
        icon: "light_groups",
      };
      const result = validateGroup(group);
      expect(result.id).toBe("group-1");
      expect(result.name).toBe("Test Group");
      expect(result.controller_ids).toEqual(["ctrl-1", "ctrl-2"]);
      expect(result.ts).toBe(1234567890);
      expect(result.icon).toBe("light_groups");
    });

    it("should coerce ts to integer", () => {
      const group = {
        id: "group-2",
        name: "Float TS",
        controller_ids: ["ctrl-1"],
        ts: 1234567890.567,
      };
      const result = validateGroup(group);
      expect(result.ts).toBe(1234567890);
    });

    it("should generate ts if not provided", () => {
      const group = {
        id: "group-3",
        name: "No TS",
        controller_ids: ["ctrl-1"],
      };
      const result = validateGroup(group);
      expect(result.ts).toBeGreaterThan(0);
      expect(Number.isInteger(result.ts)).toBe(true);
    });

    it('should default icon to "light_groups" if not provided', () => {
      const group = {
        id: "group-4",
        name: "No Icon",
        controller_ids: ["ctrl-1"],
      };
      const result = validateGroup(group);
      expect(result.icon).toBe("light_groups");
    });

    it("should coerce controller_ids elements to strings", () => {
      const group = {
        id: "group-5",
        name: "Numeric IDs",
        controller_ids: [1, 2, 3],
      };
      const result = validateGroup(group);
      expect(result.controller_ids).toEqual(["1", "2", "3"]);
    });

    it("should throw error if id is missing", () => {
      expect(() =>
        validateGroup({ name: "No ID", controller_ids: ["ctrl-1"] }),
      ).toThrow("Group must have a string id");
    });

    it("should throw error if name is missing", () => {
      expect(() =>
        validateGroup({ id: "no-name", controller_ids: ["ctrl-1"] }),
      ).toThrow("Group must have a string name");
    });

    it("should throw error if controller_ids is missing", () => {
      expect(() =>
        validateGroup({ id: "no-controllers", name: "No Controllers" }),
      ).toThrow("Group must have a controller_ids array");
    });

    it("should throw error if controller_ids is not an array", () => {
      expect(() =>
        validateGroup({
          id: "bad-controllers",
          name: "Bad Controllers",
          controller_ids: "not-array",
        }),
      ).toThrow("Group must have a controller_ids array");
    });
  });

  describe("validateBatch", () => {
    it("should validate a batch of valid presets", () => {
      const presets = [
        {
          id: "p1",
          name: "Preset 1",
          color: { hsv: { h: 180, s: 50, v: 75 } },
        },
        {
          id: "p2",
          name: "Preset 2",
          color: { hsv: { h: 270, s: 60, v: 80 } },
        },
      ];
      const result = validateBatch(presets, validatePreset);
      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(0);
    });

    it("should collect invalid items with error messages", () => {
      const presets = [
        { id: "p1", name: "Valid", color: { hsv: { h: 180, s: 50, v: 75 } } },
        { name: "No ID", color: { hsv: { h: 270, s: 60, v: 80 } } },
        { id: "p3", color: { hsv: { h: 90, s: 40, v: 70 } } },
      ];
      const result = validateBatch(presets, validatePreset);
      expect(result.valid).toHaveLength(1);
      expect(result.invalid).toHaveLength(2);
      expect(result.invalid[0].index).toBe(1);
      expect(result.invalid[0].error).toContain("Preset must have a string id");
      expect(result.invalid[1].index).toBe(2);
      expect(result.invalid[1].error).toContain(
        "Preset must have a string name",
      );
    });

    it("should validate with type coercion", () => {
      const presets = [
        {
          id: "p1",
          name: "Float Values",
          ts: 123.456,
          color: { hsv: { h: 180.7, s: 50.3, v: 75.9 } },
        },
      ];
      const result = validateBatch(presets, validatePreset);
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].ts).toBe(123);
      expect(result.valid[0].color.hsv).toEqual({
        h: 180,
        s: 50,
        v: 75,
        ct: 0,
      });
    });
  });
});
