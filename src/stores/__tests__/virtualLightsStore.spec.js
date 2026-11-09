import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { effectScope, reactive } from "vue";
import { flushPromises } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({ controllers: { currentController: { ip_address: "192.168.29.69" } }, info: { data: null }, api: { getInfo: vi.fn(), getConfig: vi.fn(), fetchApi: vi.fn() } }));
vi.mock("../controllersStore", () => ({ useControllersStore: () => mocks.controllers }));
vi.mock("../infoDataStore", () => ({ infoDataStore: () => mocks.info }));
vi.mock("src/services/api", () => ({ apiService: mocks.api }));
import { useVirtualLightsStore } from "../virtualLightsStore";

const configuration = () => ({ revision: 0, lights: [{ id: "desk", index: 3, name: "Desk", type: "SINGLE", pins: [5], is_default: true }], soc: "esp32c3", board_id: "", buttons: [], buses: [] });
const response = (jsonData) => ({ jsonData, error: null });

beforeEach(() => {
  setActivePinia(createPinia());
  vi.resetAllMocks();
  mocks.controllers = reactive({ currentController: { ip_address: "192.168.29.69" } });
  mocks.info = reactive({ data: { app: { git_version: "V5.1.0-6-develop" } } });
  mocks.api.getInfo.mockResolvedValue(response({ app: { git_version: "V5.1.0-6-develop" } }));
  mocks.api.getConfig.mockImplementation(async () => response({ hardware: { configuration: configuration() } }));
  mocks.api.fetchApi.mockImplementation(async (endpoint) => response(endpoint === "catalog" ? { boards: [], templates: [] } : { raw: [0] }));
});

