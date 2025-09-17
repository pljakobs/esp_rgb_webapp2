<template>
  <div class="setup-wizard">
    <!-- Custom Wizard Header/Progress -->
    <div class="wizard-header q-mb-lg">
      <div class="text-h5 q-mb-md">Device Setup</div>
      <div class="custom-stepper">
        <div class="step-indicators row items-center justify-between q-px-md">
          <!-- Step 1: Hostname -->
          <div
            class="step-indicator"
            :class="{ active: step === 1, completed: step > 1 }"
            @click="step > 1 ? (step = 1) : null"
          >
            <div class="step-icon">
              <svgIcon name="badge_outlined" />
              <svgIcon
                v-if="step > 1"
                name="check_outlined"
                class="step-check-overlay"
              />
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
              <svgIcon name="memory_outlined" />
              <svgIcon
                v-if="step > 2"
                name="check_outlined"
                class="step-check-overlay"
              />
            </div>
            <div class="step-label">Pin Config</div>
          </div>
          <!-- Step 3: Color Model -->
          <div
            class="step-indicator"
            :class="{ active: step === 3, completed: step > 3 }"
            @click="step > 3 ? (step = 3) : null"
          >
            <div class="step-icon">
              <svgIcon name="palette_outlined" />
              <svgIcon
                v-if="step > 3"
                name="check_outlined"
                class="step-check-overlay"
              />
            </div>
            <div class="step-label">Color Model</div>
          </div>
          <!-- Step 4: WiFi Connection -->
          <div
            class="step-indicator"
            :class="{ active: step === 4, completed: step > 4 }"
            @click="step > 4 ? (step = 4) : null"
          >
            <div class="step-icon">
              <svgIcon name="wifi_outlined" />
              <svgIcon
                v-if="step > 4"
                name="check_outlined"
                class="step-check-overlay"
              />
            </div>
            <div class="step-label">WiFi</div>
          </div>
          <!-- Step 5: Completion -->
          <div class="step-indicator" :class="{ active: step === 5 }">
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
          @blur="trimHostname"
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
        <div v-if="socSpecificConfigs.length === 0" class="q-mt-md">
          <q-banner class="text-warning bg-warning-light q-mb-md" rounded>
            <template #avatar>
              <svgIcon name="info_outlined" />
            </template>
            <div class="text-subtitle2">No Default Pin Configuration Available</div>
            <div class="text-body2 q-mt-sm">
              No pre-configured pin layouts are available for your {{ infoData.data.soc.toUpperCase() }} device.
              You can continue with the setup and configure the pins manually in the main interface later.
            </div>
          </q-banner>
          <div class="text-caption text-grey-7">
            Pin configuration can be set up after completing the initial setup process.
          </div>
        </div>
        <div v-else>
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
          <div class="q-mt-md">
            <div class="text-subtitle2">Selected Configuration Details:</div>
            <q-list dense class="q-mt-sm">
              <q-item
                v-for="(channel, index) in currentPinConfig.channels"
                :key="index"
              >
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
      </div>

      <!-- Step 3: Color Model -->
      <div v-if="step === 3" class="q-pa-md">
        <div class="text-h6 q-mb-md">Configure Color Model</div>
        <div class="text-subtitle2 q-mb-lg">
          Select the color model and adjust color channels
        </div>
        <mySelect
          v-model="colorModel"
          :options="colorOptions"
          label="Color Model"
          style="width: 200px"
          class="q-mb-md"
          @update:model-value="emitColorModel"
        />
        <div>
          <ColorSlider
            v-for="colorSlider in colorSliders"
            :key="colorSlider.label"
            :min="colorSlider.min"
            :max="colorSlider.max"
            :label="colorSlider.label"
            :value="getColorSliderValue(colorSlider.model)"
            :color="colorSlider.color"
            @update:model="updateColorSlider(colorSlider.model, $event)"
          />
        </div>
      </div>

      <!-- Step 4: WiFi Configuration -->
      <div v-if="step === 4" class="q-pa-md">
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
                <svgIcon
                  :name="getSignalIcon(props.opt.signal, props.opt.encryption)"
                />
              </q-item-section>
            </q-item>
          </template>
        </mySelect>
        <q-input
          v-model="selectedNetwork.ssid"
          filled
          label="Network Name (SSID)"
          :disable="false"
          class="q-mb-md"
          @blur="trimNetworkName"
        />
        <q-input
          v-model="password"
          :type="isPwd ? 'password' : 'text'"
          filled
          label="Password"
          class="q-mb-md"
          :class="{ shake: wifiData.message === 'Wrong password' }"
          @blur="trimPassword"
        >
          <template #append>
            <svgIcon
              :name="
                isPwd ? 'visibility_off_outlined' : 'visibility-outlined-24'
              "
              class="cursor-pointer"
              @click="isPwd = !isPwd"
            />
          </template>
        </q-input>
        <div
          v-if="wifiData.message === 'Wrong password'"
          class="text-negative q-my-md"
        >
          Password authentication failed, please try again.
        </div>
        <div
          v-if="wifiData.message === 'AP not found.'"
          class="text-negative q-my-md"
        >
          Access point {{ wifiData.ssid }} could not be found, please try again.
        </div>
      </div>

      <!-- Step 5: Completion/Status -->
      <div v-if="step === 5" class="q-pa-md">
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
          <div class="text-h6 text-positive q-mb-md">
            Connection Successful!
          </div>
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
            <q-btn
              color="primary"
              label="Restart Now"
              @click="restartController"
            />
          </div>
        </div>
        <div v-else class="q-my-lg">
          <svgIcon
            name="error"
            color="negative"
            size="3em"
            class="q-mb-md block"
          />
          <div class="text-h6 text-negative q-mb-md">Connection Failed</div>
          <p>{{ wifiData.message || "Unable to connect to the network" }}</p>
          <q-btn
            color="primary"
            label="Try Again"
            @click="step = 4"
            class="q-mt-md"
          />
        </div>
      </div>

      <!-- Wizard Footer/Navigation -->
      <q-separator />
      <div class="row justify-between q-pa-md">
        <q-btn
          v-if="step > 1 && step < 5"
          outline
          color="primary"
          label="Back"
          @click="step--"
        />
        <div v-else></div>
        <q-btn
          v-if="step < 4"
          color="primary"
          label="Next"
          @click="goToNextStep"
          :disable="!canProceed"
        />
        <q-btn
          v-else-if="step === 4"
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
import ColorSlider from "src/components/ColorSlider.vue";

