<template>
  <div class="preset-section" :class="{ 'in-dialog': isDialog }">
    <q-scroll-area
      :style="{ height: isDialog ? dialogHeight : cardHeight, width: '100%' }"
    >
      <q-list separator :dense="isDialog">
        <template v-if="activePresets.length != 0">
          <q-item
            v-for="preset in activePresets"
            :key="preset.name"
            :class="{
              'q-my-sm': !isDialog,
              'q-my-xs': isDialog,
              'selected-preset': isDialog && selectedPresetId === preset.id,
            }"
            clickable
            @click="handlePresetClick(preset)"
          >
            <!-- Smaller badges in dialog mode -->
            <q-item-section avatar :class="{ 'dialog-avatar': isDialog }">
              <div v-if="preset.color.hsv">
                <q-badge
                  :style="{
                    backgroundColor: `rgb(${hsvToRgb(preset.color.hsv).r}, ${
                      hsvToRgb(preset.color.hsv).g
                    }, ${hsvToRgb(preset.color.hsv).b})`,
                    width: isDialog ? '20px' : '30px',
                    height: isDialog ? '20px' : '30px',
                    borderRadius: '50%',
                    border: '1px solid black',
                  }"
                  round
                />
              </div>
              <div v-else>
                <RawBadge :color="preset.color" :is-dialog="isDialog" />
              </div>
            </q-item-section>

            <!-- Make type badge smaller or optional in dialog mode -->
            <q-item-section
              avatar
              :class="{ 'dialog-avatar': isDialog }"
              v-if="!isDialog || preset.color.raw"
            >
              <q-badge
                style="background-color: black; color: white"
                :style="{ fontSize: isDialog ? '0.6em' : '0.8em' }"
                round
              >
                {{ preset.color.raw ? "RAW" : "HSV" }}
              </q-badge>
            </q-item-section>

            <!-- Name - make more compact in dialog -->
            <q-item-section>
              <div :class="{ 'text-subtitle2': isDialog }">
                {{ preset.name }}
              </div>
            </q-item-section>

            <!-- Only show these controls when not in dialog mode -->
            <q-item-section side v-if="!isDialog">
              <svgIcon
                name="star_outlined"
                :isSelected="preset.favorite"
                @click.stop="toggleFavorite(preset)"
              />
              <q-tooltip>{{
                preset.favorite ? "Remove from favorites" : "Add to favorites"
              }}</q-tooltip>
            </q-item-section>
            <q-item-section side v-if="!isDialog">
              <div class="icon-wrapper" @click.stop="deletePreset(preset)">
                <svgIcon name="delete" />
              </div>
              <q-tooltip>Delete Preset</q-tooltip>
            </q-item-section>
          </q-item>
        </template>
        <template v-else>
          <div
            class="no-presets-container"
            :style="{ height: isDialog ? '200px' : '100%' }"
          >
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
    // Fixed: wrapped in props object
    modelValue: {
      type: Object,
      default: () => ({}),
    },
    isDialog: {
      type: Boolean,
      default: false,
    },
    dialogHeight: {
      type: String,
      default: "400px",
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
    const selectedPresetId = ref(props.modelValue?.Preset?.id || null);

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
        if (props.isDialog) {
          // Just select the preset visually but don't emit yet
          selectedPresetId.value = preset.id;

          // Still update model value but don't expect parent to act on it yet
          emit("update:modelValue", {
            Preset: {
              id: preset.id,
            },
          });
        } else {
          // Normal mode - emit immediately
          emit("update:modelValue", { ...preset.color });
        }
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
        Dialog.create({
          component: DeleteAllPresetsDialog,
          persistent: true,
        });
      } catch (error) {
        console.error("Error showing delete all presets dialog:", error);
      }
    };

    // Fixed: removed the early return and included all functions
    return {
      activePresets,
      handlePresetClick,
      toggleFavorite,
      deletePreset,
      deleteAllPresets,
      hsvToRgb,
      selectedPresetId, // Added this
      // No need to use props.isDialog here - Vue exposes props in the template
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
