import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAppDataStore } from "../stores/appDataStore";

describe("AppDataStore", () => {
  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    setActivePinia(createPinia());
  });

  it("initializes with empty data", () => {
    const store = useAppDataStore();
    expect(store.data).toBeDefined();
    expect(store.data.presets).toEqual([]);
    expect(store.data.groups).toEqual([]);
  });

  it("can add a preset", () => {
    const store = useAppDataStore();
    const testPreset = {
      id: "test-1",
      name: "Test Preset",
      color: {
        hsv: { h: 180, s: 50, v: 100 },
      },
    };

    store.data.presets.push(testPreset);
    expect(store.data.presets).toHaveLength(1);
    expect(store.data.presets[0].name).toBe("Test Preset");
  });

  it("can add a group", () => {
    const store = useAppDataStore();
    const testGroup = {
      id: "group-1",
      name: "Living Room",
      controller_ids: ["controller-1", "controller-2"],
    };

    store.data.groups.push(testGroup);
    expect(store.data.groups).toHaveLength(1);
    expect(store.data.groups[0].controller_ids).toHaveLength(2);
  });

  it("can find preset by id", () => {
    const store = useAppDataStore();
    const preset1 = {
      id: "p1",
      name: "Red",
      color: { hsv: { h: 0, s: 100, v: 100 } },
    };
    const preset2 = {
      id: "p2",
      name: "Blue",
      color: { hsv: { h: 240, s: 100, v: 100 } },
    };

    store.data.presets.push(preset1, preset2);

    const found = store.data.presets.find((p) => p.id === "p2");
    expect(found).toBeDefined();
    expect(found.name).toBe("Blue");
  });
});
