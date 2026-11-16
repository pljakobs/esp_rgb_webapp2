import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { Notify } from "quasar";
import { storeStatus } from "src/stores/storeConstants";

const mocks = vi.hoisted(() => ({
  app: {
    data: { controllers: [{ id: "one", icon: "custom-light" }] },
    storeStatus: "ready",
    status: "synced",
    synchronizeAllData: vi.fn(),
  },
  scenes: {
    initialize: vi.fn(),
    groupNodes: [],
    expandedNodes: [],
    debugState: vi.fn(),
  },
}));
vi.mock("src/stores/appDataStore", () => ({
  useAppDataStore: () => mocks.app,
}));
vi.mock("src/stores/scenesStore", () => ({
  useScenesStore: () => mocks.scenes,
}));
vi.mock("src/stores/controllersStore", () => ({
  useControllersStore: () => ({ data: [] }),
}));
vi.mock("src/services/tools.js", () => ({
  applyScene: vi.fn(),
  getPresetName: vi.fn(),
}));
vi.mock("src/components/Dialogs/sceneDialog.vue", () => ({ default: {} }));
vi.mock("src/components/Dialogs/groupDialog.vue", () => ({ default: {} }));
vi.mock("src/components/Dialogs/deleteItemDialog.vue", () => ({ default: {} }));
vi.mock("quasar", async (importOriginal) => ({
  ...(await importOriginal()),
  Notify: { create: vi.fn() },
}));

import ScenesCard from "../scenesCard.vue";

describe("Manual scene synchronization UI", () => {
  let wrapper;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.app.synchronizeAllData.mockResolvedValue(true);
    wrapper = mount(ScenesCard, {
      global: {
        mocks: { $t: (key) => key },
        stubs: {
          MyCard: { template: "<div><slot /></div>" },
          QCardSection: { template: "<div><slot /></div>" },
          QScrollArea: { template: "<div><slot /></div>" },
          QBtn: { template: "<button><slot /></button>" },
          QTree: true,
          SvgIcon: true,
        },
      },
    });
  });
  afterEach(() => {
    wrapper.unmount();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("offers manual sync without requiring a debug build and warns about stale deletions", () => {
    expect(wrapper.text()).toContain("Sync scenes and groups");
    expect(wrapper.text()).toContain(
      "Stale controllers can restore deleted scenes or groups",
    );
  });

  it("uses the store entry point and reports success", async () => {
    await wrapper.vm.runSync();
    expect(mocks.app.synchronizeAllData).toHaveBeenCalledOnce();
    expect(Notify.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "positive" }),
    );
    expect(wrapper.vm.syncRunning).toBe(false);
  });

  it("reports incomplete synchronization without a success notification", async () => {
    mocks.app.synchronizeAllData.mockResolvedValue(false);
    await wrapper.vm.runSync();
    expect(Notify.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "warning" }),
    );
    expect(wrapper.vm.syncRunning).toBe(false);
  });

  it("keeps controller metadata available after the store reports SYNCED", () => {
    mocks.app.status = storeStatus.SYNCED;
    expect(wrapper.vm.getCustomControllerIcon({ controller_id: "one" })).toBe(
      "custom-light",
    );
  });
});
