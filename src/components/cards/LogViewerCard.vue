<template>
  <MyCard icon="article" title="Log Viewer">
    <q-card-section>
      <div class="row items-end q-col-gutter-sm">
        <div class="col-12 col-md-6">
          <q-input
            v-model="collectorHost"
            label="Collector IPv4"
            hint="Example: 192.168.29.100"
            @blur="persistCollectorTarget"
          />
        </div>
        <div class="col-12 col-md-2">
          <q-input
            v-model.number="collectorPort"
            type="number"
            label="Port"
            hint="Default: 4821"
            @blur="persistCollectorTarget"
          />
        </div>
        <div class="col-12 col-md-4 row q-gutter-sm">
          <q-btn
            color="primary"
            label="Refresh"
            :loading="loading"
            @click="refreshLogs"
          />
        </div>
      </div>

      <div class="text-caption q-mt-sm">
        Controller IP: {{ currentControllerIp || "none selected" }}
      </div>
      <div class="text-caption" :class="statusClass">{{ statusMessage }}</div>

      <q-banner v-if="showCollectorSetupHelp" class="q-mt-sm bg-grey-9 text-white">
        <div class="text-subtitle2 q-mb-xs">Local log service not found</div>
        <div class="text-caption q-mb-xs">
          Start the collector on your Linux machine and enter its IPv4 and port above.
        </div>
        <div class="setup-command">
          git clone https://github.com/pljakobs/lightinator-log-service.git
        </div>
        <div class="setup-command">cd lightinator-log-service</div>
        <div class="setup-command">./scripts/run-container.sh</div>
      </q-banner>
    </q-card-section>

    <q-card-section class="row justify-center no-padding">
          <div ref="logViewerEl" class="log-viewer">
        <div v-if="displayLogs.length === 0" class="empty-state">
          No logs available.
        </div>
        <div v-for="(log, index) in displayLogs" :key="index" class="log-line">
          <span class="log-timestamp">{{ log.time }}</span>
          <span class="log-location" v-if="log.location"
            >[{{ log.location }}]</span
          >
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </q-card-section>
    <q-card-section class="row justify-center no-padding">
      <q-btn
        flat
        :disable="!canLoadOlder || loading"
        label="Load Older"
        color="primary"
        class="q-mr-sm"
        @click="loadOlder"
      />
      <q-btn
        @click="downloadLogFile"
        :disable="displayLogs.length === 0"
        label="Download Log"
        color="primary"
      />
      <q-btn
        flat
        label="Fullscreen"
        color="primary"
        class="q-ml-sm"
        @click="fullscreen = true"
      />
    </q-card-section>

    <q-dialog v-model="fullscreen" maximized>
      <q-card class="fullscreen-card">
        <q-card-section class="row items-center q-pb-sm">
          <div class="text-h6">Log Viewer</div>
          <q-space />
          <q-btn
            flat
            label="Refresh"
            :loading="loading"
            @click="refreshLogs"
          />
          <q-btn
            flat
            :disable="!canLoadOlder || loading"
            label="Load Older"
            class="q-ml-sm"
            @click="loadOlder"
          />
          <q-btn
            flat
            label="Download"
            :disable="displayLogs.length === 0"
            class="q-ml-sm"
            @click="downloadLogFile"
          />
          <q-btn
            flat
            round
            dense
            label="X"
            class="q-ml-sm"
            @click="fullscreen = false"
          />
        </q-card-section>

        <q-separator />

        <q-card-section class="fullscreen-body">
          <div class="text-caption q-mb-sm" :class="statusClass">{{ statusMessage }}</div>
          <div ref="logViewerFullscreenEl" class="log-viewer log-viewer-fullscreen">
            <div v-if="displayLogs.length === 0" class="empty-state">
              No logs available.
            </div>
            <div
              v-for="(log, index) in displayLogs"
              :key="`fs-${index}`"
              class="log-line"
            >
              <span class="log-timestamp">{{ log.time }}</span>
              <span class="log-location" v-if="log.location"
                >[{{ log.location }}]</span
              >
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </MyCard>
</template>

<script>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useControllersStore } from "src/stores/controllersStore";
import { configDataStore } from "src/stores/configDataStore";
import MyCard from "src/components/myCard.vue";

