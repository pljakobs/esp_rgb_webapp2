<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin">
      <q-toolbar class="bg-primary text-white" v-if="!presetExists">
        <q-toolbar-title>Add Preset</q-toolbar-title>
        <q-badge :style="badgeStyle" round />
      </q-toolbar>
      <q-toolbar class="bg-warning text-dark" v-else>
        <q-toolbar-title>overwrite existing Preset</q-toolbar-title>
        <q-badge :style="badgeStyle" round />
      </q-toolbar>
      <q-card-section>
        <q-input v-model="presetName" label="Preset Name" filled autofocus />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="onCancelClick" />

        <q-btn
          v-if="presetExists"
          flat
          label="Overwrite"
          color="negative"
          @click="overwritePreset"
        />
        <q-btn
          v-if="!presetExists"
          flat
          label="Save"
          color="primary"
          @click="savePreset"
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
  emits: ["close", "save", ...useDialogPluginComponent.emits],
  setup(props, { emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
      useDialogPluginComponent();
    console.log("setup function called with props:", JSON.stringify(props));

    const presetName = ref("");
    const presetExists = ref(false);
    const presetData = useAppDataStore();

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

    const closeDialog = () => {
      emit("close");
    };

    const onCancelClick = () => {
      onDialogCancel();
    };

    const verifyPresetName = () => {
      const existingPreset = presetData.data.presets.find(
        (preset) => preset.name === presetName.value,
      );
      existingPreset
        ? (presetExists.value = true)
        : (presetExists.value = false);
    };

    const savePreset = () => {
      const newPreset = {
        name: presetName.value,
        type: props.presetType,
        data: props.preset,
      };
      console.log("dialogOk, new preset:", newPreset);
      onDialogOK(newPreset);
    };

    const overwritePreset = () => {
      const existingPreset = presetData.data.presets.find(
        (preset) => preset.name === presetName.value,
      );
      if (existingPreset) {
        presetData.deletePreset(existingPreset);
      }
      savePreset();
    };

    watch(presetName, verifyPresetName);

    return {
      dialogRef,
      onDialogHide,
      onCancelClick,
      verifyPresetName,
      savePreset,
      overwritePreset,
      badgeStyle,
      presetName,
      presetExists,
    };
  },
};
</script>