export default {
  name: "NetworkSetupWizard",
  components: { svgIcon, ColorSlider },
  setup() {
    const controllers = useControllersStore();
    const infoData = infoDataStore();
    const configData = configDataStore();
    const ws = useWebSocket();

    const step = ref(1);
    const connecting = ref(false);
    const countdown = ref(10);

    // Hostname
    const hostname = ref(configData.data.general.device_name || "");

    // Pin config
    const currentPinConfigName = ref(
      configData.data.general.current_pin_config_name,
    );
    const pinConfigNames = ref([]);
    const currentPinConfig = ref({});
    const socSpecificConfigs = computed(() =>
      configData.data.hardware.pinconfigs.filter(
        (config) =>
          config.soc.toLowerCase() === infoData.data.soc.toLowerCase(),
      ),
    );

    // Color model
    const defaultColorOptions = ["RGB", "RGBWW", "RGBCW", "RGBWWCW"];
    const colorOptions = ref([]);
    const colorModel = ref("");
    const colorSliders = computed(() => {
      const sliders = [
        {
          label: "Red",
          model: "color.brightness.red",
          min: 0,
          max: 100,
          color: "red",
        },
        {
          label: "Green",
          model: "color.brightness.green",
          min: 0,
          max: 100,
          color: "green",
        },
        {
          label: "Blue",
          model: "color.brightness.blue",
          min: 0,
          max: 100,
          color: "blue",
        },
      ];
      if (colorModel.value === "RGBWW" || colorModel.value === "RGBWWCW") {
        sliders.push({
          label: "Warm White",
          model: "color.brightness.ww",
          min: 0,
          max: 100,
          color: "yellow",
        });
      }
      if (colorModel.value === "RGBCW" || colorModel.value === "RGBWWCW") {
        sliders.push({
          label: "Cold White",
          model: "color.brightness.cw",
          min: 0,
          max: 100,
          color: "cyan",
        });
      }
      return sliders;
    });
    const getColorSliderValue = (model) => {
      return model.split(".").reduce((o, i) => o[i], configData.data);
    };
    const updateColorSlider = (model, value) => {
      configData.updateData(model, value);
    };
    const emitColorModel = (newColorModel) => {
      colorModel.value = newColorModel;
    };

    // WiFi
    const selectedNetwork = ref({ ssid: "", signal: 0, encryption: "" });
    const networks = ref([]);
    const password = ref("");
    const isPwd = ref(true);

    // Status
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

    // Input trimming helpers
    const trimHostname = () => {
      if (hostname.value) {
        hostname.value = hostname.value.trim();
      }
    };
    const trimNetworkName = () => {
      if (selectedNetwork.value.ssid) {
        selectedNetwork.value.ssid = selectedNetwork.value.ssid.trim();
      }
    };
    const trimPassword = () => {
      if (password.value) {
        password.value = password.value.trim();
      }
    };

    // Validation
    const canProceed = computed(() => {
      if (step.value === 1) {
        return hostname.value && hostname.value.trim() !== "";
      } else if (step.value === 2) {
        // Allow proceeding even if no pin configs are available
        return true;
      } else if (step.value === 3) {
        return colorModel.value && colorOptions.value.length > 0;
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

    // Step navigation
    const goToNextStep = () => {
      step.value++;
    };

    // Pin config helpers
    const getPinConfigNames = () => {
      pinConfigNames.value = socSpecificConfigs.value.map((config) => ({
        label: config.name,
        value: config.name,
      }));
      if (currentPinConfigName.value) {
        const config = socSpecificConfigs.value.find(
          (c) => c.name === currentPinConfigName.value,
        );
        if (config) currentPinConfig.value = config;
      } else if (socSpecificConfigs.value.length > 0) {
        currentPinConfigName.value = socSpecificConfigs.value[0].name;
        currentPinConfig.value = socSpecificConfigs.value[0];
      }
    };
    const handlePinConfigChange = (newConfigName) => {
      const config = socSpecificConfigs.value.find(
        (c) => c.name === newConfigName,
      );
      if (config) currentPinConfig.value = config;
    };

    // WiFi helpers
    const getSignalIcon = (signalStrength, encryption) => {
      switch (encryption) {
        case "WPA":
        case "WPA2_PSK":
        case "WPA_WPA2_PSK":
          if (signalStrength >= -50)
            return "network_wifi_locked_FILL0_wght400_GRAD0_opsz24";
          if (signalStrength >= -65)
            return "network_wifi_3_bar_locked_FILL0_wght400_GRAD0_opsz24";
          if (signalStrength >= -75)
            return "network_wifi_2_bar_locked_FILL0_wght400_GRAD0_opsz24";
          if (signalStrength >= -90)
            return "network_wifi_1_bar_locked_FILL0_wght400_GRAD0_opsz24";
          return "signal_wifi_statusbar_null_FILL0_wght400_GRAD0_opsz24";
        default:
          if (signalStrength >= -50)
            return "network_wifi_FILL0_wght400_GRAD0_opsz24";
          if (signalStrength >= -65)
            return "network_wifi_3_bar_FILL0_wght400_GRAD0_opsz24";
          if (signalStrength >= -75)
            return "network_wifi_2_bar_FILL0_wght400_GRAD0_opsz24";
          if (signalStrength >= -90)
            return "network_wifi_1_bar_FILL0_wght400_GRAD0_opsz24";
          return "signal_wifi_statusbar_null_FILL0_wght400_GRAD0_opsz24";
      }
    };
    const fetchNetworks = async () => {
      try {
        if (controllers.currentController.ip_address) {
          const response = await fetch(
            `http://${controllers.currentController.ip_address}/networks`,
            { method: "GET" },
          );
          const responseJson = await response.json();
          responseJson.available.sort((a, b) => b.signal - a.signal);
          networks.value = responseJson["available"];
          await fetch(
            `http://${controllers.currentController.ip_address}/scan_networks`,
            { method: "POST" },
          );
        }
      } catch (error) {
        console.error("Error fetching networks:", error);
      }
    };

    // Finalize setup: WiFi, then config, then color model
    const finalizeSetup = async () => {
      connecting.value = true;
      try {
        // 1. Connect to WiFi
        const response = await fetch(
          `http://${controllers.currentController.ip_address}/connect`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ssid: selectedNetwork.value.ssid,
              password: password.value,
            }),
          },
        );
        if (response.ok) {
          wifiData.value.message = "Connecting to network...";
          log.value.push("Connecting to network");
          step.value = 5;
        } else {
          wifiData.value.message = "Failed to initiate connection";
          log.value.push("Failed to initiate connection");
          connecting.value = false;
          // Stay on WiFi step
          step.value = 4;
          return;
        }

        // 2. Wait for WiFi connection (poll or use websocket)
        let connected = false;
        for (let i = 0; i < 20; i++) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          if (wifiData.value.connected) {
            connected = true;
            break;
          }
        }

        // 3. Send config data (hostname & pin config) after WiFi is up
        if (connected) {
          configData.updateData("general.device_name", hostname.value);
          // Only update pin config if one is selected
          if (currentPinConfigName.value && currentPinConfig.value.channels) {
            configData.updateData(
              "general.current_pin_config_name",
              currentPinConfigName.value,
            );
            configData.updateData(
              "general.channels",
              currentPinConfig.value.channels,
            );
          }
          // Send color model here
          const modelIndex = colorOptions.value.indexOf(colorModel.value);
          configData.updateData("color.outputmode", modelIndex);
        } else {
          // WiFi never connected, go back to WiFi step
          wifiData.value.message =
            "Unable to connect to the network. Please try again.";
          step.value = 4;
          connecting.value = false;
          return;
        }
      } catch (error) {
        wifiData.value.message = `Connection error: ${error.message}`;
        step.value = 4;
      } finally {
        setTimeout(() => {
          connecting.value = false;
        }, 3000);
      }
    };

    // Poll the new IP after reboot and redirect when reachable
    const pollNewIpAndRedirect = (ip) => {
      let attempts = 0;
      const maxAttempts = 30;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(`http://${ip}/api/ping`, { method: "GET" });
          if (res.ok) {
            clearInterval(interval);
            window.location.href = `http://${ip}`;
          }
        } catch (e) {}
        if (attempts >= maxAttempts) {
          clearInterval(interval);
        }
      }, 1000);
    };

    const restartController = () => {
      systemCommand.restartController();
    };

    // Countdown and redirect after reboot
    const startCountdown = () => {
      countdown.value = 10;
      const timer = setInterval(() => {
        countdown.value--;
        if (countdown.value <= 0) {
          clearInterval(timer);
          restartController();
          if (wifiData.value.ip) {
            pollNewIpAndRedirect(wifiData.value.ip);
          }
        }
      }, 1000);
    };

    // Websocket for wifi status
    const registerWebSocketCallback = () => {
      ws.onJson("wifi_status", (params) => {
        wifiData.value.connected = params.station.connected;
        wifiData.value.ssid = params.station.ssid;
        wifiData.value.dhcp = params.station.dhcp;
        wifiData.value.ip = params.station.ip;
        wifiData.value.netmask = params.station.netmask;
        wifiData.value.gateway = params.station.gateway;
        wifiData.value.mac = params.station.mac;
        wifiData.value.message = params.message;
        if (wifiData.value.connected && step.value === 5) startCountdown();
      });
    };

    // Initial setup
    onMounted(() => {
      fetchNetworks();
      registerWebSocketCallback();
      getPinConfigNames();
      // Color model options
      colorOptions.value =
        configData.data.general?.supported_color_models?.length > 0
          ? configData.data.general.supported_color_models
          : defaultColorOptions;
      const colorModelIndex = configData.data.color.color_mode;
      if (colorModelIndex >= 0 && colorModelIndex < colorOptions.value.length) {
        colorModel.value = colorOptions.value[colorModelIndex];
      } else {
        colorModel.value = colorOptions.value[0];
      }
      // WiFi status
      if (infoData.storeStatus === storeStatus.LOADED) {
        wifiData.value.connected = infoData.data.connection.connected;
        wifiData.value.ssid = infoData.data.connection.ssid;
        wifiData.value.ip = infoData.data.connection.ip;
        wifiData.value.netmask = infoData.data.connection.netmask;
        wifiData.value.gateway = infoData.data.connection.gateway;
        if (wifiData.value.connected && wifiData.value.ssid) {
          selectedNetwork.value.ssid = wifiData.value.ssid;
        }
      }
    });

    watch(
      () => infoData.data.soc,
      () => {
        if (infoData.data.soc) getPinConfigNames();
      },
    );
    watch(
      () => wifiData.value.ssid,
      (newSsid) => {
        if (wifiData.value.connected && newSsid) {
          selectedNetwork.value.ssid = newSsid;
        }
      },
    );

    // Watchers for automatic whitespace trimming
    watch(
      () => hostname.value,
      () => {
        if (hostname.value && hostname.value !== hostname.value.trim()) {
          hostname.value = hostname.value.trim();
        }
      },
    );
    watch(
      () => selectedNetwork.value.ssid,
      () => {
        if (selectedNetwork.value.ssid && selectedNetwork.value.ssid !== selectedNetwork.value.ssid.trim()) {
          selectedNetwork.value.ssid = selectedNetwork.value.ssid.trim();
        }
      },
    );
    watch(
      () => password.value,
      () => {
        if (password.value && password.value !== password.value.trim()) {
          password.value = password.value.trim();
        }
      },
    );

    return {
      step,
      connecting,
      countdown,
      hostname,
      currentPinConfigName,
      pinConfigNames,
      currentPinConfig,
      socSpecificConfigs,
      infoData,
      selectedNetwork,
      networks,
      password,
      isPwd,
      wifiData,
      log,
      canProceed,
      canConnectToWifi,
      goToNextStep,
      getPinConfigNames,
      handlePinConfigChange,
      finalizeSetup,
      restartController,
      getSignalIcon,
      colorModel,
      colorOptions,
      colorSliders,
      getColorSliderValue,
      updateColorSlider,
      emitColorModel,
      trimHostname,
      trimNetworkName,
      trimPassword,
    };
  },
};
</script>

<style scoped>
.step-indicator {
  position: relative;
  display: inline-block;
}

.step-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.step-overlay .q-icon {
  color: #4caf50;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  padding: 2px;
}
</style>
