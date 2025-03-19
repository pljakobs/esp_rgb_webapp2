<template>
  <MyCard title="Firmware update" icon="systemsecurityupdate_outlined">
    <q-card-section>
      <q-input
        v-model="otaUrl"
        label="OTA URL"
        hint="URL to the firmware update server"
      />
    </q-card-section>

    <q-card-actions>
      <q-btn
        label="Check firmware"
        color="primary"
        class="q-mt-md"
        @click="fetchFirmware"
      />
    </q-card-actions>

    <q-card-section v-if="firmware">
      Current: firmware: {{ infoData.data.git_version }} webapp:
      {{ infoData.data.webapp_version }}
    </q-card-section>
  </MyCard>
</template>

<script>
/*
ToDo
  - add an "update all" button to the firmware update card that will update all controllers with the appropriate firmware
    this will have to be decided on SoC, release or debug as well as build branch (not relevant right now but in the future)
  - consider making the "check firmware" conditional in that I could check for new firmware once the card is opened and
    this would automatically become active when there is a new build
*/
import { ref } from "vue";
import { Dialog } from "quasar";
import { configDataStore } from "src/stores/configDataStore";
import { infoDataStore } from "src/stores/infoDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import MyCard from "src/components/myCard.vue";
import FirmwareSelectDialog from "src/components/Dialogs/firmwareSelectDialog.vue";
import FirmwareUpdateProgressDialog from "src/components/Dialogs/firmwareUpdateProgressDialog.vue";

export default {
  components: {
    MyCard,
  },
  setup() {
    const configData = configDataStore();
    const infoData = infoDataStore();
    const controllers = useControllersStore();

    const otaUrl = ref(configData.data.ota.url);
    const firmware = ref();
    const availableFirmware = ref([]);

    const fetchFirmware = async () => {
      console.log("Fetching firmware from:", otaUrl.value);
      try {
        const response = await fetch(otaUrl.value, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          Dialog.create({
            title: "HTTP error",
            message: `HTTP error! status: ${response.status}`,
            color: "negative",
            icon: "report_problem",
            persistent: true,
          });
          return;
        }

        const data = await response.json();
        firmware.value = data;

        // Filter available firmware based on current SoC
        availableFirmware.value = data.firmware.filter(
          (fw) => fw.soc === infoData.data.soc,
        );
        console.log("Available firmware:", availableFirmware.value);

        // Open the firmware selection dialog
        showFirmwareDialog();
      } catch (error) {
        console.error("Error fetching firmware:", error);
        Dialog.create({
          title: "Error",
          message: `Error fetching firmware: ${error.message}`,
          color: "negative",
          icon: "report_problem",
          persistent: true,
        });
      }
    };

    const showFirmwareDialog = () => {
      Dialog.create({
        component: FirmwareSelectDialog,
        componentProps: {
          firmwareOptions: availableFirmware.value,
          currentInfo: infoData.data,
          otaUrl: otaUrl.value,
        },
        persistent: true,
      }).onOk(async (selectedFirmware) => {
        await updateController(selectedFirmware);
      });
    };

    const updateController = async (selectedFirmware) => {
      try {
        console.log("Updating with firmware:", selectedFirmware);

        const postResponse = await fetch(
          `http://${controllers.currentController["ip_address"]}/update`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(selectedFirmware.files),
          },
        );

        if (!postResponse.ok) {
          Dialog.create({
            title: "Update failed",
            message: `Update failed! status: ${postResponse.status}`,
            color: "negative",
            icon: "report_problem",
            persistent: true,
          });
          return;
        }

        // Show the countdown dialog
        Dialog.create({
          component: FirmwareUpdateProgressDialog,
          persistent: true,
        });
      } catch (error) {
        console.error("Error updating firmware:", error);
        Dialog.create({
          title: "Error",
          message: `Error updating firmware: ${error.message}`,
          color: "negative",
          icon: "report_problem",
          persistent: true,
        });
      }
    };

    return {
      otaUrl,
      firmware,
      fetchFirmware,
      infoData,
    };
  },
};
</script>

<style scoped>
.icon {
  color: var(--icon-color);
  fill: var(--icon-color);
}
</style>
