<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card class="q-dialog-plugin" style="width: 400px; max-height: 600px">
      <q-toolbar :class="getToolbarClass">
        <q-toolbar_title>
          {{ dialogTitle }}
        </q-toolbar_title>
      </q-toolbar>

      <!-- Increased height to match the component height -->
      <q-card_section style="height: 420px; padding: 10px">
        <!-- Add PresetSection -->
        <PresetSection
          v-if="type === 'Preset'"
          :model-value="colorValue"
          :is-dialog="true"
          dialog-height="400px"
          @update:model-value="updateColorValue"
        />
        <!-- Keep existing sections -->
        <HsvSection
          v-if="type === 'HSV'"
          :model-value="colorValue"
          :is-dialog="true"
          dialog-height="400px"
          @update:model-value="updateColorValue"
        />
        <RawSection
          v-else-if="type === 'RAW'"
          :model-value="colorValue"
          :is-dialog="true"
          dialog-height="400px"
          @update:model-value="updateColorValue"
        />
      </q-card_section>

      <q-card_actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="onCancelClick" />
        <q-btn flat label="OK" color="primary" @click="onOkClick" />
      </q-card_actions>
    </q-card>
  </q-dialog>
</template>
<script>
import { ref, watch, onMounted, computed } from "vue";
import { useDialogPluginComponent } from "quasar";
import HsvSection from "src/components/cards/colorPickerSections/HsvSection.vue";
import RawSection from "src/components/cards/colorPickerSections/RawSection.vue";
import PresetSection from "src/components/cards/colorPickerSections/PresetSection.vue";
import { useAppDataStore } from "src/stores/appDataStore";

