import { describe, it, expect } from "vitest";
import { LIGHT_CHANNELS, supportsVirtualLights, lightProfile, createLight, validateLightConfiguration } from "../virtualLights.js";

const light = (overrides = {}) => ({ id: "light-a", index: 0, name: "Desk", type: "RGB", pins: [1, 2, 3], is_default: true, ...overrides });

describe("Virtual-light firmware profile", () => {
  it("uses only the supported 5.1 firmware line", () => {
    expect(supportsVirtualLights("V5.1.0-6-develop")).toBe(true);
    expect(supportsVirtualLights("V5.1-418-develop")).toBe(true);
    for (const version of ["V5.0-417-develop", "V5.10.0", "V6.0.0", null]) {
      expect(supportsVirtualLights(version)).toBe(false);
    }
  });
  it("matches the schema's channel order and control profiles", () => {
    expect(LIGHT_CHANNELS.RGBCW).toEqual(["r", "g", "b", "cw"]);
    expect(lightProfile(light({ type: "WWCW" }))).toMatchObject({ rgb: false, ct: true, channels: ["ww", "cw"] });
    expect(lightProfile(light({ type: "RGB" }))).toMatchObject({ rgb: true, ct: false });
  });
  it("creates a fresh identity without renumbering existing lights", () => {
    expect(createLight([light({ index: 7 })], "fresh-id")).toMatchObject({ id: "fresh-id", index: 8, is_default: false });
    expect(createLight([], "first").is_default).toBe(true);
  });
});

describe("Whole-assignment validation", () => {
  it("allows an empty configuration and a valid light", () => {
    expect(validateLightConfiguration({ lights: [] })).toEqual([]);
    expect(validateLightConfiguration({ lights: [light()] })).toEqual([]);
  });
  it("rejects missing/default duplicates and duplicate identity", () => {
    expect(validateLightConfiguration({ lights: [light({ is_default: false })] })).toContain("Select exactly one default light.");
    expect(validateLightConfiguration({ lights: [light(), light()] }).join(" ")).toContain("duplicate light ID");
  });
  it("rejects conflicts with disabled button/bus reservations and board pins", () => {
    expect(validateLightConfiguration({ lights: [light()], buttons: [{ pin: 1, enabled: false }] }).join(" ")).toContain("already assigned");
    expect(validateLightConfiguration({ lights: [light()], buses: [{ sda: 2, scl: 4, enabled: false }] }).join(" ")).toContain("already assigned");
    expect(validateLightConfiguration({ lights: [light()] }, { reserved_gpios: [1], implemented_pins: [] }).join(" ")).toContain("not a board PWM output");
  });
  it("does not mutate rejected candidates", () => {
    const configuration = { lights: [light({ pins: [1, null] })] };
    const original = JSON.stringify(configuration);
    expect(validateLightConfiguration(configuration).length).toBeGreaterThan(0);
    expect(JSON.stringify(configuration)).toBe(original);
  });
});