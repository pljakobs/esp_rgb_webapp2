import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncService } from "../syncService";
import { validateScene } from "../schemaValidator";
import { apiService } from "../api";

vi.mock("../api", () => ({
  apiService: {
    getHosts: vi.fn(),
    getDataFromController: vi.fn(),
    updateDataOnController: vi.fn(),
  },
}));
vi.mock("../../stores/controllersStore", () => ({
  useControllersStore: () => ({
    currentController: { id: "one" },
    data: [],
  }),
}));

const clone = (value) => JSON.parse(JSON.stringify(value));
const oldScene = {
  id: "scene",
  name: "Old scene",
  group_id: "group",
  ts: 100,
  favorite: false,
  transition: { cmd: "fade", t: 1000, q: "" },
  settings: [
    {
      controller_id: "one",
      pos: 0,
      color: { hsv: { h: 0, s: 50, v: 10, ct: 2700 } },
    },
    { controller_id: "one", pos: 1, color: { Preset: { id: "removed-step" } } },
  ],
};
const newScene = {
  ...oldScene,
  name: "New scene",
  group_id: "new-group",
  ts: 200,
  favorite: true,
  transition: { cmd: "solid", t: 2000, r: true, q: "" },
  settings: [
    {
      controller_id: "one",
      light: 7,
      light_id: "light-uuid",
      pos: 0,
      color: { raw: { r: 1, g: 2, b: 3, ww: 4, cw: 5 } },
      transition: { cmd: "solid", t: 1500, q: "back" },
    },
  ],
};
const hosts = [
  { id: "one", hostname: "one", ip_address: "192.0.2.1", visible: true },
  { id: "two", hostname: "two", ip_address: "192.0.2.2", visible: true },
];

describe("Scene synchronization integrity", () => {
  let service;
  let data;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new SyncService();
    vi.spyOn(service, "sleep").mockResolvedValue();
    data = {
      "192.0.2.1": { scenes: [clone(oldScene)], groups: [] },
      "192.0.2.2": { scenes: [clone(newScene)], groups: [] },
    };
    apiService.getHosts.mockResolvedValue({
      jsonData: { hosts: clone(hosts) },
    });
    apiService.getDataFromController.mockImplementation(async (ip) => ({
      jsonData: clone(data[ip]),
    }));
    apiService.updateDataOnController.mockImplementation(
      async (ip, payload) => {
        for (const [key, value] of Object.entries(payload)) {
          const [collection] = key.split("[");
          if (key.endsWith("[]")) {
            data[ip][collection].push(...clone(value));
          } else {
            const index = data[ip][collection].findIndex(
              (item) => item.id === value.id,
            );
            data[ip][collection][index] = clone(value);
          }
        }
        return { jsonData: { success: true } };
      },
    );
  });

  it("selects the complete newest revision without resurrecting removed steps", () => {
    const input = {
      scenes: [clone(oldScene), clone(newScene)],
      groups: [],
      controllers: [],
    };
    const original = clone(input);
    expect(service.buildConsolidatedView(input).scenes).toEqual([newScene]);
    expect(input).toEqual(original);
    input.scenes.reverse();
    expect(service.buildConsolidatedView(input).scenes).toEqual([newScene]);
  });

  it("keeps ConfigDB preset wrappers and step targets when normalizing", () => {
    const scene = clone(newScene);
    scene.settings[0].color = {
      Preset: { id: "preset" },
      extension: { value: 42 },
    };
    expect(service.normalizeSceneForSync(scene)).toEqual(scene);
    scene.settings[0].color = { id: "preset", extension: { value: 42 } };
    expect(service.normalizeSceneForSync(scene).settings[0]).toEqual({
      ...newScene.settings[0],
      color: { Preset: { id: "preset" }, extension: { value: 42 } },
    });
  });

  it("writes only the changed complete scene and makes no writes on a second sync", async () => {
    expect(await service.synchronizeData()).toBe(true);
    expect(apiService.updateDataOnController).toHaveBeenCalledExactlyOnceWith(
      "192.0.2.1",
      { "scenes[id=scene]": newScene },
      { timeout: 8000 },
    );
    expect(data["192.0.2.1"].scenes).toEqual([newScene]);
    apiService.updateDataOnController.mockClear();
    expect(await service.synchronizeData()).toBe(true);
    expect(apiService.updateDataOnController).not.toHaveBeenCalled();
  });

  it("holds the local guard during writes and rejects overlapping collection or sync", async () => {
    let release;
    let started;
    const writing = new Promise((resolve) => {
      started = resolve;
    });
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    const update = apiService.updateDataOnController.getMockImplementation();
    apiService.updateDataOnController.mockImplementationOnce(
      async (...args) => {
        started();
        await pending;
        return update(...args);
      },
    );
    const sync = service.synchronizeData();
    await writing;
    expect(service.isCurrentlySyncing).toBe(true);
    expect(await service.getConsolidatedView()).toBeNull();
    expect(await service.synchronizeData()).toBe(false);
    release();
    expect(await sync).toBe(true);
    expect(service.isCurrentlySyncing).toBe(false);
  });

  it("never inserts into an unread controller and reports partial collection as failure", async () => {
    apiService.getDataFromController.mockImplementation(async (ip) =>
      ip === "192.0.2.2"
        ? { error: new Error("Offline") }
        : { jsonData: clone(data[ip]) },
    );
    expect(await service.synchronizeData()).toBe(false);
    expect(apiService.updateDataOnController).not.toHaveBeenCalled();
    expect(service.isCurrentlySyncing).toBe(false);
  });

  it("does not mistake an incomplete response for an empty controller", async () => {
    apiService.getDataFromController.mockResolvedValue({
      jsonData: { success: false },
    });
    expect(await service.synchronizeData()).toBe(false);
    expect(apiService.updateDataOnController).not.toHaveBeenCalled();
  });

  it("reads the current invisible controller before updating it", async () => {
    apiService.getHosts.mockResolvedValue({
      jsonData: { hosts: [{ ...hosts[0], visible: false }, hosts[1]] },
    });
    expect(await service.synchronizeData()).toBe(true);
    expect(apiService.getDataFromController.mock.calls[0][0]).toBe("192.0.2.1");
    expect(apiService.updateDataOnController.mock.calls[0][1]).toHaveProperty(
      "scenes[id=scene]",
    );
    expect(
      apiService.updateDataOnController.mock.calls[0][1],
    ).not.toHaveProperty("scenes[]");
  });

  it("treats a controller rejection as failure even without a transport error", async () => {
    apiService.updateDataOnController.mockResolvedValue({
      jsonData: { success: false },
    });
    expect(await service.synchronizeData()).toBe(false);
    expect(service.isCurrentlySyncing).toBe(false);
  });

  it("detects corrupt settings even when IDs and timestamps match", async () => {
    apiService.updateDataOnController.mockImplementation(async () => {
      data["192.0.2.1"].scenes = [clone(newScene)];
      data["192.0.2.1"].scenes[0].settings[0].color.raw.ww = 99;
      return { jsonData: { success: true } };
    });
    expect(await service.synchronizeData()).toBe(false);
  });

  it("compares nested content without depending on JSON property order", () => {
    const actual = clone(newScene);
    actual.settings[0].color.raw = { cw: 5, ww: 4, b: 3, g: 2, r: 1 };
    expect(service._compareArrays([newScene], [actual], "id")).toBeNull();
  });

  it.each([
    ["extra object", [newScene, { ...newScene, id: "deleted" }]],
    ["duplicate ID", [newScene, newScene]],
    ["concurrently newer revision", [{ ...newScene, ts: 300 }]],
    [
      "changed light",
      [
        {
          ...newScene,
          settings: [{ ...newScene.settings[0], light_id: "another" }],
        },
      ],
    ],
  ])("rejects %s during verification", (_name, actual) => {
    expect(service._compareArrays([newScene], actual, "id")).not.toBeNull();
  });

  it("accepts legacy default target representations without changing explicit targets", () => {
    const actual = clone(oldScene);
    actual.settings = actual.settings.map((setting) => ({
      ...setting,
      light: -1,
      light_id: null,
    }));
    expect(service._compareArrays([oldScene], [actual], "id")).toBeNull();
    actual.settings[0].light = 0;
    expect(service._compareArrays([oldScene], [actual], "id")).not.toBeNull();
  });
});

