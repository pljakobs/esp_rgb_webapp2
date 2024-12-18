<template>
  <MyCard icon="img:icons/memory_outlined.svg" title="Controller config">
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
      ></q-select>
      <q-btn
        label="Update Configuration"
        color="primary"
        class="q-mt-md"
        @click="updatePinConfig"
      />
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, onMounted, watch } from "vue";
import { useQuasar } from "quasar";
import { configDataStore } from "src/stores/configDataStore";
import { infoDataStore } from "src/stores/infoDataStore";
import MyCard from "src/components/myCard.vue";

export default {
  name: "ControllerConfigCard",
  components: {
    MyCard,
  },
  setup() {
    const configData = configDataStore();
    const infoData = infoDataStore();
    const pinConfigData = ref([]);
    const currentPinConfigName = ref(
      configData.data.general.current_pin_config_name,
    );
    const showManualConfig = ref(false);
    const pinConfigNames = ref([]);

    const getPinConfigNames = () => {
      pinConfigNames.value = configData.data.hardware.pinconfigs.map(
        (config) => config.name,
      );
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

    onMounted(() => {
      loadPinConfigData();
    });

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
      pinConfigNames,
      infoData,
    };
  },
};
</script>

<style scoped>
.q-mt-md {
  margin-top: 16px;
}
</style>
