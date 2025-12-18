<!-- filepath: /home/pjakobs/devel/esp_rgb_webapp2/src/components/Dialogs/SceneComponents/ControllerItem.vue -->
<template>
  <div class="controller-item q-mb-sm">
    <div class="controller-header row items-center full-width justify-between">
      <!-- Left side with controller info - NOT clickable -->
      <div class="row items-center flex-grow">
        <q-item-section avatar>
          <color-display-badge :color="primarySetting?.color" />
        </q-item-section>

        <q-item-section>
          <q-item-label>{{ controller.hostname }}</q-item-label>
          <q-item-label caption>{{ displayValue }}</q-item-label>
        </q-item-section>
      </div>

      <!-- Toggle icon on the right - ONLY THIS is clickable for expansion -->
      <div
        class="toggle-container"
        @click="$emit('toggle-expansion', controller.id)"
      >
        <svgIcon
          name="arrow_drop_down"
          class="toggle-icon"
          :class="{ 'rotate-right': !isExpanded }"
        />
      </div>
    </div>

    <!-- Expandable content -->
    <q-slide-transition>
      <div v-show="isExpanded">
        <q-card class="q-ma-sm">
          <q-card-section>
            <!-- Draggable component for settings -->
            <draggable
              :list="settings"
              handle=".drag-handle"
              item-key="pos"
              @end="onDragEnd"
              ghost-class="ghost"
              v-if="settings.length > 0"
              class="q-mb-md"
            >
              <template #item="{ element: sceneSetting }">
                <scene-setting-item
                  :scene-setting="sceneSetting"
                  :color-type-options="colorTypeOptions"
                  :direction-options="directionOptions"
                  :queue-options="queueOptions"
                  @update-queue-settings="updateQueueSettings"
                  @color-type-change="
                    (type) => onColorTypeChange(type, sceneSetting)
                  "
                  @edit-selection="editCurrentSelection(sceneSetting)"
                  @remove-setting="$emit('remove-setting', sceneSetting)"
                />
              </template>
            </draggable>

            <!-- Add a button to add new setting - moved below the list -->
            <q-btn
              color="primary"
              flat
              dense
              class="q-mt-sm"
              @click="addNewSetting"
            >
              <svgIcon name="add" />
              <span class="q-ml-xs">Add Color Setting</span>
            </q-btn>
          </q-card-section>
        </q-card>
      </div>
    </q-slide-transition>
  </div>
</template>

<script>
import { ref, computed } from "vue";
import { Dialog } from "quasar";
import draggable from "vuedraggable";
import { useAppDataStore } from "src/stores/appDataStore";
import colorPickerDialog from "src/components/Dialogs/colorPickerDialog.vue";
import ColorDisplayBadge from "src/components/ColorDisplayBadge.vue";
import SceneSettingItem from "./SceneSettingItem.vue";

