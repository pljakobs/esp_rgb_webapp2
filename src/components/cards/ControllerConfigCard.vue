<template>
  <MyCard title="Controller config" icon="memory_outlined">
    <q-card-section>
      <div class="text-caption q-mb-md text-orange">
        Controller configuration changes require a restart to take effect. Make
        your changes and click "Apply and Restart" to save and restart the
        controller.
      </div>

      <!-- Pin Configuration Section -->
      <div class="text-h6 q-mb-md">Pin Configuration</div>
      <div class="row items-center q-mb-md">
        <mySelect
          v-model="localCurrentPinConfigName"
          class="custom-select col-6"
          :options="pinConfigNames"
          label="Pin configuration"
          emit-value
          map-options
        />
        <div class="col-6 q-pl-md">
          <q-btn
            color="primary"
            flat
            dense
            round
            @click="editCurrentConfig"
            :disable="!localCurrentPinConfigName"
            title="Edit current configuration"
          >
            <svgIcon name="edit" />
          </q-btn>
          <q-btn
            color="primary"
            flat
            dense
            round
            @click="showAddConfigDialog"
            title="Add new configuration"
          >
            <svgIcon name="add_circle" />
          </q-btn>
        </div>
      </div>

      <q-toggle v-model="showPinDetails" label="Show Pin Details" />
      <data-table v-if="showPinDetails" :items="formattedPinConfigData" />

      <!-- PWM Configuration Section (only for non-ESP8266) -->
      <div
        v-if="
          infoData.data.soc && infoData.data.soc.toLowerCase() !== 'esp8266'
        "
      >
        <q-separator class="q-my-lg" />
        <div class="text-h6 q-mb-md">PWM Configuration</div>

        <!-- Timer Settings -->
        <q-expansion-item
          label="Timer Settings"
          default-opened
          header-class="text-subtitle1"
          expand-icon-class="hidden"
        >
          <template #header="{ expanded }">
            <q-item-section avatar>
              <svgIcon name="timer" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-subtitle1">Timer Settings</q-item-label>
            </q-item-section>
            <q-item-section side>
              <svgIcon
                name="arrow_drop_down"
                :class="{ 'rotate-icon': !expanded }"
              />
            </q-item-section>
          </template>

          <div class="q-pa-md">
            <div class="row q-gutter-md">
              <div class="col-12 col-md-4">
                <mySelect
                  v-model="pwmSpeedMode"
                  :options="speedModeOptions"
                  label="Speed Mode"
                  emit-value
                  map-options
                />
                <q-tooltip class="custom-tooltip">
                  Only the ESP32 supports high speed mode
                </q-tooltip>
              </div>
              <div class="col-12 col-md-4">
                <mySelect
                  v-model="pwmTimerNumber"
                  :options="timerNumberOptions"
                  label="Timer Number"
                  emit-value
                  map-options
                />
                <q-tooltip class="custom-tooltip">
                  Select which hardware timer to use for PWM generation. Each
                  timer can be configured independently. This may be used in the
                  future if the firmware supports multiple virtual lights.
                </q-tooltip>
              </div>
              <div class="col-12 col-md-4">
                <q-input
                  v-model.number="pwmFrequency"
                  type="number"
                  label="Frequency (Hz)"
                >
                  <q-tooltip class="custom-tooltip">
                    Select the PWM base frequency. This controls how fast your
                    LEDs will "flicker". ESP32 hardware (all types) support
                    values in the kHz range. Depending on your spreadSpectrum
                    settings, higher values may lead to sluggish response from
                    the controller due to higher load.
                  </q-tooltip>
                </q-input>
              </div>
              <div class="col-12 col-md-4">
                <q-input
                  v-model.number="pwmResolution"
                  type="number"
                  label="Resolution Bits"
                  :min="1"
                  :max="16"
                >
                  <q-tooltip class="custom-tooltip">
                    Select the number of bits used for PWM resolution. Higher
                    values allow for finer control of the PWM signal. Note that
                    higher resolution may limit the maximum achievable
                    frequency. The default for this firmware is 10bits for 1024
                    distinct levels. More is not really necessary.
                  </q-tooltip>
                </q-input>
              </div>
            </div>
          </div>
        </q-expansion-item>

        <!-- Spread Spectrum Settings -->
        <q-expansion-item
          label="Spread Spectrum Settings"
          header-class="text-subtitle1"
          expand-icon-class="hidden"
        >
          <template #header="{ expanded }">
            <q-item-section avatar>
              <svgIcon name="blur" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-subtitle1"
                >Spread Spectrum Settings</q-item-label
              >
            </q-item-section>
            <q-item-section side>
              <svgIcon
                name="arrow_drop_down"
                :class="{ 'rotate-icon': !expanded }"
              />
            </q-item-section>
          </template>

          <div class="q-pa-md">
            <div class="row q-gutter-md">
              <div class="col-12 col-md-4">
                <mySelect
                  v-model="pwmSpreadSpectrumMode"
                  :options="spreadSpectrumModeOptions"
                  label="Spread Spectrum Mode"
                  emit-value
                  map-options
                />
                <q-tooltip class="custom-tooltip">
                  Spread spectrum reduces EMI (electromagnetic interference) by
                  slightly varying the PWM frequency over time. leave this "ON"
                  to enable this feature. Switching this to "off" will have a
                  negative effect on EMI emissions, especially with longer LED
                  strips. This could lead to radio interference and especially
                  to noise on the 12V power lines which may act as antennas. In
                  extreme cases, it might even lead to the controller being
                  unstable.
                </q-tooltip>
              </div>
              <div class="col-12 col-md-4">
                <q-input
                  v-model.number="pwmSpreadSpectrumWidth"
                  type="number"
                  label="Width (%)"
                  :min="0"
                  :max="100"
                  :disable="pwmSpreadSpectrumMode === 'off'"
                >
                  <q-tooltip class="custom-tooltip">
                    This controls the width of the spread spectrum modulation.
                    The frequency will be smeared out by this many percent above
                    and below the PWM center frequency.
                  </q-tooltip>
                </q-input>
              </div>
              <div class="col-12 col-md-4">
                <q-input
                  v-model.number="pwmSpreadSpectrumSubsampling"
                  type="number"
                  label="Subsampling"
                  :min="1"
                  :disable="pwmSpreadSpectrumMode === 'off'"
                >
                  <q-tooltip class="custom-tooltip">
                    This controls how often the PWM frequency hops around. The
                    value is in base frequency cycles, so let's say your base
                    frequency is set at 4kHz (4000Hz) and you set subsampling to
                    4, the frequency will change every 4 cycles or every 1ms.
                    Higher values lead to less frequent changes. Lower values
                    will create more interrupts and therefore are more CPU
                    intensive. This value influences the quality of the spread
                    spectrum effect: the longer the PWM frequency stays the
                    same, the more energy will be emitted at that frequency,
                    potentially defeating the purpose of spread spectrum.
                    Something between 1 and 8 is a good start.
                  </q-tooltip>
                </q-input>
              </div>
            </div>
          </div>
        </q-expansion-item>

        <!-- Phase Shift Settings -->
        <q-expansion-item
          label="Phase Shift Settings"
          header-class="text-subtitle1"
          expand-icon-class="hidden"
        >
          <template #header="{ expanded }">
            <q-item-section avatar>
              <svgIcon name="swap_horiz" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-subtitle1"
                >Phase Shift Settings</q-item-label
              >
            </q-item-section>
            <q-item-section side>
              <svgIcon
                name="arrow_drop_down"
                :class="{ 'rotate-icon': !expanded }"
              />
            </q-item-section>
          </template>

          <div class="q-pa-md">
            <div class="row">
              <div class="col-12 col-md-4">
                <mySelect
                  v-model="pwmPhaseShiftMode"
                  :options="phaseShiftModeOptions"
                  label="Phase Shift Mode"
                  emit-value
                  map-options
                />
                <q-tooltip class="custom-tooltip">
                  Phase shifting delays the phase between the three, four or
                  five LED channels and thus helps distribute switching noise
                  across different time intervals, reducing peak EMI. If you
                  have long LED strips and all channels switch on at the same
                  time, you potentially switch 10s of A on the 12V line in that
                  instance, creating a lot of noise and, depending on wire
                  length, a decent voltage dip. Setting Phase Shift to "ON"
                  distributes the switching time for the configured channels
                  equally along the PWM cycle type (1/freq) without impacting
                  the color quality.
                </q-tooltip>
              </div>
            </div>
          </div>
        </q-expansion-item>
      </div>

      <!-- Universal Action Buttons -->
      <q-separator class="q-my-lg" />
      <div class="row justify-between items-center">
        <div class="col">
          <q-btn
            v-if="hasAnyChanges"
            color="orange"
            label="Reset All Changes"
            @click="resetAllChanges"
            class="q-mr-sm"
          >
            <svgIcon name="refresh" />
          </q-btn>
        </div>
        <div class="col-auto">
          <q-btn
            color="primary"
            label="Apply and Restart"
            :disable="!hasAnyChanges"
            @click="applyAllAndRestart"
          >
            <svgIcon name="restart_alt" />
          </q-btn>
        </div>
      </div>
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, onMounted, computed, watch } from "vue";
import { useQuasar, Dialog } from "quasar";
import { configDataStore } from "src/stores/configDataStore";
import { infoDataStore } from "src/stores/infoDataStore";
import MyCard from "src/components/myCard.vue";
import DataTable from "src/components/dataTable.vue";
import PinConfigDialog from "src/components/Dialogs/pinConfigDialog.vue";
import systemCommand from "src/services/systemCommands.js";

