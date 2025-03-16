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
            <div v-if="preset.color.hsv">
              <q-badge
                :style="{
                  backgroundColor: `rgb(${hsvToRgb(preset.color.hsv).r}, ${
                    hsvToRgb(preset.color.hsv).g
                  }, ${hsvToRgb(preset.color.hsv).b})`,
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: '1px solid black',
                }"
                round
                @click="handlePresetClick(preset)"
              />
            </div>
            <div v-else>
              <RawBadge
                :color="preset.color"
                @click="handlePresetClick(preset)"
              />
            </div>
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
          <q-item-section side v-if="!isDialog">
            <svgIcon
              name="star_outlined"
              :isSelected="preset.favorite"
              @click="toggleFavorite(preset)"
            />
            <q-tooltip>{{
              preset.favorite ? "Remove from favorites" : "Add to favorites"
            }}</q-tooltip>
          </q-item-section>
          <q-item-section side v-if="!isDialog">
            <div class="icon-wrapper" @click="deletePreset(preset)">
              <svgIcon name="delete" />
            </div>
            <q-tooltip>Delete Preset</q-tooltip>
          </q-item-section>
        </q-item>
      </template>
      <template v-else>
        <div class="no-presets-container">
          <div class="no-presets-message">No presets available</div>
        </div>
      </template>
    </q-list>
  </q-scroll-area>
  <!--<div v-if="!isDialog && activePresets.length > 0" class="q-my-sm">-->
  <div
    v-if="!isDialog && activePresets.length > 0"
    class="delete-all-container"
  >
    <q-btn color="negative" @click="deleteAllPresets" class="full-width" flat>
      <svgIcon name="delete_forever" />
      Delete All Presets
    </q-btn>
  </div>
</template>

<script>
import { ref, computed, onMounted } from "vue";
import { colors, Dialog } from "quasar";
import { useAppDataStore } from "src/stores/appDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import RawBadge from "src/components/RawBadge.vue";
import DeletePresetDialog from "src/components/Dialogs/deletePresetDialog.vue";
import DeleteAllPresetsDialog from "src/components/Dialogs/deleteAllPresetsDialog.vue";

const { hsvToRgb } = colors;

export default {
  name: "PresetSection",
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
    const appData = useAppDataStore();
    const controllers = useControllersStore();
    const selectedPreset = ref(null);
    const selectedControllers = ref([]);

    onMounted(() => {
      try {
        appData.fetchData();
      } catch (error) {
        console.error("Error fetching preset data:", error);
      }
    });

    const activePresets = computed(() => {
      try {
        const presets = appData.data.presets || [];
        return presets;
      } catch (error) {
        console.error("Error computing activePresets:", error);
        return [];
      }
    });

    const handlePresetClick = (preset) => {
      try {
        emit("update:modelValue", { ...preset.color });
      } catch (error) {
        console.error("Error handling preset click:", error);
      }
    };

    const toggleFavorite = async (preset) => {
      try {
        appData.toggleFavorite(preset);
      } catch (error) {
        console.error("Error toggling favorite:", error);
      }
    };

    const deletePreset = async (preset) => {
      try {
        // Show a single dialog that handles both confirmation and progress
        Dialog.create({
          component: DeletePresetDialog,
          componentProps: {
            preset: preset,
          },
          persistent: true,
        });
      } catch (error) {
        console.error("Error deleting preset:", error);
      }
    };

    const deleteAllPresets = async () => {
      try {
        // Show the confirmation dialog for deleting all presets
        Dialog.create({
          component: DeleteAllPresetsDialog,
          persistent: true,
        });
      } catch (error) {
        console.error("Error showing delete all presets dialog:", error);
      }
    };

    return {
      activePresets,
      handlePresetClick,
      toggleFavorite,
      deletePreset,
      deleteAllPresets,
      hsvToRgb,
      isDialog: props.isDialog,
    };
  },
};
</script>

<style scoped>
/* Existing styles remain the same */
.icon {
  color: var(--icon-color);
  fill: var(--icon-color);
}
.text-yellow {
  color: yellow;
}
.no-presets-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
}
.no-presets-message {
  background-color: #f0f0f0;
  padding: 20px;
  border-radius: 10px;
  text-align: center;
  color: #333;
}
</style>
