<template>
  <q-scroll-area :style="{ height: isDialog ? dialogHeight : cardHeight }">
    <q-card-section class="flex justify-center no-padding">
      <q-color
        v-if="!profile || profile.rgb"
        v-model="internalColor"
        format-model="hex"
        no-header
        no-footer
        class="scaled-color"
      />
      <div v-else class="full-width q-px-lg q-pt-md">
        <div class="text-caption text-grey-7">{{ $t('color.brightness') }}</div>
        <q-slider v-model="brightness" :aria-label="$t('color.brightness')" :min="0" :max="100" :step="0.1" label />
      </div>
    </q-card-section>

    <!-- Added CT Slider Section -->
    <q-card-section
      class="q-px-lg q-pt-md"
      style="max-width: 300px; margin: 0 auto"
      v-if="supportsColorTemp"
    >
      <div class="text-caption text-grey-7 q-mb-xs">{{ $t('color.colorTemperature') }}</div>
      <div class="row items-center no-wrap">
        <svgIcon name="lightbulb_outlined" class="q-mr-sm text-grey-7" />
        <q-slider
          v-model="ct"
          :aria-label="$t('color.colorTemperature')"
          :min="minCt"
          :max="maxCt"
          label
          color="orange"
          class="col"
        >
          <q-tooltip>{{ $t('color.colorTemperature') }}</q-tooltip>
        </q-slider>
      </div>
    </q-card-section>

    <q-card-section class="flex justify-center" v-if="!isDialog && !profile">
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
    profile: { type: Object, default: null },
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
    const brightness = ref(0);
    const colorStore = useColorDataStore();
    const configData = configDataStore();

    const minCt = computed(() => {
      if (props.profile) return props.profile.colortemp.ww;
      // Defaults if parsing fails
      try {
        return configData.data.color.colortemp.ww || 2500;
      } catch {
        return 2500;
      }
    });

    const maxCt = computed(() => {
      if (props.profile) return props.profile.colortemp.cw;
      try {
        return configData.data.color.colortemp.cw || 9000;
      } catch {
        return 9000;
      }
    });

    const supportsColorTemp = computed(
      () => props.profile ? props.profile.ct : configData.hasColorTemperatureSupport,
    );
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
            brightness.value = newValue.hsv.v ?? 0;
            const rgb = hsvToRgb(newValue.hsv);
            internalColor.value = rgbToHex(rgb);
          } else if (props.profile?.channels.length === 1 && Array.isArray(newValue?.raw)) {
            brightness.value = (newValue.raw[0] ?? 0) * 100 / 1023;
          }
          if (newValue?.hsv?.ct !== undefined) {
            ct.value = newValue.hsv.ct;
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
          if (props.profile?.channels.length === 1 && Array.isArray(props.modelValue.raw)) {
            emit("update:modelValue", { raw: [Math.round(brightness.value * 1023 / 100)] });
            return;
          }
          const rgb = hexToRgb(internalColor.value);
          let hsv = rgbToHsv(rgb);
          if (props.profile && !props.profile.rgb) hsv = { h: 0, s: 0, v: brightness.value };

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
    watch(brightness, emitUpdate);

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
      brightness,
      ct,
      minCt,
      maxCt,
      onAddPreset,
      supportsColorTemp,
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