describe("Controller-scoped virtual lights", () => {
  const twoLights = () => ({
    ...configuration(),
    lights: [
      ...configuration().lights,
      { id: "pink", index: 0, name: "Pink", type: "SINGLE", pins: [4], is_default: false },
    ],
  });

  it("does not reload or reset selection on runtime updates or same-address controller refreshes", async () => {
    mocks.api.getConfig.mockImplementation(async () => response({ hardware: { configuration: twoLights() } }));
    const store = useVirtualLightsStore();
    store.start();
    await flushPromises();
    await store.selectLight("pink");
    const token = store.loadToken;
    mocks.api.getInfo.mockClear();
    mocks.api.getConfig.mockClear();
    mocks.api.fetchApi.mockClear();

    for (const uptime of [10, 20, 30]) {
      mocks.info.data = { ...mocks.info.data, runtime: { uptime } };
      mocks.controllers.currentController = { ...mocks.controllers.currentController, name: "Refreshed" };
      await flushPromises();
      expect(store.selectedId).toBe("pink");
      expect(store.loadToken).toBe(token);
    }

    expect(mocks.api.getInfo).not.toHaveBeenCalled();
    expect(mocks.api.getConfig).not.toHaveBeenCalled();
    expect(mocks.api.fetchApi).not.toHaveBeenCalled();

    const updatedInfo = { app: { git_version: "V5.1.0-7-develop" } };
    mocks.api.getInfo.mockResolvedValue(response(updatedInfo));
    mocks.info.data = updatedInfo;
    await flushPromises();
    expect(mocks.api.getInfo).toHaveBeenCalledTimes(1);
    expect(store.firmwareVersion).toBe("V5.1.0-7-develop");
    expect(store.selectedId).toBe("pink");
    expect(mocks.api.fetchApi).toHaveBeenLastCalledWith("color?light=0", { ip_address: "192.168.29.69", name: "Refreshed" });
    store.$dispose();
  });

  it("preserves an existing selection on reload and falls back to default when it is removed", async () => {
    mocks.api.getConfig.mockImplementation(async () => response({ hardware: { configuration: twoLights() } }));
    const store = useVirtualLightsStore();
    await store.load();
    await store.selectLight("pink");
    await store.load();
    expect(store.selectedId).toBe("pink");

    mocks.api.getConfig.mockResolvedValue(response({ hardware: { configuration: configuration() } }));
    await store.load();
    expect(store.selectedId).toBe("desk");
  });

  it("selects the new controller's default rather than reusing a matching light ID", async () => {
    mocks.api.getConfig.mockImplementation(async () => response({ hardware: { configuration: twoLights() } }));
    const store = useVirtualLightsStore();
    await store.load();
    await store.selectLight("pink");
    mocks.controllers.currentController = { ip_address: "other-controller" };
    await store.load();
    expect(store.selectedId).toBe("desk");
  });

  it("keeps firmware switching active after the first component scope is disposed", async () => {
    const componentScope = effectScope();
    const store = useVirtualLightsStore();
    componentScope.run(() => store.start());
    await flushPromises();
    expect(store.enabled).toBe(true);
    componentScope.stop();
    mocks.api.getInfo.mockResolvedValue(response({ git_version: "V5.0-417-develop" }));
    mocks.controllers.currentController = { ip_address: "legacy" };
    await flushPromises();
    expect(store.enabled).toBe(false);
    expect(store.firmwareVersion).toBe("V5.0-417-develop");
    store.$dispose();
  });

  it("does not issue advanced reads on 5.0", async () => {
    mocks.api.getInfo.mockResolvedValue(response({ app: { git_version: "V5.0-417-develop" } }));
    const store = useVirtualLightsStore();
    await store.load();
    expect(store.enabled).toBe(false);
    expect(mocks.api.getConfig).not.toHaveBeenCalled();
    expect(mocks.api.fetchApi).not.toHaveBeenCalled();
  });
  it("routes reads and writes by persistent index and explicit controller", async () => {
    const store = useVirtualLightsStore();
    await store.load();
    expect(store.selectedId).toBe("desk");
    await store.sendColor({ raw: [0] });
    expect(mocks.api.fetchApi).toHaveBeenCalledWith("color?light=3", { ip_address: "192.168.29.69" }, { method: "POST", body: { raw: [0] } });
  });
  it("ignores stale responses after switching to a 5.0 controller", async () => {
    let resolveInfo;
    mocks.api.getInfo.mockImplementationOnce(() => new Promise((resolve) => { resolveInfo = resolve; }));
    const store = useVirtualLightsStore();
    const oldLoad = store.load();
    mocks.controllers.currentController = { ip_address: "legacy" };
    mocks.api.getInfo.mockResolvedValue(response({ git_version: "V5.0-417-develop" }));
    await store.load();
    resolveInfo(response({ app: { git_version: "V5.1.0-6-develop" } }));
    await oldLoad;
    expect(store.enabled).toBe(false);
    expect(store.lights).toEqual([]);
    expect(mocks.api.fetchApi).not.toHaveBeenCalled();
  });
  it("preserves active assignments on rejected writes", async () => {
    const store = useVirtualLightsStore();
    await store.load();
    const draft = configuration();
    draft.lights[0].name = "Renamed";
    mocks.api.fetchApi.mockResolvedValue({ error: { message: "Rejected" } });
    await expect(store.apply(draft)).rejects.toThrow("Rejected");
    expect(store.configuration.lights[0].name).toBe("Desk");
    expect(store.saving).toBe(false);
  });
  it("submits one candidate and adopts readback only after acceptance", async () => {
    const store = useVirtualLightsStore();
    await store.load();
    const draft = configuration();
    draft.lights[0].name = "Renamed";
    mocks.api.getConfig.mockResolvedValueOnce(response({ hardware: { configuration: configuration() } })).mockResolvedValueOnce(response({ hardware: { configuration: { ...draft, revision: 1 } } }));
    await store.apply(draft);
    expect(mocks.api.fetchApi).toHaveBeenCalledWith("config", { ip_address: "192.168.29.69" }, expect.objectContaining({ atomic: true, body: { hardware: { configuration: { ...draft, revision: 1 } } } }));
    expect(store.configuration.lights[0].name).toBe("Renamed");
    expect(draft.revision).toBe(0);
  });
});