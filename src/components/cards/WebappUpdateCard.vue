<template>
  <MyCard :title="$t('cards.webappUpdate.title')" icon="web_outlined">
    <q-card-section>
      <q-toggle
        v-model="webappEnabled"
        :label="$t('cards.webappUpdate.autoUpdate')"
        @update:model-value="onToggleEnabled"
      />
      <div class="text-caption text-grey q-mt-xs">
        {{ $t("cards.webappUpdate.description") }}
      </div>
    </q-card-section>

    <!-- OTA progress section -->
    <q-card-section v-if="otaActive" class="q-pt-none q-pb-sm">
      <div class="row items-center q-mb-xs">
        <q-badge :color="stateBadgeColor" :label="stateLabel" class="q-mr-sm" />
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
          {{
            $t("cards.webappUpdate.filesProgress", {
              done: otaDoneFiles,
              total: otaTotalFiles,
            })
          }}
        </span>
      </div>
    </q-card-section>

    <q-card-section v-if="showFileChecklist" class="q-pt-none q-pb-sm">
      <div class="text-caption text-grey-8 q-mb-xs">
        {{ $t("cards.webappUpdate.fileListTitle") }}
      </div>
      <div class="webapp-file-list">
        <div
          v-for="(entry, idx) in fileChecklist"
          :key="`${idx}-${entry.path}`"
          class="row items-center q-py-xs no-wrap"
        >
          <q-icon
            :name="entry.done ? 'check_circle' : 'radio_button_unchecked'"
            :color="entry.done ? 'positive' : 'grey-6'"
            size="18px"
            class="q-mr-sm"
          />
          <span class="text-caption ellipsis">{{ entry.path }}</span>
        </div>
      </div>
    </q-card-section>

    <q-card-section v-if="statusMessage" class="q-pt-none">
      <div class="text-caption text-grey">{{ statusMessage }}</div>
    </q-card-section>

    <q-card-actions align="left">
      <q-btn
        :label="$t('cards.webappUpdate.checkWebapp')"
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
import { useI18n } from "vue-i18n";
import { Notify } from "quasar";
import { configDataStore } from "src/stores/configDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import useWebSocket from "src/services/websocket.js";
import MyCard from "src/components/myCard.vue";

export default {
  components: { MyCard },
  setup() {
    const { t } = useI18n();
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
    const fileChecklist = ref([]);

    const otaActive = computed(() => otaState.value !== "idle");
    const showFileChecklist = computed(() => fileChecklist.value.length > 0);
    const otaProgressValue = computed(() =>
      otaTotalFiles.value > 0 ? otaDoneFiles.value / otaTotalFiles.value : 0,
    );
    const stateLabel = computed(
      () =>
        ({
          idle: t("cards.webappUpdate.states.idle"),
          querying_api: t("cards.webappUpdate.states.queryingApi"),
          downloading: t("cards.webappUpdate.states.downloading"),
          activating: t("cards.webappUpdate.states.activating"),
        })[otaState.value] ?? otaState.value,
    );
    const stateBadgeColor = computed(
      () =>
        ({
          idle: "grey",
          querying_api: "info",
          downloading: "primary",
          activating: "positive",
        })[otaState.value] ?? "grey",
    );

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
          message: t("cards.webappUpdate.errors.saveEnabled", {
            error: err.message,
          }),
        });
        // revert optimistic update
        webappEnabled.value = !val;
      }
    }

    async function checkWebapp() {
      checking.value = true;
      statusMessage.value = t("cards.webappUpdate.checking");
      otaState.value = "idle";
      otaVersion.value = "";
      otaDoneFiles.value = 0;
      otaTotalFiles.value = 0;
      otaCurrentFile.value = "";
      fileChecklist.value = [];

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
            const retryAfter = parseInt(
              response.headers.get("Retry-After") ?? "5",
              10,
            );
            attempt++;
            if (attempt > MAX_RETRIES) {
              throw new Error(
                t("cards.webappUpdate.errors.deviceBusyMaxRetries", {
                  retries: MAX_RETRIES,
                }),
              );
            }
            statusMessage.value = t("cards.webappUpdate.retryingBusy", {
              seconds: retryAfter,
              attempt,
              maxRetries: MAX_RETRIES,
            });
            await new Promise((r) => setTimeout(r, retryAfter * 1000));
            continue;
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          const responseState = data?.state ?? "idle";
          const responseLastStatus = data?.last_status ?? "";
          const responseVersion = data?.version ?? "";

          // If firmware already resolved the check synchronously (no update),
          // show a terminal status immediately instead of leaving "check started".
          if (responseState === "idle") {
            if (responseLastStatus === "no_update") {
              statusMessage.value = t("cards.webappUpdate.alreadyUpToDate", {
                version: responseVersion ? ` (${responseVersion})` : "",
              });
            } else if (responseLastStatus === "updated") {
              statusMessage.value = t("cards.webappUpdate.updatedTo", {
                version: responseVersion,
              });
            } else {
              statusMessage.value =
                data.status ?? t("cards.webappUpdate.checkStarted");
            }
            checking.value = false;
            return;
          }

          // Show initial status from response; further updates arrive via WS
          statusMessage.value =
            data.status ?? t("cards.webappUpdate.checkStarted");
          checking.value = false;
          return;
        } catch (err) {
          statusMessage.value = t("cards.webappUpdate.errorPrefix", {
            error: err.message,
          });
          Notify.create({
            type: "negative",
            message: t("cards.webappUpdate.errors.checkFailed", {
              error: err.message,
            }),
          });
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

      const total = Math.max(Number(otaTotalFiles.value) || 0, 0);
      const currentIndex = Math.min(
        Math.max(Number(otaDoneFiles.value) || 0, 0),
        Math.max(total - 1, 0),
      );

      if (total > 0 && fileChecklist.value.length !== total) {
        const existing = fileChecklist.value.slice(0, total);
        while (existing.length < total) {
          existing.push({
            path: t("cards.webappUpdate.pendingFile", {
              index: existing.length + 1,
            }),
            done: false,
          });
        }
        fileChecklist.value = existing;
      }

      if (total > 0) {
        fileChecklist.value = fileChecklist.value.map((entry, idx) => ({
          ...entry,
          done: idx < currentIndex,
        }));

        if (otaCurrentFile.value) {
          fileChecklist.value[currentIndex] = {
            path: otaCurrentFile.value,
            done: fileChecklist.value[currentIndex]?.done ?? false,
          };
        }
      }

      // Update status message to reflect the outcome once idle
      if (otaState.value === "idle") {
        const lastStatus = params.last_status ?? "";
        const ver = params.version ?? "";
        if (lastStatus === "no_update") {
          statusMessage.value = t("cards.webappUpdate.alreadyUpToDate", {
            version: ver ? ` (${ver})` : "",
          });
        } else if (lastStatus === "updated") {
          statusMessage.value = t("cards.webappUpdate.updatedTo", {
            version: ver,
          });
          fileChecklist.value = fileChecklist.value.map((entry) => ({
            ...entry,
            done: true,
          }));
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
      fileChecklist,
      showFileChecklist,
      otaProgressValue,
      stateLabel,
      stateBadgeColor,
      onToggleEnabled,
      checkWebapp,
    };
  },
};
</script>

<style scoped>
.webapp-file-list {
  max-height: 19.5rem;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
}
</style>
