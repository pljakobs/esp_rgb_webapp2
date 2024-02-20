<template>
  <div>
    <MyCard>
      <q-card-section>
        <div class="text-h6">
          <q-icon name="info" />
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
              @click="exportSettings"
              class="q-mt-md"
            />
            <q-btn
              label="import settings"
              color="primary"
              @click="importSettings"
              class="q-mt-md"
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
              @click="restartController"
              class="q-mt-md"
            />
            <q-btn
              label="reset"
              color="primary"
              @click="resetController"
              class="q-mt-md"
            />
          </q-card-actions>
        </div>
      </q-card-section>
    </MyCard>
    <MyCard>
      <q-card-section>
        <div class="text-h6">
          <q-icon name="memory" />
          Controller
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section> todo: pin configuration goes here </q-card-section>
    </MyCard>
    <MyCard>
      <q-card-section>
        <div class="text-h6">
          <q-icon name="security" />
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
          <q-icon name="system_update" />
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
          @click="checkFirmware"
          class="q-mt-md"
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
      style="max-width: 50%"
    >
      <q-card-section>
        <div class="text-h6">
          <q-icon name="system_update" />
          Firmware update
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section class="centered-content">
        your platform is {{ infoData.data.soc }} with partition layout
        {{ infoData.data.part_layout }}
        <table class="styled-table">
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
        </table>
      </q-card-section>
      <q-card-actions>
        <q-btn
          label="update"
          color="primary"
          @click="updateController"
          class="q-mt-md"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, watchEffect } from "vue";

import { configDataStore } from "src/stores/configDataStore";
import { controllersStore } from "src/stores/controllersStore.js";
import { infoDataStore } from "src/stores/infoDataStore";
import { storeStatus } from "src/stores/storeConstants";

import dataTable from "src/components/dataTable.vue";
import MyCard from "src/components/myCard.vue";

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

    const firmware = ref();
    const firmwareItems = ref([]);
    const firmwareInfo = ref([]);

    watchEffect(() => {
      if (infoData.status === storeStatus.READY && infoData.data) {
        firmwareInfo.value = [
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

    console.log("otaUrl", otaUrl.value);
    console.log("ifoData: ", infoData.data);
    const fetchFirmware = async () => {
      try {
        const response = await fetch(otaUrl.value, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("data", data);
        firmware.value = data.firmware.find(
          (item) =>
            item.partitioning === infoData.data.part_layout &&
            item.soc === infoData.data.soc,
        );

        if (!firmware.value) {
          console.error("No matching firmware found");
        } else {
          console.log("firmware", JSON.stringify(firmware.value));
          firmwareItems.value = [
            {
              label: "firmware version",
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
      }
    };

    const checkFirmware = async () => {
      configData.updateData("ota.url", otaUrl.value);
      await fetchFirmware();
      dialogOpen.value = true;
      console.log("dialogOpen", dialogOpen.value);
    };

    //onMounted(checkFirmware);

    const updateController = async () => {
      console.log("update controller");

      /*const postResponse = await fetch("http://controllers.localhost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      */
    };
    return {
      otaUrl,
      updateController,
      firmware,
      checkFirmware,
      infoData,
      firmwareInfo,
      dialogOpen,
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
</style>
