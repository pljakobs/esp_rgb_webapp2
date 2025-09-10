<template>
  <q-scroll-area :style="{ height: isDialog ? dialogHeight : cardHeight }">
    <q-card-section class="flex justify-center no-padding">
      <q-color
        v-model="internalColor"
        format-model="hex"
        no-header
        no-footer
        class="scaled-color"
      />
    </q-card-section>
    <q-card-section class="flex justify-center" v-if="!isDialog">
      <q-btn flat color="primary" @click="onAddPreset">
        <template v-slot:default>
          <svgIcon name="star_outlined" />
          <span>Add Preset</span>
        </template>
      </q-btn>
    </q-card-section>
  </q-scroll-area>
</template>

<script>
import { ref, watch, computed } from "vue";
import { colors } from "quasar";
import { useColorDataStore } from "src/stores/colorDataStore";

const { hexToRgb, rgbToHsv, rgbToHex, hsvToRgb } = colors;

export default {
  props: {
    modelValue: {
      type: Object,
      default: () => ({ hsv: { h: 0, s: 0, v: 0 } }),
    },
    isDialog: {
      type: Boolean,
      default: false,
    },
    cardHeight: {
      type: String,
      default: "300px",
    },
    dialogHeight: {
      type: String,
      default: "280px",
    },
  },
  emits: ["update:modelValue", "add-preset"],
  setup(props, { emit }) {
    const internalColor = ref("#000000");
    const colorStore = useColorDataStore();

    // Flag to prevent emitting during prop updates from websocket events
    const updatingFromProps = ref(false);

    // Watch for changes in props.modelValue
    watch(
      () => props.modelValue,
      (newValue) => {
        if (newValue?.hsv) {
          try {
            // Set flag to prevent emitting
            updatingFromProps.value = true;

            const rgb = hsvToRgb(newValue.hsv);
            internalColor.value = rgbToHex(rgb);

            // Reset flag after DOM update
            setTimeout(() => {
              updatingFromProps.value = false;
            }, 0);
          } catch (error) {
            console.log("Error converting HSV to hex:", error);
            updatingFromProps.value = false;
          }
        }
      },
      { immediate: true, deep: true },
    );

    // Watch for changes in the color picker
    watch(internalColor, (val) => {
      // Only emit if not updating from props and not from websocket
      if (!updatingFromProps.value && colorStore.change_by !== "websocket") {
        try {
          const rgb = hexToRgb(val);
          let hsv = rgbToHsv(rgb);

          // Round values to 1 decimal place instead of 2
          hsv = {
            h: Math.round(hsv.h * 10) / 10,
            s: Math.round(hsv.s * 10) / 10,
            v: Math.round(hsv.v * 10) / 10,
          };

          // Emit the new color value
          emit("update:modelValue", { hsv });
        } catch (error) {
          console.log("Error in color picker watcher:", error);
        }
      }
    });

    const onAddPreset = () => {
      // Get the current HSV value and emit it for preset creation
      const rgb = hexToRgb(internalColor.value);
      const hsv = rgbToHsv(rgb);

      emit("add-preset", {
        type: "hsv",
        value: {
          h: Math.round(hsv.h * 10) / 10,
          s: Math.round(hsv.s * 10) / 10,
          v: Math.round(hsv.v * 10) / 10,
        },
      });
    };

    return {
      internalColor,
      onAddPreset,
    };
  },
};
</script>

<style scoped>
.no-padding {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}
.scaled-color {
  width: 150%;
  height: 150%;
}
.hsv-section {
  display: flex;
  flex-direction: column;
}
</style>
