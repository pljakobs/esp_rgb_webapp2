<template>
  <MyCard>
    <q-card-section>
      <div class="text-h6">
        <q-icon name="img:icons/memory_outlined.svg" />
        Controller
      </div>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <q-select
        v-model="currentPinConfigName"
        class="custom-select"
        :options="pinConfigNames"
        label="Pin configuration"
        emit-value
        map-options
        dropdown-icon="img:icons/arrow_drop_down.svg"
        @update:model-value="handlePinConfigChange"
      >
      </q-select>
    </q-card-section>
    <q-card-section>
      <!-- Table displaying the current pin configuration -->
      <div v-if="showManualConfig">
        <!-- List of configurable pins -->
        <q-list>
          <q-item v-for="(pin, index) in configurablePins" :key="index">
            <q-item-section>
              <q-select
                v-model="pin.value"
                :label="pin.name"
                :options="availablePinsOptions"
                emit-value
                map-options
                dropdown-icon="img:icons/arrow_drop_down.svg"
              />
            </q-item-section>
          </q-item>
        </q-list>
        <q-btn label="Set" color="primary" @click="setManualConfig" />
      </div>
      <dataTable v-else :items="formattedPinConfigData" />
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, computed, watch, onMounted } from "vue";
import { useQuasar } from "quasar";
import { configDataStore } from "src/stores/configDataStore";
import { infoDataStore } from "src/stores/infoDataStore";
import dataTable from "components/dataTable.vue";
import MyCard from "src/components/myCard.vue";

export default {
  components: {
    MyCard,
    dataTable,
  },
  setup() {
    const configData = configDataStore();
    const infoData = infoDataStore();

    const pinConfigData = ref(null);
    const pinConfigNames = ref([]);
    const currentPinConfigName = ref();
    const currentPinConfig = ref([]);
    const showManualConfig = ref(false);
    const configurablePins = ref([
      { name: "Pin 1", value: "" },
      { name: "Pin 2", value: "" },
      // Add more configurable pins as needed
    ]);

    const availablePinsOptions = computed(() => {
      const soc = infoData.data.soc.toLowerCase();
      const socPins = configData.data.hardware["available-pins"].find(
        (item) => item.soc.toLowerCase() === soc,
      );
      return socPins
        ? socPins.pins.map((pin) => ({ label: pin, value: pin }))
        : [];
    });

    const formattedPinConfigData = computed(() => {
      if (!currentPinConfig.value || !currentPinConfig.value.channels) {
        return [];
      }
      return currentPinConfig.value.channels.map((config) => ({
        label: config.name,
        value: config.pin,
      }));
    });

    const getPinConfigNames = () => {
      pinConfigNames.value = pinConfigData.value
        .filter((item) =>
          configData.data.general.supported_color_models
            .map((model) => model.toLowerCase())
            .includes(item.model.toLowerCase()),
        )
        .map((item) => item.name);

      // Add "manual" to pinConfigNames
      pinConfigNames.value.push("manual");
    };

    const getCurrentPinConfig = () => {
      if (!currentPinConfigName.value) {
        currentPinConfigName.value =
          configData.data.general.current_pin_config_name;
      }
      currentPinConfig.value = pinConfigData.value.find(
        (config) => config.name === currentPinConfigName.value,
      );

      if (currentPinConfigName.value !== "manual") {
        showManualConfig.value = false;
      } else {
        showManualConfig.value = true;
      }
    };

    const handlePinConfigChange = (value) => {
      if (value !== "manual") {
        // Update the store with the selected pin configuration
        configData.updateData("general.current_pin_config_name", value, false);
        const selectedConfig = pinConfigData.value.find(
          (config) => config.name === value,
        );
        configData.updateData(
          "general.channels",
          selectedConfig.channels,
          false,
        );
        // Call the API to update the configuration
        updatePinConfig();
      }
    };

    const setManualConfig = () => {
      const manualConfig = configurablePins.value.reduce((acc, pin) => {
        acc[pin.name] = pin.value;
        return acc;
      }, {});
      configData.data.general.channels = manualConfig;
      configData.data.general.current_pin_config_name = "manual";
      // Call the API to update the configuration
      updatePinConfig();
    };

    const updatePinConfig = async () => {
      try {
        const response = await fetch("/api/update-config", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(configData.data.general),
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        useQuasar().notify({
          type: "positive",
          message: "Configuration updated successfully!",
        });
      } catch (error) {
        console.error("Error updating configuration:", error);
        useQuasar().notify({
          type: "negative",
          message: `Error updating configuration: ${error.message}`,
        });
      }
    };

    onMounted(() => {
      loadPinConfigData();
    });

    const loadPinConfigData = async () => {
      try {
        const response = await fetch(configData.data.general.pin_config_url);
        if (!response.ok) throw new Error("Error loading pin config from URL");
        const remotePinConfigData = await response.json();
        const remoteVersion = remotePinConfigData.version;

        if (remoteVersion > configData.data.hardware.version) {
          configData.data.hardware.pinconfigs = remotePinConfigData.pinconfigs;
          configData.data.hardware.version = remoteVersion;
        }

        pinConfigData.value = configData.data.hardware.pinconfigs.filter(
          (config) =>
            config.soc.toLowerCase() === infoData.data.soc.toLowerCase(),
        );
      } catch (error) {
        console.error("Error loading pin config:", error);
      }
      getPinConfigNames();
      getCurrentPinConfig();
    };

    watch(currentPinConfigName, (newVal) => {
      if (newVal === "manual") {
        showManualConfig.value = true;
      } else {
        showManualConfig.value = false;
      }
    });

    return {
      currentPinConfigName,
      pinConfigData,
      showManualConfig,
      handlePinConfigChange,
      updatePinConfig,
      getPinConfigNames,
      getCurrentPinConfig,
      loadPinConfigData,
      availablePinsOptions,
      formattedPinConfigData,
      setManualConfig,
    };
  },
};
</script>
