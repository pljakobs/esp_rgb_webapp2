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
        label="check firmware"
        color="primary"
        class="q-mt-md"
        @click="fetchFirmware"
      />
    </q-card-actions>
    <q-card-section v-if="firmware">
      current: firmware: {{ infoData.data.git_version }} webapp:
      {{ infoData.data.webapp_version }}
    </q-card-section>

    <!-- Download Dialog -->
    <q-dialog v-model="dialogOpen">
      <q-card
        class="shadow-4 col-auto fit q-gutter-md q-pa-md"
        style="max-width: 450px; max-height: 640px"
      >
        <q-card-section>
          <div class="text-h6">
            <q-icon name="img:icons/systemsecurityupdate_outlined.svg" />
            Firmware update
          </div>
        </q-card-section>
        <q-separator />
        <q-card-section class="centered-content">
          <div>
            <p>Currently running firmware:</p>
            <table class="styled-table">
              <tbody>
                <tr>
                  <td class="label">Build type:</td>
                  <td>{{ infoData.data.build_type }}</td>
                </tr>
                <tr>
                  <td class="label">Version:</td>
                  <td>{{ infoData.data.git_version }}</td>
                </tr>
                <tr>
                  <td class="label">Webapp version:</td>
                  <td>{{ infoData.data.webapp_version }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <table class="styled-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Build Type</th>
                <th>Version</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fw in availableFirmware" :key="fw.url">
                <td>
                  <q-radio
                    v-model="selectedFirmware"
                    :val="fw"
                    :label="fw.fw_version"
                  />
                </td>
                <td>{{ fw.type }}</td>
                <td>{{ fw.fw_version }}</td>
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
            @click="() => updateController(selectedFirmware)"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Countdown Dialog -->
    <q-dialog v-model="countdownDialog">
      <q-card
        class="shadow-4 col-auto fit q-gutter-md q-pa-md"
        style="max-width: 250px; max-height: 200px"
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
  </MyCard>
</template>

<script>
import { ref } from "vue";
import { useQuasar } from "quasar";
import { configDataStore } from "src/stores/configDataStore";
import { infoDataStore } from "src/stores/infoDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import MyCard from "src/components/myCard.vue";

export default {
  components: {
    MyCard,
  },
  setup() {
    const configData = configDataStore();
    const infoData = infoDataStore();
    const controllers = useControllersStore();

    const otaUrl = ref(configData.data.ota.url);
    const dialogOpen = ref(false);
    const countdownDialog = ref(false);
    const progress = ref(0);

    const firmware = ref();
    const availableFirmware = ref([]);
    const selectedFirmware = ref(null);
    const $q = useQuasar();

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

        // Filter available firmware based on current SoC
        availableFirmware.value = data.firmware.filter(
          (fw) => fw.soc === infoData.data.soc,
        );
        console.log("available firmware: ", availableFirmware.value);

        // Open the dialog to show available firmware
        dialogOpen.value = true;
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

    const updateController = async (selectedFirmware) => {
      if (!selectedFirmware) {
        $q.dialog({
          title: "Error",
          message: "Please select a firmware version to update.",
          color: "negative",
          icon: "img:icons/report-problem_outlined.svg",
        });
        return;
      }

      console.log("Selected firmware:", selectedFirmware);

      try {
        let baseUrl;
        let fullUrl;
        const relativeUrl = selectedFirmware.files.rom.url;
        if (relativeUrl.substring(0, 4) !== "http") {
          // relative URL is server relative (has no scheme)
          baseUrl = otaUrl.value.substring(
            0,
            otaUrl.value.lastIndexOf("/") + 1,
          );
          fullUrl = baseUrl + relativeUrl;
        } else {
          // relative URL is not really relative, thus has the host portion
          fullUrl = relativeUrl;
        }
        console.log("baseUrl:", baseUrl, "\nrelativeUrl: ", relativeUrl);
        console.log("fullUrl: ", fullUrl);

        selectedFirmware.files.rom.url = fullUrl;

        console.log(
          "firmwarre structure:",
          JSON.stringify(selectedFirmware.files),
        );
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
          console.log("postResponse was not ok");
          $q.dialog({
            title: "Update failed",
            message: `Update failed! status: ${postResponse.status}`,
            color: "negative",
            icon: "img:icons/report-problem_outlined.svg",
          });
          return;
        }

        dialogOpen.value = false;
        startCountdown();
      } catch (error) {
        console.error("Error updating firmware:", error);
        $q.dialog({
          title: "Error",
          message: `Error updating firmware: ${error.message}`,
          color: "negative",
          icon: "img:icons/report-problem_outlined.svg",
        });
      }
    };

    const startCountdown = () => {
      countdownDialog.value = true;
      progress.value = 1;
      const interval = setInterval(() => {
        progress.value -= 1 / 30;
        if (progress.value <= 0) {
          clearInterval(interval);
          location.reload(true);
        }
      }, 1000);
    };

    return {
      otaUrl,
      firmware,
      availableFirmware,
      selectedFirmware,
      fetchFirmware,
      dialogOpen,
      countdownDialog,
      progress,
      updateController,
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

.styled-table {
  border-collapse: separate;
  border-spacing: 10px;
}

.styled-table th {
  font-weight: bold;
  text-align: center;
}

.styled-table td {
  text-align: left;
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
</style>
