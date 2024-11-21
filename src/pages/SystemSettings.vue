<!-- eslint-disable vue/attribute-hyphenation -->
<template>
  <div>
    <MyCard>
      <q-card-section>
        <div class="text-h6">
          <q-icon name="img:icons/info_outlined.svg" />
          Information
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section>
        <div class="text-h6 col-auto self-center q-gutter-md">
          <div class="text-h6">Settings</div>
          <q-card-actions>
            <q-btn
              label="export settings"
              color="primary"
              class="q-mt-md"
              @click="exportSettings"
            />
            <q-btn
              label="import settings"
              color="primary"
              class="q-mt-md"
              @click="importSettings"
            />
          </q-card-actions>
        </div>
      </q-card-section>
      <q-card-section>
        <div class="text-h6 col-auto self-center q-gutter-md">
          <div class="text-h6">System</div>
          <q-card-actions>
            <q-btn
              label="restart"
              color="primary"
              class="q-mt-md"
              @click="restartController"
            />
            <q-btn
              label="reset"
              color="primary"
              class="q-mt-md"
              @click="resetController"
            />
            <q-btn
              label="switch ROM"
              color="primary"
              class="q-mt-md"
              @click="switchROM"
            />
          </q-card-actions>
        </div>
      </q-card-section>
    </MyCard>
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
        </div>
        <dataTable v-else :Items="formattedPinConfigData" />
      </q-card-section>
    </MyCard>
    <MyCard>
      <q-card-section>
        <div class="text-h6">
          <q-icon name="img:icons/security_outlined.svg" />
          security
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section>
        todo: security config goes here. todo: not all new endpoints are yet
        password secured
      </q-card-section>
    </MyCard>

    <MyCard>
      <q-card-section>
        <div class="text-h6">
          <q-icon name="img:icons/systemsecurityupdate_outlined.svg" />
          Firmware update
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section>
        <dataTable :Items="firmwareInfo" />
        <q-input
          v-model="otaUrl"
          label="OTA URL"
          hint="URL to the firmware update server"
        />
      </q-card-section>
      <q-card-actions
        ><q-btn
          label="check firmware"
          color="primary"
          class="q-mt-md"
          @click="checkFirmware"
      /></q-card-actions>
      <q-card-section v-if="firmware">
        current: firmware: {{ infoData.data.git_version }} webapp:
        {{ infoData.data.webapp_version }}
      </q-card-section>
    </MyCard>
  </div>
  <q-dialog v-model="dialogOpen">
    <q-card
      class="shadow-4 col-auto fit q-gutter-md q-pa-md"
      style="max-width: 450px; max-height: 480px"
    >
      <q-card-section>
        <div class="text-h6">
          <q-icon name="img:icons/systemsecurityupdate_outlined.svg" />
          Firmware update
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section class="centered-content">
        your platform is {{ infoData.data.soc }}
        <table class="styled-table">
          <tbody>
            <tr>
              <th></th>
              <th>installed</th>
              <th>available</th>
            </tr>
            <tr>
              <td class="label">firmware</td>
              <td>{{ infoData.data.git_version }}</td>
              <td>{{ firmware.files.rom.fw_version }}</td>
            </tr>
          </tbody>
        </table>
      </q-card-section>
      <q-card-actions class="action-buttons">
        <q-btn
          label="cancel"
          color="primary"
          class="q-mt-md"
          @click="dialogOpen = false"
        />
        <q-btn
          label="update"
          color="primary"
          class="q-mt-md"
          @click="updateController"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
  <q-dialog v-model="countdownDialog">
    <q-card
      class="shadow-4 col-auto fit q-gutter-md q-pa-md"
      style="max-width: 250; max-height: 200px"
    >
      <q-card-section>
        <div class="text-h6">Updating...</div>
      </q-card-section>
      <q-card-section class="row items-center">
        <q-linear-progress :value="progress" color="primary" />
      </q-card-section>
      <q-card-section>
        <div>Reloading in {{ Math.floor(progress * 30) }} seconds...</div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, onMounted, computed } from "vue";
import { useQuasar } from "quasar";
import { controllersStore } from "src/stores/controllersStore";
import { configDataStore } from "src/stores/configDataStore";
import { infoDataStore } from "src/stores/infoDataStore";

