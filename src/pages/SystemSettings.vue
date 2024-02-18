<template>
  <div>
    <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md">
      <q-card-section
        ><h4>update controller</h4>
        <input type="text" v-model="otaUrl"
      /></q-card-section>
      <q-card-actions
        ><q-btn
          label="check firmware"
          color="primary"
          @click="checkFirmware"
          class="q-mt-md"
      /></q-card-actions>
      <q-card-section v-if="firmware">
        current: firmware: {{ infoData.git_version }} webapp:
        {{ infoData.webapp_version }}

        available: firmware: {{ firmware.files.rom.fw_version }} webapp:
        {{ firmware.files.rom.webapp_version }}
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

export default {
  setup() {
    const controllers = controllersStore();
    const configData = configDataStore();
    const infoData = infoDataStore();

    const otaUrl = ref(configData.data.ota.url);

    const firmware = ref();
    const firmwareItems = ref([]);

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
    return { otaUrl, updateController, firmware, checkFirmware, infoData };
  },
};
</script>
