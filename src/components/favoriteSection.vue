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
            class="swatch"
            :style="{
              backgroundColor: `rgb(${hsvToRgb(preset.color.hsv).r}, ${hsvToRgb(preset.color.hsv).g}, ${hsvToRgb(preset.color.hsv).b})`,
            }"
          >
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
import { presetDataStore } from "src/stores/presetDataStore";
import { colorDataStore } from "src/stores/colorDataStore";

const { hsvToRgb } = colors;

export default {
  name: "favoriteSection",
  setup() {
    const presetData = presetDataStore();
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
      colorData.updateData("hsv", preset.color.hsv);
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
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  border-radius: 8px;
  color: white;
  text-shadow: 1px 1px 2px black;
}

.swatch-name {
  text-align: center;
  font-weight: bold;
}
</style>
