<template>
  <component :is="scrollContainer" :style="scrollStyle">
    <q-card-section class="flex justify-center no-padding">
      <q-color
        v-if="!profile || profile.rgb"
        :model-value="internalColor"
        format-model="hex"
        no-header
        no-footer
        class="scaled-color"
        @update:model-value="updateColor"
      />
      <LightControlSlider
        :model-value="brightness"
        :label="$t('color.brightness')"
        :display-value="`${Math.round(brightness)}%`"
        :min="0"
        :max="100"
        :step="0.1"
        @update:model-value="updateBrightness"
      >
        <template #action>
          <q-toggle
            v-if="showPower"
            :model-value="powerOn"
            :disable="powerBusy || powerOn === null"
            :aria-label="$t('color.power')"
            @update:model-value="$emit('update:power', $event)"
          />
        </template>
      </LightControlSlider>
    </q-card-section>

    <q-card-section v-if="supportsColorTemp" class="q-pa-none">
      <LightControlSlider
        :model-value="ct"
        :label="$t('color.colorTemperature')"
        :display-value="`${Math.round(ct)} K`"
        :min="minCt"
        :max="maxCt"
        temperature
        @update:model-value="updateTemperature"
      />
    </q-card-section>

    <q-card-section class="flex justify-center" v-if="!isDialog && !profile">
      <q-btn flat color="primary" @click="onAddPreset">
        <template v-slot:default>
          <svgIcon name="star_outlined" />
          <span>Add Preset</span>
        </template>
      </q-btn>
    </q-card-section>
  </component>
</template>

<script>
import { ref, watch, computed } from "vue";
import { colors, QScrollArea } from "quasar";
import { useColorDataStore } from "src/stores/colorDataStore";
import { configDataStore } from "src/stores/configDataStore";
import LightControlSlider from "src/components/LightControlSlider.vue";

const { hexToRgb, rgbToHsv, rgbToHex, hsvToRgb } = colors;

export default {
  components: { LightControlSlider },
  props: {
    profile: { type: Object, default: null },
    showPower: { type: Boolean, default: false },
    powerOn: { type: Boolean, default: null },
    powerBusy: { type: Boolean, default: false },
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
  emits: ["update:modelValue", "update:power", "add-preset"],
  setup(props, { emit }) {
    const internalColor = ref("#000000");
    const ct = ref(0);
    const brightness = ref(0);
    const currentHsv = ref({ h: 0, s: 0, v: 0 });
    const colorStore = useColorDataStore();
    const configData = configDataStore();
    const scrollContainer = computed(() => !props.isDialog && props.cardHeight === "auto" ? "div" : QScrollArea);
    const scrollStyle = computed(() => scrollContainer.value === "div" ? undefined : { height: props.isDialog ? props.dialogHeight : props.cardHeight });

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
            currentHsv.value = {
              h: newValue.hsv.h ?? 0,
              s: newValue.hsv.s ?? 0,
              v: brightness.value,
            };
            const rgb = hsvToRgb(newValue.hsv);
            internalColor.value = rgbToHex(rgb);
          } else if (props.profile?.channels.length === 1 && Array.isArray(newValue?.raw)) {
            brightness.value = (newValue.raw[0] ?? 0) * 100 / 1023;
          }
          if (newValue?.hsv?.ct !== undefined) {
            ct.value = Math.max(minCt.value, Math.min(maxCt.value, newValue.hsv.ct));
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
          const hsv = props.profile && !props.profile.rgb
            ? { h: 0, s: 0, v: brightness.value }
            : currentHsv.value;

          // Round values to 1 decimal place instead of 2
          const roundedHsv = {
            h: Math.round(hsv.h * 10) / 10,
            s: Math.round(hsv.s * 10) / 10,
            v: Math.round(hsv.v * 10) / 10,
          };

          // Emit the new color value include ct
          emit("update:modelValue", { hsv: roundedHsv, ct: ct.value });
        } catch (error) {
          console.log("Error in color/ct watcher:", error);
        }
      }
    };

    const updateColor = (value) => {
      internalColor.value = value;
      currentHsv.value = rgbToHsv(hexToRgb(value));
      brightness.value = currentHsv.value.v;
      emitUpdate();
    };
    const updateBrightness = (value) => {
      brightness.value = value;
      if (!props.profile || props.profile.rgb) {
        currentHsv.value = { ...currentHsv.value, v: value };
        internalColor.value = rgbToHex(hsvToRgb(currentHsv.value));
      }
      emitUpdate();
    };
    const updateTemperature = (value) => {
      ct.value = value;
      emitUpdate();
    };

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
      updateColor,
      updateBrightness,
      updateTemperature,
      scrollContainer,
      scrollStyle,
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
.scaled-color :deep(.q-color-picker__hue .q-slider__track) {
  height: 28px !important;
  border-radius: 14px;
}
.scaled-color :deep(.q-color-picker__hue .q-slider__inner),
.scaled-color :deep(.q-color-picker__hue .q-slider__selection) {
  border-radius: 14px;
}
.hsv-section {
  display: flex;
  flex-direction: column;
}
</style>