export default {
  name: "ControllerItem",
  components: {
    draggable,
    ColorDisplayBadge,
    SceneSettingItem,
  },
  props: {
    controller: {
      type: Object,
      required: true,
    },
    settings: {
      type: Array,
      required: true,
    },
    isExpanded: {
      type: Boolean,
      default: false,
    },
    colorTypeOptions: {
      type: Array,
      required: true,
    },
    directionOptions: {
      type: Array,
      required: true,
    },
    queueOptions: {
      type: Array,
      required: true,
    },
  },
  emits: [
    "toggle-expansion",
    "settings-updated",
    "add-setting",
    "remove-setting",
    "update-positions",
  ],
  setup(props, { emit }) {
    const appData = useAppDataStore();

    // Get the primary setting (pos=0) for display in the header
    const primarySetting = computed(() => {
      if (!props.settings || props.settings.length === 0) return null;

      // Try to find one with pos=0 first
      const setting = props.settings.find((s) => s.pos === 0);
      return setting || props.settings[0]; // Fallback to first if no pos=0
    });

    // Get a display value for the current color selection
    const displayValue = computed(() => {
      if (!primarySetting.value || !primarySetting.value.color)
        return "No Color";

      if (primarySetting.value.color.hsv) {
        const { h, s, v } = primarySetting.value.color.hsv;
        return `HSV (${h}°, ${s}%, ${v}%)`;
      }

      if (primarySetting.value.color.raw) {
        const { r, g, b } = primarySetting.value.color.raw;
        return `RGB (${r}, ${g}, ${b})`;
      }

      if (primarySetting.value.color.Preset) {
        const presetId = primarySetting.value.color.Preset.id;
        const preset = appData.data.presets.find((p) => p.id === presetId);
        return `Preset: ${preset ? preset.name : "Unknown"}`;
      }

      return "No Color";
    });

    // On drag end - update positions and emit event
    const onDragEnd = () => {
      updatePositions();
      emit("update-positions", props.settings);
      emit("settings-updated");
    };

    // Update positions after drag and drop reordering
    const updatePositions = () => {
      props.settings.forEach((setting, index) => {
        setting.pos = index;
      });
    };

    // Add a new setting (uses emit to inform parent)
    const addNewSetting = () => {
      // Determine the highest position
      let maxPos = 0;
      if (props.settings.length > 0) {
        maxPos = Math.max(
          ...props.settings.map((s) => (s.pos !== undefined ? s.pos : 0)),
        );
      }

      // Create new setting with next position
      const newSetting = {
        controller_id: props.controller.id,
        pos: maxPos + 1,
        color: { hsv: {} }, // Use empty hsv object by default
      };

      emit("add-setting", newSetting);
    };

    // Helper to update queue settings for all settings of this controller
    const updateQueueSettings = () => {
      // If there is only one setting with transitions, it should be "single"
      // Otherwise all should be "back"
      const transitionSettings = props.settings.filter(
        (s) => s.transition && s.transition.cmd === "fade",
      );

      if (transitionSettings.length === 1) {
        transitionSettings[0].transition.q = "single";
      } else if (transitionSettings.length > 1) {
        transitionSettings.forEach((s) => {
          s.transition.q = "back";
        });
      }

      emit("settings-updated");
    };

    // When a color type is changed
    const onColorTypeChange = (colorType, sceneSetting) => {
      // Set default value based on type
      if (colorType === "hsv") {
        sceneSetting.color = {
          hsv: { h: 0, s: 100, v: 100 },
        };
      } else if (colorType === "raw") {
        sceneSetting.color = {
          raw: { r: 255, g: 0, b: 0 },
        };
      } else if (colorType === "preset") {
        // Find first preset for default
        const firstPreset = appData.data.presets[0];
        if (firstPreset) {
          sceneSetting.color = {
            Preset: { id: firstPreset.id },
          };
        } else {
          sceneSetting.color = { hsv: {} }; // Fallback to empty hsv
        }
      } else {
        sceneSetting.color = { hsv: {} }; // Use empty hsv instead of null
      }

      emit("settings-updated");
    };

    // Edit the current color selection
    const editCurrentSelection = (sceneSetting) => {
      if (!sceneSetting || !sceneSetting.color) return;

      try {
        if (sceneSetting.color.hsv) {
          // Create a valid hsv object with default values
          const hsv = {
            h: sceneSetting.color.hsv.h ?? 0,
            s: sceneSetting.color.hsv.s ?? 100,
            v: sceneSetting.color.hsv.v ?? 100,
          };

          // Open HSV color picker
          try {
            Dialog.create({
              component: colorPickerDialog,
              componentProps: {
                type: "HSV",
                initialColor: { hsv: { ...hsv } }, // Pass a copy, not a reference
              },
            }).onOk((result) => {
              try {
                console.log("HSV Dialog result:", result);
                // Create a new object instead of modifying the existing one
                if (result && result.hsv) {
                  sceneSetting.color = {
                    hsv: {
                      h: Number(result.hsv.h ?? hsv.h),
                      s: Number(result.hsv.s ?? hsv.s),
                      v: Number(result.hsv.v ?? hsv.v),
                    },
                  };
                }
                emit("settings-updated");
              } catch (err) {
                console.error("Error in HSV dialog onOk handler:", err);
                // Ensure we always have valid values even if there was an error
                sceneSetting.color = { hsv: { h: 0, s: 100, v: 100 } };
                emit("settings-updated");
              }
            });
          } catch (dialogErr) {
            console.error("Error creating HSV dialog:", dialogErr);
          }
        } else if (sceneSetting.color.raw) {
          const raw = {
            r: sceneSetting.color.raw.r ?? 255,
            g: sceneSetting.color.raw.g ?? 0,
            b: sceneSetting.color.raw.b ?? 0,
          };

          try {
            Dialog.create({
              component: colorPickerDialog,
              componentProps: {
                type: "RAW",
                initialColor: { raw: { ...raw } }, // Pass a copy
              },
            }).onOk((result) => {
              try {
                console.log("RAW Dialog result:", result);
                if (result && result.raw) {
                  sceneSetting.color = {
                    raw: {
                      r: Number(result.raw.r ?? raw.r),
                      g: Number(result.raw.g ?? raw.g),
                      b: Number(result.raw.b ?? raw.b),
                    },
                  };
                }
                emit("settings-updated");
              } catch (err) {
                console.error("Error in RAW dialog onOk handler:", err);
                sceneSetting.color = { raw: { r: 255, g: 0, b: 0 } };
                emit("settings-updated");
              }
            });
          } catch (dialogErr) {
            console.error("Error creating RAW dialog:", dialogErr);
          }
        } else if (sceneSetting.color.Preset) {
          // For Preset, we need to make sure the id exists
          const presetId = sceneSetting.color.Preset.id;
          const firstPreset = appData.data.presets[0];

          // If no valid preset id, fallback to the first available preset
          const validPresetId =
            presetId || (firstPreset ? firstPreset.id : null);

          if (!validPresetId) {
            // If no presets at all, switch to HSV
            sceneSetting.color = { hsv: { h: 0, s: 100, v: 100 } };
            emit("settings-updated");
            return;
          }

          try {
            Dialog.create({
              component: colorPickerDialog,
              componentProps: {
                type: "Preset",
                initialColor: { Preset: { id: validPresetId } },
              },
            }).onOk((result) => {
              try {
                console.log("Preset Dialog result:", result);
                if (result) {
                  // Handle different result formats
                  const resultId =
                    result.id || (result.Preset && result.Preset.id);
                  if (resultId) {
                    sceneSetting.color = { Preset: { id: resultId } };
                  }
                }
                emit("settings-updated");
              } catch (err) {
                console.error("Error in Preset dialog onOk handler:", err);
                if (validPresetId) {
                  sceneSetting.color = { Preset: { id: validPresetId } };
                } else {
                  sceneSetting.color = { hsv: { h: 0, s: 100, v: 100 } };
                }
                emit("settings-updated");
              }
            });
          } catch (dialogErr) {
            console.error("Error creating Preset dialog:", dialogErr);
          }
        }
      } catch (outerError) {
        console.error("Outer error in editCurrentSelection:", outerError);
        // Ensure we have valid values as a last resort
        sceneSetting.color = { hsv: { h: 0, s: 100, v: 100 } };
        emit("settings-updated");
      }
    };

    return {
      primarySetting,
      displayValue,
      onDragEnd,
      updatePositions,
      addNewSetting,
      updateQueueSettings, // Make sure this is returned!
      onColorTypeChange,
      editCurrentSelection,
    };
  },
};
</script>

<style scoped>
.controller-item {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  margin-bottom: 8px;
}

.controller-header {
  padding: 8px 16px;
  display: flex;
  align-items: center;
}

.toggle-icon {
  transition: transform 0.3s;
  cursor: pointer;
}

.rotate-right {
  transform: rotate(-90deg);
}

.toggle-container {
  padding: 4px;
  cursor: pointer;
  border-radius: 50%;
  transition: background-color 0.3s;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-container:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.ghost {
  opacity: 0.5;
  background: #c8ebfb;
}

@media (max-width: 599px) {
  .controller-item {
    margin-bottom: 4px;
  }
}
</style>
