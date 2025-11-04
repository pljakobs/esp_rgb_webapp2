<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card class="q-dialog-plugin">
      <q-toolbar
        class="bg-primary text-white"
        v-if="!presetExists && !isSaving"
      >
        <q-toolbar-title>Add Preset</q-toolbar-title>
        <q-badge :style="badgeStyle" round />
      </q-toolbar>
      <q-toolbar class="bg-warning text-dark" v-else-if="!isSaving">
        <q-toolbar-title>Overwrite Existing Preset</q-toolbar-title>
        <q-badge :style="badgeStyle" round />
      </q-toolbar>
      <q-toolbar class="bg-primary text-white" v-else>
        <q-toolbar-title>Saving Preset...</q-toolbar-title>
        <q-badge :style="badgeStyle" round />
      </q-toolbar>

      <q-card-section>
        <q-input
          v-model="presetName"
          label="Preset Name"
          filled
          autofocus
          :disable="isSaving"
        />
      </q-card-section>

      <q-card-section v-if="isSaving || isRollingBack">
        <q-linear-progress
          :value="progressValue"
          :color="isRollingBack ? 'negative' : 'primary'"
          size="md"
          :indeterminate="progress.total === 0"
        />
        <div class="text-center q-mt-sm">
          <span v-if="!isRollingBack">
            {{ progress.completed }} of {{ progress.total }} controllers updated
          </span>
          <span v-else>
            {{
              progress.message ||
              `${progress.completed} of ${progress.total} controllers rolled back`
            }}
          </span>
        </div>
      </q-card-section>
      <q-card-section v-if="isAborting && !isRollingBack && progress.message">
        <div class="text-center q-pa-md">
          <svgIcon name="info" size="2rem" class="text-primary" />
          <p>{{ progress.message }}</p>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          flat
          :label="isSaving && !isRollingBack ? 'Abort' : 'Cancel'"
          :color="isSaving && !isRollingBack ? 'negative' : 'primary'"
          @click="
            isSaving && !isRollingBack ? onAbortSaving() : onDialogCancel()
          "
          :disable="isRollingBack"
        />

        <!-- Show OK button when abort is done but no rollback needed -->
        <q-btn
          v-if="isAborting && !isRollingBack && progress.message"
          flat
          label="OK"
          color="primary"
          @click="onDialogCancel()"
        />

        <q-btn
          v-if="presetExists && !isSaving && !isRollingBack"
          flat
          label="Overwrite"
          color="negative"
          @click="onOverwriteClick"
          :disable="!presetName"
        />
        <q-btn
          v-if="!presetExists && !isSaving && !isRollingBack"
          flat
          label="Save"
          color="primary"
          @click="onSaveClick"
          :disable="!presetName"
        />

        <q-btn v-if="isSaving" flat label="Saving..." color="primary" disable />
        <q-btn
          v-if="isRollingBack"
          flat
          label="Rolling back..."
          color="negative"
          disable
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed, watch } from "vue";
import { colors } from "quasar";
import { useAppDataStore } from "src/stores/appDataStore";
import { useDialogPluginComponent } from "quasar";

const { hsvToRgb } = colors;

