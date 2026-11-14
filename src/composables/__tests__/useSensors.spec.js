import { mount, flushPromises } from "@vue/test-utils";
import { reactive, ref } from "vue";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useSensors } from "../useSensors";
import { useControllersStore } from "src/stores/controllersStore";
import { sensorRequest } from "src/services/sensors";

vi.mock("src/stores/controllersStore", () => ({
  useControllersStore: vi.fn(),
}));
vi.mock("src/services/sensors", async (importOriginal) => ({
  ...(await importOriginal()),
  sensorRequest: vi.fn(),
}));

const currentConfig = {
  extension_id: "current-1",
  enabled: true,
  available: true,
  address: 64,
  shunt_ohms: 0.1,
  interval_ms: 1000,
};
const spectrumConfig = {
  extension_id: "spectrum-1",
  enabled: true,
  available: true,
  atime: 29,
  astep: 599,
  gain: 6,
  interval_ms: 1000,
};
const currentReading = {
  extension_id: "current-1",
  valid: true,
  error: "",
  age_ms: 10,
  current_a: -0.125,
  voltage_v: 12,
  power_w: -1.5,
};
const spectrumReading = {
  extension_id: "spectrum-1",
  valid: false,
  state: "idle",
  error: "",
  age_ms: 0,
};

describe("sensor polling lifecycle", () => {
  let controllers;
  let wrapper;
  let expanded;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    controllers = reactive({ currentController: { ip_address: "192.0.2.1" } });
    useControllersStore.mockReturnValue(controllers);
    sensorRequest.mockImplementation(async (id, resource, controller, body) => {
      if (resource === "config")
        return {
          ...(id === "current-1" ? currentConfig : spectrumConfig),
          ...body,
        };
      if (resource === "start_measurement")
        return { extension_id: id, valid: false };
      return { ...(id === "current-1" ? currentReading : spectrumReading) };
    });
    expanded = ref(true);
  });

  afterEach(() => {
    wrapper?.unmount();
    vi.useRealTimers();
  });

  async function start() {
    wrapper = mount({ setup: () => useSensors(expanded), template: "<div />" });
    await flushPromises();
    return wrapper.vm;
  }

  it("loads both configurations, polls signed current and stops on unmount", async () => {
    const vm = await start();
    expect(vm.sensors.map((s) => s.supported)).toEqual([true, true]);
    expect(vm.sensors[0].history[0].y).toBe(-0.125);
    await vi.advanceTimersByTimeAsync(2000);
    expect(vm.sensors[0].history).toHaveLength(2);
    wrapper.unmount();
    const calls = sensorRequest.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10000);
    expect(sensorRequest.mock.calls).toHaveLength(calls);
  });

  it("does not request while collapsed and clears readings on collapse", async () => {
    expanded.value = false;
    const vm = await start();
    expect(sensorRequest).not.toHaveBeenCalled();
    expanded.value = true;
    await flushPromises();
    expect(vm.sensors[0].reading.valid).toBe(true);
    expanded.value = false;
    await flushPromises();
    expect(vm.sensors[0].reading).toBeNull();
    const calls = sensorRequest.mock.calls.length;
    await vi.advanceTimersByTimeAsync(4000);
    expect(sensorRequest.mock.calls).toHaveLength(calls);
  });

  it("discards late responses from the previous controller", async () => {
    let resolve;
    sensorRequest.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const vm = await start();
    controllers.currentController = { ip_address: "192.0.2.2" };
    await flushPromises();
    resolve({ ...currentConfig, shunt_ohms: 0.5 });
    await flushPromises();
    expect(vm.sensors[0].config.shunt_ohms).toBe(0.1);
    expect(vm.sensors[0].history).toHaveLength(1);
  });

  it("does not fabricate readings for unsupported extensions or retry them continuously", async () => {
    sensorRequest.mockRejectedValue(
      Object.assign(new Error("Not found"), { status: 404 }),
    );
    const vm = await start();
    expect(
      vm.sensors.every((s) => s.supported === false && s.reading === null),
    ).toBe(true);
    await vi.advanceTimersByTimeAsync(4000);
    expect(sensorRequest).toHaveBeenCalledTimes(2);
  });

  it("does not write or start measurements without a reported extension capability", async () => {
    const vm = await start();
    const current = vm.sensors[0];
    current.supported = false;
    await vm.save(current);
    expect(sensorRequest).not.toHaveBeenCalledWith(
      "current-1",
      "config",
      expect.anything(),
      expect.anything(),
    );
    expect(current.actionError).toContain("not supported");

    const spectrum = vm.sensors[1];
    spectrum.supported = false;
    await vm.measure(spectrum);
    expect(sensorRequest).not.toHaveBeenCalledWith(
      "spectrum-1",
      "start_measurement",
      expect.anything(),
      expect.anything(),
    );
    expect(spectrum.actionError).toContain("not available");
  });

  it("keeps disconnected settings editable without overwriting unsaved drafts", async () => {
    sensorRequest.mockImplementation(async (id) => ({
      ...(id === "current-1" ? currentConfig : spectrumConfig),
      available: false,
    }));
    const vm = await start();
    vm.sensors[0].draft.shunt_ohms = 0.2;
    await vi.advanceTimersByTimeAsync(2000);
    expect(vm.sensors[0].draft.shunt_ohms).toBe(0.2);
    expect(vm.sensors[0].config.available).toBe(false);
  });

  it("inserts a gap for invalid current and bounds history at 120 samples", async () => {
    const vm = await start();
    sensorRequest.mockImplementation(async (id, resource) => {
      if (resource === "config")
        return id === "current-1" ? currentConfig : spectrumConfig;
      return id === "current-1"
        ? { ...currentReading, valid: false, error: "I2C failure" }
        : spectrumReading;
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(vm.sensors[0].reading.valid).toBe(false);
    expect(vm.sensors[0].history.at(-1).y).toBeNull();
    await vi.advanceTimersByTimeAsync(250000);
    expect(vm.sensors[0].history).toHaveLength(120);
  });

  it("persists only settings, clears old readings and leaves action errors visible across polls", async () => {
    const vm = await start();
    const sensor = vm.sensors[0];
    sensor.draft.shunt_ohms = 0.2;
    await vm.save(sensor);
    expect(sensor.config.shunt_ohms).toBe(0.2);
    expect(sensor.reading).toBeNull();
    expect(sensor.history).toHaveLength(0);
    sensorRequest.mockRejectedValueOnce(
      new Error("settings could not be saved"),
    );
    await vm.save(sensor);
    await vi.advanceTimersByTimeAsync(2000);
    expect(sensor.actionError).toBe("settings could not be saved");
  });

  it("marks spectrum invalid while measuring and surfaces busy errors", async () => {
    const vm = await start();
    const sensor = vm.sensors[1];
    await vm.measure(sensor);
    expect(sensor.reading).toEqual({ valid: false, state: "measuring" });
    sensorRequest.mockRejectedValueOnce(new Error("measurement busy"));
    await vm.measure(sensor);
    expect(sensor.actionError).toBe("measurement busy");
  });
});
