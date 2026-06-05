<template>
  <MyCard title="Webapp update" icon="web_outlined">
    <q-card-section>
      <q-toggle
        v-model="webappEnabled"
        label="Enable automatic webapp updates"
        @update:model-value="onToggleEnabled"
      />
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
        :disable="checking"
        @click="checkWebapp"
      />
    </q-card-actions>
  </MyCard>
</template>

<script>
import { ref, onMounted, onUnmounted } from "vue";
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
      try {
        const controller = controllersStore.currentController;
        const baseUrl = `http://${controller.ip_address}`;
        const response = await fetch(`${baseUrl}/webapp_check`, {
          method: "POST",
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        // Show initial status from response; further updates arrive via WS
        statusMessage.value = data.status ?? "Check started";
      } catch (err) {
        statusMessage.value = `Error: ${err.message}`;
        Notify.create({ type: "negative", message: `Webapp check failed: ${err.message}` });
      } finally {
        checking.value = false;
      }
    }

    // Listen for webapp OTA status pushed over WebSocket
    const ws = useWebSocket();
    ws.onJson("webapp_ota_status", (params) => {
      const s = params?.status ?? "";
      const ver = params?.version ?? "";
      const prog = params?.progress != null ? ` (${params.progress}%)` : "";
      if (s === "idle" && ver) {
        statusMessage.value = `Installed: ${ver}`;
      } else if (s) {
        statusMessage.value = `${s}${ver ? " — " + ver : ""}${prog}`;
      }
    });

    onUnmounted(() => {
      // useWebSocket listeners are cleaned up by the composable on unmount
    });

    return {
      webappEnabled,
      checking,
      statusMessage,
      onToggleEnabled,
      checkWebapp,
    };
  },
};
</script>
