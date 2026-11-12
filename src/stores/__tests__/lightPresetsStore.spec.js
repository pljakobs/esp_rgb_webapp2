import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { reactive } from "vue";
import { useLightPresetsStore } from "../lightPresetsStore";
import { apiService } from "src/services/api";
import { isLightFavorite, presetColor } from "src/services/lightPresets";

const mocks = vi.hoisted(() => ({
  app: { data: { presets: [] } },
  controllers: { currentController: { ip_address: "device" } },
  lights: {},
}));
vi.mock("../appDataStore", () => ({ useAppDataStore: () => mocks.app }));
vi.mock("../controllersStore", () => ({
  useControllersStore: () => mocks.controllers,
}));
vi.mock("../virtualLightsStore", () => ({
  useVirtualLightsStore: () => mocks.lights,
}));
vi.mock("src/services/tools", () => ({ makeID: () => "new-preset" }));
vi.mock("src/services/api", () => ({
  apiService: {
    getInfo: vi.fn(),
    getConfig: vi.fn(),
    getDataFromController: vi.fn(),
    updateDataOnController: vi.fn(),
    setColor: vi.fn(),
  },
}));

const color = { hsv: { h: 120, s: 50, v: 40, ct: 2800 } };
const light = { id: "uuid", index: 3, type: "RGBWWCW", is_default: true };
const preset = () => ({
  id: "preset",
  name: "Warm",
  favorite: true,
  color: structuredClone(color),
  light_favorites: [{ light_id: "other", favorite: true }],
});