export default {
  name: "ColorPickerDialog",
  components: {
    HsvSection,
    RawSection,
    PresetSection,
  },
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      required: true,
      validator: (val) => ["HSV", "RAW", "Preset"].includes(val),
    },
    initialColor: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: [
    ...useDialogPluginComponent.emits,
    "update:model-value",
    "ok",
    "cancel",
  ],
  setup(props, { emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
      useDialogPluginComponent();
    const appData = useAppDataStore();

    // Default colors for each type with safe values
    const defaultHsv = { hsv: { h: 0, s: 100, v: 100 } };
    const defaultRaw = { raw: { r: 255, g: 0, b: 0, ww: 0, cw: 0 } };

    // Get first preset if available for default
    const getDefaultPreset = () => {
      const firstPreset = appData.data.presets?.[0];
      return { Preset: { id: firstPreset?.id || null } };
    };

    const dialogTitle = computed(() => {
      switch (props.type) {
        case "HSV":
          return "HSV Color Picker";
        case "RAW":
          return "RAW Color Values";
        case "Preset":
          return "Select Preset";
        default:
          return "Color Picker";
      }
    });

    const getToolbarClass = computed(() => {
      switch (props.type) {
        case "HSV":
          return "bg-primary";
        case "RAW":
          return "bg-secondary";
        case "Preset":
          return "bg-tertiary";
        default:
          return "bg-primary";
      }
    });

    // Initialize colorValue with appropriate default based on type
    const colorValue = ref(
      props.type === "HSV"
        ? defaultHsv
        : props.type === "RAW"
          ? defaultRaw
          : getDefaultPreset(),
    );

    // Helper function to ensure HSV values are valid
    const ensureValidHsv = (hsvObj) => {
      if (!hsvObj) return { h: 0, s: 100, v: 100 };

      return {
        h: Number(hsvObj.h ?? 0),
        s: Number(hsvObj.s ?? 100),
        v: Number(hsvObj.v ?? 100),
      };
    };

    // Helper function to ensure RAW values are valid
    const ensureValidRaw = (rawObj) => {
      if (!rawObj) return { r: 255, g: 0, b: 0, ww: 0, cw: 0 };

      return {
        r: Number(rawObj.r ?? 255),
        g: Number(rawObj.g ?? 0),
        b: Number(rawObj.b ?? 0),
        ww: Number(rawObj.ww ?? 0),
        cw: Number(rawObj.cw ?? 0),
      };
    };

    // Helper function to ensure Preset is valid
    const ensureValidPreset = (presetObj) => {
      if (!presetObj || !presetObj.id) {
        const defaultPreset = getDefaultPreset();
        return defaultPreset.Preset;
      }
      return { id: presetObj.id };
    };

    // Initialize with any provided initial colors
    onMounted(() => {
      try {
        if (props.initialColor) {
          if (props.type === "HSV") {
            const validHsv = ensureValidHsv(props.initialColor.hsv);
            colorValue.value = { hsv: validHsv };
          } else if (props.type === "RAW") {
            const validRaw = ensureValidRaw(props.initialColor.raw);
            colorValue.value = { raw: validRaw };
          } else if (props.type === "Preset") {
            const validPreset = ensureValidPreset(props.initialColor.Preset);
            colorValue.value = { Preset: validPreset };
          }
        }
      } catch (error) {
        console.error("Error initializing color picker:", error);
        // Set safe defaults on error
        if (props.type === "HSV") {
          colorValue.value = defaultHsv;
        } else if (props.type === "RAW") {
          colorValue.value = defaultRaw;
        } else if (props.type === "Preset") {
          colorValue.value = getDefaultPreset();
        }
      }
    });

    // Update the internal color value when a section emits an update
    const updateColorValue = (newValue) => {
      try {
        if (props.type === "HSV" && newValue.hsv) {
          colorValue.value = {
            hsv: ensureValidHsv(newValue.hsv),
          };
        } else if (props.type === "RAW" && newValue.raw) {
          colorValue.value = {
            raw: ensureValidRaw(newValue.raw),
          };
        } else if (props.type === "Preset" && newValue.Preset) {
          colorValue.value = {
            Preset: ensureValidPreset(newValue.Preset),
          };
        } else {
          colorValue.value = newValue;
        }
      } catch (error) {
        console.error("Error updating color value:", error);
      }
    };

    // Watch for the modelValue prop to control dialog visibility
    watch(
      () => props.modelValue,
      (val) => {
        if (val) {
          dialogRef.value.show();
        } else {
          dialogRef.value.hide();
        }
      },
    );

    // Handle OK button click
    const onOkClick = () => {
      try {
        let resultValue;

        if (props.type === "HSV") {
          resultValue = {
            hsv: ensureValidHsv(colorValue.value.hsv),
          };
        } else if (props.type === "RAW") {
          resultValue = {
            raw: ensureValidRaw(colorValue.value.raw),
          };
        } else if (props.type === "Preset") {
          resultValue = {
            Preset: ensureValidPreset(colorValue.value.Preset),
          };
        } else {
          resultValue = colorValue.value;
        }

        emit("ok", resultValue);
        emit("update:model-value", false);
        onDialogOK();
      } catch (error) {
        console.error("Error in onOkClick:", error);
        // Send fallback values on error
        if (props.type === "HSV") {
          emit("ok", defaultHsv);
        } else if (props.type === "RAW") {
          emit("ok", defaultRaw);
        } else {
          emit("ok", getDefaultPreset());
        }
        emit("update:model-value", false);
        onDialogOK();
      }
    };

    // Handle Cancel button click
    const onCancelClick = () => {
      emit("cancel");
      emit("update:model-value", false);
      onDialogCancel();
    };

    // Handle dialog hide (e.g., clicking outside the dialog)
    watch(dialogRef, () => {
      emit("update:model-value", false);
    });

    return {
      dialogRef,
      onDialogHide,
      onOkClick,
      onCancelClick,
      colorValue,
      updateColorValue,
      dialogTitle,
      getToolbarClass,
    };
  },
};
</script>

<style scoped>
.full-width {
  width: 100%;
}
</style>
