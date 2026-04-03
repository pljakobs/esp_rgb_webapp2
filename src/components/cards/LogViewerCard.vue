<template>
  <MyCard icon="article" title="Log Viewer">
    <q-card-section>
      <div class="row items-end q-col-gutter-sm">
        <div class="col-12 col-md-8">
          <q-input
            v-model="serviceBaseUrl"
            label="Log Service URL"
            hint="Example: http://192.168.x.x:4821"
            @blur="persistServiceBaseUrl"
          />
        </div>
        <div class="col-12 col-md-4 row q-gutter-sm">
          <q-btn
            color="primary"
            label="Refresh"
            :loading="loading"
            @click="refreshLogs"
          />
          <q-btn
            flat
            color="primary"
            label="Detect"
            :loading="detecting"
            @click="detectService"
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
          Start the collector on your Linux machine and then click Detect.
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
    const defaultServiceUrl = () => {
      const locationHost = window.location.hostname || "";
      if (locationHost && locationHost !== "localhost" && locationHost !== "127.0.0.1") {
        return `http://${locationHost}:4821`;
      }
      return "http://127.0.0.1:4821";
    };
    const serviceBaseUrl = ref(
      localStorage.getItem("lightinator-log-service-url") || defaultServiceUrl(),
    );
    const remoteLogs = ref([]);
    const nextBefore = ref(null);
    const loading = ref(false);
    const detecting = ref(false);
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

    const normalizeUrl = (url) => String(url || "").trim().replace(/\/$/, "");

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

    const resolveCollectorTarget = async (baseUrl) => {
      const parsed = new URL(baseUrl);
      const info = await fetchJsonWithTimeout(`${baseUrl}/api/v1/service-info`, 2000);
      const udpPort = Number.parseInt(info?.udp?.port || "5514", 10) || 5514;

      if (isIpv4Address(parsed.hostname)) {
        return { ip: parsed.hostname, udpPort };
      }

      const ipv4List = Array.isArray(info?.network?.ipv4) ? info.network.ipv4 : [];
      const preferredIp =
        ipv4List.find((ip) => isPrivateIpv4(ip)) ||
        ipv4List.find((ip) => isIpv4Address(ip));

      if (preferredIp) {
        return { ip: preferredIp, udpPort };
      }

      throw new Error(
        "Detected log service but no collector IPv4 address was provided. Use a service URL with an IP address.",
      );
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

    const persistServiceBaseUrl = () => {
      serviceBaseUrl.value = normalizeUrl(serviceBaseUrl.value);
      localStorage.setItem("lightinator-log-service-url", serviceBaseUrl.value);
    };

    const buildDetectionCandidates = () => {
      const locationHost = window.location.hostname || "";
      const saved = normalizeUrl(serviceBaseUrl.value);
      const candidates = [saved];

      if (locationHost) {
        candidates.push(`http://${locationHost}:4821`);
      }
      candidates.push(window.location.origin);
      candidates.push("http://127.0.0.1:4821");
      candidates.push("http://localhost:4821");
      candidates.push("http://lightinator-logservice.local:4821");

      return [...new Set(candidates.filter(Boolean).map(normalizeUrl))];
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
      if (loading.value || detecting.value) {
        return;
      }

      if (!currentControllerIp.value) {
        statusMessage.value = "No controller selected";
        return;
      }

      loading.value = true;
      try {
        persistServiceBaseUrl();
        const endpoint = `${serviceBaseUrl.value}/api/v1/logs?ip=${encodeURIComponent(
          currentControllerIp.value,
        )}&limit=200&before=0`;
        const payload = await fetchJsonWithTimeout(endpoint);
        const previousLastRaw = remoteLogs.value.at(-1)?.raw;
        remoteLogs.value = (payload.items || []).map(mapRecord);
        nextBefore.value = payload.nextBefore;
        serviceDetected.value = true;
        statusMessage.value = `Connected. Loaded ${remoteLogs.value.length} log entries.`;
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

    const detectService = async () => {
      detecting.value = true;
      statusMessage.value = "Detecting log service...";

      let lastError = null;
      for (const candidate of buildDetectionCandidates()) {
        try {
          await fetchJsonWithTimeout(`${candidate}/health`, 1500);
          const target = await resolveCollectorTarget(candidate);
          serviceBaseUrl.value = candidate;
          persistServiceBaseUrl();
          serviceDetected.value = true;
          await autoConfigureControllerRsyslog(target);
          statusMessage.value = currentControllerIp.value
            ? `Connected and configured controller rsyslog to ${target.ip}:${target.udpPort}`
            : `Connected to log service at ${candidate}`;
          detecting.value = false;
          await refreshLogs();
          return;
        } catch (error) {
          lastError = error;
          // Try next candidate.
        }
      }

      serviceDetected.value = false;
      const browserHost = window.location.hostname || "collector-ip";
      const suggestion = `Try http://${browserHost}:4821 or your collector LAN IP.`;
      statusMessage.value = lastError
        ? `Error: could not detect log service (${lastError.message}). ${suggestion}`
        : `Error: could not detect log service. ${suggestion}`;
      detecting.value = false;
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
      detectService();
      startPolling();
    });

    onUnmounted(() => {
      stopPolling();
    });

    return {
      serviceBaseUrl,
      currentControllerIp,
      displayLogs,
      canLoadOlder,
      loading,
      detecting,
      fullscreen,
      logViewerEl,
      logViewerFullscreenEl,
      showCollectorSetupHelp,
      statusMessage,
      statusClass,
      persistServiceBaseUrl,
      refreshLogs,
      loadOlder,
      detectService,
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
