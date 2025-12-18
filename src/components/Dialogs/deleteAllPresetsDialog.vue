<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card class="q-dialog-plugin">
      <!-- Warning mode -->
      <q-card-section v-if="!isDeleting" class="bg-negative text-white">
        <div class="text-h6">
          <svgIcon name="warning" size="md" class="q-mr-sm" />
          Warning: Delete All Presets
        </div>
      </q-card-section>

      <q-card-section v-if="!isDeleting" class="q-pt-lg">
        <p class="text-bold">
          This will delete ALL presets from ALL controllers!
        </p>
        <p>This action cannot be undone. Are you sure you want to proceed?</p>
      </q-card-section>

      <!-- Progress mode -->
      <template v-else>
        <q-toolbar class="bg-negative text-white">
          <q-toolbar-title>Deleting All Presets...</q-toolbar-title>
        </q-toolbar>

        <q-card-section>
          <div class="text-center q-mb-md">
            <p>Deleting all presets from all controllers</p>
          </div>

          <q-linear-progress
            :value="progressValue"
            color="negative"
            size="md"
            :indeterminate="currentStage === 'fetching'"
          />
          <div class="text-center q-mt-sm">
            <div v-if="currentStage === 'fetching'">
              Retrieving presets from controllers...
            </div>
            <div v-else-if="currentStage === 'deleting'">
              {{ progress.completed }} of {{ progress.total }} presets deleted
            </div>
            <div v-else-if="currentStage === 'complete'">
              Deletion complete!
            </div>
          </div>
        </q-card-section>
      </template>

      <!-- Buttons - different based on mode -->
      <q-card-actions align="right">
        <template v-if="!isDeleting">
          <q-btn
            flat
            label="Cancel"
            color="primary"
            @click="onDialogCancel()"
          />
          <q-btn
            flat
            label="Delete All"
            color="negative"
            @click="startDeleteAll()"
          />
        </template>
        <!-- No buttons in progress mode - closes automatically -->
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed } from "vue";
import { useDialogPluginComponent } from "quasar";
import { useAppDataStore } from "src/stores/appDataStore";
import { useControllersStore } from "src/stores/controllersStore";

export default {
  name: "deleteAllPresetsDialog",
  emits: [...useDialogPluginComponent.emits],
  setup() {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
      useDialogPluginComponent();

    const appData = useAppDataStore();
    const controllers = useControllersStore();
    const isDeleting = ref(false);
    const currentStage = ref("initial"); // 'initial', 'fetching', 'deleting', 'complete'
    const progress = ref({
      completed: 0,
      total: 0,
    });

    const progressValue = computed(() => {
      if (progress.value.total === 0) return 0;
      return progress.value.completed / progress.value.total;
    });

    // Function to start the delete all operation
    const startDeleteAll = async () => {
      try {
        isDeleting.value = true;
        currentStage.value = "fetching";

        // Step 1: Fetch all presets from all controllers
        const allControllerPresets = {};
        for (const controller of controllers.data) {
          try {
            const response = await fetch(
              `http://${controller.ip_address}/data`,
            );
            if (response.ok) {
              const data = await response.json();
              if (data.presets && Array.isArray(data.presets)) {
                allControllerPresets[controller.ip_address] = data.presets;
              }
            }
          } catch (error) {
            console.error(
              `Error fetching presets from ${controller.ip_address}:`,
              error,
            );
          }
        }

        // Step 2: Count total presets to delete
        let totalPresets = 0;
        for (const ip in allControllerPresets) {
          totalPresets += allControllerPresets[ip].length;
        }

        // Update progress for deletion phase
        currentStage.value = "deleting";
        progress.value.total = totalPresets;
        progress.value.completed = 0;

        // Step 3: Delete each preset from each controller
        for (const ip in allControllerPresets) {
          for (const preset of allControllerPresets[ip]) {
            try {
              let payload = { [`presets[id=${preset.id}]`]: [] };
              await fetch(`http://${ip}/data`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              });

              // Update progress
              progress.value.completed++;
            } catch (error) {
              console.error(
                `Error deleting preset ${preset.id} from ${ip}:`,
                error,
              );
              // Still increment progress even if there was an error
              progress.value.completed++;
            }
          }
        }

        // Step 4: Clear local presets array
        appData.data.presets = [];

        // Step 5: Complete
        currentStage.value = "complete";

        // Auto-close after a delay
        setTimeout(() => {
          onDialogCancel();
        }, 1500);
      } catch (error) {
        console.error("Error in deleteAllPresets:", error);
        onDialogCancel(); // Close on error
      }
    };

    return {
      dialogRef,
      onDialogHide,
      onDialogCancel,
      progress,
      progressValue,
      isDeleting,
      currentStage,
      startDeleteAll,
    };
  },
};
</script>
