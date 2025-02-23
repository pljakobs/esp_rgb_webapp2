<template>
  <q-dialog ref="dialog" @hide="onDialogHide">
    <q-card class="q-dialog-plugin">
      <q-card-section>
        <div class="text-h6">
          <q-badge :style="badgeStyle" round />
          Add Preset
        </div>
      </q-card-section>
      <q-card-section>
        <q-input
          v-model="presetName"
          label="Preset Name"
          filled
          autofocus
          @keyup.enter="verifyPresetName"
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="closeDialog" />
        <div v-if="presetExists" class="text-negative">Preset exists</div>
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
          @click="verifyPresetName"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed } from "vue";
import { colors } from "quasar";
import { useAppDataStore } from "src/stores/appDataStore";

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
  emits: ["close", "save"],
  setup(props, { emit }) {
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
      return {
        backgroundColor: "transparent",
        width: "30px",
        height: "30px",
        borderRadius: "50%",
        border: "1px solid black",
      };
    });

    const closeDialog = () => {
      emit("close");
    };

    const verifyPresetName = () => {
      const existingPreset = presetData.data.presets.find(
        (preset) => preset.name === presetName.value,
      );
      if (existingPreset) {
        presetExists.value = true;
      } else {
        savePreset();
      }
    };

    const savePreset = () => {
      const newPreset = {
        name: presetName.value,
        type: props.presetType,
        data: props.preset,
      };
      emit("save", newPreset);
      closeDialog();
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

    return {
      presetName,
      presetExists,
      closeDialog,
      verifyPresetName,
      savePreset,
      overwritePreset,
      badgeStyle,
    };
  },
};
</script>
