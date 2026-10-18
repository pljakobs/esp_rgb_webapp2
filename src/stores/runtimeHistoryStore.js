import { defineStore } from "pinia";
import { watch } from "vue";
import { infoDataStore } from "src/stores/infoDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import useWebSocket, { wsStatus } from "src/services/websocket.js";

const MAX_HEAP_SAMPLES = 360;
const HISTORY_WINDOW_MS = 30 * 60 * 1000;

export const useRuntimeHistoryStore = defineStore("runtimeHistory", {
  state: () => ({
    heapHistory: [],
    runtime: {},
    started: false,
  }),
  actions: {
    start() {
      if (this.started) return;
      this.started = true;

      const ws = useWebSocket();
      const infoData = infoDataStore();
      const controllers = useControllersStore();
      const applyRuntimeUpdate = (params) => {
        if (!params || typeof params !== "object") return;

        const socketUrl = ws.url?.value ?? "";
        const socketHost = socketUrl
          .replace(/^wss?:\/\//, "")
          .replace(/\/.*$/, "");
        const controller =
          controllers.data.find(
            (entry) => String(entry.ip_address) === socketHost,
          ) || controllers.currentController;
        const controllerKey = controller
          ? `${controller.id ?? ""}|${controller.ip_address ?? controller.hostname ?? ""}`
          : socketHost;

        const mergedRuntime = {
          ...this.runtime,
          uptime: Number(params.uptime ?? this.runtime.uptime ?? 0),
          heap_free: Number(params.heap_free ?? this.runtime.heap_free ?? 0),
          minfreeHeapRuntime: Number(
            params.minfreeHeapRuntime ?? this.runtime.minfreeHeapRuntime ?? 0,
          ),
          minfreeHeap10min: Number(
            params.minfreeHeap10min ?? this.runtime.minfreeHeap10min ?? 0,
          ),
          heapLowErrUptime: Number(
            params.heapLowErrUptime ?? this.runtime.heapLowErrUptime ?? 0,
          ),
          heapLowErr10min: Number(
            params.heapLowErr10min ?? this.runtime.heapLowErr10min ?? 0,
          ),
        };

        this.runtime = mergedRuntime;
        if (Number.isFinite(mergedRuntime.heap_free)) {
          this.heapHistory.push({
            ts: Date.now(),
            val: mergedRuntime.heap_free,
            controllerKey,
          });
          if (this.heapHistory.length > MAX_HEAP_SAMPLES) {
            this.heapHistory.shift();
          }
          const cutoff = Date.now() - HISTORY_WINDOW_MS;
          const firstRecent = this.heapHistory.findIndex(
            (entry) => entry.ts >= cutoff,
          );
          if (firstRecent > 0) this.heapHistory.splice(0, firstRecent);
        }

        if (!infoData.data || typeof infoData.data !== "object") {
          infoData.data = {};
        }
        infoData.data = {
          ...infoData.data,
          runtime: mergedRuntime,
        };
      };

      ws.onNotification("runtime_info", applyRuntimeUpdate);
      watch(
        () => ws.status.value,
        async (status) => {
          if (status === wsStatus.CONNECTED) {
            try {
              const response = await ws.request("subscribe", {
                channel: "runtime_info",
              });
              console.log("Subscribed to runtime_info successfully:", response);
            } catch (err) {
              console.error("Failed to subscribe to runtime_info:", err);
            }
          }
        },
        { immediate: true },
      );
    },
  },
});
