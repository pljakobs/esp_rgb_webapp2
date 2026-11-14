import { defineStore } from "pinia";
import { effectScope, watch } from "vue";
import { useControllersStore } from "./controllersStore";
import { infoDataStore } from "./infoDataStore";
import { apiService } from "src/services/api";
import { supportsVirtualLights, lightProfile, validateLightConfiguration } from "src/services/virtualLights";

const clone = (value) => JSON.parse(JSON.stringify(value));
const unwrap = ({ jsonData, error }) => {
  if (error) throw new Error(typeof jsonData?.error === "string" && jsonData.error ? jsonData.error : error.message || "Controller request failed.");
  if (jsonData?.success === false) throw new Error(jsonData.error || "Controller rejected the request.");
  return jsonData;
};

export const useVirtualLightsStore = defineStore("virtualLights", {
  state: () => ({
    controllerIp: null,
    firmwareVersion: null,
    deviceSoc: null,
    configuration: null,
    catalog: null,
    selectedId: null,
    color: {},
    loading: false,
    colorLoading: false,
    saving: false,
    error: null,
    loadToken: 0,
    colorToken: 0,
    started: false,
  }),
  getters: {
    enabled() {
      return this.controllerIp === useControllersStore().currentController?.ip_address && supportsVirtualLights(this.firmwareVersion);
    },
    lights: (state) => state.configuration?.lights ?? [],
    compatibleBoards: (state) => {
      const soc = state.deviceSoc?.toLowerCase();
      return state.catalog?.boards?.filter((board) => board.soc?.toLowerCase() === soc) ?? [];
    },
    selectedLight() { return this.lights.find((light) => light.id === this.selectedId) ?? null; },
    profile() { return lightProfile(this.selectedLight); },
  },
  actions: {
    start() {
      if (this.started) return;
      this.started = true;
      const controllers = useControllersStore();
      const info = infoDataStore();
      const scope = effectScope(true);
      scope.run(() => watch(
        [() => controllers.currentController?.ip_address, () => info.data?.app?.git_version],
        () => this.load(),
        { immediate: true, flush: "sync" },
      ));
      const dispose = this.$dispose;
      this.$dispose = () => {
        scope.stop();
        dispose();
      };
    },
    async load() {
      const controller = { ...useControllersStore().currentController };
      const selectedId = controller.ip_address === this.controllerIp ? this.selectedId : null;
      const token = ++this.loadToken;
      ++this.colorToken;
      this.controllerIp = controller.ip_address;
      this.firmwareVersion = null;
      this.deviceSoc = null;
      this.configuration = null;
      this.catalog = null;
      this.selectedId = selectedId;
      this.color = {};
      this.error = null;
      this.loading = true;
      this.saving = false;
      this.colorLoading = false;
      const current = () => token === this.loadToken && controller.ip_address === useControllersStore().currentController?.ip_address;
      try {
        if (!controller.ip_address) return;
        const info = unwrap(await apiService.getInfo(controller));
        if (!current()) return;
        this.firmwareVersion = info?.app?.git_version ?? info?.git_version;
        this.deviceSoc = info?.device?.soc ?? info?.soc ?? null;
        if (!supportsVirtualLights(this.firmwareVersion)) return;
        const config = unwrap(await apiService.getConfig(controller));
        if (!current()) return;
        if (!Array.isArray(config?.hardware?.configuration?.lights)) throw new Error("Virtual-light configuration is unavailable.");
        this.configuration = config.hardware.configuration;
        const catalog = unwrap(await apiService.fetchApi("catalog", controller));
        if (!current()) return;
        this.catalog = catalog;
        const selectedLight = this.lights.find((light) => light.id === selectedId)
          ?? this.lights.find((light) => light.is_default);
        this.selectedId = selectedLight?.id ?? null;
        await this.fetchColor();
      } catch (error) {
        if (current()) this.error = error.message;
      } finally {
        if (current()) this.loading = false;
      }
    },
    async selectLight(id) {
      if (!this.enabled || !this.lights.some((light) => light.id === id)) return;
      this.selectedId = id;
      this.error = null;
      this.color = {};
      await this.fetchColor();
    },
    async fetchColor() {
      const light = this.selectedLight;
      const controller = { ...useControllersStore().currentController };
      const token = ++this.colorToken;
      if (!this.enabled || !light) return;
      this.colorLoading = true;
      const current = () => token === this.colorToken && this.enabled && this.selectedId === light.id && controller.ip_address === this.controllerIp;
      try {
        const color = unwrap(await apiService.fetchApi(`color?light=${light.index}`, controller));
        if (current()) this.color = color;
      } catch (error) {
        if (current()) this.error = error.message;
      } finally {
        if (current()) this.colorLoading = false;
      }
    },
    async sendColor(color) {
      const light = this.selectedLight;
      if (!this.enabled || !light || this.loading || this.colorLoading || this.saving) return;
      const controller = { ...useControllersStore().currentController };
      const token = this.loadToken;
      const body = clone(color);
      this.error = null;
      try {
        unwrap(await apiService.fetchApi(`color?light=${light.index}`, controller, { method: "POST", body }));
        if (token === this.loadToken && this.selectedId === light.id && this.enabled) await this.fetchColor();
      } catch (error) {
        if (token === this.loadToken && this.enabled) this.error = error.message;
      }
    },
    async apply(configuration) {
      if (!this.enabled || !this.configuration || this.loading || this.saving) throw new Error("Light configuration is not ready.");
      const controller = { ...useControllersStore().currentController };
      const token = this.loadToken;
      const original = JSON.stringify(this.configuration);
      const candidate = clone(configuration);
      if (!this.deviceSoc) throw new Error("Controller SoC is unavailable.");
      candidate.soc = this.deviceSoc;
      const savedBoard = candidate.board_profile;
      const board = savedBoard?.id === candidate.board_id && savedBoard?.revision === candidate.board_revision && savedBoard?.soc === candidate.soc
        ? savedBoard
        : this.compatibleBoards.find((entry) => entry.id === candidate.board_id && entry.revision === candidate.board_revision);
      if (candidate.board_id && !board) throw new Error("Selected board profile is unavailable. Select the board again.");
      if (board) candidate.board_profile = clone(board);
      const errors = validateLightConfiguration(candidate, board);
      if (errors.length) throw new Error(errors.join("\n"));
      this.saving = true;
      ++this.colorToken;
      try {
        const latest = unwrap(await apiService.getConfig(controller));
        if (token !== this.loadToken || !this.enabled) throw new Error("Controller changed; configuration was not sent.");
        if (JSON.stringify(latest?.hardware?.configuration) !== original) throw new Error("Configuration changed on the controller. Reload before applying.");
        candidate.revision = (candidate.revision ?? 0) + 1;
        unwrap(await apiService.fetchApi("config", controller, { method: "POST", atomic: true, body: { hardware: { configuration: candidate } } }));
        const readback = unwrap(await apiService.getConfig(controller));
        if (token !== this.loadToken || !this.enabled) return;
        if (!Array.isArray(readback?.hardware?.configuration?.lights)) throw new Error("Configuration readback failed.");
        this.configuration = readback.hardware.configuration;
        this.error = null;
        if (!this.lights.some((light) => light.id === this.selectedId)) {
          this.selectedId = null;
          this.color = {};
        } else {
          await this.fetchColor();
        }
      } finally {
        if (token === this.loadToken) {
          this.saving = false;
          this.colorLoading = false;
        }
      }
    },
  },
});