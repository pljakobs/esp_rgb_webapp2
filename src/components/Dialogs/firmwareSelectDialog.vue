<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card
      class="shadow-4 q-pa-md"
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
                <td>{{ currentInfo.build_type }}</td>
              </tr>
              <tr>
                <td class="label">Version:</td>
                <td>{{ currentInfo.git_version }}</td>
              </tr>
              <tr>
                <td class="label">Webapp version:</td>
                <td>{{ currentInfo.webapp_version }}</td>
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
            <tr v-for="fw in firmwareOptions" :key="fw.url">
              <td>
                <q-radio
                  v-model="selectedFirmware"
                  :val="fw"
                  :label="getVersionLabel(fw)"
                />
              </td>
              <td>{{ fw.type }}</td>
              <td>{{ getVersionLabel(fw) }}</td>
            </tr>
          </tbody>
        </table>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="onDialogCancel" />
        <q-btn
          flat
          label="Update"
          color="primary"
          :disable="!selectedFirmware"
          @click="startUpdate"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref } from "vue";
import { useDialogPluginComponent } from "quasar";

export default {
  name: "FirmwareSelectDialog",
  props: {
    firmwareOptions: {
      type: Array,
      required: true,
    },
    currentInfo: {
      type: Object,
      required: true,
    },
    otaUrl: {
      type: String,
      required: true,
    },
  },
  emits: [...useDialogPluginComponent.emits],

  setup(props, { emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
      useDialogPluginComponent();

    // Make selectedFirmware reactive by using ref
    const selectedFirmware = ref(
      props.firmwareOptions.find(
        (fw) => fw.type === props.currentInfo.build_type,
      ) || props.firmwareOptions[0],
    );

    // Helper function to get version from different possible property names
    const getVersionLabel = (fw) => {
      // Check different possible version property names
      return fw.version || fw.fw_version || "Unknown";
    };

    const startUpdate = () => {
      if (!selectedFirmware.value) {
        return;
      }

      // Process the firmware URLs
      let baseUrl;
      let fullUrl;
      const relativeUrl = selectedFirmware.value.files.rom.url;

      if (relativeUrl.substring(0, 4) !== "http") {
        // relative URL is server relative (has no scheme)
        baseUrl = props.otaUrl.substring(0, props.otaUrl.lastIndexOf("/") + 1);
        fullUrl = baseUrl + relativeUrl;
      } else {
        // relative URL is not really relative, thus has the host portion
        fullUrl = relativeUrl;
      }

      // Create a deep copy to avoid mutating props
      const preparedFirmware = JSON.parse(
        JSON.stringify(selectedFirmware.value),
      );
      preparedFirmware.files.rom.url = fullUrl;

      // Send the selected firmware back to the parent
      onDialogOK(preparedFirmware);
    };

    return {
      dialogRef,
      onDialogHide,
      onDialogCancel,
      selectedFirmware,
      startUpdate,
      getVersionLabel,
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
</style>
