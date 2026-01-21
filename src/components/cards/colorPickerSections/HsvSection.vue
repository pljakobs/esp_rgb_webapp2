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
    
    <!-- Added CT Slider Section -->
    <q-card-section class="q-px-lg q-pt-md" style="max-width: 300px; margin: 0 auto;">
      <div class="text-caption text-grey-7 q-mb-xs">Color Temperature</div>
      <div class="row items-center no-wrap">
        <svgIcon name="thermostat" class="q-mr-sm text-grey-7" />
        <q-slider
          v-model="ct"
          :min="minCt"
          :max="maxCt"
          label
          color="orange"
          class="col"
        >
          <q-tooltip>Color Temperature</q-tooltip>
        </q-slider>
      </div>
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
import { configDataStore } from "src/stores/configDataStore";

const { hexToRgb, rgbToHsv, rgbToHex, hsvToRgb } = colors;

export default {
  props: {
    modelValue: {
      type: Object,
      default: () => ({ hsv: { h: 0, s: 0, v: 0 }, ct: 0 }),
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
    const ct = ref(0);
    const colorStore = useColorDataStore();
    const configData = configDataStore();

    const minCt = computed(() => {
        // Defaults if parsing fails
        try{
           return configData.data.color.colortemp.ww || 2500;
        } catch {
            return 2500
        }
    })

    const maxCt = computed(() => {
        try{
           return configData.data.color.colortemp.cw || 9000;
        } catch {
            return 9000
        }
    })

    // Flag to prevent emitting during prop updates from websocket events
    const updatingFromProps = ref(false);

    // Watch for changes in props.modelValue
    watch(
      () => props.modelValue,
      (newValue) => {
        // Set flag to prevent emitting
        updatingFromProps.value = true;

        try {
          if (newValue?.hsv) {
            const rgb = hsvToRgb(newValue.hsv);
            internalColor.value = rgbToHex(rgb);
          }
          if (newValue?.ct !== undefined) {
             ct.value = newValue.ct;
          }
        } catch (error) {
           console.log("Error processing updates from props:", error);
        }

        // Reset flag after DOM update
        setTimeout(() => {
          updatingFromProps.value = false;
        }, 0);
      },
      { immediate: true, deep: true },
    );

    // Helper to emit updates
    const emitUpdate = () => {
      // Only emit if not updating from props and not from websocket
      if (!updatingFromProps.value && colorStore.change_by !== "websocket") {
        try {
          const rgb = hexToRgb(internalColor.value);
          let hsv = rgbToHsv(rgb);

          // Round values to 1 decimal place instead of 2
          hsv = {
            h: Math.round(hsv.h * 10) / 10,
            s: Math.round(hsv.s * 10) / 10,
            v: Math.round(hsv.v * 10) / 10,
          };

          // Emit the new color value include ct
          emit("update:modelValue", { hsv, ct: ct.value });
        } catch (error) {
          console.log("Error in color/ct watcher:", error);
        }
      }
    };

    // Watch for changes in the color picker or CT slider
    watch(internalColor, emitUpdate);
    watch(ct, emitUpdate);

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
          ct: ct.value,
        },
      });
    };

    return {
      internalColor,
      ct,
      minCt,
      maxCt,
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
