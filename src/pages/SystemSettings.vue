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
        >
        </q-select>
        <!-- Table displaying the current pin configuration -->
        <dataTable :Items="formattedPinConfigData" />
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

        available: firmware: {{ firmware.files.rom.fw_version }} webapp:
        {{ firmware.files.spiffs.webapp_version }}
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
        your platform is {{ infoData.data.soc }} with partition layout
        {{ infoData.data.part_layout }}
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
            <tr>
              <td class="label">webapp</td>
              <td>{{ infoData.data.webapp_version }}</td>
              <td>{{ firmware.files.spiffs.webapp_version }}</td>
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
import { ref, watchEffect, watch } from "vue";

import { configDataStore } from "src/stores/configDataStore";
import { controllersStore } from "src/stores/controllersStore.js";
import { infoDataStore } from "src/stores/infoDataStore";
import { storeStatus } from "src/stores/storeConstants";

import dataTable from "src/components/dataTable.vue";
import MyCard from "src/components/myCard.vue";
import systemCommand from "src/services/systemCommands";
import { useQuasar } from "quasar";

export default {
  components: {
    dataTable,
    MyCard,
  },
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

    console.log("otaUrl", otaUrl.value);
    console.log("infoData: ", infoData.data);

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
          })
            .onOk(() => {
              console.log("ok");
            })
            .onCancel(() => {
              console.log("cancel");
            })
            .onDismiss(() => {
              console.log("dismiss");
            });
          console.error(`HTTP error! status: ${response.status}`);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("data", data);

        if (data.firmware && data.firmware.length > 0) {
          firmware.value = data.firmware.find(
            (item) =>
              item.partitioning === infoData.data.part_layout &&
              item.soc === infoData.data.soc,
          );
        } else {
          firmware.value = {
            files: {
              rom: data.rom,
              spiffs: data.spiffs,
            },
          };
        }

        // If firmware was found, check if the URL is local and convert it to a full URL
        if (
          firmware.value.files.rom &&
          !firmware.value.files.rom.url.startsWith("http://") &&
          !firmware.value.files.rom.url.startsWith("https://")
        ) {
          const baseUrl = otaUrl.value.replace("version.json", "");
          const path = firmware.value.files.rom.url.replace("./", "");

          firmware.value.files.rom.url = new URL(path, baseUrl).href;
          console.log(
            "firmware.value.files.rom.url",
            firmware.value.files.rom.url,
          );
        }
        if (
          firmware.value.files.spiffs &&
          !firmware.value.files.spiffs.url.startsWith("http://") &&
          !firmware.value.files.spiffs.url.startsWith("https://")
        ) {
          const baseUrl = otaUrl.value.replace("version.json", "");
          const path = firmware.value.files.spiffs.url.replace("./", "");

          firmware.value.files.spiffs.url = new URL(path, baseUrl).href;
          console.log(
            "firmware.value.files.spiffs.url",
            firmware.value.files.spiffs.url,
          );
        }

        if (!firmware.value) {
          console.error("No matching firmware found");
          $q.dialog({
            title: "Firmware missing",
            message: `No matching firmware found for your configuration / controller`,
            color: "negative",
            icon: "img:icons/report-problem_outlined.svg",
          })
            .onOk(() => {
              console.log("ok");
            })
            .onCancel(() => {
              console.log("cancel");
            })
            .onDismiss(() => {
              console.log("dismiss");
            });
        } else {
          console.log("firmware", JSON.stringify(firmware.value));
          firmwareItems.value = [
            {
              label: "Firmware version",
              value: firmware.value.files.rom.fw_version,
            },
            {
              label: "Webapp version",
              value: firmware.value.files.spiffs.webapp_version,
            },
          ];
          console.log("firmwareItems", firmwareItems.value);
          console.log("updating configData.data.ota.url", otaUrl.value);
          configData.data.ota.url = otaUrl;
        }
      } catch (error) {
        console.error("There was a problem with the fetch operation: ", error);
        $q.dialog({
          title: "Error fetching firmware list",
          message: `There was a problem with the fetch operation: ${error.message}`,
          color: "negative",
          icon: "img:icons/report-problem_outlined.svg",
        })
          .onOk(() => {
            console.log("ok");
          })
          .onCancel(() => {
            console.log("cancel");
          })
          .onDismiss(() => {
            console.log("dismiss");
          });
      }
    };

    const checkFirmware = async () => {
      configData.updateData("ota.url", otaUrl.value);
      await fetchFirmware();
      if (firmware.value) {
        dialogOpen.value = true;
      }
    };

    const updateController = async () => {
      console.log(
        "update controller:",
        controllers.currentController["ip_address"],
      );
      console.log("updating firmware", firmware.value);
      console.log(
        "host: ",
        `http://${controllers.currentController["ip_address"]}`,
      );
      await fetch(
        `http://${controllers.currentController["ip_address"]}/update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(firmware.value["files"]),
        },
      );
      dialogOpen.value = false;
      startCountdown();
    };

    const startCountdown = () => {
      countdownDialog.value = true;
      progress.value = 1;
      const interval = setInterval(() => {
        progress.value -= 1 / 30;
        if (progress.value <= 0) {
          clearInterval(interval);
          location.reload();
        }
      }, 1000);
    };

    const switchROM = () => {
      console.log(`switching ROM, current ${infoData.data.current_rom}`);
      systemCommand.switchRom();
      setTimeout(() => {
        location.reload();
      }, 7500);
    };

    const loadPinConfigData = async () => {
      try {
        console.log(
          "loading pin config from ",
          configData.data.general.pin_config_url,
        );
        const response = await fetch(configData.data.general.pin_config_url);
        if (!response.ok) throw new Error("Error loading pin config");
        const jsonData = await response.json();
        pinConfigData.value = jsonData;
      } catch (error) {
        console.error(
          "Error loading pin config from pinConfigUrl, trying fallback URL",
          error,
        );
        try {
          const fallbackUrl = `controller.currentController["ip-address"]/config/pinconfig.json`;
          const response = await fetch(fallbackUrl);
          if (!response.ok)
            throw new Error("Error loading pin config from fallback URL");
          const jsonData = await response.json();
          pinConfigData.value = jsonData;
        } catch (fallbackError) {
          console.error(
            "Error loading pin config from fallback URL",
            fallbackError,
          );
        }
      }
      getPinConfigNames();
      getCurrentPinConfig();
    };

    const getPinConfigNames = () => {
      pinConfigNames.value = pinConfigData.value.pinconfigs
        .filter((item) =>
          configData.data.general.supported_color_models
            .map((model) => model.toLowerCase())
            .includes(item.model.toLowerCase()),
        )
        .map((item) => item.name);
    };

    const getCurrentPinConfig = () => {
      if (!currentPinConfigName.value) {
        currentPinConfigName.value =
          configData.data.general.current_pin_config_name;
      }
      console.log(
        "getCurrentPinConfig called for config name ",
        currentPinConfigName.value,
      );

      currentPinConfig.value = pinConfigData.value.pinconfigs.find(
        (config) => config.name === currentPinConfigName.value,
      );

      console.log("updated pinConfig:", currentPinConfig.value);
    };

    const updatePinConfig = (newPinConfigName) => {
      currentPinConfigName.value = newPinConfigName;
      console.log("updatePinConfig called");
      console.log("updating pin config");
      configData.updateData(
        "general.current_pin_config_name",
        currentPinConfigName,
        false,
      );

      getCurrentPinConfig();

      if (currentPinConfig.value.model === "rgbww") {
        configData.updateData(
          "general.channels",
          currentPinConfig.value.channels,
          false,
        );
        const pinConfigString = currentPinConfig.value.channels
          .map((channel) => channel.pin)
          .join(",");

        console.log("updated pin config string:", pinConfigString);
        configData.updateData("general.pin_config", pinConfigString, true);
      }
    };

    watch(currentPinConfigName, (newVal) => {
      console.log("currentPinConfigName changed", newVal);
      updatePinConfig(newVal);
    });

    watchEffect(() => {
      if (infoData.status === storeStatus.READY && infoData.data) {
        firmwareInfo.value = [
          {
            label: "active ROM",
            value: infoData.data.current_rom,
          },
          {
            label: "Firmware",
            value: infoData.data.git_version,
          },
          {
            label: "Web interface",
            value: infoData.data.webapp_version,
          },
          {
            label: "SOC",
            value: infoData.data.soc,
          },
          {
            label: "Partition layout",
            value: infoData.data.part_layout,
          },
          {
            label: "RGBWW Version",
            value: infoData.data.rgbww.version,
          },
          {
            label: "Sming version",
            value: infoData.data.sming,
          },
        ];
      }
    });

    watchEffect(() => {
      if (
        configData.status === storeStatus.READY &&
        controllers.status === storeStatus.READY
      ) {
        loadPinConfigData();
      }
    });

    return {
      otaUrl,
      updateController,
      firmware,
      checkFirmware,
      infoData,
      firmwareInfo,
      dialogOpen,
      startCountdown,
      progress,
      switchROM,
      pinConfigData,
      pinConfigNames,
      currentPinConfig,
      currentPinConfigName,
      updatePinConfig,
    };
  },
  computed: {
    formattedPinConfigData() {
      if (!this.currentPinConfig) {
        return [];
      }
      if (
        !this.currentPinConfig.channels ||
        this.currentPinConfig.channels.length === 0
      ) {
        return [];
      }

      return this.currentPinConfig.channels.map((config) => ({
        label: config.name,
        value: config.pin,
      }));
    },
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
