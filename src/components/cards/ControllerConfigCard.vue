<template>
  <MyCard icon="memory_outlined" title="Controller config">
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
        style="width: auto"
      ></q-select>
      <q-toggle v-model="showDetails" label="Show Details" />
      <data-table v-if="showDetails" :items="formattedPinConfigData" />
      <q-separator />
      <div v-if="!showAddConfigPane">
        <q-btn
          label="Add Config"
          color="primary"
          class="q-mt-md"
          @click="handleAddConfigPane(true)"
        />
      </div>
      <div v-else>
        <q-input
          v-model="newConfigName"
          label="Config Name"
          class="config-name-input"
        />
        <div
          v-for="(channel, index) in newConfigChannels"
          :key="index"
          class="channel-select"
        >
          <div class="color-circle" :class="channel.name"></div>
          <q-select
            v-model="channel.pin"
            :options="filteredAvailablePins"
            :label="channel.name"
            emit-value
            map-options
            dropdown-icon="img:icons/arrow_drop_down.svg"
            @update:model-value="updateAvailablePins"
            class="pin-select"
          ></q-select>
        </div>
        <div class="button-row">
          <q-btn
            label="Cancel"
            color="primary"
            @click="handleAddConfigPane(false)"
          />
          <q-btn label="Add" color="primary" @click="addNewConfig" />
        </div>
      </div>
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, onMounted, computed, watch } from "vue";
import { useQuasar } from "quasar";
import { configDataStore } from "src/stores/configDataStore";
import { infoDataStore } from "src/stores/infoDataStore";
import MyCard from "src/components/myCard.vue";
import DataTable from "src/components/dataTable.vue";

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
    const showAddConfigPane = ref(false);
    const newConfigName = ref("");
    const availablePins = ref([]);
    const newConfigChannels = ref([
      { name: "red", pin: null },
      { name: "green", pin: null },
      { name: "blue", pin: null },
      { name: "warmwhite", pin: null },
      { name: "coldwhite", pin: null },
    ]);

    const getPinConfigNames = () => {
      pinConfigNames.value = configData.data.hardware.pinconfigs
        .filter(
          (config) =>
            config.soc.toLowerCase() === infoData.data.soc.toLowerCase(),
        )
        .map((config) => config.name);
    };

    const getCurrentPinConfig = () => {
      const currentConfig = configData.data.hardware.pinconfigs.find(
        (config) => config.name === currentPinConfigName.value,
      );
      if (currentConfig) {
        pinConfigData.value = currentConfig.channels;
      }
    };

    const handlePinConfigChange = (newConfigName) => {
      currentPinConfigName.value = newConfigName;
      getCurrentPinConfig();
      updatePinConfig();
    };

    const handleAddConfigPane = (show) => {
      console.log(
        "in handleAddConfigPane, setting up for soc",
        infoData.data.soc,
      );
      newConfigName.value = "new";
      newConfigChannels.value = [
        { name: "red", pin: null },
        { name: "green", pin: null },
        { name: "blue", pin: null },
        { name: "warmwhite", pin: null },
        { name: "coldwhite", pin: null },
      ];
      console.log(
        "available_pins",
        JSON.stringify(configData.data.hardware.available_pins),
      );
      const socPins = configData.data.hardware.available_pins.find(
        (pinConfig) =>
          pinConfig.soc.toLowerCase() === infoData.data.soc.toLowerCase(),
      );

      console.log("socPins", JSON.stringify(socPins));

      if (socPins) {
        availablePins.value = socPins.pins.map((pin) => ({
          label: `Pin ${pin}`,
          value: pin,
        }));
      } else {
        availablePins.value = [];
      }

      console.log("mapped pins:", JSON.stringify(availablePins.value));
      console.log("finished handleAddConfigPane");
      showAddConfigPane.value = show;
    };

    const updatePinConfig = async () => {
      const currentConfig = configData.data.hardware.pinconfigs.find(
        (config) => config.name === currentPinConfigName.value,
      );
      if (currentConfig) {
        configData.updateData("general.channels", currentConfig.channels);
        configData.updateData(
          "general.current_pin_config_name",
          currentPinConfigName.value,
        );
      }
    };

    const loadPinConfigData = async () => {
      console.log("loading pinConfigData");
      try {
        const response = await fetch(configData.data.general.pin_config_url);
        if (!response.ok) throw new Error("Error loading pin config from URL");
        const remotePinConfigData = await response.json();
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

          console.log("mergedPinConfigs", JSON.stringify(mergedPinConfigs));

          configData.updateData("hardware.pinconfigs", mergedPinConfigs, false);
          configData.updateData("hardware.version", remoteVersion, false);
        }

        pinConfigData.value = configData.data.hardware.pinconfigs.filter(
          (config) =>
            config.soc.toLowerCase() === infoData.data.soc.toLowerCase(),
        );
      } catch (error) {
        console.error("Error loading pin config:", error);
        $q.notify({
          type: "negative",
          message: `Error loading pin config: ${error.message}`,
        });
      }
      getPinConfigNames();
      getCurrentPinConfig();
    };

    const addNewConfig = () => {
      if (!newConfigName.value) {
        $q.notify({
          type: "negative",
          message: "Config name is required",
        });
        return;
      }

      const newConfig = {
        name: newConfigName.value,
        soc: infoData.data.soc,
        channels: newConfigChannels.value,
      };

      configData.updateData("hardware.pinconfigs", [
        ...configData.data.hardware.pinconfigs,
        newConfig,
      ]);
      showAddConfigPane.value = false;
      getPinConfigNames();
    };

    const filteredAvailablePins = computed(() => {
      const selectedPins = newConfigChannels.value.map(
        (channel) => channel.pin,
      );
      return availablePins.value.filter(
        (pin) => !selectedPins.includes(pin.value),
      );
    });

    const updateAvailablePins = () => {
      // Trigger reactivity for filteredAvailablePins
      filteredAvailablePins.value;
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

    // Watch for changes in infoData.data.soc to ensure availablePins is reactive
    watch(
      () => infoData.data.soc,
      (newSoc) => {
        console.log("infoData.data.soc changed to", newSoc);
      },
    );

    return {
      currentPinConfigName,
      pinConfigData,
      showDetails,
      handlePinConfigChange,
      handleAddConfigPane,
      updatePinConfig,
      getPinConfigNames,
      getCurrentPinConfig,
      loadPinConfigData,
      pinConfigNames,
      formattedPinConfigData,
      showAddConfigPane,
      newConfigName,
      newConfigChannels,
      addNewConfig,
      availablePins,
      filteredAvailablePins,
      updateAvailablePins,
    };
  },
};
</script>

<style scoped>
.q-mt-md {
  margin-top: 16px;
}

.config-name-input {
  width: 50%;
  margin-left: 15%;
  min-width: 100px;
}

.channel-select {
  display: flex;
  align-items: center;
  margin-left: 25%;
}

.color-circle {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  margin-right: 10px;
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
  border: 1px solid #ccc; /* Add a border to make the white circle visible */
}

.pin-select {
  width: 30%;
}

.button-row {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  margin-left: 20%;
  margin-right: 40%;
}
</style>