export default {
  setup() {
    const controllers = controllersStore();
    const configData = configDataStore();
    const infoData = infoDataStore();

    const otaUrl = ref(configData.data.ota.url);
    const dialogOpen = ref(false);
    const countdownDialog = ref(false);
    const progress = ref(0);

    const firmware = ref();
    const firmwareItems = ref([]);
    const firmwareInfo = ref([]);

    const $q = useQuasar();

    const pinConfigData = ref(null);
    const pinConfigNames = ref([]);
    const currentPinConfigName = ref();
    const currentPinConfig = ref([]);
    const showManualConfig = ref(false);
    const configurablePins = ref([]);
    const formattedPinConfigData = ref([]);

    const availablePinsOptions = computed(() => {
      const soc = infoData.data.soc.toLowerCase();
      const socPins = configData.data.hardware["available-pins"].find(
        (item) => item.soc.toLowerCase() === soc,
      );
      return socPins
        ? socPins.pins.map((pin) => ({ label: pin, value: pin }))
        : [];
    });

    console.log("availablePinsOptions", availablePinsOptions.value);

    const fetchFirmware = async () => {
      console.log("entering fetchFirmware");
      try {
        const response = await fetch(otaUrl.value, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        console.log("response: ", response);
        if (!response.ok) {
          console.log("response was not ok");
          $q.dialog({
            title: "HTTP error",
            message: `HTTP error! status: ${response.status}`,
            color: "negative",
            icon: "img:icons/report-problem_outlined.svg",
          });
          return;
        }
        const data = await response.json();
        firmware.value = data;
        firmwareItems.value = data.items;
        firmwareInfo.value = data.info;
      } catch (error) {
        console.error("Error fetching firmware:", error);
        $q.dialog({
          title: "Error",
          message: `Error fetching firmware: ${error.message}`,
          color: "negative",
          icon: "img:icons/report-problem_outlined.svg",
        });
      }
    };

    // Load pin configuration data
    const loadPinConfigData = async () => {
      try {
        console.log("loading pin config from configData store");

        const response = await fetch(configData.data.general.pin_config_url);
        if (!response.ok) throw new Error("Error loading pin config from URL");
        const remotePinConfigData = await response.json();
        const remoteVersion = remotePinConfigData.version;

        if (remoteVersion > configData.data.hardware.version) {
          console.log("Updating local pin config data with remote data");
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

    // Get pin configuration names
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

    // Get current pin configuration
    const getCurrentPinConfig = () => {
      if (!currentPinConfigName.value) {
        currentPinConfigName.value =
          configData.data.general.current_pin_config_name;
      }
      console.log(
        "getCurrentPinConfig called for config name ",
        currentPinConfigName.value,
      );

      currentPinConfig.value = pinConfigData.value.find(
        (config) => config.name === currentPinConfigName.value,
      );

      if (currentPinConfigName.value !== "manual") {
        showManualConfig.value = false;
      } else {
        showManualConfig.value = true;
      }
      console.log("updated pinConfig:", currentPinConfig.value);
    };

    // Handle pin configuration change
    const handlePinConfigChange = (value) => {
      if (value !== "manual") {
        // Update the store/API with the selected pin configuration
        configData.data.general.current_pin_config_name = value;
        configData.data.general.channels = pinConfigData.value.find(
          (config) => config.name === value,
        ).channels;
        formattedPinConfigData.value = configData.data.general.channels;
        // Call the API to update the configuration
        //updatePinConfig();
      }
    };

    // Set manual configuration
    const setManualConfig = () => {
      const manualConfig = configurablePins.value.reduce((acc, pin) => {
        acc[pin.name] = pin.value;
        return acc;
      }, {});
      configData.data.general.channels = manualConfig;
      configData.data.general.current_pin_config_name = "manual";
      // Call the API to update the configuration
      //updatePinConfig();
    };

    // Fetch firmware and map pinConfig on component mount
    onMounted(() => {
      fetchFirmware();
      loadPinConfigData();
    });

    return {
      controllers,
      configData,
      infoData,
      otaUrl,
      dialogOpen,
      countdownDialog,
      progress,
      firmware,
      firmwareItems,
      firmwareInfo,
      pinConfigData,
      pinConfigNames,
      currentPinConfigName,
      currentPinConfig,
      configurablePins,
      availablePinsOptions,
      fetchFirmware,
      loadPinConfigData,
      getPinConfigNames,
      getCurrentPinConfig,
      handlePinConfigChange,
      setManualConfig,
      formattedPinConfigData: computed(() => {
        if (!currentPinConfig.value || !currentPinConfig.value.channels) {
          return [];
        }
        return currentPinConfig.value.channels.map((config) => ({
          label: config.name,
          value: config.pin,
        }));
      }),
    };
  },
};
</script>
<style scoped>
.styled-table {
  border-collapse: separate;
  border-spacing: 10px;
}

.styled-table th {
  font-weight: bold;
  text-align: center;
}

.styled-table td {
  text-align: center;
}

.styled-table .label {
  text-align: right;
}

.centered-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.action-buttons {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  text-align: center;
  margin-top: 10px;
}
.custom-select {
  width: 30%; /* Set the width to 30% */
  min-width: 200px; /* Set the minimum width to 80px */
}
</style>
