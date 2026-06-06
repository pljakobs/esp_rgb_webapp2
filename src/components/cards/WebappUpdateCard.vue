<template>
  <MyCard title="Webapp update" icon="web_outlined">
    <q-card-section>
      <q-toggle
        v-model="webappEnabled"
        label="Auto-update webapp"
        @update:model-value="onToggleEnabled"
      />
      <div class="text-caption text-grey q-mt-xs">
        When enabled, checks for a new webapp on every WiFi connect.
        Disable to only update on manual request.
        A missing webapp is always fetched regardless of this setting.
      </div>
    </q-card-section>

    <!-- OTA progress section -->
    <q-card-section v-if="otaActive" class="q-pt-none q-pb-sm">
      <div class="row items-center q-mb-xs">
        <q-badge
          :color="stateBadgeColor"
          :label="stateLabel"
          class="q-mr-sm"
        />
        <span v-if="otaVersion" class="text-caption text-grey">
          v{{ otaVersion }}
        </span>
      </div>
      <q-linear-progress
        :value="otaProgressValue"
        color="primary"
        track-color="grey-3"
        rounded
        stripe
        class="q-mb-xs"
        style="height: 8px"
      />
      <div class="row justify-between text-caption text-grey">
        <span v-if="otaCurrentFile" class="ellipsis" style="max-width: 75%">
          {{ otaCurrentFile }}
        </span>
        <span v-if="otaTotalFiles > 0">
          {{ otaDoneFiles }} / {{ otaTotalFiles }} files
        </span>
      </div>
    </q-card-section>

    <q-card-section v-if="statusMessage" class="q-pt-none">
      <div class="text-caption text-grey">{{ statusMessage }}</div>
    </q-card-section>

    <q-card-actions align="left">
      <q-btn
        label="Check webapp"
        color="primary"
        class="q-mt-xs"
        :loading="checking"
        :disable="checking || otaActive"
        @click="checkWebapp"
      />
    </q-card-actions>
  </MyCard>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Notify } from "quasar";
import { configDataStore } from "src/stores/configDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import useWebSocket from "src/services/websocket.js";
import MyCard from "src/components/myCard.vue";

export default {
  components: { MyCard },
  setup() {
    const configData = configDataStore();
    const controllersStore = useControllersStore();

    const webappEnabled = ref(configData.data?.webapp?.enabled ?? true);
    const checking = ref(false);
    const statusMessage = ref("");

    // OTA progress state (populated by webapp_ota_status WebSocket messages)
    const otaState = ref("idle");
    const otaVersion = ref("");
    const otaDoneFiles = ref(0);
    const otaTotalFiles = ref(0);
    const otaCurrentFile = ref("");

    const otaActive = computed(
      () => otaState.value !== "idle",
    );
    const otaProgressValue = computed(() =>
      otaTotalFiles.value > 0 ? otaDoneFiles.value / otaTotalFiles.value : 0,
    );
    const stateLabel = computed(() => ({
      idle: "Idle",
      querying_api: "Checking for update…",
      downloading: "Downloading…",
      activating: "Activating…",
    }[otaState.value] ?? otaState.value));
    const stateBadgeColor = computed(() => ({
      idle: "grey",
      querying_api: "info",
      downloading: "primary",
      activating: "positive",
    }[otaState.value] ?? "grey"));

    // Keep toggle in sync if config is reloaded elsewhere
    function syncFromStore() {
      webappEnabled.value = configData.data?.webapp?.enabled ?? true;
    }

    onMounted(() => {
      syncFromStore();
    });

    async function onToggleEnabled(val) {
      try {
        await configData.updateData("webapp.enabled", val, true);
      } catch (err) {
        Notify.create({
          type: "negative",
          message: `Failed to save webapp enabled setting: ${err.message}`,
        });
        // revert optimistic update
        webappEnabled.value = !val;
      }
    }

    async function checkWebapp() {
      checking.value = true;
      statusMessage.value = "Checking for webapp update…";

      const MAX_RETRIES = 4;
      let attempt = 0;

      while (attempt <= MAX_RETRIES) {
        try {
          const controller = controllersStore.currentController;
          const baseUrl = `http://${controller.ip_address}`;
          const response = await fetch(`${baseUrl}/webapp_check`, {
            method: "POST",
          });

          if (response.status === 429) {
            // Firmware is low on heap — honour Retry-After header
            const retryAfter = parseInt(response.headers.get("Retry-After") ?? "5", 10);
            attempt++;
            if (attempt > MAX_RETRIES) {
              throw new Error(`Device busy (429), gave up after ${MAX_RETRIES} retries`);
            }
            statusMessage.value = `Device busy, retrying in ${retryAfter}s… (${attempt}/${MAX_RETRIES})`;
            await new Promise((r) => setTimeout(r, retryAfter * 1000));
            continue;
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          // Show initial status from response; further updates arrive via WS
          statusMessage.value = data.status ?? "Check started";
          checking.value = false;
          return;
        } catch (err) {
          statusMessage.value = `Error: ${err.message}`;
          Notify.create({ type: "negative", message: `Webapp check failed: ${err.message}` });
          checking.value = false;
          return;
        }
      }

      // Exceeded retries without throwing (shouldn't happen, but be safe)
      checking.value = false;
    }

    // Listen for webapp OTA status pushed over WebSocket
    const ws = useWebSocket();
    ws.onJson("webapp_ota_status", (params) => {
      if (!params) return;

      otaState.value = params.state ?? "idle";
      otaVersion.value = params.version ?? "";
      otaDoneFiles.value = params.file ?? 0;
      otaTotalFiles.value = params.total ?? 0;
      otaCurrentFile.value = params.file_path ?? "";

      // Update status message to reflect the outcome once idle
      if (otaState.value === "idle") {
        const lastStatus = params.last_status ?? "";
        const ver = params.version ?? "";
        if (lastStatus === "no_update") {
          statusMessage.value = `Already up to date${ver ? " (" + ver + ")" : ""}`;
        } else if (lastStatus === "updated") {
          statusMessage.value = `Updated to ${ver}`;
        } else if (lastStatus) {
          statusMessage.value = lastStatus;
        }
        // OTA is done — clear the checking spinner if it was still set
        checking.value = false;
      } else {
        // While active, clear the initial "check started" status message so
        // only the progress section is shown
        statusMessage.value = "";
        checking.value = false;
      }
    });

    onUnmounted(() => {
      // useWebSocket listeners are cleaned up by the composable on unmount
    });

    return {
      webappEnabled,
      checking,
      statusMessage,
      otaActive,
      otaState,
      otaVersion,
      otaDoneFiles,
      otaTotalFiles,
      otaCurrentFile,
      otaProgressValue,
      stateLabel,
      stateBadgeColor,
      onToggleEnabled,
      checkWebapp,
    };
  },
};
</script>
