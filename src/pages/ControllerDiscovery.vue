<template>
  <q-page class="flex flex-center discovery-page">
    <div
      class="discovery-container q-pa-md"
      style="max-width: 600px; width: 100%"
    >
      <div class="text-center q-mb-lg">
        <q-icon name="wifi_find" size="80px" color="primary" />
        <h4 class="q-my-md">Find Your Controller</h4>
        <p class="text-grey-7">
          Scanning your local network for ESP RGBWW controllers...
        </p>
      </div>

      <!-- Network Status -->
      <q-banner
        v-if="!networkConnected"
        class="bg-negative text-white q-mb-md"
        rounded
      >
        <template v-slot:avatar>
          <q-icon name="wifi_off" />
        </template>
        No network connection. Please connect to WiFi and try again.
      </q-banner>

      <!-- Scanning Status -->
      <div v-if="scanning" class="text-center q-mb-lg">
        <q-spinner-dots size="50px" color="primary" />
        <p class="q-mt-md">Found {{ controllers.length }} controller(s)...</p>
      </div>

      <!-- Controller List -->
      <div v-if="!scanning && controllers.length > 0">
        <h6 class="q-my-md">Available Controllers:</h6>
        <q-list bordered separator>
          <q-item
            v-for="controller in controllers"
            :key="controller.ip_address"
            clickable
            v-ripple
            @click="selectController(controller)"
            class="controller-item"
          >
            <q-item-section avatar>
              <q-avatar color="primary" text-color="white" icon="lightbulb" />
            </q-item-section>

            <q-item-section>
              <q-item-label>{{ controller.name }}</q-item-label>
              <q-item-label caption>
                {{ controller.hostname }} ({{ controller.ip_address }})
              </q-item-label>
              <q-item-label caption v-if="controller.firmware">
                Firmware: {{ controller.firmware }}
              </q-item-label>
            </q-item-section>

            <q-item-section side>
              <q-icon name="chevron_right" />
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <!-- No Controllers Found -->
      <div
        v-if="!scanning && controllers.length === 0 && scanCompleted"
        class="text-center q-mb-lg"
      >
        <q-icon name="search_off" size="60px" color="grey-5" />
        <p class="text-grey-7 q-mt-md">No controllers found on your network.</p>
      </div>

      <!-- Actions -->
      <div class="q-mt-lg q-gutter-sm">
        <q-btn
          v-if="!scanning"
          color="primary"
          label="Scan Again"
          icon="refresh"
          class="full-width"
          @click="startScan"
        />

        <q-btn
          v-if="!scanning"
          flat
          color="primary"
          label="Manual Entry"
          icon="edit"
          class="full-width"
          @click="showManualEntry = true"
        />
      </div>

      <!-- Manual Entry Dialog -->
      <q-dialog v-model="showManualEntry">
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">Enter Controller IP</div>
          </q-card-section>

          <q-card-section class="q-pt-none">
            <q-input
              v-model="manualIp"
              label="IP Address"
              placeholder="192.168.1.100"
              outlined
              @keyup.enter="connectManual"
            />
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Cancel" color="primary" v-close-popup />
            <q-btn
              flat
              label="Connect"
              color="primary"
              @click="connectManual"
              :loading="verifying"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<script>
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useQuasar } from "quasar";
import {
  scanForControllers,
  saveController,
  checkNetworkStatus,
  verifyController,
} from "src/services/controllerDiscovery";
import { useControllersStore } from "src/stores/controllersStore";

export default {
  name: "ControllerDiscovery",
  setup() {
    const router = useRouter();
    const $q = useQuasar();
    const controllersStore = useControllersStore();

    const scanning = ref(false);
    const scanCompleted = ref(false);
    const networkConnected = ref(true);
    const controllers = ref([]);
    const showManualEntry = ref(false);
    const manualIp = ref("");
    const verifying = ref(false);
    let discoveryInterval = null;

    const checkNetwork = async () => {
      const status = await checkNetworkStatus();
      networkConnected.value = status.connected;
      return status.connected;
    };

    // Ongoing background discovery
    const SCAN_TIMEOUT = 8000;
    const DISCOVERY_INTERVAL = 10000; // 10s between scans

    const startScan = async () => {
      if (!(await checkNetwork())) {
        return;
      }
      scanning.value = true;
      scanCompleted.value = false;
      controllers.value = [];
      await runDiscoveryLoop();
    };

    const runDiscoveryLoop = async () => {
      // Clear any previous interval
      if (discoveryInterval) {
        clearInterval(discoveryInterval);
      }

      // Initial scan
      await doDiscovery();

      // Set up interval for ongoing discovery
      discoveryInterval = setInterval(doDiscovery, DISCOVERY_INTERVAL);
    };

    const doDiscovery = async () => {
      try {
        const found = await scanForControllers({
          timeout: SCAN_TIMEOUT,
          onProgress: (progress) => {
            // Optionally handle progress
          },
        });
        // Merge: update controllers list reactively
        controllers.value = found;
        scanCompleted.value = true;
      } catch (error) {
        console.error("Scan error:", error);
        // Optionally notify user
      } finally {
        scanning.value = false;
      }
    };

    const selectController = async (controller) => {
      try {
        // Save to storage
        await saveController(controller);

        // Update controllers store
        controllersStore.setCurrentController({
          id: controller.ip_address,
          hostname: controller.hostname,
          ip_address: controller.ip_address,
          name: controller.name,
        });

        $q.notify({
          type: "positive",
          message: `Connected to ${controller.name}`,
          position: "top",
        });

        // Navigate to main app
        router.push("/");
      } catch (error) {
        console.error("Failed to select controller:", error);
        $q.notify({
          type: "negative",
          message: "Failed to connect to controller",
          position: "top",
        });
      }
    };

    const connectManual = async () => {
      if (!manualIp.value) {
        return;
      }

      verifying.value = true;

      try {
        const controller = await verifyController(
          {
            ip_address: manualIp.value,
          },
          5000,
        );

        if (controller) {
          await selectController(controller);
          showManualEntry.value = false;
        } else {
          $q.notify({
            type: "negative",
            message: "No controller found at this IP",
            position: "top",
          });
        }
      } catch (error) {
        console.error("Manual connection error:", error);
        $q.notify({
          type: "negative",
          message: "Failed to connect",
          position: "top",
        });
      } finally {
        verifying.value = false;
      }
    };

    onMounted(() => {
      checkNetwork();
      startScan();
    });

    onUnmounted(() => {
      if (discoveryInterval) {
        clearInterval(discoveryInterval);
      }
    });

    return {
      scanning,
      scanCompleted,
      networkConnected,
      controllers,
      showManualEntry,
      manualIp,
      verifying,
      startScan,
      selectController,
      connectManual,
    };
  },
};
</script>

<style lang="scss" scoped>
.discovery-page {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.discovery-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.controller-item {
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(0, 0, 0, 0.03);
  }
}

.body--dark {
  .discovery-container {
    background: #1e1e1e;
  }

  .controller-item:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
}
</style>
