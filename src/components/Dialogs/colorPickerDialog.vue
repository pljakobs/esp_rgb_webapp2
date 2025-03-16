<template>
  <q-dialog v-model="isOpen">
    <q-card>
      <q-card-section> [{{ type }}] </q-card-section>
      <q-card-section v-if="type === 'HSV'">
        hsv color picker here
        <HsvSection card-height="200" />
      </q-card-section>
      <q-card-section v-else-if="type === 'RAW'">
        raw color picker here
        <RawSection card-height="200" />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="onCancel" />
        <q-btn flat label="OK" color="primary" @click="onOk" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, watch } from "vue";
import { useDialogPluginComponent, colors } from "quasar";
import HsvSection from "src/components/cards/colorPickerSections/HsvSection.vue";
import RawSection from "src/components/cards/colorPickerSections/RawSection.vue";

const { hexToRgb, rgbToHsv } = colors;

export default {
  name: "ColorPickerDialog",
  props: {
    type: {
      type: String,
      required: true,
    },
    modelValue: {
      type: Boolean,
      required: true,
    },
  },
  emits: ["update:modelValue", "ok", "cancel"],
  components: {
    HsvSection,
    RawSection,
  },
  setup(props, { emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
      useDialogPluginComponent();
    const isOpen = ref(props.modelValue);
    const color = ref("#000000"); // Default color
    const type = ref(props.type);

    const onOk = () => {
      if (type.value === "HSV") {
        const rgb = hexToRgb(color.value); // Convert hex to RGB
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b); // Convert RGB to HSV
        emit("ok", hsv);
      } else {
        emit("ok", color.value);
      }
      emit("update:modelValue", false);
    };

    const onCancel = () => {
      emit("cancel");
      emit("update:modelValue", false);
    };

    watch(
      () => props.modelValue,
      (val) => {
        console.log("opening dialog, type=", type.value);
        isOpen.value = val;
      },
    );

    watch(
      () => props.type,
      (val) => {
        console.log("ColorPickerDialog type prop changed:", val);
        type.value = val;
      },
    );

    watch(isOpen, (val) => {
      if (val) {
        console.log("Dialog is now visible");
        // Perform any actions needed when the dialog becomes visible
      }
    });

    return {
      isOpen,
      onOk,
      onCancel,
      type,
      color,
      dialogRef,
      onDialogHide,
      onDialogOK,
      onDialogCancel,
    };
  },
};
</script>

<style scoped>
.scaled-color {
  width: 100%;
  height: 100%;
}
</style>
