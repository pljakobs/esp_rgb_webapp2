import { defineStore } from "pinia";
import { storeStatus } from "src/stores/storeConstants";
import { apiService } from "src/services/api.js";
import useWebSocket, { wsStatus } from "src/services/websocket.js";

/**
 * Normalize an /info response to the new nested structure.
 * Handles both the legacy flat structure (firmware < V5.1) and the
 * current nested structure (firmware >= V5.1).
 *
 * Detection: if `raw.device` is present → already new structure.
 */
export function normalizeInfoData(raw) {
  if (!raw) return raw;
  // Already new nested structure
  if (raw.device !== undefined) return raw;
  // Legacy flat structure — remap to nested
  return {
    device: {
      deviceid: raw.deviceid,
      soc: raw.soc,
      current_rom: raw.current_rom,
    },
    app: {
      webapp_version: raw.webapp_version,
      git_version: raw.git_version,
      build_type: raw.build_type,
      git_date: raw.git_date,
    },
    sming: { version: raw.sming },
    runtime: {
      uptime: raw.uptime,
      heap_free: raw.heap_free,
      cpu_usage_percent: raw.cpu_usage_percent,
      event_num_clients: raw.event_num_clients,
    },
    rgbww: raw.rgbww,
    connection: raw.connection,
    mqtt: raw.mqtt,
    homeassistant: raw.homeassistant,
  };
}

export const infoDataStore = defineStore("infoDataStore", {
  state: () => ({
    data: null,
    status: storeStatus.LOADING,
    http_response_status: null,
  }),
  actions: {
    async fetchDataViaWebSocket(timeoutMs = 1200) {
      const ws = useWebSocket();
      if (ws.status?.value !== wsStatus.CONNECTED || typeof ws.request !== "function") {
        return null;
      }

      try {
        const params = await ws.request("info", { V: "2" }, timeoutMs);
        const payload = params?.message ?? params;
        return payload && typeof payload === "object" ? payload : null;
      } catch (error) {
        console.warn("info websocket fetch failed, falling back to HTTP:", error?.message || error);
        return null;
      }
    },

    async fetchData() {
      this.status = storeStatus.LOADING;
      try {
        let infoPayload = await this.fetchDataViaWebSocket();

        if (!infoPayload) {
          const { jsonData, error } = await apiService.getInfo();
          if (error) {
            throw error;
          }
          infoPayload = jsonData;
        }

        console.log("info data fetched: ", JSON.stringify(infoPayload));
        this.data = normalizeInfoData(infoPayload);
        this.status = storeStatus.READY;
        return this.data;
      } catch (err) {
        this.status = storeStatus.ERROR;
        console.error("error fetching info data:", err);
        throw err;
      }
    },
  },
});
