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
                backgroundColor: preset.raw
                  ? `rgb(${preset.raw.r}, ${preset.raw.g}, ${preset.raw.b})`
                  : `rgb(${hsvToRgb(preset.hsv).r}, ${hsvToRgb(preset.hsv).g}, ${hsvToRgb(preset.hsv).b})`,
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
              {{ preset.raw ? "RAW" : "HSV" }}
            </q-badge>
          </q-item-section>
          <q-item-section @click="handlePresetClick(preset)">
            {{ preset.name }}
          </q-item-section>
          <q-item-section side>
            <q-icon
              name="star"
              size="2em"
              :class="{ 'text-yellow': preset.favorite }"
              @click="toggleFavorite(preset)"
            />
          </q-item-section>
          <q-item-section side>
            <q-icon name="delete" size="2em" @click="deletePreset(preset)" />
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
import { computed } from "vue";
import { colors } from "quasar";
import { presetDataStore } from "src/stores/presetDataStore";
import { colorDataStore } from "src/stores/colorDataStore";

const { hsvToRgb } = colors;

export default {
  name: "PresetSection",
  setup() {
    const presetData = presetDataStore();
    const colorData = colorDataStore();

    const activePresets = computed(() => {
      const presets = presetData.data["presets"];
      if (!presets) {
        return [];
      }
      return presets.filter((preset) => !preset.deleted);
    });

    const handlePresetClick = (preset) => {
      console.log("preset selected", preset);

      if (preset.raw) {
        colorData.change_by = "preset";
        colorData.updateData("raw", preset.raw);
      } else {
        colorData.change_by = "preset";
        colorData.updateData("hsv", preset.hsv);
      }
    };

    const toggleFavorite = (preset) => {
      preset.favorite = !preset.favorite;
      presetData.updatePreset(preset);
    };

    const deletePreset = (preset) => {
      // Remove the preset from presetData.data['presets']
      presetData.deletePreset(preset);
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

<style scoped></style>
