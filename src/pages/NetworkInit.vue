<template>
  <div class="setup-wizard">
    <!-- Custom Wizard Header/Progress -->
    <div class="wizard-header q-mb-lg">
      <div class="text-h5 q-mb-md">Device Setup</div>

      <!-- Custom stepper implementation -->
      <div class="custom-stepper">
        <div class="step-indicators row items-center justify-between q-px-md">
          <!-- Step 1: Hostname -->
          <div
            class="step-indicator"
            :class="{ active: step === 1, completed: step > 1 }"
            @click="step > 1 ? (step = 1) : null"
          >
            <div class="step-icon">
              <svgIcon v-if="step > 1" name="check_outlined" />
              <svgIcon v-else name="badge_outlined" />
            </div>
            <div class="step-label">Hostname</div>
          </div>

          <!-- Step 2: Pin Configuration -->
          <div
            class="step-indicator"
            :class="{ active: step === 2, completed: step > 2 }"
            @click="step > 2 ? (step = 2) : null"
          >
            <div class="step-icon">
              <svgIcon v-if="step > 2" name="check_outlined" />
              <svgIcon v-else name="memory_outlined" />
            </div>
            <div class="step-label">Pin Config</div>
          </div>

          <!-- Step 3: WiFi Connection -->
          <div
            class="step-indicator"
            :class="{ active: step === 3, completed: step > 3 }"
            @click="step > 3 ? (step = 3) : null"
          >
            <div class="step-icon">
              <svgIcon v-if="step > 3" name="check_outlined" />
              <svgIcon v-else name="wifi_outlined" />
            </div>
            <div class="step-label">WiFi</div>
          </div>

          <!-- Step 4: Completion -->
          <div class="step-indicator" :class="{ active: step === 4 }">
            <div class="step-icon">
              <svgIcon name="check_outlined" />
            </div>
            <div class="step-label">Complete</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Wizard Content -->
    <q-card flat bordered class="wizard-content q-pa-md">
      <!-- Step 1: Hostname -->
      <div v-if="step === 1" class="q-pa-md">
        <div class="text-h6 q-mb-md">Set Device Hostname</div>
        <div class="text-subtitle2 q-mb-lg">
          Choose a unique name to identify this device on your network
        </div>

        <q-input
          v-model="hostname"
          label="Hostname"
          filled
          class="q-mb-md"
          :rules="[(val) => !!val || 'Hostname is required']"
        />

        <div class="text-caption q-mb-lg">
          The hostname will be used to access the device on your local network
        </div>
      </div>

      <!-- Step 2: Pin Configuration -->
      <div v-if="step === 2" class="q-pa-md">
        <div class="text-h6 q-mb-md">Configure Device Pins</div>
        <div class="text-subtitle2 q-mb-lg">
          Select a pin configuration for your
          {{ infoData.data.soc.toUpperCase() }} device
        </div>

        <mySelect
          v-model="currentPinConfigName"
          filled
          :options="pinConfigNames"
          label="Pin Configuration"
          class="q-mb-md"
          emit-value
          map-options
          @update:model-value="handlePinConfigChange"
        />

        <div v-if="socSpecificConfigs.length === 0" class="text-negative q-mt-md">
          No pin configurations available for
          {{ infoData.data.soc.toUpperCase() }} device. Please contact support.
        </div>

        <div v-else class="q-mt-md">
          <div class="text-subtitle2">Selected Configuration Details:</div>
          <q-list dense class="q-mt-sm">
            <q-item v-for="(channel, index) in currentPinConfig.channels" :key="index">
              <q-item-section>
                <div class="row items-center">
                  <div class="color-circle q-mr-md" :class="channel.name"></div>
                  <div class="text-capitalize">{{ channel.name }}:</div>
                  <div class="q-ml-md">Pin {{ channel.pin }}</div>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </div>

      <!-- Step 3: WiFi Configuration -->
      <div v-if="step === 3" class="q-pa-md">
        <div class="text-h6 q-mb-md">Connect to WiFi Network</div>
        <div class="text-subtitle2 q-mb-lg">
          Select your WiFi network from the list or enter details manually
        </div>

        <mySelect
          v-model="selectedNetwork"
          filled
          :options="networks"
          label="Select a network"
          option-label="ssid"
          option-value="ssid"
          class="q-mb-md"
        >
          <template #option="props">
            <q-item v-bind="props.itemProps">
              <q-item-section>
                {{ props.opt.ssid }}
              </q-item-section>
              <q-item-section avatar>
                <svgIcon :name="getSignalIcon(props.opt.signal, props.opt.encryption)" />
              </q-item-section>
            </q-item>
          </template>
        </mySelect>

        <q-input
          v-model="selectedNetwork.ssid"
          filled
          label="Network Name (SSID)"
          :disable="selectedNetwork && selectedNetwork.signal !== undefined"
          class="q-mb-md"
        />

        <q-input
          v-model="password"
          :type="isPwd ? 'password' : 'text'"
          filled
          label="Password"
          class="q-mb-md"
          :class="{ shake: wifiData.message === 'Wrong password' }"
        >
          <template #append>
            <svgIcon
              :name="isPwd ? 'visibility_off_outlined' : 'visibility-outlined-24'"
              class="cursor-pointer"
              @click="isPwd = !isPwd"
            />
          </template>
        </q-input>

        <div v-if="wifiData.message === 'Wrong password'" class="text-negative q-my-md">
          Password authentication failed, please try again.
        </div>
        <div v-if="wifiData.message === 'AP not found.'" class="text-negative q-my-md">
          Access point {{ wifiData.ssid }} could not be found, please try again.
        </div>
      </div>

      <!-- Step 4: Completion/Status -->
      <div v-if="step === 4" class="q-pa-md">
        <div class="text-h6 q-mb-md">Setup Complete</div>

        <div v-if="connecting" class="q-my-lg text-center">
          <q-spinner color="primary" size="3em" />
          <div class="q-mt-md">
            {{ wifiData.message || "Connecting to network..." }}
          </div>
        </div>

        <div v-else-if="wifiData.connected" class="q-my-lg">
          <svgIcon
            name="check_outlined_outlined_circle"
            color="positive"
            size="3em"
            class="q-mb-md block"
          />

          <div class="text-h6 text-positive q-mb-md">Connection Successful!</div>

          <q-list bordered separator>
            <q-item>
              <q-item-section>
                <q-item-label caption>Hostname</q-item-label>
                <q-item-label>{{ hostname }}</q-item-label>
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section>
                <q-item-label caption>Network</q-item-label>
                <q-item-label>{{ wifiData.ssid }}</q-item-label>
              </q-item-section>
            </q-item>

            <q-item clickable tag="a" :href="'http://' + wifiData.ip">
              <q-item-section>
                <q-item-label caption>IP Address</q-item-label>
                <q-item-label>{{ wifiData.ip }}</q-item-label>
              </q-item-section>
              <q-item-section avatar>
                <svgIcon name="open_in_new" />
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section>
                <q-item-label caption>Gateway</q-item-label>
                <q-item-label>{{ wifiData.gateway }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <div class="text-center q-mt-lg">
            <p>Your device will restart in {{ countdown }} seconds</p>
            <q-btn color="primary" label="Restart Now" @click="restartController" />
          </div>
        </div>

        <div v-else class="q-my-lg">
          <svgIcon name="error" color="negative" size="3em" class="q-mb-md block" />
          <div class="text-h6 text-negative q-mb-md">Connection Failed</div>
          <p>{{ wifiData.message || "Unable to connect to the network" }}</p>
          <q-btn color="primary" label="Try Again" @click="step = 3" class="q-mt-md" />
        </div>
      </div>

      <!-- Wizard Footer/Navigation -->
      <q-separator />
      <div class="row justify-between q-pa-md">
        <q-btn
          v-if="step > 1 && step < 4"
          outline
          color="primary"
          label="Back"
          @click="step--"
        />
        <div v-else></div>

        <q-btn
          v-if="step < 3"
          color="primary"
          label="Next"
          @click="goToNextStep"
          :disable="!canProceed"
        />
        <q-btn
          v-else-if="step === 3"
          color="primary"
          label="Connect"
          @click="finalizeSetup"
          :disable="!canConnectToWifi"
          :loading="connecting"
        />
        <div v-else></div>
      </div>
    </q-card>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from "vue";
import useWebSocket from "src/services/websocket";
import { useControllersStore } from "src/stores/controllersStore.js";
import { infoDataStore } from "src/stores/infoDataStore.js";
import { configDataStore } from "src/stores/configDataStore";
import { storeStatus } from "src/stores/storeConstants";
import systemCommand from "src/services/systemCommands.js";
import svgIcon from "src/components/svgIcon.vue";

export default {
  name: "NetworkSetupWizard",
  components: {
    svgIcon, // Local registration
  },
  setup() {
    // Controllers and data stores
    const controllers = useControllersStore();
    const infoData = infoDataStore();
    const configData = configDataStore();
    const ws = useWebSocket();

    // Wizard state
    const step = ref(1);
    const connecting = ref(false);
    const countdown = ref(10);

    // Step 1: Hostname
    const hostname = ref(configData.data.general.device_name || "");

    // Step 2: Pin Configuration
    const currentPinConfigName = ref(configData.data.general.current_pin_config_name);
    const pinConfigNames = ref([]);
    const currentPinConfig = ref({});

    // Step 3: WiFi Configuration
    const selectedNetwork = ref({ ssid: "", signal: 0, encryption: "" });
    const networks = ref([]);
    const password = ref("");
    const isPwd = ref(true);

    // Step 4: Status
    const wifiData = ref({
      connected: false,
      message: "",
      ssid: null,
      dhcp: null,
      ip: null,
      netmask: null,
      gateway: null,
      mac: null,
    });
    const log = ref([]);

    // Computed properties for validation
    const canProceed = computed(() => {
      if (step.value === 1) {
        return hostname.value && hostname.value.trim() !== "";
      } else if (step.value === 2) {
        return currentPinConfigName.value && socSpecificConfigs.value.length > 0;
      }
      return true;
    });

    const canConnectToWifi = computed(() => {
      return (
        selectedNetwork.value &&
        selectedNetwork.value.ssid &&
        selectedNetwork.value.ssid.trim() !== ""
      );
    });

    // Computed property for SOC-specific pin configs
    const socSpecificConfigs = computed(() => {
      return configData.data.hardware.pinconfigs.filter(
        (config) => config.soc.toLowerCase() === infoData.data.soc.toLowerCase()
      );
    });

    // Functions
    const goToNextStep = () => {
      if (step.value === 1) {
        // Save hostname
        configData.updateData("general.device_name", hostname.value);
      } else if (step.value === 2) {
        // Pin config is saved in handlePinConfigChange
      }
      step.value++;
    };

    const getPinConfigNames = () => {
      pinConfigNames.value = socSpecificConfigs.value.map((config) => ({
        label: config.name,
        value: config.name,
      }));

      // Set current pin config
      if (currentPinConfigName.value) {
        const config = socSpecificConfigs.value.find(
          (c) => c.name === currentPinConfigName.value
        );
        if (config) {
          currentPinConfig.value = config;
        }
      } else if (socSpecificConfigs.value.length > 0) {
        // Default to first config if none selected
        currentPinConfigName.value = socSpecificConfigs.value[0].name;
        currentPinConfig.value = socSpecificConfigs.value[0];
      }
    };

    const handlePinConfigChange = (newConfigName) => {
      const config = socSpecificConfigs.value.find((c) => c.name === newConfigName);

      if (config) {
        currentPinConfig.value = config;
        configData.updateData("general.channels", config.channels);
        configData.updateData("general.current_pin_config_name", newConfigName);
      }
    };

    const finalizeSetup = async () => {
      connecting.value = true;

      try {
        // Save hostname
        configData.updateData("general.device_name", hostname.value);

        // Connect to WiFi
        console.log("Connecting to network:", selectedNetwork.value.ssid);
        const new_ssid = selectedNetwork.value.ssid;
        const new_password = password.value;

        const response = await fetch(
          `http://${controllers.currentController.ip_address}/connect`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ssid: new_ssid,
              password: new_password,
            }),
          }
        );

        if (response.ok) {
          wifiData.value.message = "Connecting to network...";
          log.value.push("Connecting to network");
          step.value = 4; // Move to completion step
        } else {
          wifiData.value.message = "Failed to initiate connection";
          log.value.push("Failed to initiate connection");
        }
      } catch (error) {
        console.error("Connection error:", error);
        wifiData.value.message = `Connection error: ${error.message}`;
      } finally {
        setTimeout(() => {
          connecting.value = false;
        }, 3000);
      }
    };

    const restartController = () => {
      systemCommand.restartController();
    };

    const getSignalIcon = (signalStrength, encryption) => {
      switch (encryption) {
        case "WPA":
        case "WPA2_PSK":
        case "WPA_WPA2_PSK": {
          if (signalStrength >= -50) {
            return "network_wifi_locked_FILL0_wght400_GRAD0_opsz24";
          } else if (signalStrength >= -65) {
            return "network_wifi_3_bar_locked_FILL0_wght400_GRAD0_opsz24";
          } else if (signalStrength >= -750) {
            return "network_wifi_2_bar_locked_FILL0_wght400_GRAD0_opsz24";
          } else if (signalStrength >= -90) {
            return "network_wifi_1_bar_locked_FILL0_wght400_GRAD0_opsz24";
          } else {
            return "signal_wifi_statusbar_null_FILL0_wght400_GRAD0_opsz24";
          }
        }
        default: {
          if (signalStrength >= -50) {
            return "network_wifi_FILL0_wght400_GRAD0_opsz24";
          } else if (signalStrength >= -65) {
            return "network_wifi_3_bar_FILL0_wght400_GRAD0_opsz24";
          } else if (signalStrength >= -750) {
            return "network_wifi_2_bar_FILL0_wght400_GRAD0_opsz24";
          } else if (signalStrength >= -90) {
            return "network_wifi_1_bar_FILL0_wght400_GRAD0_opsz24";
          } else {
            return "signal_wifi_statusbar_null_FILL0_wght400_GRAD0_opsz24";
          }
        }
      }
    };

    const fetchNetworks = async () => {
      try {
        if (controllers.currentController.ip_address) {
          console.log("Fetching networks");
          const response = await fetch(
            `http://${controllers.currentController.ip_address}/networks`,
            { method: "GET" }
          );
          const responseJson = await response.json();
          responseJson.available.sort((a, b) => b.signal - a.signal);
          networks.value = responseJson["available"];

          // Initiate another scan
          await fetch(
            `http://${controllers.currentController.ip_address}/scan_networks`,
            { method: "POST" }
          );
        }
      } catch (error) {
        console.error("Error fetching networks:", error);
      }
    };

    const registerWebSocketCallback = () => {
      ws.onJson("wifi_status", (params) => {
        console.log("Websocket wifi_status:", params);
        wifiData.value.connected = params.station.connected;
        wifiData.value.ssid = params.station.ssid;
        wifiData.value.dhcp = params.station.dhcp;
        wifiData.value.ip = params.station.ip;
        wifiData.value.netmask = params.station.netmask;
        wifiData.value.gateway = params.station.gateway;
        wifiData.value.mac = params.station.mac;
        wifiData.value.message = params.message;

        if (wifiData.value.connected && step.value === 4) {
          startCountdown();
        }
      });
    };

    const startCountdown = () => {
      countdown.value = 10;
      const timer = setInterval(() => {
        countdown.value--;
        if (countdown.value <= 0) {
          clearInterval(timer);
          restartController();
        }
      }, 1000);
    };

    // Initialize on mount
    onMounted(() => {
      fetchNetworks();
      registerWebSocketCallback();
      getPinConfigNames();

      // Set initial wifi data if available
      if (infoData.storeStatus === storeStatus.LOADED) {
        wifiData.value.connected = infoData.data.connection.connected;
        wifiData.value.ssid = infoData.data.connection.ssid;
        wifiData.value.ip = infoData.data.connection.ip;
        wifiData.value.netmask = infoData.data.connection.netmask;
        wifiData.value.gateway = infoData.data.connection.gateway;
      }
    });

    // Watch for SOC changes
    watch(
      () => infoData.data.soc,
      () => {
        if (infoData.data.soc) {
          getPinConfigNames();
        }
      }
    );

    // Watch for successful WiFi connection
    watch(
      () => wifiData.value.message,
      (newVal, oldVal) => {
        if (oldVal === "Connecting to WiFi" && newVal === "Connected to WiFi") {
          console.log("Connected to network, stopping access point");
        }
      }
    );

    return {
      // Wizard state
      step,
      connecting,
      countdown,

      // Step 1: Hostname
      hostname,

      // Step 2: Pin Configuration
      currentPinConfigName,
      pinConfigNames,
      currentPinConfig,
      socSpecificConfigs,
      infoData,

      // Step 3: WiFi Configuration
      selectedNetwork,
      networks,
      password,
      isPwd,

      // Step 4: Status
      wifiData,
      log,

      // Computed properties
      canProceed,
      canConnectToWifi,

      // Methods
      goToNextStep,
      getPinConfigNames,
      handlePinConfigChange,
      finalizeSetup,
      restartController,
      getSignalIcon,
    };
  },
};
</script>

