import { beforeEach, describe, expect, it, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const mocks = vi.hoisted(() => ({
  controllers: {
    currentController: { id: "one", hostname: "one", ip_address: "192.0.2.1" },
    fetchData: vi.fn(),
    status: "ready",
  },
  config: { fetchData: vi.fn(), status: "ready" },
  color: { fetchData: vi.fn(), status: "ready" },
  info: { fetchData: vi.fn(), status: "ready", data: {} },
  history: { start: vi.fn() },
  websocket: { connect: vi.fn(), destroy: vi.fn() },
}));

vi.mock("../../stores/controllersStore", () => ({
  useControllersStore: () => mocks.controllers,
}));
vi.mock("../../stores/configDataStore", () => ({
  configDataStore: () => mocks.config,
}));
vi.mock("../../stores/colorDataStore", () => ({
  useColorDataStore: () => mocks.color,
}));
vi.mock("../../stores/infoDataStore", () => ({
  infoDataStore: () => mocks.info,
}));
vi.mock("../../stores/runtimeHistoryStore", () => ({
  useRuntimeHistoryStore: () => mocks.history,
}));
vi.mock("../websocket.js", () => ({ default: () => mocks.websocket }));
vi.mock("../api", () => ({
  apiService: {
    getData: vi
      .fn()
      .mockResolvedValue({ jsonData: { presets: [], scenes: [], groups: [] } }),
  },
}));

import initializeStores from "../initializeStores";
import { useAppDataStore } from "../../stores/appDataStore";
import { syncService } from "../syncService";
import { storeStatus } from "../../stores/storeConstants";

describe("Read-only frontend initialization", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("loads controller data without starting replication on opening or switching", async () => {
    const appData = useAppDataStore();
    const sync = vi
      .spyOn(syncService, "synchronizeData")
      .mockResolvedValue(true);
    const load = vi.spyOn(appData, "fetchData");
    try {
      await initializeStores({ force: true });
      mocks.controllers.currentController = {
        id: "two",
        hostname: "two",
        ip_address: "192.0.2.2",
      };
      await initializeStores({ force: true });
      expect(load).toHaveBeenCalledTimes(2);
      expect(load).toHaveBeenLastCalledWith({ replace: true });
      expect(sync).not.toHaveBeenCalled();
      expect(appData.syncStatus).toBe(storeStatus.sync.NOT_STARTED);
    } finally {
      sync.mockRestore();
    }
  });
});
