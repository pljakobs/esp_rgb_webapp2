<template>
  <div class="setup-wizard">
    <!-- Custom Wizard Header/Progress -->
    <div class="wizard-header q-mb-lg">
      <div class="text-h5 q-mb-md">{{ $t('setup.deviceSetup') }}</div>
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
            <div class="step-label">{{ $t('setup.steps.hostname') }}</div>
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
            <div class="step-label">{{ $t('setup.steps.pinConfig') }}</div>
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
            <div class="step-label">{{ $t('setup.steps.colorModel') }}</div>
          </div>
          <!-- Step 4: Telemetry -->
          <div
            class="step-indicator"
            :class="{ active: step === 4, completed: step > 4 }"
            @click="step > 4 ? (step = 4) : null"
          >
            <div class="step-icon">
              <svgIcon name="telemetry" />
              <svgIcon
                v-if="step > 4"
                name="check_outlined"
                class="step-check-overlay"
              />
            </div>
            <div class="step-label">{{ $t('setup.steps.telemetry') }}</div>
          </div>
          <!-- Step 5: Completion -->
          <div class="step-indicator" :class="{ active: step === 5 }">
            <div class="step-icon">
              <svgIcon name="check_outlined" />
            </div>
            <div class="step-label">{{ $t('setup.steps.complete') }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Wizard Content -->
    <q-card flat bordered class="wizard-content q-pa-md">
      <!-- Step 1: Hostname -->
      <div v-if="step === 1" class="q-pa-md">
        <div class="text-h6 q-mb-md">{{ $t('setup.hostnameStep.title') }}</div>
        <div class="text-subtitle2 q-mb-lg">
          {{ $t('setup.hostnameStep.subtitle') }}
        </div>
        <q-input
          v-model="hostname"
          :label="$t('setup.hostnameStep.label')"
          filled
          class="q-mb-md"
          :rules="[(val) => !!val || $t('setup.hostnameStep.required')]"
          @blur="trimHostname"
        />
        <div class="text-caption q-mb-lg">
          {{ $t('setup.hostnameStep.hint') }}
        </div>
      </div>

      <!-- Step 2: Pin Configuration -->
      <div v-if="step === 2" class="q-pa-md">
        <div class="text-h6 q-mb-md">{{ $t('setup.pinConfigStep.title') }}</div>
        <div class="text-subtitle2 q-mb-lg">
          {{ $t('setup.pinConfigStep.subtitle', { soc: infoData.data.device?.soc?.toUpperCase() }) }}
        </div>
        <div v-if="socSpecificConfigs.length === 0" class="q-mt-md">
          <q-banner class="text-warning bg-warning-light q-mb-md" rounded>
            <template #avatar>
              <svgIcon name="info_outlined" />
            </template>
            <div class="text-subtitle2">
              {{ $t('setup.pinConfigStep.noConfigTitle') }}
            </div>
            <div class="text-body2 q-mt-sm">
              {{ $t('setup.pinConfigStep.noConfigBody', { soc: infoData.data.device?.soc?.toUpperCase() }) }}
            </div>
          </q-banner>
          <div class="text-caption text-grey-7">
            {{ $t('setup.pinConfigStep.noConfigCaption') }}
          </div>
        </div>
        <div v-else>
          <mySelect
            v-model="currentPinConfigName"
            filled
            :options="pinConfigNames"
            :label="$t('setup.pinConfigStep.pinConfigLabel')"
            class="q-mb-md"
            emit-value
            map-options
            @update:model-value="handlePinConfigChange"
          />
          <div class="q-mt-md">
            <div class="text-subtitle2">{{ $t('setup.pinConfigStep.selectedConfigDetails') }}</div>
            <q-list dense class="q-mt-sm">
              <q-item
                v-for="(channel, index) in currentPinConfig.channels"
                :key="index"
              >
                <q-item-section>
                  <div class="row items-center">
                    <div
                      class="color-circle q-mr-md"
                      :class="channel.name"
                    ></div>
                    <div class="text-capitalize">{{ channel.name }}:</div>
                    <div class="q-ml-md">{{ $t('setup.pinConfigStep.pin', { number: channel.pin }) }}</div>
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </div>
      </div>

      <!-- Step 3: Color Model -->
      <div v-if="step === 3" class="q-pa-md">
        <div class="text-h6 q-mb-md">{{ $t('setup.colorModelStep.title') }}</div>
        <div class="text-subtitle2 q-mb-lg">
          {{ $t('setup.colorModelStep.subtitle') }}
        </div>
        <mySelect
          v-model="colorModel"
          :options="colorOptions"
          :label="$t('setup.colorModelStep.colorModelLabel')"
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

      <!-- Step 4: Telemetry -->
      <div v-if="step === 4" class="q-pa-md">
        <div class="text-h6 q-mb-md">{{ $t('setup.telemetryStep.title') }}</div>

        <div class="text-subtitle2 q-mb-sm">{{ $t('setup.telemetryStep.statsTitle') }}</div>
        <div class="text-body2 q-mb-md text-grey-7">
          {{ $t('setup.telemetryStep.statsBody') }}
        </div>
        <q-btn-toggle
          v-model="statsEnabled"
          class="q-mb-lg"
          :options="[
            { label: $t('common.yes'), value: true },
            { label: $t('common.no'), value: false },
          ]"
        />

        <div class="text-subtitle2 q-mb-sm">{{ $t('setup.telemetryStep.logTitle') }}</div>
        <div class="text-body2 q-mb-md text-grey-7">
          {{ $t('setup.telemetryStep.logBody') }}
        </div>
        <q-btn-toggle
          v-model="logEnabled"
          class="q-mb-lg"
          :options="[
            { label: $t('common.yes'), value: true },
            { label: $t('common.no'), value: false },
          ]"
        />

        <div class="text-caption q-mt-md">
          {{ $t('setup.telemetryStep.changeNote') }}
        </div>
        <div class="q-mt-md">
          <q-btn
            :label="detailsButtonLabel"
            @click="toggleDetails"
            flat
            color="primary"
          />
          <div v-if="showDetails">
            <div>
              {{ $t('setup.telemetryStep.dataNote') }}
              <q-scroll-area style="height: 200px">
                <q-table
                  :rows="telemetryDataRows"
                  :columns="telemetryDataColumns"
                  row-key="col1"
                  flat
                  bordered
                  wrap-cells
                  :hide-bottom="true"
                  :pagination="{
                    rowsPerPage: telemetryDataRows.length,
                    page: 1,
                    sortBy: null,
                    descending: false,
                  }"
                />
              </q-scroll-area>
            </div>
          </div>
        </div>
      </div>



      <!-- Step 5: Completion -->
      <div v-if="step === 5" class="q-pa-md">
        <div class="text-h6 q-mb-md">{{ $t('setup.completeStep.title') }}</div>
        <q-list bordered separator class="q-mb-lg">
          <q-item>
            <q-item-section>
              <q-item-label caption>{{ $t('setup.completeStep.hostname') }}</q-item-label>
              <q-item-label>{{ hostname }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="currentPinConfigName">
            <q-item-section>
              <q-item-label caption>{{ $t('setup.completeStep.pinConfiguration') }}</q-item-label>
              <q-item-label>{{ currentPinConfigName }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>{{ $t('setup.completeStep.colorModel') }}</q-item-label>
              <q-item-label>{{ colorModel }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <div v-if="needsRestart" class="text-center q-mt-lg">
          <q-spinner color="primary" size="3em" />
          <div class="q-mt-md">{{ $t('setup.completeStep.restarting') }}</div>
          <div class="q-mt-sm text-grey-7">{{ $t('setup.completeStep.reconnecting', { seconds: countdown }) }}</div>
        </div>
        <div v-else class="text-center q-mt-lg">
          <svgIcon
            name="check_outlined_outlined_circle"
            color="positive"
            size="3em"
            class="q-mb-md block"
          />
          <div class="text-h6 text-positive q-mb-md">{{ $t('setup.completeStep.saved') }}</div>
          <q-btn color="primary" :label="$t('setup.completeStep.goToDashboard')" @click="router.push('/')" />
        </div>
      </div>

      <!-- Wizard Footer/Navigation -->
      <q-separator />
      <div class="row justify-between q-pa-md">
        <q-btn
          v-if="step > 1 && step < 5"
          outline
          color="primary"
          :label="$t('common.back')"
          @click="step--"
        />
        <div v-else></div>
        <q-btn
          v-if="step < 4"
          color="primary"
          :label="$t('common.next')"
          @click="goToNextStep"
          :disable="!canProceed"
        />
        <q-btn
          v-else-if="step === 4"
          color="primary"
          :label="$t('common.finish')"
          @click="finalizeSetup"
          :loading="connecting"
        />
        <div v-else></div>
      </div>
    </q-card>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useControllersStore } from "src/stores/controllersStore.js";
import { infoDataStore } from "src/stores/infoDataStore.js";
import { configDataStore } from "src/stores/configDataStore";
import svgIcon from "src/components/svgIcon.vue";
import ColorSlider from "src/components/ColorSlider.vue";
import { getTelemetryData } from "src/stores/telemetryData.js";

export default {
  name: "NetworkSetupWizard",
  components: { svgIcon, ColorSlider },
  setup() {
    const { t } = useI18n();
    const telemetryDataColumns = computed(
      () => getTelemetryData(t).telemetryDataColumns,
    );
    const telemetryDataRows = computed(() => getTelemetryData(t).telemetryDataRows);
    const controllers = useControllersStore();
    const infoData = infoDataStore();
    const configData = configDataStore();
    const router = useRouter();

    const step = ref(1);
    const connecting = ref(false);
    const countdown = ref(10);
    const coerceTelemetryEnabled = (value, fallback = false) => {
      if (typeof value === "boolean") {
        return value;
      }
      if (value === "ON") {
        return true;
      }
      if (value === "OFF") {
        return false;
      }
      return fallback;
    };

    // Hostname
    const hostname = ref(configData.data.general.device_name || "");

    // Telemetry Stats
    const statsEnabled = computed({
      get: () =>
        coerceTelemetryEnabled(
          configData.data.network?.telemetry?.statsEnabled,
        ),
      set: (value) => {
        configData.updateData("network.telemetry.statsEnabled", Boolean(value));
      },
    });

    // Telemetry Logs
    const logEnabled = computed({
      get: () =>
        coerceTelemetryEnabled(configData.data.network?.telemetry?.logEnabled),
      set: (value) => {
        configData.updateData("network.telemetry.logEnabled", Boolean(value));
      },
    });

    // Telemetry details
    const showDetails = ref(false);
    const detailsButtonLabel = computed(() =>
      showDetails.value ? t('setup.telemetryStep.hideDetails') : t('setup.telemetryStep.showDetails'),
    );
    const toggleDetails = () => {
      showDetails.value = !showDetails.value;
    };
    const isDebug = computed(() => infoData.data?.app?.build_type === "debug");

    // Pin config
    const currentPinConfigName = ref(
      configData.data.general.current_pin_config_name,
    );
    const pinConfigNames = ref([]);
    const currentPinConfig = ref({});
    const socSpecificConfigs = computed(() =>
      configData.data.hardware.pinconfigs.filter(
        (config) =>
          config.soc.toLowerCase() === infoData.data.device?.soc?.toLowerCase(),
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

    // Track original values to detect restartable changes
    const originalPinConfigName = ref(
      configData.data.general.current_pin_config_name || "",
    );
    const needsRestart = ref(false);
    const setupDone = ref(false);

    // Input trimming helpers
    const trimHostname = () => {
      if (hostname.value) {
        hostname.value = hostname.value.trim();
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
      } else if (step.value === 4) {
        return true; // Telemetry step can always proceed
      }
      return true;
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

    // WiFi signal icon helper kept for backward compat but no longer used in template
    const getSignalIcon = () => null;

    // Save all wizard config and transition to completion step
    const finalizeSetup = async () => {
      connecting.value = true;
      try {
        // Save hostname
        await configData.updateData("general.device_name", hostname.value, true);

        // Save pin config if one is selected
        if (currentPinConfigName.value && currentPinConfig.value.channels) {
          await configData.updateData(
            "general.current_pin_config_name",
            currentPinConfigName.value,
            true,
          );
          await configData.updateData(
            "general.channels",
            currentPinConfig.value.channels,
            true,
          );
        }

        // Save color model
        const modelIndex = colorOptions.value.indexOf(colorModel.value);
        await configData.updateData("color.outputmode", modelIndex, true);

        // Pin config change triggers firmware restart automatically
        needsRestart.value =
          originalPinConfigName.value !== currentPinConfigName.value;

        setupDone.value = true;
        step.value = 5;

        if (needsRestart.value) {
          startCountdown();
        }
      } catch (error) {
        console.error("Setup error:", error);
      } finally {
        connecting.value = false;
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
      import("src/services/systemCommands.js").then((m) =>
        m.default.restartController(),
      );
    };

    // Countdown then poll for reconnect (firmware restart triggered by pin config change)
    const startCountdown = () => {
      countdown.value = 15;
      const timer = setInterval(() => {
        countdown.value--;
        if (countdown.value <= 0) {
          clearInterval(timer);
          const currentIp = controllers.currentController?.ip_address;
          if (currentIp) {
            pollNewIpAndRedirect(currentIp);
          } else {
            window.location.href = "/";
          }
        }
      }, 1000);
    };

    // Initial setup
    onMounted(() => {
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
    });

    watch(
      () => infoData.data.device?.soc,
      () => {
        if (infoData.data.device?.soc) getPinConfigNames();
      },
    );

    // Trim hostname whitespace automatically
    watch(
      () => hostname.value,
      () => {
        if (hostname.value && hostname.value !== hostname.value.trim()) {
          hostname.value = hostname.value.trim();
        }
      },
    );

    return {
      router,
      step,
      connecting,
      countdown,
      hostname,
      currentPinConfigName,
      pinConfigNames,
      currentPinConfig,
      socSpecificConfigs,
      infoData,
      canProceed,
      goToNextStep,
      getPinConfigNames,
      handlePinConfigChange,
      finalizeSetup,
      getSignalIcon,
      colorModel,
      colorOptions,
      colorSliders,
      getColorSliderValue,
      updateColorSlider,
      emitColorModel,
      trimHostname,
      statsEnabled,
      logEnabled,
      showDetails,
      detailsButtonLabel,
      toggleDetails,
      telemetryDataColumns,
      telemetryDataRows,
      isDebug,
      needsRestart,
      setupDone,
    };
  },
};
</script>

<style scoped>
.step-indicator {
  position: relative;
  display: inline-block;
}

.step-check-overlay {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  color: #4caf50;
  background-color: white;
  border-radius: 50%;
  border: 1px solid #4caf50;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  pointer-events: none;
  z-index: 1;
}

.step-icon {
  position: relative;
  display: inline-block;
  width: 24px;
  height: 24px;
}
</style>
