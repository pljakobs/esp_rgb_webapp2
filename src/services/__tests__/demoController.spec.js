import { describe, expect, it, vi } from "vitest";
import { createDemoController, installDemoTransport } from "../demoController";
import { isDemoMode } from "../demoMode";

const request = async (controller, path, body) => {
  const result = await controller.handle(new URL(`http://demo.invalid/${path}`), body === undefined ? {} : {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { status: result.status, data: await result.json() };
};

describe("demo controller", () => {
  it("uses explicit demo mode only", () => {
    expect(isDemoMode({ search: "?demo=1" })).toBe(true);
    expect(isDemoMode({ search: "?demo=0" })).toBe(false);
    expect(isDemoMode({ search: "" })).toBe(false);
  });

  it("keeps lights separate and resets in a fresh instance", async () => {
    const first = createDemoController();
    const second = createDemoController();
    await request(first, "color?light=0", { hsv: { h: 120, v: 42 } });
    expect((await request(first, "color?light=0")).data.hsv).toMatchObject({ h: 120, v: 42 });
    expect((await request(first, "color?light=1")).data.hsv.v).toBe(65);
    expect((await request(second, "color?light=0")).data.hsv.v).toBe(65);
    await request(first, "off", { light: 0 });
    expect((await request(first, "color")).data.hsv.v).toBe(0);
    await request(first, "on", { light: 0 });
    expect((await request(first, "color")).data.hsv.v).toBe(42);
  });

  it("applies collection edits atomically and preserves sparse fields", async () => {
    const controller = createDemoController();
    await request(controller, "data", { "presets[]": [{ id: "p1", name: "Test", favorite: false }] });
    await request(controller, "data", { "presets[id=p1]": { favorite: true } });
    expect((await request(controller, "data")).data.presets.find((p) => p.id === "p1")).toEqual({ id: "p1", name: "Test", favorite: true });
    expect((await request(controller, "data", { "presets[id=p1]": [], bad: 1 })).status).toBe(400);
    expect((await request(controller, "data")).data.presets.some((p) => p.id === "p1")).toBe(true);
    await request(controller, "data", { "presets[id=p1]": [] });
    expect((await request(controller, "data")).data.presets.some((p) => p.id === "p1")).toBe(false);
    expect((await request(controller, "system", { cmd: "restart" })).data.simulated).toBe(true);
  });

  it("persists configuration, light edits, sync locks and simulated updates in one instance", async () => {
    const controller = createDemoController();
    const other = createDemoController();
    const config = (await request(controller, "config")).data;
    const board = (await request(controller, "catalog")).data.boards[0];
    expect(config.hardware.configuration.board_profile).toEqual(board);
    const configuration = config.hardware.configuration;
    configuration.revision++;
    configuration.lights = [configuration.lights[0], { id: "new", index: 2, name: "New", type: "SINGLE", pins: [11], is_default: false }];
    await request(controller, "config", { hardware: { configuration }, network: { mqtt: { enabled: true } } });
    const saved = (await request(controller, "config")).data;
    expect(saved.hardware.configuration).toEqual(configuration);
    expect(saved.network.mqtt.enabled).toBe(true);
    expect((await request(controller, "color?light=2")).status).toBe(200);
    expect((await request(controller, "color?light=1")).status).toBe(404);
    expect((await request(other, "config")).data.network.mqtt.enabled).toBe(false);
    await request(controller, "data", { "sync-lock": { id: "demo", ts: 1 } });
    expect((await request(controller, "data")).data["sync-lock"]).toEqual({ id: "demo", ts: 1 });
    await request(controller, "data", { "sync-lock": { id: "", ts: 0 } });
    expect((await request(controller, "data")).data["sync-lock"].id).toBe("");
    await request(controller, "system", { cmd: "demo_update_firmware" });
    expect((await request(controller, "info")).data.app.git_version).toBe("V5.1-2-develop");
    expect((await request(other, "info")).data.app.git_version).toBe("V5.1-1-develop");
  });

  it("supports sensor settings, readings and simulated spectrum measurements", async () => {
    const controller = createDemoController();
    await request(controller, "extensions/current-1/config", { interval_ms: 2000 });
    expect((await request(controller, "extensions/current-1/config")).data).toMatchObject({ extension_id: "current-1", interval_ms: 2000, available: true });
    expect((await request(controller, "extensions/current-1/readings")).data).toMatchObject({ valid: true, current_a: 0.35 });
    expect((await request(controller, "extensions/spectrum-1/readings")).data.state).toBe("idle");
    expect((await request(controller, "extensions/spectrum-1/start_measurement", {})).data.extension_id).toBe("spectrum-1");
    expect((await request(controller, "extensions/spectrum-1/readings")).data).toMatchObject({ valid: true, state: "complete", data: { f1: 120, f8: 350 } });
  });

  it("blocks real controller requests rather than forwarding them", async () => {
    const nativeFetch = vi.fn();
    const target = { location: new URL("https://lightinator.de/api/demo/V5/index.html?demo=1"), fetch: nativeFetch };
    installDemoTransport(target);
    await expect(target.fetch("http://192.168.1.1/color")).rejects.toThrow("disabled");
    const response = await target.fetch("http://demo.invalid/color");
    expect((await response.json()).hsv.v).toBe(65);
    expect(nativeFetch).not.toHaveBeenCalled();
  });
});
