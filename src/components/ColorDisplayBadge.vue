<template>
  <div>
    <!-- HSV Color Badge -->
    <div v-if="color?.hsv">
      <q-badge
        :style="{
          backgroundColor: `rgb(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b})`,
          width: '25px',
          height: '25px',
          borderRadius: '50%',
          border: '1px solid black',
        }"
        round
      />
    </div>
    <!-- RAW Color Badge -->
    <div v-else-if="color?.raw">
      <RawBadge :color="color" />
    </div>
    <!-- Preset Badge -->
    <div v-else-if="color?.Preset">
      <q-badge class="preset-badge" :label="presetName" color="primary" />
    </div>
    <!-- No selection -->
    <div v-else><svgIcon name="palette_outlined" /></div>
  </div>
</template>

<script>
import { computed } from "vue";
import { colors } from "quasar";
import RawBadge from "src/components/RawBadge.vue";
import { getPresetName } from "src/services/tools.js";
import { useAppDataStore } from "src/stores/appDataStore";

const { hsvToRgb } = colors;

export default {
  name: "ColorDisplayBadge",
  components: {
    RawBadge,
  },
  props: {
    color: {
      type: Object,
      default: null,
    },
  },
  setup(props) {
    const appData = useAppDataStore();

    const rgbColor = computed(() => {
      if (props.color?.hsv) {
        // Provide default values for any missing HSV properties
        const hsv = {
          h: props.color.hsv.h ?? 0,
          s: props.color.hsv.s ?? 100,
          v: props.color.hsv.v ?? 100,
        };
        try {
          return hsvToRgb(hsv);
        } catch (error) {
          console.error("Error converting HSV to RGB:", error);
          return { r: 0, g: 0, b: 0 };
        }
      }
      return { r: 0, g: 0, b: 0 };
    });

    const presetName = computed(() => {
      if (props.color?.Preset?.id) {
        return getPresetName(props.color.Preset.id);
      }
      return "Unknown";
    });

    return {
      rgbColor,
      presetName,
    };
  },
};
</script>

<style scoped>
.preset-badge {
  min-width: 25px;
  height: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 15px;
  padding: 0 8px;
  font-size: 0.8em;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
  white-space: nowrap;
}

@media (max-width: 599px) {
  .preset-badge {
    max-width: 80px;
  }
}
</style>