export default {
  name: "LogViewerCard",
  components: {
    MyCard,
  },
  setup() {
    const controllersStore = useControllersStore();
    const configStore = configDataStore();
    const defaultCollectorHost =
      window.location.hostname &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
        ? window.location.hostname
        : "127.0.0.1";
    const collectorHost = ref(
      localStorage.getItem("lightinator-log-service-host") || defaultCollectorHost,
    );
    const collectorPort = ref(
      Number.parseInt(localStorage.getItem("lightinator-log-service-port") || "4821", 10) ||
        4821,
    );
    const remoteLogs = ref([]);
    const nextBefore = ref(null);
    const loading = ref(false);
    const fullscreen = ref(false);
    const serviceDetected = ref(false);
    const statusMessage = ref("Idle");
    const logViewerEl = ref(null);
    const logViewerFullscreenEl = ref(null);
    const pollMs = 2000;
    let pollTimer = null;

    const currentControllerIp = computed(
      () => controllersStore.currentController?.ip_address || "",
    );

    const statusClass = computed(() => {
      if (statusMessage.value.toLowerCase().includes("error")) {
        return "status-error";
      }
      if (statusMessage.value.toLowerCase().includes("connected")) {
        return "status-ok";
      }
      return "";
    });

    const displayLogs = computed(() => remoteLogs.value);
    const canLoadOlder = computed(() => nextBefore.value !== null);
    const showCollectorSetupHelp = computed(
      () =>
        !serviceDetected.value &&
        (statusMessage.value.toLowerCase().includes("could not detect") ||
          statusMessage.value.toLowerCase().includes("error loading logs")),
    );

    const normalizeHost = (host) => String(host || "").trim();
    const normalizePort = (port) => {
      const parsed = Number.parseInt(String(port || ""), 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
        return null;
      }
      return parsed;
    };

    const serviceBaseUrl = computed(() => {
      const host = normalizeHost(collectorHost.value);
      const port = normalizePort(collectorPort.value);
      if (!host || !port) {
        return "";
      }
      return `http://${host}:${port}`;
    });

    const isIpv4Address = (value) => {
      const parts = String(value || "").trim().split(".");
      if (parts.length !== 4) {
        return false;
      }
      return parts.every((part) => {
        if (!/^\d+$/.test(part)) {
          return false;
        }
        const num = Number.parseInt(part, 10);
        return num >= 0 && num <= 255;
      });
    };

    const isPrivateIpv4 = (value) => {
      if (!isIpv4Address(value)) {
        return false;
      }
      const [a, b] = value.split(".").map((part) => Number.parseInt(part, 10));
      return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
    };

    const autoConfigureControllerRsyslog = async ({ ip, udpPort }) => {
      if (!currentControllerIp.value) {
        return;
      }

      await configStore.updateMultipleData(
        {
          "network.rsyslog.enabled": true,
          "network.rsyslog.host": ip,
          "network.rsyslog.port": udpPort,
        },
        true,
      );
    };

    const persistCollectorTarget = () => {
      collectorHost.value = normalizeHost(collectorHost.value);
      const port = normalizePort(collectorPort.value);
      collectorPort.value = port || 4821;
      localStorage.setItem("lightinator-log-service-host", collectorHost.value);
      localStorage.setItem(
        "lightinator-log-service-port",
        String(collectorPort.value),
      );
    };

    const fetchJsonWithTimeout = async (url, timeoutMs = 3000) => {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const response = await fetch(url, { signal: ctrl.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const mapRecord = (record) => ({
      time: record.receivedAt || "",
      location: record.sourceIp || "",
      message: record.message || record.raw || "",
      raw: record.raw || record.message || "",
    });

    const scrollToBottom = async () => {
      await nextTick();
      if (fullscreen.value && logViewerFullscreenEl.value) {
        logViewerFullscreenEl.value.scrollTop =
          logViewerFullscreenEl.value.scrollHeight;
      } else if (logViewerEl.value) {
        logViewerEl.value.scrollTop = logViewerEl.value.scrollHeight;
      }
    };

    const refreshLogs = async () => {
      if (loading.value) {
        return;
      }

      if (!currentControllerIp.value) {
        statusMessage.value = "No controller selected";
        return;
      }

      persistCollectorTarget();
      if (!isIpv4Address(collectorHost.value)) {
        serviceDetected.value = false;
        statusMessage.value = "Please enter a valid collector IPv4 address.";
        return;
      }

      const httpPort = normalizePort(collectorPort.value);
      if (!httpPort) {
        serviceDetected.value = false;
        statusMessage.value = "Please enter a valid collector HTTP port.";
        return;
      }

      loading.value = true;
      try {
        const endpoint = `${serviceBaseUrl.value}/api/v1/logs?ip=${encodeURIComponent(
          currentControllerIp.value,
        )}&limit=200&before=0`;
        const payload = await fetchJsonWithTimeout(endpoint);
        const previousLastRaw = remoteLogs.value.at(-1)?.raw;
        remoteLogs.value = (payload.items || []).map(mapRecord);
        nextBefore.value = payload.nextBefore;
        await autoConfigureControllerRsyslog({
          ip: collectorHost.value,
          udpPort: 5514,
        });
        serviceDetected.value = true;
        statusMessage.value = `Connected. Loaded ${remoteLogs.value.length} log entries. Controller rsyslog set to ${collectorHost.value}:5514.`;
        const hasNewTail = previousLastRaw !== remoteLogs.value.at(-1)?.raw;
        if (hasNewTail) {
          await scrollToBottom();
        }
      } catch (error) {
        serviceDetected.value = false;
        statusMessage.value = `Error loading logs: ${error.message}`;
      } finally {
        loading.value = false;
      }
    };

    const loadOlder = async () => {
      if (!currentControllerIp.value || nextBefore.value === null) {
        return;
      }

      loading.value = true;
      try {
        const endpoint = `${serviceBaseUrl.value}/api/v1/logs?ip=${encodeURIComponent(
          currentControllerIp.value,
        )}&limit=200&before=${nextBefore.value}`;
        const payload = await fetchJsonWithTimeout(endpoint);
        const older = (payload.items || []).map(mapRecord);
        remoteLogs.value = [...older, ...remoteLogs.value];
        nextBefore.value = payload.nextBefore;
        statusMessage.value = `Loaded ${older.length} older entries.`;
      } catch (error) {
        statusMessage.value = `Error loading older logs: ${error.message}`;
      } finally {
        loading.value = false;
      }
    };

    const downloadLogFile = () => {
      const logContent = displayLogs.value
        .map((log) => log.raw || `${log.time} ${log.location} ${log.message}`)
        .join("\n");
      const blob = new Blob([logContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Lightinator_log.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    watch(currentControllerIp, () => {
      refreshLogs();
    });

    watch(fullscreen, () => {
      scrollToBottom();
    });

    const startPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
      }
      pollTimer = setInterval(() => {
        refreshLogs();
      }, pollMs);
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    onMounted(() => {
      persistCollectorTarget();
      refreshLogs();
      startPolling();
    });

    onUnmounted(() => {
      stopPolling();
    });

    return {
      collectorHost,
      collectorPort,
      currentControllerIp,
      displayLogs,
      canLoadOlder,
      loading,
      fullscreen,
      logViewerEl,
      logViewerFullscreenEl,
      showCollectorSetupHelp,
      statusMessage,
      statusClass,
      persistCollectorTarget,
      refreshLogs,
      loadOlder,
      downloadLogFile,
    };
  },
};
</script>

<style scoped>
.log-viewer {
  padding: 20px;
  background-color: #505050;
  border-radius: 5px;
  max-height: 400px;
  max-width: 100%;
  overflow: auto;
}

.log-line {
  margin-bottom: 10px;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.log-timestamp {
  color: blue;
  margin-right: 5px;
}

.log-location {
  color: black;
  margin-right: 5px;
}

.log-message {
  color: white;
}

.empty-state {
  color: #ddd;
  font-style: italic;
}

.status-ok {
  color: #4caf50;
}

.status-error {
  color: #ef5350;
}

.setup-command {
  font-family: monospace;
  padding: 4px 8px;
  margin-top: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}

.fullscreen-card {
  display: flex;
  flex-direction: column;
}

.fullscreen-body {
  flex: 1;
  min-height: 0;
}

.log-viewer-fullscreen {
  max-height: calc(100vh - 170px);
}
</style>
