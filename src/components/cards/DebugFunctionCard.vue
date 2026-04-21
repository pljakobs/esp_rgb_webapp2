<template>
  <MyCard title="Debuging Functions" icon="systemsecurityupdate_outlined">
    <q-card-section>
      <q-btn-group>
        <q-btn
          label="Switch ROM"
          color="primary"
          class="q-mt-md"
          @click="switchRom"
        />
        Current ROM: {{ infoData.data.current_rom }}
        <q-btn
          label="Restart Controller"
          color="primary"
          class="q-mt-md"
          @click="restartController"
        />
      </q-btn-group>
      <br />
      <q-toggle
        v-model="debugEnabled"
        label="Debug Logging"
        color="primary"
        class="q-mt-md"
        @update:model-value="toggleDebug"
      />
      <q-btn
        label="Forget Controllers"
        color="primary"
        class="q-mt-md"
        @click="forgetControllers"
      />
      <q-btn
        label="Delete Data"
        color="negative"
        class="q-mt-md q-ml-sm"
        @click="deleteDataDialog = true"
      />
    </q-card-section>
  </MyCard>

  <q-dialog v-model="deleteDataDialog" persistent>
    <q-card style="min-width: 320px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Delete Data from All Controllers</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <div class="text-body2 text-negative q-mb-md">
          This will permanently delete the selected data from
          <strong>every</strong> controller. This cannot be undone.
        </div>
        <q-option-group
          v-model="selectedDataTypes"
          :options="dataTypeOptions"
          type="checkbox"
          color="negative"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" v-close-popup />
        <q-btn
          flat
          label="Delete"
          color="negative"
          :disable="selectedDataTypes.length === 0 || deleteInProgress"
          :loading="deleteInProgress"
          @click="deleteSelectedData"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import MyCard from "src/components/myCard.vue";
import systemCommand from "src/services/systemCommands.js";
import { infoDataStore } from "src/stores/infoDataStore";
import { configDataStore } from "src/stores/configDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import { useAppDataStore } from "src/stores/appDataStore";
import { ref, watch } from "vue";

export default {
  components: {
    MyCard,
  },
  setup() {
    const infoData = infoDataStore();
    const configData = configDataStore();
    const debugEnabled = ref(configData.data.general.debug);

    const deleteDataDialog = ref(false);
    const selectedDataTypes = ref([]);
    const deleteInProgress = ref(false);

    const dataTypeOptions = [
      { label: "Presets", value: "presets" },
      { label: "Groups", value: "groups" },
      { label: "Scenes", value: "scenes" },
      { label: "Controllers", value: "controllers" },
    ];

    const switchRom = () => {
      systemCommand.switchRom();
    };

    const toggleDebug = () => {
      console.log("switching debug mode to: ", debugEnabled.value);
      systemCommand.debug(debugEnabled.value);
    };

    const restartController = () => {
      systemCommand.restartController();
    };

    const forgetControllers = () => {
      systemCommand.forgetControllers();
    };

    const deleteSelectedData = async () => {
      if (selectedDataTypes.value.length === 0) return;

      deleteInProgress.value = true;
      const controllers = useControllersStore();
      const appData = useAppDataStore();

      const payload = {};
      for (const type of selectedDataTypes.value) {
        payload[type] = [];
      }

      for (const controller of controllers.data) {
        if (!controller.ip_address) continue;
        try {
          const response = await fetch(
            `http://${controller.ip_address}/data`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );
          if (!response.ok) {
            console.warn(
              `Failed to clear data on ${controller.hostname}: HTTP ${response.status}`,
            );
          } else {
            console.log(
              `Cleared ${selectedDataTypes.value.join(", ")} on ${controller.hostname}`,
            );
          }
        } catch (error) {
          console.error(
            `Error clearing data on ${controller.hostname}:`,
            error.message,
          );
        }
      }

      // Update local store state for cleared types
      for (const type of selectedDataTypes.value) {
        if (type in appData.data) {
          appData.data[type] = [];
        }
      }

      deleteInProgress.value = false;
      selectedDataTypes.value = [];
      deleteDataDialog.value = false;
    };

    // Watch for changes in configData to update debugEnabled
    watch(
      () => configData.data.general.debug,
      (newVal) => {
        debugEnabled.value = newVal;
      },
    );

    return {
      switchRom,
      toggleDebug,
      restartController,
      forgetControllers,
      deleteDataDialog,
      selectedDataTypes,
      deleteInProgress,
      dataTypeOptions,
      deleteSelectedData,
      infoData,
      debugEnabled,
    };
  },
};
</script>

<style scoped>
.q-mt-md {
  margin-top: 16px;
}
</style>