export default {
  name: "addPresetDialog",
  props: {
    presetType: {
      type: String,
      required: true,
    },
    preset: {
      type: Object,
      required: true,
    },
  },
  emits: ["close", "save", "abort", ...useDialogPluginComponent.emits],
  setup(props, { emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
      useDialogPluginComponent();

    const presetName = ref("");
    const presetExists = ref(false);
    const existingPreset = ref(null);
    const presetData = useAppDataStore();
    const isSaving = ref(false);
    const progress = ref({
      completed: 0,
      total: 0,
    });
    const isAborting = ref(false);
    const isRollingBack = ref(false);
    const progressValue = computed(() => {
      if (progress.value.total === 0) return 0;

      // For saving, show 0 to 100% progress
      if (!isRollingBack.value) {
        return progress.value.completed / progress.value.total;
      }
      // For rollback, show 100% to 0% progress (reversed)
      else {
        // We want to show the inverse - how many are left to process
        return Math.max(0, 1 - progress.value.completed / progress.value.total);
      }
    });

    const onAbortSaving = () => {
      console.log("Aborting save operation");
      isAborting.value = true;
      isRollingBack.value = true;

      // Update progress display for rollback
      progress.value = {
        completed: 0,
        total: 0,
        message: "Initiating rollback...",
      };

      // Find the preset ID if it exists in store
      let presetId = existingPreset.value?.id;

      // If it's a new preset, try to find it by name in the store
      if (!presetId && presetName.value) {
        const foundPreset = presetData.data.presets.find(
          (p) => p.name === presetName.value,
        );
        if (foundPreset) {
          presetId = foundPreset.id;
          console.log(
            `Found preset ID ${presetId} for name "${presetName.value}"`,
          );
        }
      }

      // Create a rollback progress callback
      const rollbackProgressCallback = (
        completed,
        total,
        controllerIP,
        options = {},
      ) => {
        console.log(`Rollback progress: ${completed}/${total}`);

        // Special case: no preset ID found
        if (options && options.noPresetId) {
          isRollingBack.value = false;
          progress.value = {
            completed: 0,
            total: 0,
            message: options.message || "No rollback needed",
          };
          return;
        }

        // Normal progress update
        progress.value.completed = completed;
        progress.value.total = total;
        progress.value.message = `Rolling back changes from ${completed} of ${total} controllers`;

        // Close dialog only when rollback is complete
        if (completed === total) {
          setTimeout(() => {
            onDialogCancel();
          }, 800); // Short delay to show completion
        }
      };

      // Emit an abort event with the necessary info and progress callback
      emit("abort", {
        name: presetName.value,
        existingId: existingPreset.value?.id,
        updateProgress: rollbackProgressCallback,
      });

      // Important: DON'T close the dialog here - it will close after rollback
    };

    const badgeStyle = computed(() => {
      if (props.presetType === "hsv") {
        const { r, g, b } = hsvToRgb(props.preset);
        return {
          backgroundColor: `rgb(${r}, ${g}, ${b})`,
          width: "30px",
          height: "30px",
          borderRadius: "50%",
          border: "1px solid black",
        };
      } else {
        const { r, g, b } = props.preset;
        if (r !== undefined && g !== undefined && b !== undefined) {
          return {
            backgroundColor: `rgb(${r}, ${g}, ${b})`,
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            border: "1px solid black",
          };
        }
      }
    });

    const verifyPresetName = () => {
      // Find if a preset with this name already exists
      const found = presetData.data.presets.find(
        (preset) => preset.name === presetName.value,
      );

      if (found) {
        existingPreset.value = found;
        presetExists.value = true;
        console.log("Found existing preset:", found);
      } else {
        existingPreset.value = null;
        presetExists.value = false;
      }
    };

    const onSaveClick = () => {
      if (!presetName.value) return;
      isSaving.value = true;

      // Create the progress update callback
      const updateProgressCallback = (completed, total) => {
        console.log(`Progress update in dialog: ${completed}/${total}`);
        progress.value.completed = completed;
        progress.value.total = total;

        // Don't close if we're aborting
        if (isAborting.value) {
          return;
        }

        // Close dialog when saving completes
        if (completed === total) {
          setTimeout(() => {
            onDialogCancel();
          }, 800); // Short delay to show completion
        }
      };

      // Pass the data along with the updateProgress callback
      const result = {
        name: presetName.value,
        isNew: true,
        updateProgress: updateProgressCallback,
        // Add a reference to dialogRef so the parent can close it
        dialogRef: dialogRef,
      };

      // Emit the "ok" event
      emit("ok", result);
    };

    const onOverwriteClick = () => {
      if (!presetName.value || !existingPreset.value) return;
      isSaving.value = true;

      // Create the progress update callback
      const updateProgressCallback = (completed, total) => {
        console.log(`Progress update in dialog: ${completed}/${total}`);
        progress.value.completed = completed;
        progress.value.total = total;

        // Don't close if we're aborting
        if (isAborting.value) {
          return;
        }

        // Close dialog when saving completes
        if (completed === total) {
          setTimeout(() => {
            onDialogCancel();
          }, 800); // Short delay to show completion
        }
      };

      // Pass the data along with the updateProgress callback
      const result = {
        name: presetName.value,
        isNew: false,
        existingId: existingPreset.value.id,
        favorite: existingPreset.value.favorite || false,
        updateProgress: updateProgressCallback,
        dialogRef: dialogRef,
      };

      emit("ok", result);
    };

    watch(presetName, verifyPresetName);

    return {
      dialogRef,
      onDialogHide,
      onDialogCancel,
      verifyPresetName,
      onSaveClick,
      onOverwriteClick,
      badgeStyle,
      presetName,
      presetExists,
      isSaving,
      progress,
      onAbortSaving,
      isAborting,
      isRollingBack,
      progressValue,
    };
  },
};
</script>
