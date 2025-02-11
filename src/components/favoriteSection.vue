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
import { colorDataStore } from "src/stores/colorDataStore";
import RawBadge from "src/components/RawBadge.vue";

const { hsvToRgb } = colors;

export default {
  name: "favoriteSection",
  components: {
    RawBadge,
  },
  setup() {
    const presetData = useAppDataStore();
    const colorData = colorDataStore();

    const cols = ref(3); // Number of columns in the grid

    const favoritePresets = computed(() =>
      presetData.data.presets.filter((preset) => preset.favorite),
    );

    const selectPreset = (preset) => {
      console.log("Selected preset:", preset);
      // Handle preset selection here
    };

    const setColor = (preset) => {
      // Set the color in the colorDataStore
      console.log("Setting color to:", JSON.stringify(preset));
      colorData.change_by = "preset";
      preset.color.hsv
        ? colorData.updateData("hsv", preset.color.hsv)
        : colorData.updateData("raw", preset.color.raw);
    };
    return {
      favoritePresets,
      cols,
      selectPreset,
      setColor,
      hsvToRgb,
    };
  },
};
</script>

<style scoped>
.flex-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.color-swatch {
  cursor: pointer;
  flex: 1 1 100%; /* Adjust the width and gap as needed */
  box-sizing: border-box;
}

@media (min-width: 400px) {
  .color-swatch {
    flex: 1 1 calc(50% - 10px); /* Two swatches per row with a 10px gap */
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
