<!-- filepath: /home/pjakobs/devel/esp_rgb_webapp2/src/components/PresetSection.vue -->
<template>
  <q-scroll-area style="height: 100%; width: 100%">
    <q-list separator style="overflow-y: auto; height: 100%">
      <template v-if="activePresets.length != 0">
        <q-item
          v-for="preset in activePresets"
          :key="preset.name"
          class="q-my-sm"
        >
          <q-item-section avatar>
            <q-badge
              :style="{
                backgroundColor: preset.color.raw
                  ? `rgb(${preset.color.raw.r}, ${preset.color.raw.g}, ${preset.color.raw.b})`
                  : `rgb(${hsvToRgb(preset.color.hsv).r}, ${hsvToRgb(preset.color.hsv).g}, ${hsvToRgb(preset.color.hsv).b})`,
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                border: '1px solid black',
              }"
              round
              @click="handlePresetClick(preset)"
            />
          </q-item-section>
          <q-item-section avatar>
            <q-badge
              style="background-color: black; color: white; font-size: 0.8em"
              round
              @click="handlePresetClick(preset)"
            >
              {{ preset.color.raw ? "RAW" : "HSV" }}
            </q-badge>
          </q-item-section>
          <q-item-section @click="handlePresetClick(preset)">
            {{ preset.name }}
          </q-item-section>
          <q-item-section side>
            <svgIcon
              name="star_outlined"
              :isSelected="preset.favorite"
              @click="toggleFavorite(preset)"
            />
          </q-item-section>
          <q-item-section side>
            <div class="icon-wrapper" @click="deletePreset(preset)">
              <svgIcon name="delete" />
            </div>
          </q-item-section>
        </q-item>
      </template>
      <template v-else>
        <q-item>
          <q-item-section>
            <div class="text-center q-pa-md">No presets available</div>
          </q-item-section>
        </q-item>
      </template>
    </q-list>
  </q-scroll-area>
</template>

<script>
import { computed, onMounted } from "vue";
import { colors } from "quasar";
import { presetDataStore } from "src/stores/presetDataStore";
import { colorDataStore } from "src/stores/colorDataStore";

const { hsvToRgb } = colors;

export default {
  name: "PresetSection",
  setup() {
    const presetData = presetDataStore();
    const colorData = colorDataStore();

    // Fetch presets data on component mount
    onMounted(() => {
      presetData.fetchData();
    });

    const activePresets = computed(() => {
      const presets = presetData.data.presets;
      if (!presets) {
        return [];
      }
      console.log("activePresets", JSON.stringify(presets));
      return presets;
    });

    const handlePresetClick = (preset) => {
      console.log("preset selected", preset);

      if (preset.color.raw) {
        colorData.change_by = "preset";
        colorData.updateData("raw", preset.color.raw);
      } else {
        colorData.change_by = "preset";
        colorData.updateData("hsv", preset.color.hsv);
      }
    };

    const toggleFavorite = async (preset) => {
      console.log("toggle Favorite", JSON.stringify(preset));
      try {
        preset.favorite = !preset.favorite;
        await presetData.updatePreset(preset.name, {
          favorite: preset.favorite,
        });
        console.log("toggled favorite for preset", preset.name);
      } catch (error) {
        console.error("Error toggling favorite:", error);
      }
    };

    const deletePreset = async (preset) => {
      try {
        await presetData.deletePreset(preset);
        console.log("deleted preset", preset);
      } catch (error) {
        console.error("Error deleting preset:", error);
      }
    };

    return {
      activePresets,
      handlePresetClick,
      toggleFavorite,
      deletePreset,
      hsvToRgb,
    };
  },
};
</script>

<style scoped>
.icon {
  color: var(--icon-color);
  fill: var(--icon-color);
}
.text-yellow {
  color: yellow;
}
</style>
