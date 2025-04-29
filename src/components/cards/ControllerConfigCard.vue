<template>
  <MyCard title="Controller config" icon="memory_outlined">
    <q-card-section>
      <div class="row items-center q-mb-md">
        <mySelect
          v-model="currentPinConfigName"
          class="custom-select col-6"
          :options="pinConfigNames"
          label="Pin configuration"
          emit-value
          map-options
          @update:model-value="handlePinConfigChange"
        >
        </mySelect>
        <div class="col-6 q-pl-md">
          <q-btn
            color="primary"
            flat
            dense
            round
            @click="editCurrentConfig"
            :disable="!currentPinConfigName"
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

      <q-toggle v-model="showDetails" label="Show Details" />
      <data-table v-if="showDetails" :items="formattedPinConfigData" />
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
    const currentPinConfigName = ref(
      configData.data.general.current_pin_config_name,
    );
    const showDetails = ref(false);
    const pinConfigNames = ref([]);
    const availablePins = ref([]);

    // Add a computed property for SOC-specific configs
    const socSpecificConfigs = computed(() => {
      return configData.data.hardware.pinconfigs.filter(
        (config) =>
          config.soc.toLowerCase() === infoData.data.soc.toLowerCase(),
      );
    });

    const getPinConfigNames = () => {
      // Use the computed property instead of filtering again
      pinConfigNames.value = socSpecificConfigs.value.map(
        (config) => config.name,
      );
    };

    const getCurrentPinConfig = () => {
      // First check if the current config is compatible with this SOC
      const isSocCompatible = socSpecificConfigs.value.some(
        (config) => config.name === currentPinConfigName.value,
      );

      if (!isSocCompatible && socSpecificConfigs.value.length > 0) {
        // Current config is not compatible, select the first compatible one
        currentPinConfigName.value = socSpecificConfigs.value[0].name;
        $q.notify({
          type: "warning",
          message: `Selected pin configuration not compatible with ${infoData.data.soc}. Switching to a compatible configuration.`,
          timeout: 3000,
        });
      }

      const currentConfig = socSpecificConfigs.value.find(
        (config) => config.name === currentPinConfigName.value,
      );

      if (currentConfig) {
        pinConfigData.value = currentConfig.channels;
        if (
          currentConfig.clearPin !== undefined &&
          currentConfig.clearPin !== -1
        ) {
          console.log("Updating clear pin:", currentConfig.clearPin);
          configData.updateData("general.clear_pin", currentConfig.clearPin);
        }
      } else if (socSpecificConfigs.value.length > 0) {
        // Fallback to first compatible config if current one not found
        currentPinConfigName.value = socSpecificConfigs.value[0].name;
        pinConfigData.value = socSpecificConfigs.value[0].channels;
      } else {
        pinConfigData.value = [];
      }
    };

    const handlePinConfigChange = (newConfigName) => {
      currentPinConfigName.value = newConfigName;
      getCurrentPinConfig();
      updatePinConfig();
    };

    const updatePinConfig = async () => {
      const currentConfig = socSpecificConfigs.value.find(
        (config) => config.name === currentPinConfigName.value,
      );

      if (currentConfig) {
        configData.updateData("general.channels", currentConfig.channels);
        configData.updateData(
          "general.current_pin_config_name",
          currentPinConfigName.value,
        );
        if (
          currentConfig.clearPin !== undefined &&
          currentConfig.clearPin !== -1
        ) {
          console.log("Updating clear pin:", currentConfig.clearPin);
          configData.updateData("general.clear_pin", currentConfig.clearPin);
        }
      }
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

    const loadPinConfigData = async () => {
      console.log("loading pinConfigData");
      try {
        const owner = "pljakobs";
        const repo = "esp_rgb_webapp2";
        const path = "public/config/pinconfig.json";
        const branch = "devel";

        /*
         * use the Github API to fetch newer pinconfig.json file - this avoids CORS issues
         * and allows us to fetch the file directly from the repo
         * this allows us to just update the pinconfig in the repo and make the new configuration available to
         * controllers without necessitating a firmware update
         * once new pin configs are fetched, the local list is updated, so whenever the frontend is used, the controller learns all
         * new pin configs
         */
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

        const response = await fetch(apiUrl);
        const data = await response.json();
        const remotePinConfigData = JSON.parse(atob(data.content));

        const remoteVersion = remotePinConfigData.version;

        if (remoteVersion > configData.data.hardware.version) {
          const localPinConfigs = configData.data.hardware.pinconfigs;
          const remotePinConfigs = remotePinConfigData.pinconfigs;

          // Merge arrays, avoiding duplicates based on the 'name' property
          const mergedPinConfigs = [
            ...localPinConfigs,
            ...remotePinConfigs.filter(
              (remoteConfig) =>
                !localPinConfigs.some(
                  (localConfig) => localConfig.name === remoteConfig.name,
                ),
            ),
          ];

          configData.updateData("hardware.pinconfigs", mergedPinConfigs, false);
          configData.updateData("hardware.version", remoteVersion, false);
        }
      } catch (error) {
        console.error("Error loading pin config:", error);
        $q.notify({
          type: "negative",
          message: `Error loading pin config: ${error.message}`,
        });
      }

      // After loading data, update the UI based on SOC-specific configs
      getPinConfigNames();
      getCurrentPinConfig();
      loadAvailablePins();
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
        // Add the new configuration
        configData.updateData("hardware.pinconfigs", [
          ...configData.data.hardware.pinconfigs,
          newConfig,
        ]);

        // Update the available configurations list
        getPinConfigNames();

        // Select the new configuration
        currentPinConfigName.value = newConfig.name;
        getCurrentPinConfig();
        updatePinConfig();

        $q.notify({
          type: "positive",
          message: `Pin configuration "${newConfig.name}" created`,
        });
      });
    };

    const editCurrentConfig = () => {
      // Find the current configuration
      const currentConfig = socSpecificConfigs.value.find(
        (config) => config.name === currentPinConfigName.value,
      );

      if (!currentConfig) {
        $q.notify({
          type: "negative",
          message: "No configuration selected",
        });
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
        // Update the configuration in the store
        const configs = configData.data.hardware.pinconfigs;
        const index = configs.findIndex(
          (c) => c.name === currentPinConfigName.value,
        );

        if (index !== -1) {
          configs[index] = updatedConfig;
          configData.updateData("hardware.pinconfigs", configs);

          // If the name changed, update the selection
          if (updatedConfig.name !== currentPinConfigName.value) {
            currentPinConfigName.value = updatedConfig.name;
            getPinConfigNames();
          }

          getCurrentPinConfig();
          updatePinConfig();

          $q.notify({
            type: "positive",
            message: `Pin configuration "${updatedConfig.name}" updated`,
          });
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

    // Watch for changes in showDetails to ensure reactivity
    watch(showDetails, (newVal) => {
      if (newVal) {
        // Force re-render or perform any necessary updates
        getCurrentPinConfig();
      }
    });

    // Add a watch for changes in SOC
    watch(
      () => infoData.data.soc,
      () => {
        if (infoData.data.soc) {
          getPinConfigNames();
          getCurrentPinConfig();
          loadAvailablePins();
        }
      },
    );

    return {
      currentPinConfigName,
      pinConfigData,
      showDetails,
      handlePinConfigChange,
      updatePinConfig,
      getPinConfigNames,
      getCurrentPinConfig,
      loadPinConfigData,
      pinConfigNames,
      formattedPinConfigData,
      showAddConfigDialog,
      editCurrentConfig,
      socSpecificConfigs, // Add to return object for template access
    };
  },
};
</script>
