<template>
  <MyCard>
    <q-card-section>
      <div class="text-h6">
        <q-icon name="img:icons/systemsecurityupdate_outlined.svg" />
        Firmware update
      </div>
    </q-card-section>
    <q-separator />
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
import MyCard from "src/components/myCard.vue";

export default {
  components: {
    MyCard,
  },
  setup() {
    const configData = configDataStore();
    const infoData = infoDataStore();

    const otaUrl = ref(configData.data.ota.url);
    const dialogOpen = ref(false);
    const countdownDialog = ref(false);
    const progress = ref(0);

    const firmware = ref();
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

    const updateController = async () => {
      dialogOpen.value = false;
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

    return {
      otaUrl,
      firmware,
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
</style>