export default {
  name: "ControllerConfigCard",
  components: {
    MyCard,
    DataTable,
  },
  setup() {
    const $q = useQuasar();
    const configData = configDataStore();
    const infoData = infoDataStore();
    const pinConfigData = ref([]);
    const showPinDetails = ref(false);
    const pinConfigNames = ref([]);
    const availablePins = ref([]);
    const remotePinConfigs = ref([]);

    // Helper function to show notifications with SVG icons
    const showNotification = (type, iconName, message, timeout = 3000) => {
      $q.notify({
        type,
        html: true,
        message: `<div class="row items-center q-gutter-sm no-wrap">
          <svgIcon name="${iconName}" class="text-${type} q-mr-sm" style="font-size: 20px;"></svgIcon>
          <span>${message}</span>
        </div>`,
        timeout,
      });
    };

    // Store original values for all settings
    const originalValues = {
      pinConfigName: configData.data.general.current_pin_config_name,
      // PWM values with safe defaults - using correct schema property names
      pwmSpeedMode:
        configData.data.hardware?.pwm?.timer?.speed_mode || "low_speed",
      pwmFrequency: configData.data.hardware?.pwm?.timer?.frequency || 1000,
      pwmResolution: configData.data.hardware?.pwm?.timer?.resolution || 10,
      pwmTimerNumber: configData.data.hardware?.pwm?.timer?.number || 0,
      pwmSpreadSpectrumMode:
        configData.data.hardware?.pwm?.spreadSpectrum?.mode || "ON",
      pwmSpreadSpectrumWidth:
        configData.data.hardware?.pwm?.spreadSpectrum?.width || 15,
      pwmSpreadSpectrumSubsampling:
        configData.data.hardware?.pwm?.spreadSpectrum?.subsampling || 4,
      pwmPhaseShiftMode:
        configData.data.hardware?.pwm?.phaseShift?.mode || "ON",
    };

    // Local reactive values (not immediately applied to store)
    const localCurrentPinConfigName = ref(originalValues.pinConfigName);
    const pwmSpeedMode = ref(originalValues.pwmSpeedMode);
    const pwmFrequency = ref(originalValues.pwmFrequency);
    const pwmResolution = ref(originalValues.pwmResolution);
    const pwmTimerNumber = ref(originalValues.pwmTimerNumber);
    const pwmSpreadSpectrumMode = ref(originalValues.pwmSpreadSpectrumMode);
    const pwmSpreadSpectrumWidth = ref(originalValues.pwmSpreadSpectrumWidth);
    const pwmSpreadSpectrumSubsampling = ref(
      originalValues.pwmSpreadSpectrumSubsampling,
    );
    const pwmPhaseShiftMode = ref(originalValues.pwmPhaseShiftMode);

    // Flag to track when active pin config content has been modified
    const activePinConfigModified = ref(false);

    // Check if there are any changes
    const hasAnyChanges = computed(() => {
      const pinConfigChanged =
        localCurrentPinConfigName.value !== originalValues.pinConfigName ||
        activePinConfigModified.value;

      // Only check PWM changes if PWM is supported
      const isPwmSupported =
        infoData.data.soc && infoData.data.soc.toLowerCase() !== "esp8266";
      const pwmChanged =
        isPwmSupported &&
        (pwmSpeedMode.value !== originalValues.pwmSpeedMode ||
          pwmFrequency.value !== originalValues.pwmFrequency ||
          pwmResolution.value !== originalValues.pwmResolution ||
          pwmTimerNumber.value !== originalValues.pwmTimerNumber ||
          pwmSpreadSpectrumMode.value !==
            originalValues.pwmSpreadSpectrumMode ||
          pwmSpreadSpectrumWidth.value !==
            originalValues.pwmSpreadSpectrumWidth ||
          pwmSpreadSpectrumSubsampling.value !==
            originalValues.pwmSpreadSpectrumSubsampling ||
          pwmPhaseShiftMode.value !== originalValues.pwmPhaseShiftMode);

      return pinConfigChanged || pwmChanged;
    });

    // PWM Options
    const speedModeOptions = computed(() => {
      const options = [{ label: "Low Speed", value: "low_speed" }];

      // Only add High Speed option for ESP32 (exactly)
      if (infoData.data.soc && infoData.data.soc.toLowerCase() === "esp32") {
        options.push({ label: "High Speed", value: "high_speed" });
      }

      return options;
    });

    const timerNumberOptions = [
      { label: "Timer 0", value: 0 },
      { label: "Timer 1", value: 1 },
      { label: "Timer 2", value: 2 },
      { label: "Timer 3", value: 3 },
    ];

    const spreadSpectrumModeOptions = [
      { label: "Off", value: "OFF" },
      { label: "On", value: "ON" },
    ];

    const phaseShiftModeOptions = [
      { label: "Off", value: "OFF" },
      { label: "On", value: "ON" },
    ];

    // Reset all changes
    const resetAllChanges = () => {
      localCurrentPinConfigName.value = originalValues.pinConfigName;
      pwmSpeedMode.value = originalValues.pwmSpeedMode;
      pwmFrequency.value = originalValues.pwmFrequency;
      pwmResolution.value = originalValues.pwmResolution;
      pwmTimerNumber.value = originalValues.pwmTimerNumber;
      pwmSpreadSpectrumMode.value = originalValues.pwmSpreadSpectrumMode;
      pwmSpreadSpectrumWidth.value = originalValues.pwmSpreadSpectrumWidth;
      pwmSpreadSpectrumSubsampling.value =
        originalValues.pwmSpreadSpectrumSubsampling;
      pwmPhaseShiftMode.value = originalValues.pwmPhaseShiftMode;
      activePinConfigModified.value = false;
    };

    // Apply all changes and restart
    // Apply all changes and restart - ATOMIC VERSION
    const applyAllAndRestart = async () => {
      const updates = {};

      // Prepare pin configuration changes
      if (localCurrentPinConfigName.value !== originalValues.pinConfigName) {
        const currentConfig = socSpecificConfigs.value.find(
          (config) => config.name === localCurrentPinConfigName.value,
        );

        if (currentConfig) {
          updates["general.channels"] = currentConfig.channels;
          updates["general.current_pin_config_name"] =
            localCurrentPinConfigName.value;

          if (
            currentConfig.clearPin !== undefined &&
            currentConfig.clearPin !== -1
          ) {
            updates["general.clear_pin"] = currentConfig.clearPin;
          }
        }
      }

      // Prepare PWM configuration changes (only if supported)
      const isPwmSupported =
        infoData.data.soc && infoData.data.soc.toLowerCase() !== "esp8266";
      if (isPwmSupported) {
        // Only add PWM updates if values have changed
        if (pwmSpeedMode.value !== originalValues.pwmSpeedMode) {
          updates["hardware.pwm.timer.speed_mode"] = pwmSpeedMode.value;
        }
        if (pwmFrequency.value !== originalValues.pwmFrequency) {
          updates["hardware.pwm.timer.frequency"] = pwmFrequency.value;
        }
        if (pwmResolution.value !== originalValues.pwmResolution) {
          updates["hardware.pwm.timer.resolution"] = pwmResolution.value;
        }
        if (pwmTimerNumber.value !== originalValues.pwmTimerNumber) {
          updates["hardware.pwm.timer.number"] = pwmTimerNumber.value;
        }
        if (
          pwmSpreadSpectrumMode.value !== originalValues.pwmSpreadSpectrumMode
        ) {
          updates["hardware.pwm.spreadSpectrum.mode"] =
            pwmSpreadSpectrumMode.value;
        }
        if (
          pwmSpreadSpectrumWidth.value !== originalValues.pwmSpreadSpectrumWidth
        ) {
          updates["hardware.pwm.spreadSpectrum.width"] =
            pwmSpreadSpectrumWidth.value;
        }
        if (
          pwmSpreadSpectrumSubsampling.value !==
          originalValues.pwmSpreadSpectrumSubsampling
        ) {
          updates["hardware.pwm.spreadSpectrum.subsampling"] =
            pwmSpreadSpectrumSubsampling.value;
        }
        if (pwmPhaseShiftMode.value !== originalValues.pwmPhaseShiftMode) {
          updates["hardware.pwm.phaseShift.mode"] = pwmPhaseShiftMode.value;
        }
      }

      // Apply all updates atomically
      if (Object.keys(updates).length > 0) {
        // Use atomic update if available, otherwise fall back to individual updates
        if (configData.updateMultipleData) {
          configData.updateMultipleData(updates, true);
        } else {
          // Fallback to individual updates for backward compatibility
          Object.entries(updates).forEach(([path, value]) => {
            configData.updateData(path, value, true);
          });
        }

        // Update original values to reflect the new state
        Object.assign(originalValues, {
          pinConfigName: localCurrentPinConfigName.value,
          pwmSpeedMode: pwmSpeedMode.value,
          pwmFrequency: pwmFrequency.value,
          pwmResolution: pwmResolution.value,
          pwmTimerNumber: pwmTimerNumber.value,
          pwmSpreadSpectrumMode: pwmSpreadSpectrumMode.value,
          pwmSpreadSpectrumWidth: pwmSpreadSpectrumWidth.value,
          pwmSpreadSpectrumSubsampling: pwmSpreadSpectrumSubsampling.value,
          pwmPhaseShiftMode: pwmPhaseShiftMode.value,
        });

        showNotification(
          "positive",
          "check_circle",
          "Controller configuration updated. Controller is restarting...",
          3000,
        );

        // Reset the flag since changes have been applied
        activePinConfigModified.value = false;

        // Actually restart the controller
        try {
          await systemCommand.restartController();
        } catch (error) {
          console.error("Error restarting controller:", error);
          showNotification(
            "negative",
            "error",
            "Failed to restart controller. Please restart manually.",
            5000,
          );
        }
      } else {
        showNotification("info", "info", "No changes to apply", 2000);
      }
    };

    // --- New Pin Config Logic ---
    // Fetch remote pin configs and available pins from pin_config_url
    const fetchRemotePinConfigs = async () => {
      remotePinConfigs.value = [];
      const url = configData.data.general.pin_config_url;
      if (!url) return;
      try {
        const response = await fetch(url);
        const json = await response.json();
        if (Array.isArray(json.pinconfigs)) {
          remotePinConfigs.value = json.pinconfigs;
        }
        // Also update available_pins if present
        if (Array.isArray(json.available_pins)) {
          configData.updateData("hardware.available_pins", json.available_pins);
        }
      } catch (e) {
        console.error("Failed to fetch remote pin configs:", e);
      }
    };

    // Merge local and remote, filter for SoC, avoid duplicates
    const compatiblePinConfigs = computed(() => {
      const soc = infoData.data.soc?.toLowerCase() || "";
      const local = configData.data.hardware.pinconfigs || [];
      const remote = remotePinConfigs.value || [];
      // Merge, remote first if not in local
      const merged = [
        ...local,
        ...remote.filter((rc) => !local.some((lc) => lc.name === rc.name)),
      ];
      // Debug output
      console.log("[PinConfig Debug] SoC:", soc);
      console.log("[PinConfig Debug] Merged pin configs:", merged);
      const filtered = merged.filter((cfg) => cfg.soc?.toLowerCase() === soc);
      console.log(
        "[PinConfig Debug] Filtered compatible pin configs:",
        filtered,
      );
      return filtered;
    });

    const getPinConfigNames = () => {
      pinConfigNames.value = compatiblePinConfigs.value.map((cfg) => cfg.name);
    };

    const getCurrentPinConfig = () => {
      const isSocCompatible = compatiblePinConfigs.value.some(
        (config) => config.name === localCurrentPinConfigName.value,
      );
      if (!isSocCompatible && compatiblePinConfigs.value.length > 0) {
        localCurrentPinConfigName.value = compatiblePinConfigs.value[0].name;
        showNotification(
          "warning",
          "warning",
          `Selected pin configuration not compatible with ${infoData.data.soc}. Switching to a compatible configuration.`,
          3000,
        );
      }
      const currentConfig = compatiblePinConfigs.value.find(
        (config) => config.name === localCurrentPinConfigName.value,
      );
      if (currentConfig) {
        pinConfigData.value = currentConfig.channels;
      } else if (compatiblePinConfigs.value.length > 0) {
        localCurrentPinConfigName.value = compatiblePinConfigs.value[0].name;
        pinConfigData.value = compatiblePinConfigs.value[0].channels;
      } else {
        pinConfigData.value = [];
      }
    };

    // When user selects a config, add to local if from remote
    const onPinConfigSelected = (name) => {
      const selected = compatiblePinConfigs.value.find(
        (cfg) => cfg.name === name,
      );
      if (
        selected &&
        !configData.data.hardware.pinconfigs.some((cfg) => cfg.name === name)
      ) {
        // Add to local store
        configData.updateData("hardware.pinconfigs", [
          ...configData.data.hardware.pinconfigs,
          selected,
        ]);
      }
      configData.updateData("general.current_pin_config_name", name);
      localCurrentPinConfigName.value = name;
      getCurrentPinConfig();
    };

    const loadAvailablePins = () => {
      const socPins = configData.data.hardware.available_pins.find(
        (pinConfig) =>
          pinConfig.soc.toLowerCase() === infoData.data.soc.toLowerCase(),
      );
      if (socPins) {
        availablePins.value = socPins.pins.map((pin) => ({
          label: `Pin ${pin}`,
          value: pin,
        }));
      } else {
        availablePins.value = [];
      }
    };

    // Load both local and remote pin configs on mount
    const loadPinConfigData = async () => {
      await fetchRemotePinConfigs();
      getPinConfigNames();
      getCurrentPinConfig();
      loadAvailablePins();
      // If no compatible pin configs, prompt to add one
      if (compatiblePinConfigs.value.length === 0) {
        showNotification(
          "warning",
          "warning",
          `No pin configuration found for ${infoData.data.soc}. Please add one for this architecture.`,
          4000,
        );
        showAddConfigDialog();
      }
    };

    const showAddConfigDialog = () => {
      Dialog.create({
        component: PinConfigDialog,
        componentProps: {
          mode: "add",
          availablePins: availablePins.value,
          soc: infoData.data.soc,
        },
      }).onOk((newConfig) => {
        configData.updateData("hardware.pinconfigs", [
          ...configData.data.hardware.pinconfigs,
          newConfig,
        ]);

        // Set the new config as the current one
        configData.updateData(
          "general.current_pin_config_name",
          newConfig.name,
        );
        localCurrentPinConfigName.value = newConfig.name;
        getPinConfigNames();
        getCurrentPinConfig();

        showNotification(
          "positive",
          "check_circle",
          `Pin configuration "${newConfig.name}" created and selected`,
        );
      });
    };

    const editCurrentConfig = () => {
      const currentConfig = socSpecificConfigs.value.find(
        (config) => config.name === localCurrentPinConfigName.value,
      );

      if (!currentConfig) {
        showNotification("negative", "error", "No configuration selected");
        return;
      }
      if (
        currentConfig.clearPin === undefined &&
        configData.data.general.clear_pin !== undefined
      ) {
        currentConfig.clearPin = configData.data.general.clear_pin;
      }

      Dialog.create({
        component: PinConfigDialog,
        componentProps: {
          mode: "edit",
          existingConfig: currentConfig,
          availablePins: availablePins.value,
          soc: infoData.data.soc,
        },
      }).onOk((updatedConfig) => {
        const configs = configData.data.hardware.pinconfigs;
        const index = configs.findIndex(
          (c) => c.name === localCurrentPinConfigName.value,
        );

        if (index !== -1) {
          configs[index] = updatedConfig;

          // Update the stored pin configurations
          configData.updateData("hardware.pinconfigs", configs);

          // Since this is the currently active pin config, also update the active configuration
          configData.updateData("general.channels", updatedConfig.channels);
          configData.updateData(
            "general.current_pin_config_name",
            updatedConfig.name,
          );

          if (
            updatedConfig.clearPin !== undefined &&
            updatedConfig.clearPin !== null
          ) {
            configData.updateData("general.clear_pin", updatedConfig.clearPin);
          }

          // Mark that the active pin config has been modified (requires restart)
          activePinConfigModified.value = true;

          if (updatedConfig.name !== localCurrentPinConfigName.value) {
            localCurrentPinConfigName.value = updatedConfig.name;
            getPinConfigNames();
          }

          getCurrentPinConfig();

          showNotification(
            "positive",
            "check_circle",
            `Pin configuration "${updatedConfig.name}" updated and applied`,
          );
        }
      });
    };

    const formattedPinConfigData = computed(() => {
      return pinConfigData.value.map((channel) => ({
        label: channel.name,
        value: channel.pin,
      }));
    });

    onMounted(() => {
      loadPinConfigData();
    });

    watch(showPinDetails, (newVal) => {
      if (newVal) {
        getCurrentPinConfig();
      }
    });

    watch(
      () => infoData.data.soc,
      () => {
        if (infoData.data.soc) {
          getPinConfigNames();
          getCurrentPinConfig();
          loadAvailablePins();

          // Reset speed mode to low_speed if current SoC doesn't support high speed
          if (
            infoData.data.soc.toLowerCase() !== "esp32" &&
            pwmSpeedMode.value === "high_speed"
          ) {
            pwmSpeedMode.value = "low_speed";
          }
        }
      },
    );

    return {
      infoData,
      // Local values
      localCurrentPinConfigName,
      pwmSpeedMode,
      pwmFrequency,
      pwmResolution,
      pwmTimerNumber,
      pwmSpreadSpectrumMode,
      pwmSpreadSpectrumWidth,
      pwmSpreadSpectrumSubsampling,
      pwmPhaseShiftMode,
      // Computed
      hasAnyChanges,
      // Options
      speedModeOptions,
      timerNumberOptions,
      spreadSpectrumModeOptions,
      phaseShiftModeOptions,
      // Functions
      resetAllChanges,
      applyAllAndRestart,
      // Pin config
      pinConfigNames,
      showPinDetails,
      formattedPinConfigData,
      showAddConfigDialog,
      editCurrentConfig,
      compatiblePinConfigs,
      getCurrentPinConfig,
      getPinConfigNames,
      loadPinConfigData,
      onPinConfigSelected,
    };
  },
};
</script>

<style scoped>
.rotate-icon {
  transform: rotate(-90deg);
  transition: transform 0.3s ease;
}

.hidden {
  display: none !important;
}
</style>
<style>
.custom-tooltip {
  max-width: 250px;
  font-size: 14px;
  font-weight: 500; /* Makes text slightly bolder */
  line-height: 1.4; /* Improves readability */
  padding: 8px 12px; /* Adds more internal spacing */
}
</style>
