<template>
  <q-scroll-area style="height: 100%; width: 100%">
    <q-card-section class="q-pa-md">
      <q-grid :cols="cols" class="q-gutter-md">
        <q-grid-item
          v-for="preset in favoritePresets"
          :key="preset.name"
          class="color-swatch"
          @click="selectPreset(preset)"
        >
          <div
            class="swatch"
            :style="{
              backgroundColor: `rgb(${hsvToRgb(preset.color.hsv).r}, ${hsvToRgb(preset.color.hsv).g}, ${hsvToRgb(preset.color.hsv).b})`,
            }"
          >
            <div class="swatch-name">{{ preset.name }}</div>
          </div>
        </q-grid-item>
      </q-grid>
    </q-card-section>
  </q-scroll-area>
</template>

<script>
import { ref, computed } from "vue";
import { colors } from "quasar";
import { presetDataStore } from "src/stores/presetDataStore";

const { hsvToRgb } = colors;

export default {
  name: "favoriteSection",
  setup() {
    const presetData = presetDataStore();
    const cols = ref(3); // Number of columns in the grid

    const favoritePresets = computed(() =>
      presetData.data.presets.filter((preset) => preset.favorite)
    );

    const selectPreset = (preset) => {
      console.log("Selected preset:", preset);
      // Handle preset selection here
    };

    return {
      favoritePresets,
      cols,
      selectPreset,
      hsvToRgb,
    };
  },
};
</script>

<style scoped>
.color-swatch {
  cursor: pointer;
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
