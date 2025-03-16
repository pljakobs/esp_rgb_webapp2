<template>
  <q-scroll-area style="height: 100%; width: 100%">
    <q-card-section class="q-pa-md">
      <div class="flex-container">
        <div
          v-for="preset in favoritePresets"
          :key="preset.name"
          class="color-swatch"
          @click="setColor(preset)"
        >
          <div
            v-if="preset.color.hsv"
            class="swatch"
            :style="{
              backgroundColor: `rgb(${hsvToRgb(preset.color.hsv).r}, ${hsvToRgb(preset.color.hsv).g}, ${hsvToRgb(preset.color.hsv).b})`,
            }"
          >
            <div class="swatch-name">{{ preset.name }}</div>
          </div>
          <div
            v-else
            class="swatch"
            :style="{
              backgroundColor: `rgb(140,127,127)`,
            }"
          >
            <RawBadge :color="preset.color" class="raw-badge" />
            <div class="swatch-name">{{ preset.name }}</div>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-scroll-area>
</template>

<script>
import { ref, computed } from "vue";
import { colors } from "quasar";
import { useAppDataStore } from "src/stores/appDataStore";
import RawBadge from "src/components/RawBadge.vue";

const { hsvToRgb } = colors;

export default {
  name: "favoriteSection",
  components: {
    RawBadge,
  },
  props: {
    isDialog: {
      type: Boolean,
      default: false,
    },
    cardHeight: {
      type: String,
      default: "300px",
    },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const presetData = useAppDataStore();
    const cols = ref(3);

    const favoritePresets = computed(() =>
      presetData.data.presets.filter((preset) => preset.favorite),
    );

    const setColor = (preset) => {
      // Emit the selected color
      emit("update:modelValue", { ...preset.color });
    };

    return {
      favoritePresets,
      cols,
      setColor,
      hsvToRgb,
    };
  },
};
</script>

<style scoped>
/* Existing styles remain the same */
.flex-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.color-swatch {
  cursor: pointer;
  flex: 1 1 100%;
  box-sizing: border-box;
}

@media (min-width: 400px) {
  .color-swatch {
    flex: 1 1 calc(50% - 10px);
  }
}

.swatch {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  border-radius: 8px;
  color: white;
  text-shadow: 1px 1px 2px black;
}

.raw-badge {
  position: absolute;
  top: 35%;
  left: 5%;
}

.swatch-name {
  text-align: center;
  font-weight: bold;
}
</style>
