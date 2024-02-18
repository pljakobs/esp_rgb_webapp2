<template>
  <div>
    <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md q-ma-md">
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
    </q-card>
    <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md q-ma-md">
      <q-card-section>
        <div class="text-h6">
          <q-icon name="memory" />
          Controller
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section> todo: pin configuration goes here </q-card-section>
    </q-card>
    <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md q-ma-md">
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
    </q-card>

    <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md q-ma-md">
      <q-card-section>
        <div class="text-h6">
          <q-icon name="system_update" />
          Firmware update
        </div>
      </q-card-section>
      <q-separator />
      <dataTable :Items="firmwareInfo" />
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
    </q-card>
  </div>
</template>

<script>
import { configDataStore } from "src/stores/configDataStore";
import { controllersStore } from "src/stores/controllersStore.js";
import { infoDataStore } from "src/stores/infoDataStore";
import { ref, onMounted } from "vue";
import dataTable from "src/components/dataTable.vue";
import { watchEffect } from "vue";
import { storeStatus } from "src/stores/storeConstants";

export default {
  components: {
    dataTable,
  },
  setup() {
    const controllers = controllersStore();
    const configData = configDataStore();
    const infoData = infoDataStore();

    const otaUrl = ref(configData.data.ota.url);

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
      configData.data.ota.url = otaUrl.value;
      fetchFirmware();
    };

    onMounted(checkFirmware);

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
    };
  },
};
</script>