describe("Scene target validation", () => {
  it.each([-1, 0, 7, 65535])(
    "preserves valid target index %s and stable identity",
    (light) => {
      const scene = clone(newScene);
      scene.settings[0].light = light;
      expect(validateScene(scene).settings[0]).toEqual(scene.settings[0]);
    },
  );

  it.each([-2, 65536, 1.5, "7", null, NaN, Infinity])(
    "rejects invalid index %s rather than routing to a default",
    (light) => {
      const scene = clone(newScene);
      scene.settings[0].light = light;
      expect(() => validateScene(scene)).toThrow("light must be an integer");
    },
  );

  it.each([null, "", "light-uuid"])(
    "preserves firmware light_id value %s",
    (lightId) => {
      const scene = clone(newScene);
      scene.settings[0].light_id = lightId;
      expect(validateScene(scene).settings[0].light_id).toBe(lightId);
    },
  );

  it.each([7, {}, false])("rejects non-string light identity %s", (lightId) => {
    const scene = clone(newScene);
    scene.settings[0].light_id = lightId;
    expect(() => validateScene(scene)).toThrow(
      "light_id must be a string or null",
    );
  });

  it("leaves unqualified 5.0 steps unqualified and does not mutate input colours", () => {
    const scene = clone(oldScene);
    scene.settings[0].color.hsv.h = 1.5;
    const original = clone(scene);
    const validated = validateScene(scene);
    expect(scene).toEqual(original);
    expect(validated.settings[0]).not.toHaveProperty("light");
    expect(validated.settings[0]).not.toHaveProperty("light_id");
    expect(validated.settings[0].color.hsv.h).toBe(1);
    expect(validated.settings[1].color).toEqual({
      Preset: { id: "removed-step" },
    });
  });

  it("converts flattened references to the ConfigDB tagged shape without losing metadata", () => {
    const scene = clone(newScene);
    scene.settings[0].color = { id: "preset", extension: true };
    expect(validateScene(scene).settings[0].color).toEqual({
      Preset: { id: "preset" },
      extension: true,
    });
  });
});
