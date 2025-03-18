<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card class="q-dialog-plugin" style="width: 400px; max-height: 600px">
      <q-toolbar :class="getToolbarClass">
        <q-toolbar-title>
          {{ dialogTitle }}
        </q-toolbar-title>
      </q-toolbar>

      <!-- Increased height to match the component height -->
      <q-card-section style="height: 420px; padding: 10px">
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
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="onCancelClick" />
        <q-btn flat label="OK" color="primary" @click="onOkClick" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
<script>
import { ref, watch, onMounted, computed } from "vue";
import { useDialogPluginComponent } from "quasar";
import HsvSection from "src/components/cards/colorPickerSections/HsvSection.vue";
import RawSection from "src/components/cards/colorPickerSections/RawSection.vue";
import PresetSection from "src/components/cards/colorPickerSections/PresetSection.vue";

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

    // Default colors for each type
    const defaultHsv = { hsv: { h: 0, s: 0, v: 0 } };
    const defaultRaw = { raw: { r: 0, g: 0, b: 0, ww: 0, cw: 0 } };
    const defaultPreset = { Preset: { id: null } };

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

    // Track the current color value
    const colorValue = ref(props.type === "HSV" ? defaultHsv : defaultRaw);

    // Initialize with any provided initial colors
    onMounted(() => {
      if (props.initialColor) {
        if (props.type === "HSV" && props.initialColor.hsv) {
          colorValue.value = { hsv: { ...props.initialColor.hsv } };
        } else if (props.type === "RAW" && props.initialColor.raw) {
          colorValue.value = { raw: { ...props.initialColor.raw } };
        } else if (props.type === "Preset" && props.initialColor.Preset) {
          colorValue.value = { Preset: { ...props.initialColor.Preset } };
        }
      }
    });

    // Update the internal color value when a section emits an update
    const updateColorValue = (newValue) => {
      colorValue.value = newValue;
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
      emit("ok", colorValue.value);
      emit("update:model-value", false);
      onDialogOK();
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
