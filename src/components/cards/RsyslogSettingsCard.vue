<template>
  <MyCard icon="article" title="Rsyslog Settings">
    <q-card-section>
      <div>
        Configure UDP rsyslog forwarding for device logs. Changes apply after
        restart.
      </div>
      <div class="text-h7 q-mt-sm">
        <q-toggle
          v-model="enabled"
          label="enable rsyslog"
          left-label
          @update:model-value="updateEnabled"
        />
      </div>
    </q-card-section>

    <q-card-section v-if="enabled" class="q-pt-none">
      <q-separator class="q-mb-md" />
      <div class="row items-center q-mb-md q-gutter-sm">
        <div class="text-h6">Target</div>
        <q-btn
          dense
          flat
          color="primary"
          label="Use Local Log Service"
          :loading="detecting"
          @click="applyDetectedLogService"
        />
      </div>
      <div class="row q-gutter-md" style="max-width: 420px">
        <div style="width: 220px">
          <q-input v-model="host" label="Rsyslog Host" @blur="updateHost" />
        </div>
        <div style="width: 120px">
          <q-input
            v-model.number="port"
            type="number"
            label="Port"
            @blur="updatePort"
          />
        </div>
      </div>
      <div class="text-caption q-mt-sm" :class="statusClass">
        {{ statusMessage }}
      </div>
    </q-card-section>
  </MyCard>
</template>

<script>
import { computed, ref } from "vue";
import { configDataStore } from "src/stores/configDataStore";
import { useConfigBinding } from "src/composables/useConfigDataBindings";
import MyCard from "src/components/myCard.vue";

export default {
  name: "RsyslogSettingsCard",
  components: {
    MyCard,
  },
  setup() {
    const configData = configDataStore();
    const detecting = ref(false);
    const statusMessage = ref("Local log service not configured.");

    const { model: enabled, save: updateEnabled } = useConfigBinding(
      configData,
      "network.rsyslog.enabled",
      {
        fallback: false,
        persist: true,
      },
    );

    const { model: host, save: updateHost } = useConfigBinding(
      configData,
      "network.rsyslog.host",
      {
        fallback: "",
        persist: true,
      },
    );

    const { model: port, save: updatePort } = useConfigBinding(
      configData,
      "network.rsyslog.port",
      {
        fallback: 514,
        persist: true,
        normalize: (value) => {
          const normalizedPort = Number.parseInt(value, 10);
          return Number.isFinite(normalizedPort) ? normalizedPort : 514;
        },
      },
    );

    const statusClass = computed(() => {
      if (statusMessage.value.toLowerCase().includes("error")) {
        return "status-error";
      }
      if (statusMessage.value.toLowerCase().includes("applied")) {
        return "status-ok";
      }
      return "";
    });

    const normalizeUrl = (url) => String(url || "").trim().replace(/\/$/, "");

    const fetchJsonWithTimeout = async (url, timeoutMs = 1500) => {
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

    const applyDetectedLogService = async () => {
      detecting.value = true;
      statusMessage.value = "Detecting local log service...";

      const saved = localStorage.getItem("lightinator-log-service-url") || "";
      const candidates = [
        normalizeUrl(saved),
        "http://lightinator-logservice.local:4821",
        "http://localhost:4821",
        "http://127.0.0.1:4821",
      ];

      for (const candidate of [...new Set(candidates.filter(Boolean))]) {
        try {
          await fetchJsonWithTimeout(`${candidate}/health`);
          const parsed = new URL(candidate);
          updateHost(parsed.hostname);
          updatePort(Number.parseInt(parsed.port || "4821", 10));
          statusMessage.value = `Applied ${parsed.hostname}:${parsed.port || "4821"}`;
          detecting.value = false;
          return;
        } catch (_error) {
          // Try next candidate.
        }
      }

      statusMessage.value =
        "Error: no local log service detected. Start service and try again.";
      detecting.value = false;
    };

    return {
      enabled,
      host,
      port,
      detecting,
      statusMessage,
      statusClass,
      updateEnabled,
      updateHost,
      updatePort,
      applyDetectedLogService,
    };
  },
};
</script>

<style scoped>
.status-ok {
  color: #4caf50;
}

.status-error {
  color: #ef5350;
}
</style>
