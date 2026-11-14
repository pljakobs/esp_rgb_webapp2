import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiService } from "../api.js";
import {
  sensorDefinitions,
  sensorRequest,
  settingsPayload,
  validSettings,
  spectralCurve,
  wavelengths,
  graphGeometry,
} from "../sensors.js";

vi.mock("../api.js", () => ({ apiService: { fetchApi: vi.fn() } }));

describe("sensor API and visualization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the authenticated shared API and strips status fields from config writes", async () => {
    const draft = {
      enabled: false,
      available: false,
      extension_id: "current-1",
      address: 64,
      shunt_ohms: 0.1,
      interval_ms: 1000,
    };
    const payload = settingsPayload(sensorDefinitions[0], draft);
    expect(payload).not.toHaveProperty("available");
    expect(payload).not.toHaveProperty("extension_id");
    apiService.fetchApi.mockResolvedValue({ jsonData: draft });
    const controller = { ip_address: "192.0.2.1" };
    await sensorRequest("current-1", "config", controller, payload);
    expect(apiService.fetchApi).toHaveBeenCalledWith(
      "extensions/current-1/config",
      controller,
      { method: "POST", body: payload, atomic: true },
    );
  });

  it("enforces the exact current and spectrum configuration bounds", () => {
    const current = {
      enabled: true,
      address: 64,
      shunt_ohms: 0.00001,
      interval_ms: 200,
    };
    expect(validSettings(sensorDefinitions[0], current)).toBe(true);
    expect(
      validSettings(sensorDefinitions[0], {
        ...current,
        address: 79,
        shunt_ohms: 1,
        interval_ms: 3600000,
      }),
    ).toBe(true);
    for (const patch of [
      { address: 63 },
      { address: 80 },
      { address: 64.5 },
      { shunt_ohms: 0 },
      { shunt_ohms: 1.1 },
      { interval_ms: 199 },
      { interval_ms: 3600001 },
      { enabled: 1 },
    ]) {
      expect(
        validSettings(sensorDefinitions[0], { ...current, ...patch }),
      ).toBe(false);
    }
    const spectrum = {
      enabled: true,
      atime: 0,
      astep: 0,
      gain: 0,
      interval_ms: 200,
    };
    expect(validSettings(sensorDefinitions[1], spectrum)).toBe(true);
    expect(
      validSettings(sensorDefinitions[1], {
        ...spectrum,
        atime: 255,
        astep: 65535,
        gain: 10,
      }),
    ).toBe(true);
    for (const patch of [
      { atime: 256 },
      { astep: 65536 },
      { gain: 11 },
      { gain: -1 },
      { atime: 0.5 },
    ]) {
      expect(() =>
        settingsPayload(sensorDefinitions[1], { ...spectrum, ...patch }),
      ).toThrow("Invalid sensor settings");
    }
  });

  it("surfaces firmware errors and rejects malformed valid readings", async () => {
    apiService.fetchApi.mockResolvedValue({
      status: 409,
      error: {},
      jsonData: { error: "measurement busy" },
    });
    await expect(
      sensorRequest("spectrum-1", "config", {}),
    ).rejects.toMatchObject({ message: "measurement busy", status: 409 });
    apiService.fetchApi.mockResolvedValue({
      jsonData: {
        extension_id: "current-1",
        valid: true,
        age_ms: 0,
        error: "",
        current_a: "broken",
      },
    });
    await expect(sensorRequest("current-1", "readings", {})).rejects.toThrow(
      "Invalid sensor response",
    );
  });

  it.each([
    [0, 100, 5, 400, 50, 200, 3, 40],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [20, 40, 60, 80, 100, 120, 140, 160],
  ])("fits all eight channels without overshoot: %j", (...values) => {
    const data = Object.fromEntries(values.map((y, i) => [`f${i + 1}`, y]));
    const curve = spectralCurve(data);
    wavelengths.forEach((x, i) =>
      expect(curve.find((p) => p.x === x)).toEqual({ x, y: values[i] }),
    );
    curve.forEach(({ x, y }) => {
      const i = Math.min(
        6,
        Math.max(
          0,
          wavelengths.findLastIndex((w) => w <= x),
        ),
      );
      expect(y).toBeGreaterThanOrEqual(
        Math.min(values[i], values[i + 1]) - 1e-8,
      );
      expect(y).toBeLessThanOrEqual(Math.max(values[i], values[i + 1]) + 1e-8);
    });
  });

  it("does not plot missing data and breaks current history across invalid readings", () => {
    expect(spectralCurve({ f1: 100 })).toEqual([]);
    const graph = graphGeometry([
      { x: 1, y: -1 },
      { x: 2, y: null },
      { x: 3, y: 1 },
    ]);
    expect(graph.minY).toBe(-1);
    expect(graph.path.match(/M/g)).toHaveLength(2);
    expect(graph.path).not.toContain("L");
  });
});