describe("Controller-local per-light presets", () => {
  let store;
  let remote;
  beforeEach(() => {
    vi.resetAllMocks();
    setActivePinia(createPinia());
    mocks.app.data = reactive({ presets: [] });
    mocks.controllers.currentController = { ip_address: "device" };
    mocks.lights = {
      enabled: true,
      selectedLight: { ...light },
      selectedId: light.id,
      loading: false,
      colorLoading: false,
      color,
      fetchColor: vi.fn(),
    };
    remote = [preset()];
    mocks.app.data.presets = structuredClone(remote);
    store = useLightPresetsStore();
    apiService.getInfo.mockResolvedValue({
      jsonData: { rgbww: { preset_light_favorites: true } },
    });
    apiService.getConfig.mockResolvedValue({
      jsonData: {
        hardware: { configuration: { lights: [{ ...light, index: 9 }] } },
      },
    });
    apiService.getDataFromController.mockImplementation(async () => ({
      jsonData: { presets: structuredClone(remote) },
    }));
    apiService.updateDataOnController.mockImplementation(
      async (_ip, payload) => {
        if (payload["presets[]"])
          remote.push(...structuredClone(payload["presets[]"]));
        else
          remote = Object.values(payload).map((value) =>
            structuredClone(value),
          );
        return { jsonData: { success: true } };
      },
    );
    apiService.setColor.mockResolvedValue({ jsonData: { success: true } });
  });

  it("uses legacy favorites only for the default and respects an explicit false", async () => {
    expect(store.favorites).toHaveLength(1);
    expect(isLightFavorite(preset(), { ...light, is_default: false })).toBe(
      false,
    );
    await store.setFavorite("preset", false);
    expect(remote[0].favorite).toBe(true);
    expect(remote[0].color).toEqual(color);
    expect(remote[0].light_favorites).toEqual([
      { light_id: "other", favorite: true },
      { light_id: "uuid", favorite: false },
    ]);
    expect(store.favorites).toHaveLength(0);
    expect(apiService.updateDataOnController.mock.calls[0][0]).toBe("device");
  });

  it("does not overwrite a newer color while changing membership", async () => {
    remote[0].color.hsv.v = 81;
    await store.setFavorite("preset", false);
    expect(remote[0].color.hsv.v).toBe(81);
  });

  it("retains the unchanged 5.0 favorite format", async () => {
    mocks.lights.enabled = false;
    await store.setFavorite("preset", false);
    expect(remote[0].favorite).toBe(false);
    expect(remote[0].light_favorites).toEqual([
      { light_id: "other", favorite: true },
    ]);
    expect(apiService.getInfo).not.toHaveBeenCalled();
  });

  it("fails explicitly on older 5.1 firmware without writing", async () => {
    apiService.getInfo.mockResolvedValue({ jsonData: { rgbww: {} } });
    await expect(store.setFavorite("preset", true)).rejects.toThrow(
      "Update the 5.1",
    );
    expect(apiService.updateDataOnController).not.toHaveBeenCalled();
    expect(store.busy).toBe(false);
  });

  it("does not publish unpersisted favorite changes", async () => {
    apiService.updateDataOnController.mockResolvedValue({
      jsonData: { success: true },
    });
    await expect(store.setFavorite("preset", false)).rejects.toThrow(
      "readback",
    );
    expect(store.favorites).toHaveLength(1);
  });

  it("aborts if the controller changes during the read", async () => {
    apiService.getDataFromController.mockImplementation(async () => {
      mocks.controllers.currentController = { ip_address: "different" };
      return { jsonData: { presets: remote } };
    });
    await expect(store.setFavorite("preset", false)).rejects.toThrow("changed");
    expect(apiService.updateDataOnController).not.toHaveBeenCalled();
  });

  it("routes preset application by UUID and freshly resolved index", async () => {
    await store.apply("preset");
    expect(apiService.setColor).toHaveBeenCalledWith(
      { ...color, cmd: "solid", light: 9, light_id: "uuid" },
      { ip_address: "device" },
    );
  });

  it("applies the latest controller-local preset rather than a stale cached colour", async () => {
    remote[0].color.hsv.v = 81;
    await store.apply("preset");
    expect(apiService.setColor.mock.calls[0][0].hsv.v).toBe(81);
    expect(store.presets[0].color.hsv.v).toBe(81);
  });

  it("accepts ConfigDB colour key order and zero defaults on readback", async () => {
    remote[0].color = { hsv: { v: 50, s: 40, h: 30 } };
    apiService.updateDataOnController.mockImplementation(
      async (_ip, payload) => {
        remote = Object.values(payload).map((value) => structuredClone(value));
        remote[0].color = { hsv: { ct: 0, h: 30, s: 40, v: 50 } };
        return { jsonData: { success: true } };
      },
    );
    await expect(store.setFavorite("preset", false)).resolves.toBeDefined();
  });

  it("never applies a preset removed from the current controller", async () => {
    remote = [];
    await expect(store.apply("preset")).rejects.toThrow("no longer exists");
    expect(apiService.setColor).not.toHaveBeenCalled();
  });

  it("does not fall back when a light was removed", async () => {
    apiService.getConfig.mockResolvedValue({
      jsonData: { hardware: { configuration: { lights: [] } } },
    });
    await expect(store.apply("preset")).rejects.toThrow("no longer exists");
    expect(apiService.setColor).not.toHaveBeenCalled();
  });

  it("saves indexed RAW with its profile and one UUID membership", async () => {
    mocks.lights.selectedLight = { ...light, type: "WWCW" };
    mocks.lights.color = { raw: [250, 750] };
    const saved = await store.saveCurrent("White mix");
    expect(saved).toMatchObject({
      name: "White mix",
      raw_channels: [250, 750],
      light_type: "WWCW",
      favorite: false,
      light_favorites: [{ light_id: "uuid", favorite: true }],
    });
    expect(presetColor(saved, { ...light, type: "WWCW" })).toEqual({
      raw: [250, 750],
    });
    expect(() => presetColor(saved, light)).toThrow("matching light profile");
  });

  it("rejects duplicate names without replacing a shared preset", async () => {
    await expect(store.saveCurrent("Warm")).rejects.toThrow("already exists");
    expect(apiService.updateDataOnController).not.toHaveBeenCalled();
  });
});
