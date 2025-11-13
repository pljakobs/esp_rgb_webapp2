import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { getPresetName, getControllerInfo } from "../services/tools";
import { useAppDataStore } from "../stores/appDataStore";
import { useControllersStore } from "../stores/controllersStore";

describe("Tools Service", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("getPresetName", () => {
    it("returns preset name when found", () => {
      const appData = useAppDataStore();
      appData.data.presets = [
        {
          id: "preset-1",
          name: "Sunset",
          color: { hsv: { h: 30, s: 100, v: 100 } },
        },
        {
          id: "preset-2",
          name: "Ocean",
          color: { hsv: { h: 200, s: 80, v: 90 } },
        },
      ];

      expect(getPresetName("preset-1")).toBe("Sunset");
      expect(getPresetName("preset-2")).toBe("Ocean");
    });

    it('returns "Unknown" when preset not found', () => {
      const appData = useAppDataStore();
      appData.data.presets = [];

      expect(getPresetName("nonexistent")).toBe("Unknown");
    });

    it("handles empty preset data gracefully", () => {
      expect(getPresetName("test")).toBe("Unknown");
    });
  });

  describe("getControllerInfo", () => {
    it("returns controller info when found", () => {
      const controllersStore = useControllersStore();
      controllersStore.data = [
        {
          id: "ctrl-1",
          hostname: "Kitchen",
          ip_address: "192.168.1.10",
          online: true,
          icon: "lightbulb",
        },
        {
          id: "ctrl-2",
          hostname: "Bedroom",
          ip_address: "192.168.1.11",
          online: false,
          icon: "led-strip",
        },
      ];

      const info = getControllerInfo("ctrl-1");
      expect(info.hostname).toBe("Kitchen");
      expect(info.ip_address).toBe("192.168.1.10");
      expect(info.online).toBe(true);
    });

    it("returns default info when controller not found", () => {
      const controllersStore = useControllersStore();
      controllersStore.data = [];

      const info = getControllerInfo("nonexistent");
      expect(info.hostname).toBe("Unknown (nonexistent)");
      expect(info.ip_address).toBe("");
      expect(info.online).toBe(false);
      expect(info.icon).toBe("led-strip-variant");
    });

    it("handles string and number IDs equally", () => {
      const controllersStore = useControllersStore();
      controllersStore.data = [
        {
          id: "123",
          hostname: "Test",
          ip_address: "192.168.1.5",
          online: true,
          icon: "light",
        },
      ];

      const info1 = getControllerInfo("123");
      const info2 = getControllerInfo(123);

      expect(info1.hostname).toBe("Test");
      expect(info2.hostname).toBe("Test");
    });
  });
});