<style scoped>
.wizard-content {
  max-width: 600px;
  margin: 0 auto;
}

.wizard-header {
  max-width: 600px;
  margin: 0 auto;
}

/* Custom stepper styles */
.custom-stepper {
  width: 100%;
}

.step-indicators {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.step-indicators::after {
  content: "";
  position: absolute;
  top: 17px;
  left: 20%;
  right: 20%;
  height: 2px;
  background: #e0e0e0;
  z-index: 0;
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1;
  cursor: pointer;
}

.step-icon {
  width: 35px;
  height: 35px;
  border-radius: 50%;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #e0e0e0;
  margin-bottom: 8px;
}

.step-indicator.active .step-icon {
  border-color: var(--q-primary);
  color: var(--q-primary);
}

.step-indicator.completed .step-icon {
  background: var(--q-primary);
  border-color: var(--q-primary);
  color: white;
}

.step-label {
  font-size: 0.8rem;
  color: #666;
}

.step-indicator.active .step-label {
  color: var(--q-primary);
  font-weight: 600;
}

.step-indicator.completed .step-label {
  color: var(--q-primary);
}

/* Pin configuration colors */
.color-circle {
  width: 18px;
  height: 18px;
  border-radius: 50%;
}

.color-circle.red {
  background-color: red;
}
.color-circle.green {
  background-color: green;
}
.color-circle.blue {
  background-color: blue;
}
.color-circle.warmwhite {
  background-color: yellow;
}
.color-circle.coldwhite {
  background-color: white;
  border: 1px solid #ccc;
}

/* Animation for password error */
.shake {
  animation: shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  perspective: 1000px;
}

@keyframes shake {
  10%,
  90% {
    transform: translate3d(-1px, 0, 0);
  }
  20%,
  80% {
    transform: translate3d(2px, 0, 0);
  }
  30%,
  50%,
  70% {
    transform: translate3d(-4px, 0, 0);
  }
  40%,
  60% {
    transform: translate3d(4px, 0, 0);
  }
}

/* Responsive adjustments */
@media (max-width: 599px) {
  .step-label {
    font-size: 0.7rem;
  }

  .step-indicators::after {
    left: 15%;
    right: 15%;
  }
}
</style>
