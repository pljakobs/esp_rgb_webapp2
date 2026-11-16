import { defineStore } from "pinia";
import { apiService } from "src/services/api";
import { makeID } from "src/services/tools";
import {
  isLightFavorite,
  presetColor,
  withLightFavorite,
} from "src/services/lightPresets";
import { useAppDataStore } from "./appDataStore";
import { useControllersStore } from "./controllersStore";
import { useVirtualLightsStore } from "./virtualLightsStore";

const unwrap = ({ jsonData, error }) => {
  if (error || jsonData?.success === false) {
    throw new Error(
      error?.message || jsonData?.error || "Controller request failed.",
    );
  }
  return jsonData;
};

export const useLightPresetsStore = defineStore("lightPresets", {
  state: () => ({ busy: false, error: null }),
  getters: {
    presets() {
      return useAppDataStore().data.presets ?? [];
    },
    light() {
      const lights = useVirtualLightsStore();
      return lights.enabled ? lights.selectedLight : null;
    },
    favorites() {
      return this.presets.filter((preset) =>
        isLightFavorite(preset, this.light),
      );
    },
  },
  actions: {
    context() {
      const controller = { ...useControllersStore().currentController };
      if (!controller.ip_address) throw new Error("Select a controller first.");
      const lights = useVirtualLightsStore();
      if (lights.loading || (lights.enabled && !lights.selectedLight))
        throw new Error("Select a loaded light first.");
      const light = lights.enabled ? { ...lights.selectedLight } : null;
      return {
        controller,
        light,
        current: () =>
          controller.ip_address ===
            useControllersStore().currentController?.ip_address &&
          (light
            ? useVirtualLightsStore().selectedId === light.id
            : !useVirtualLightsStore().enabled),
      };
    },
    async mutate(makePreset) {
      if (this.busy) throw new Error("A preset operation is already running.");
      this.busy = true;
      this.error = null;
      try {
        const context = this.context();
        if (context.light) {
          const info = unwrap(await apiService.getInfo(context.controller));
          if (info?.rgbww?.preset_light_favorites !== true) {
            throw new Error(
              "Update the 5.1 controller firmware to store per-light presets.",
            );
          }
        }
        const data = unwrap(
          await apiService.getDataFromController(context.controller.ip_address),
        );
        if (!Array.isArray(data?.presets))
          throw new Error("Controller returned invalid preset data.");
        const preset = makePreset(data.presets, context.light);
        if (!context.current())
          throw new Error("Controller or light changed; preset was not saved.");
        const exists = data.presets.some((item) => item.id === preset.id);
        const payload = exists
          ? { [`presets[id=${preset.id}]`]: preset }
          : { "presets[]": [preset] };
        unwrap(
          await apiService.updateDataOnController(
            context.controller.ip_address,
            payload,
          ),
        );
        const readback = unwrap(
          await apiService.getDataFromController(context.controller.ip_address),
        );
        const saved = readback?.presets?.find((item) => item.id === preset.id);
        if (
          !saved ||
          isLightFavorite(saved, context.light) !==
            isLightFavorite(preset, context.light) ||
          JSON.stringify(saved.light_favorites ?? []) !==
            JSON.stringify(preset.light_favorites ?? []) ||
          saved.name !== preset.name ||
          (preset.raw_channels?.length
            ? saved.light_type !== preset.light_type ||
              JSON.stringify(saved.raw_channels) !==
                JSON.stringify(preset.raw_channels)
            : JSON.stringify(presetColor(saved)) !==
              JSON.stringify(presetColor(preset)))
        ) {
          throw new Error(
            "Preset readback did not match; the controller may need newer firmware.",
          );
        }
        if (context.current())
          useAppDataStore().data.presets = readback.presets;
        return saved;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.busy = false;
      }
    },
    async setFavorite(id, favorite) {
      return this.mutate((presets, light) => {
        const preset = presets.find((item) => item.id === id);
        if (!preset)
          throw new Error("Preset no longer exists. Reload the controller.");
        return {
          ...withLightFavorite(preset, light, favorite),
          ts: Math.floor(Date.now() / 1000),
        };
      });
    },
    async saveCurrent(name, favorite = true) {
      name = name.trim();
      if (!name) throw new Error("Enter a preset name.");
      const lights = useVirtualLightsStore();
      if (!lights.enabled || !lights.selectedLight || lights.colorLoading)
        throw new Error("Light colour is not ready.");
      const color = JSON.parse(JSON.stringify(lights.color));
      const source = { ...lights.selectedLight };
      return this.mutate((presets, light) => {
        if (presets.some((item) => item.name === name))
          throw new Error(
            "That preset name already exists. Choose another name.",
          );
        const preset = {
          id: makeID(),
          name,
          favorite: false,
          icon: "palette",
          ts: Math.floor(Date.now() / 1000),
          ...(Array.isArray(color.raw)
            ? { raw_channels: color.raw, light_type: source.type }
            : { color }),
        };
        presetColor(preset, light);
        return withLightFavorite(preset, light, favorite);
      });
    },
    async apply(id) {
      if (this.busy) throw new Error("A preset operation is already running.");
      this.busy = true;
      this.error = null;
      try {
        const context = this.context();
        const data = unwrap(
          await apiService.getDataFromController(context.controller.ip_address),
        );
        if (!Array.isArray(data?.presets))
          throw new Error("Controller returned invalid preset data.");
        const preset = data.presets.find((item) => item.id === id);
        if (!preset) throw new Error("Preset no longer exists.");
        const color = presetColor(preset, context.light);
        let target = {};
        if (context.light) {
          const config = unwrap(await apiService.getConfig(context.controller));
          const light = config?.hardware?.configuration?.lights?.find(
            (item) => item.id === context.light.id,
          );
          if (!light)
            throw new Error("Light no longer exists. Reload the controller.");
          if (light.type !== context.light.type)
            throw new Error("Light profile changed. Reload the controller.");
          target = { light: light.index, light_id: light.id };
        }
        if (!context.current())
          throw new Error(
            "Controller or light changed; preset was not applied.",
          );
        unwrap(
          await apiService.setColor(
            { ...color, cmd: "solid", ...target },
            context.controller,
          ),
        );
        if (context.current()) {
          useAppDataStore().data.presets = data.presets;
          if (context.light) await useVirtualLightsStore().fetchColor();
        }
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.busy = false;
      }
    },
  },
});
