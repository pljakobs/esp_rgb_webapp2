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

      <q-card-section v-if="isSaving">
        <q-linear-progress
          :value="progress.completed / progress.total"
          color="primary"
          size="md"
          :indeterminate="progress.total === 0"
        />
        <div class="text-center q-mt-sm">
          {{ progress.completed }} of {{ progress.total }} controllers updated
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          flat
          :label="isSaving ? 'Abort' : 'Cancel'"
          :color="isSaving ? 'negative' : 'primary'"
          @click="isSaving ? onAbortSaving() : onDialogCancel()"
        />

        <q-btn
          v-if="presetExists && !isSaving"
          flat
          label="Overwrite"
          color="negative"
          @click="onOverwriteClick"
          :disable="!presetName"
        />
        <q-btn
          v-if="!presetExists && !isSaving"
          flat
          label="Save"
          color="primary"
          @click="onSaveClick"
          :disable="!presetName"
        />
        <q-btn v-if="isSaving" flat label="Saving..." color="primary" disable />
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
  emits: ["close", "save", ...useDialogPluginComponent.emits],
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
    const updatedControllers = ref([]);

    const onAbortSaving = () => {
      console.log("Aborting save operation");
      isAborting.value = true;

      // Emit an abort event with information about already updated controllers
      emit("abort", {
        name: presetName.value,
        updatedControllers: updatedControllers.value,
        existingId: existingPreset.value?.id,
      });

      // Close the dialog
      onDialogCancel();
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
      const updateProgressCallback = (completed, total, controllerIP) => {
        console.log(`Progress update in dialog: ${completed}/${total}`);
        progress.value.completed = completed;
        progress.value.total = total;

        // Track which controllers have been updated
        if (controllerIP && !updatedControllers.value.includes(controllerIP)) {
          updatedControllers.value.push(controllerIP);
        }

        // Don't close if we're aborting
        if (isAborting.value) {
          return;
        }
      };

      // Pass the data along with the updateProgress callback, but don't close the dialog yet
      const result = {
        name: presetName.value,
        isNew: true,
        updateProgress: updateProgressCallback,
        // Add a reference to dialogRef so the parent can close it
        dialogRef: dialogRef,
      };

      // CHANGE THIS LINE: Emit the "ok" event instead of canceling
      emit("ok", result);

      // DO NOT close the dialog here - the parent will close it when saving is complete
      // Remove this line: onDialogCancel();
    };

    const onOverwriteClick = () => {
      if (!presetName.value || !existingPreset.value) return;
      isSaving.value = true;

      // Create the progress update callback
      const updateProgressCallback = (completed, total) => {
        console.log(`Progress update in dialog: ${completed}/${total}`);
        progress.value.completed = completed;
        progress.value.total = total;
      };

      // Pass the data along with the updateProgress callback, but don't close the dialog yet
      const result = {
        name: presetName.value,
        isNew: false,
        existingId: existingPreset.value.id,
        favorite: existingPreset.value.favorite || false,
        updateProgress: updateProgressCallback,
        // Add a reference to dialogRef so the parent can close it
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
      updatedControllers,
      isAborting,
    };
  },
};
</script>
