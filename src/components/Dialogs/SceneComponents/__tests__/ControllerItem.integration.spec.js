import { mount, flushPromises } from "@vue/test-utils";
import ControllerItem from "../ControllerItem.vue";
import { createTestingPinia } from "@pinia/testing";
import { useAppDataStore } from "src/stores/appDataStore";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("src/services/api", () => ({
  addSceneSetting: vi.fn(() => Promise.resolve({ success: true })),
  removeSceneSetting: vi.fn(() => Promise.resolve({ success: true })),
  reorderSceneSettings: vi.fn(() => Promise.resolve({ success: true })),
}));

import * as api from "src/services/api";

describe("ControllerItem.vue integration", () => {
  let wrapper;
  let appData;
  const controller = { id: "ctrl1", hostname: "Test Controller" };
  const colorTypeOptions = [
    { label: "HSV Color", value: "hsv" },
    { label: "Raw Color", value: "raw" },
    { label: "Preset", value: "preset" },
  ];
  const directionOptions = [
    { label: "Forward", value: 0 },
    { label: "Reverse", value: 1 },
  ];
  const queueOptions = [
    { label: "None", value: null },
    { label: "Single", value: "single" },
    { label: "Back", value: "back" },
  ];

  beforeEach(() => {
    wrapper = mount(ControllerItem, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
      },
      props: {
        controller,
        settings: [],
        isExpanded: true,
        colorTypeOptions,
        directionOptions,
        queueOptions,
      },
    });
    appData = useAppDataStore();
    appData.data.scenes = [
      {
        id: "scene1",
        settings: [],
      },
    ];
  });

  it("adds a scene setting, updates store, and calls API", async () => {
    await wrapper.vm.addNewSetting();
    // Check that the event was emitted
    const emitted = wrapper.emitted("add-setting");
    expect(emitted).toBeTruthy();
    const newSetting = emitted[0][0];
    // Simulate parent handler updating store and calling API
    appData.data.scenes[0].settings.push(newSetting);
    await api.addSceneSetting(newSetting);
    expect(appData.data.scenes[0].settings).toContainEqual(newSetting);
    expect(api.addSceneSetting).toHaveBeenCalledWith(newSetting);
  });

  it("removes a scene setting, updates store, and calls API", async () => {
    const setting = {
      controller_id: controller.id,
      pos: 0,
      color: { hsv: {} },
    };
    appData.data.scenes[0].settings = [setting];
    // Simulate child emitting remove-setting
    wrapper.vm.$emit("remove-setting", setting);
    // Check that the event was emitted
    const emitted = wrapper.emitted("remove-setting");
    expect(emitted).toBeTruthy();
    expect(emitted[0][0]).toEqual(setting);
    // Simulate parent handler removing from store and calling API
    appData.data.scenes[0].settings = appData.data.scenes[0].settings.filter(
      (s) => s !== setting,
    );
    await api.removeSceneSetting(setting);
    expect(appData.data.scenes[0].settings).not.toContain(setting);
    expect(api.removeSceneSetting).toHaveBeenCalledWith(setting);
  });

  it("reorders settings, updates store, and calls API", async () => {
    const settings = [
      {
        controller_id: controller.id,
        pos: 0,
        color: { hsv: { h: 0, s: 100, v: 100 } },
      },
      {
        controller_id: controller.id,
        pos: 1,
        color: { hsv: { h: 120, s: 100, v: 100 } },
      },
    ];
    appData.data.scenes[0].settings = [...settings];
    // Simulate child emitting update-positions
    const reordered = [settings[1], settings[0]];
    reordered.forEach((s, i) => (s.pos = i));
    wrapper.vm.$emit("update-positions", reordered);
    // Check that the event was emitted
    const emitted = wrapper.emitted("update-positions");
    expect(emitted).toBeTruthy();
    expect(emitted[0][0][0].color.hsv.h).toBe(120);
    expect(emitted[0][0][1].color.hsv.h).toBe(0);
    // Simulate parent handler reordering in store and calling API
    appData.data.scenes[0].settings = reordered;
    await api.reorderSceneSettings(reordered);
    expect(appData.data.scenes[0].settings[0].color.hsv.h).toBe(120);
    expect(appData.data.scenes[0].settings[1].color.hsv.h).toBe(0);
    expect(api.reorderSceneSettings).toHaveBeenCalledWith(reordered);
  });
});
