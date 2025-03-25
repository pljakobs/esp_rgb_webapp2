<template>
  <q-dialog
    ref="dialogRef"
    @hide="handleDialogHide"
    full-width
    :maximized="$q.platform.is.mobile"
  >
    <q-card class="q-dialog-plugin scene-dialog-card">
      <!-- Toolbar -->
      <q-toolbar>
        <q-toolbar-title>
          {{ isEditMode ? "Edit Scene" : "Add Scene" }}
        </q-toolbar-title>
        <q-btn flat round dense @click="onCancelClick">
          <svgIcon name="close_outlined" />
          <q-tooltip>Cancel</q-tooltip>
        </q-btn>
      </q-toolbar>

      <!-- Main content -->
      <q-scroll-area ref="scrollAreaRef" class="scene-dialog-scroll">
        <!-- Scene name -->
        <q-card-section>
          <q-input
            v-model="scene.name"
            label="Scene Name"
            filled
            autofocus
            :max-length="20"
          />
        </q-card-section>

        <!-- Group selection -->
        <q-card-section v-if="groupOptions.length !== 0">
          <mySelect
            v-model="scene.group_id"
            :options="groupOptions"
            label="Select Group"
            filled
            @update:model-value="onGroupChange"
            emit-value
            map-options
          />
        </q-card-section>
        <q-card-section v-else class="text-center text-negative">
          A scene needs at least one group to be defined
        </q-card-section>

        <q-card-section>
          <div class="default-transition-container q-mb-sm">
            <!-- Header row with toggle - similar to controller item -->
            <div class="row items-center justify-between q-mb-xs">
              <div class="row items-center">
                <div class="text-subtitle2">Scene Default Transition</div>
                <q-tooltip>
                  This transition will be used as the default for new settings
                </q-tooltip>
              </div>

              <q-btn
                flat
                dense
                round
                :color="scene.defaultTransition ? 'primary' : 'grey'"
                @click="toggleDefaultTransition"
              >
                <svgIcon name="timer" />
                <q-tooltip>
                  {{
                    scene.defaultTransition
                      ? "Edit default transition"
                      : "Add default transition"
                  }}
                </q-tooltip>
              </q-btn>
            </div>

            <!-- Description text -->
            <div class="text-caption q-mb-sm">
              Set the default transition that will apply to new color settings
              in this scene
            </div>

            <!-- Slide transition for the panel -->
            <q-slide-transition>
              <div v-show="isDefaultTransitionVisible">
                <TransitionPanel
                  v-model="scene"
                  :direction-options="directionOptions"
                  is-default-transition
                  @update-queue-settings="updateAllQueueSettings"
                />
              </div>
            </q-slide-transition>
          </div>
        </q-card-section>

        <!-- Controllers section -->
        <q-card-section>
          <div class="text-subtitle2 q-mb-sm">Controllers in this group</div>
          <controller-item
            v-for="controller in controllersInGroup"
            :key="controller.id"
            :id="`controller-${controller.id}`"
            :controller="controller"
            :settings="getControllerSceneSettings(controller.id)"
            :is-expanded="expandedItems[controller.id]"
            :color-type-options="colorTypeOptions"
            :direction-options="directionOptions"
            :queue-options="queueOptions"
            @toggle-expansion="toggleExpansion"
            @settings-updated="checkSaveDisabled"
            @add-setting="addSetting"
            @remove-setting="removeSetting"
            @update-positions="updateSettingPositions"
          />
        </q-card-section>

        <!-- Progress bar for saving -->
        <q-card-section v-if="progress.total > 0">
          <q-linear-progress
            :value="progress.completed / progress.total"
            color="primary"
          />
          <div class="text-caption q-mt-xs">
            {{ progress.completed }} / {{ progress.total }} controllers updated
          </div>
        </q-card-section>
      </q-scroll-area>

      <!-- Action buttons -->
      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat label="Cancel" color="primary" @click="onCancelClick" />
        <q-space />
        <q-btn
          v-if="sceneExists"
          flat
          label="Overwrite"
          color="negative"
          @click="onSaveClick"
          :disabled="isSaveDisabled"
        />
        <q-btn
          v-if="!sceneExists"
          flat
          label="Save"
          color="primary"
          @click="onSaveClick"
          :disabled="isSaveDisabled"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed, nextTick } from "vue";
import { useAppDataStore } from "src/stores/appDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import mySelect from "src/components/mySelect.vue";
import { getControllersInGroup } from "src/services/tools.js";
import ControllerItem from "./SceneComponents/ControllerItem.vue";
import TransitionPanel from "./SceneComponents/TransitionPanel.vue";

// Define queue options as a constant to ensure it's always available
const QUEUE_OPTIONS = [
  { label: "None (ignore)", value: null },
  { label: "Single", value: "single" },
  { label: "Back", value: "back" },
];

export default {
  name: "sceneDialog",
  components: {
    mySelect,
    ControllerItem,
    TransitionPanel,
  },
  props: {
    scene: {
      type: Object,
      default: () => ({
        id: "",
        name: "",
        group_id: "",
        settings: [],
        ts: Date.now(),
      }),
    },
  },
  emits: ["ok", "hide"],
  setup(props, { emit }) {
    const dialogRef = ref(null);
    const appData = useAppDataStore();
    const controllersStore = useControllersStore();
    const expandedItems = ref({});
    const isDefaultTransitionVisible = ref(false);
    const scrollAreaRef = ref(null);

    // Make queueOptions available to components
    const queueOptions = QUEUE_OPTIONS;

    // Create a local copy of the scene to avoid modifying the prop directly
    const scene = ref(
      props.scene ? JSON.parse(JSON.stringify(props.scene)) : null,
    );

    // Tracking for save progress
    const progress = ref({
      completed: 0,
      total: 0,
    });

    // Check if we're editing an existing scene
    const isEditMode = computed(() => Boolean(scene.value && scene.value.id));

    const directionOptions = ref([
      { label: "Forward", value: 0 },
      { label: "Reverse", value: 1 },
    ]);

    // Debug helper function
    const debugSceneData = (label, sceneData) => {
      console.group(`Scene Debug: ${label}`);
      console.log("Scene object:", JSON.parse(JSON.stringify(sceneData)));
      if (sceneData?.settings?.length) {
        console.log(`Settings count: ${sceneData.settings.length}`);
        console.log(
          "First setting:",
          JSON.parse(JSON.stringify(sceneData.settings[0])),
        );
      } else {
        console.log("No settings found");
      }
      console.groupEnd();
    };

    // Check if a scene with this name already exists
    const sceneExists = computed(() => {
      if (!scene.value) return false;
      if (isEditMode.value) return false; // Ignore for edit mode

      const existingScene = appData.data.scenes.find(
        (s) => s.name.toLowerCase() === scene.value.name.toLowerCase(),
      );
      return Boolean(existingScene);
    });

    // Check if form is valid for saving
    const isSaveDisabled = ref(true);

    const checkSaveDisabled = () => {
      if (!scene.value) {
        isSaveDisabled.value = true;
        return;
      }

      if (!scene.value.name || !scene.value.group_id) {
        isSaveDisabled.value = true;
        return;
      }

      // Check if scene has any settings
      isSaveDisabled.value =
        !scene.value.settings || scene.value.settings.length === 0;
    };

    // Toggle default transition display and initialization
    const toggleDefaultTransition = () => {
      isDefaultTransitionVisible.value = !isDefaultTransitionVisible.value;

      // If it's becoming visible and there's no default transition yet, initialize it
      if (isDefaultTransitionVisible.value && !scene.value.defaultTransition) {
        scene.value.defaultTransition = {
          cmd: "fade",
          d: 0,
          s: 10,
          r: false,
        };
      }
    };

    // Function to handle updates to queue settings
    const updateAllQueueSettings = () => {
      console.log("Default transition settings updated");
    };

    // Get list of available groups for the dropdown
    const groupOptions = computed(() => {
      if (!appData.data.groups) return [];
      return appData.data.groups.map((group) => ({
        label: group.name,
        value: group.id,
      }));
    });

    // Get controllers in the selected group
    const controllersInGroup = computed(() => {
      if (!scene.value || !scene.value.group_id) {
        return [];
      }

      if (!controllersStore.data) {
        return [];
      }

      // Try using the utility function from tools.js first
      const controllers = getControllersInGroup(scene.value.group_id);
      if (controllers && controllers.length > 0) {
        return controllers;
      }

      // Fallback to original method if the utility didn't work
      const group = appData.data.groups.find(
        (g) => g.id === scene.value.group_id,
      );
      if (!group) {
        return [];
      }

      if (!group.controller_ids || !Array.isArray(group.controller_ids)) {
        // Try legacy 'controllers' property if it exists
        if (group.controllers && Array.isArray(group.controllers)) {
          return group.controllers.filter((c) => c.ip_address);
        }
        return [];
      }

      // Convert all IDs to strings for reliable comparison
      const controllerIds = group.controller_ids.map((id) => String(id));

      const matchedControllers = controllersStore.data.filter(
        (controller) =>
          controller.ip_address &&
          controllerIds.includes(String(controller.id)),
      );

      return matchedControllers;
    });

    // Options for the color type dropdown
    const colorTypeOptions = ref([
      { label: "No Color", value: null },
      { label: "HSV Color", value: "hsv" },
      { label: "Raw Color", value: "raw" },
      { label: "Preset", value: "preset" },
    ]);

    // Get all scene settings for a controller, sorted by position
    const getControllerSceneSettings = (controllerId) => {
      if (!scene.value || !scene.value.settings || !controllerId) {
        return [];
      }

      try {
        // Convert controllerId to string for consistent comparison
        const controllerIdStr = String(controllerId);

        const settings = scene.value.settings.filter(
          (setting) =>
            setting && String(setting.controller_id) === controllerIdStr,
        );

        // Log for debugging
        console.log(
          `Found ${settings.length} settings for controller ${controllerId}`,
        );

        // Sort by position
        return settings.sort((a, b) => {
          // Ensure pos exists, default to 0 if missing
          const posA = a && a.pos !== undefined ? a.pos : 0;
          const posB = b && b.pos !== undefined ? b.pos : 0;
          return posA - posB;
        });
      } catch (error) {
        console.error("Error in getControllerSceneSettings:", error);
        return [];
      }
    };

    // Scroll to a specific element by ID
    const scrollToElement = (elementId) => {
      nextTick(() => {
        const element = document.getElementById(elementId);
        if (element && scrollAreaRef.value) {
          // Get the current scroll position
          const currentScrollPosition = scrollAreaRef.value.getScrollPosition();

          // Get the element's position relative to the scroll container
          const elementRect = element.getBoundingClientRect();
          const scrollAreaRect =
            scrollAreaRef.value.$el.getBoundingClientRect();

          // Calculate if element is in view
          const isInView =
            elementRect.top >= scrollAreaRect.top &&
            elementRect.bottom <= scrollAreaRect.bottom;

          // Only scroll if not in view
          if (!isInView) {
            // Scroll with a small offset from the top
            scrollAreaRef.value.setScrollPosition(
              "vertical",
              currentScrollPosition.top +
                (elementRect.top - scrollAreaRect.top) -
                20,
              300, // animation duration in ms
            );
          }
        }
      });
    };

    // Function to add a new setting
    const addSetting = (newSetting) => {
      if (!scene.value || !scene.value.settings) return;

      // If there's a default transition defined, apply it to the new setting
      if (scene.value.defaultTransition) {
        newSetting.transition = JSON.parse(
          JSON.stringify(scene.value.defaultTransition),
        );
      }

      scene.value.settings.push(newSetting);
      checkSaveDisabled();

      // Scroll to the controller containing the new setting
      scrollToElement(`controller-${newSetting.controller_id}`);
    };

    // When the group changes, update controller settings
    const onGroupChange = (groupId) => {
      if (!scene.value) return;

      try {
        // For existing scenes with settings, don't clear the existing settings
        const isEditingWithSettings =
          isEditMode.value &&
          scene.value.settings &&
          scene.value.settings.length > 0;

        if (!isEditingWithSettings) {
          // Only clear and recreate settings for new scenes
          scene.value.settings = [];

          // Get controllers and make sure it's not empty
          const controllers = controllersInGroup.value || [];

          // Add settings for each controller in the group
          controllers.forEach((controller) => {
            if (controller && controller.id) {
              scene.value.settings.push({
                controller_id: controller.id,
                pos: 0, // Default position
                color: { hsv: { h: 0, s: 100, v: 100 } }, // Use valid HSV instead of null
              });
            }
          });
        }

        checkSaveDisabled();
      } catch (error) {
        console.error("Error in onGroupChange:", error);
      }
    };

    const updateProgress = (completed, total) => {
      progress.value = { completed, total };
    };

    // When dialog is closed
    const handleDialogHide = () => {
      // Prepare callbacks
      nextTick(() => {
        emit("hide");
      });
    };

    const onCancelClick = () => {
      dialogRef.value.hide();
    };

    // Toggle expansion for a controller
    const toggleExpansion = (id) => {
      try {
        if (!id) {
          console.error("Invalid controller ID in toggleExpansion");
          return;
        }

        // Toggle expansion state
        expandedItems.value = {
          ...expandedItems.value,
          [id]: !expandedItems.value[id],
        };

        // Scroll to the controller if it's being expanded
        if (expandedItems.value[id]) {
          scrollToElement(`controller-${id}`);
        }
      } catch (error) {
        console.error("Error in toggleExpansion:", error);
      }
    };

    // Remove a setting
    const removeSetting = (settingToRemove) => {
      if (!scene.value || !scene.value.settings) return;

      const index = scene.value.settings.findIndex(
        (s) =>
          s.controller_id === settingToRemove.controller_id &&
          s.pos === settingToRemove.pos,
      );

      if (index >= 0) {
        scene.value.settings.splice(index, 1);
        checkSaveDisabled();
      }
    };

    // Update positions after drag and drop
    const updateSettingPositions = (updatedSettings) => {
      if (!scene.value || !scene.value.settings || !updatedSettings.length)
        return;

      const controllerId = updatedSettings[0].controller_id;

      // Remove all settings for this controller
      scene.value.settings = scene.value.settings.filter(
        (s) => s.controller_id !== controllerId,
      );

      // Add back the updated ones
      scene.value.settings.push(...updatedSettings);
      checkSaveDisabled();
    };

    // Save the scene with proper formatting
    const onSaveClick = () => {
      try {
        if (!scene.value) {
          console.error("No scene to save");
          return;
        }

        const sceneToSave = JSON.parse(JSON.stringify(scene.value));

        // Process default transition if it exists
        if (sceneToSave.defaultTransition) {
          // Convert direction to number if it's a string
          if (typeof sceneToSave.defaultTransition.d === "string") {
            sceneToSave.defaultTransition.d = Number(
              sceneToSave.defaultTransition.d,
            );
          }

          // Convert requeue to boolean
          if (sceneToSave.defaultTransition.r !== undefined) {
            if (typeof sceneToSave.defaultTransition.r === "string") {
              sceneToSave.defaultTransition.r =
                sceneToSave.defaultTransition.r.toLowerCase() === "true";
            } else {
              sceneToSave.defaultTransition.r = Boolean(
                sceneToSave.defaultTransition.r,
              );
            }
          }

          // Remove q property if it exists
          if (sceneToSave.defaultTransition.q !== undefined) {
            delete sceneToSave.defaultTransition.q;
          }
        }

        // Process settings to match the new schema
        if (sceneToSave.settings) {
          sceneToSave.settings.forEach((setting, index) => {
            // Convert controller_id to string
            if (setting.controller_id !== undefined) {
              setting.controller_id = String(setting.controller_id);
            }

            // Remove UI-only fadeType property
            if (setting.fadeType !== undefined) {
              delete setting.fadeType;
            }

            // Ensure color is not null - default to empty hsv object
            if (setting.color === null || setting.color === undefined) {
              setting.color = { hsv: { h: 0, s: 100, v: 100 } };
            }

            // Process transition if it exists
            if (setting.transition) {
              // Convert r to boolean
              if (setting.transition.r !== undefined) {
                // First check if it's a string value like "true"/"false"
                if (typeof setting.transition.r === "string") {
                  setting.transition.r =
                    setting.transition.r.toLowerCase() === "true";
                } else {
                  setting.transition.r = Boolean(setting.transition.r);
                }
              }

              // Set queue type based on position (first=single, others=back)
              if (index === 0) {
                setting.transition.q = "single";
              } else {
                setting.transition.q = "back";
              }

              // Convert direction to number if it's a string
              if (typeof setting.transition.d === "string") {
                setting.transition.d = Number(setting.transition.d);
              }
            }

            // Move legacy transition properties to transition object
            if (!setting.transition) {
              if (
                setting.cmd === "fade" ||
                setting.d !== undefined ||
                setting.s !== undefined ||
                setting.t !== undefined ||
                setting.q !== undefined ||
                setting.r !== undefined
              ) {
                setting.transition = {};

                // Move each transition property
                ["d", "s", "t", "cmd", "q", "r"].forEach((prop) => {
                  if (setting[prop] !== undefined) {
                    setting.transition[prop] = setting[prop];
                    delete setting[prop];
                  }
                });

                // Convert r to boolean if needed
                if (setting.transition.r !== undefined) {
                  if (typeof setting.transition.r === "string") {
                    setting.transition.r =
                      setting.transition.r.toLowerCase() === "true";
                  } else {
                    setting.transition.r = Boolean(setting.transition.r);
                  }
                }
              }
            }
          });
        }

        // Add callback functions
        sceneToSave.saveComplete = () => {
          if (dialogRef.value) {
            dialogRef.value.hide();
          }
        };

        sceneToSave.updateProgress = updateProgress;

        emit("ok", sceneToSave);
      } catch (error) {
        console.error("Error in onSaveClick:", error);
      }
    };

    // Initial processing of scene data
    if (props.scene && props.scene.settings) {
      debugSceneData("Before scene processing", props.scene);

      // Ensure all settings have proper color objects and controller IDs
      nextTick(() => {
        // First, make a deep copy to avoid mutating props
        scene.value = JSON.parse(JSON.stringify(props.scene));

        // Process settings to ensure proper format
        if (scene.value.settings) {
          scene.value.settings.forEach((setting) => {
            // Ensure controller_id is a string for reliable comparisons
            if (setting.controller_id !== undefined) {
              setting.controller_id = String(setting.controller_id);
            }

            // Ensure color exists and is properly formatted
            if (setting.color === null || setting.color === undefined) {
              setting.color = { hsv: { h: 0, s: 100, v: 100 } };
            }

            // Migrate legacy transition properties to transition object
            if (!setting.transition) {
              if (
                setting.cmd === "fade" ||
                setting.d !== undefined ||
                setting.s !== undefined ||
                setting.t !== undefined ||
                setting.q !== undefined ||
                setting.r !== undefined
              ) {
                setting.transition = {};

                // Move each transition property
                ["d", "s", "t", "cmd", "q", "r"].forEach((prop) => {
                  if (setting[prop] !== undefined) {
                    setting.transition[prop] = setting[prop];
                    delete setting[prop];
                  }
                });
              }
            }

            // Initialize or convert the r property to boolean
            if (setting.transition) {
              if (setting.transition.r === undefined) {
                setting.transition.r = false;
              } else if (typeof setting.transition.r === "string") {
                setting.transition.r =
                  setting.transition.r.toLowerCase() === "true";
              } else {
                setting.transition.r = Boolean(setting.transition.r);
              }
            }

            // Set fadeType for UI (based on whether 's' or 't' is present)
            if (setting.transition?.s !== undefined) {
              setting.fadeType = "speed";
            } else if (setting.transition?.t !== undefined) {
              setting.fadeType = "time";
            }
          });
        }

        // Also handle the default transition if it exists
        if (scene.value.defaultTransition) {
          if (scene.value.defaultTransition.r === undefined) {
            scene.value.defaultTransition.r = false;
          } else if (typeof scene.value.defaultTransition.r === "string") {
            scene.value.defaultTransition.r =
              scene.value.defaultTransition.r.toLowerCase() === "true";
          } else {
            scene.value.defaultTransition.r = Boolean(
              scene.value.defaultTransition.r,
            );
          }
        }

        debugSceneData("After scene processing", scene.value);
      });
    } else {
      // If no settings, create default empty ones
      if (props.scene && !props.scene.settings) {
        scene.value.settings = [];
      }

      // If a group is already selected and this is a new scene, create default settings
      if (scene.value && scene.value.group_id && !isEditMode.value) {
        debugSceneData("Initial scene data for new scene", scene.value);
        nextTick(() => {
          onGroupChange(scene.value.group_id);
          debugSceneData("After group change for new scene", scene.value);
        });
      }
    }

    // Initial check for save disabled state
    checkSaveDisabled();

    return {
      dialogRef,
      scene,
      isEditMode,
      controllersInGroup,
      groupOptions,
      colorTypeOptions,
      sceneExists,
      isSaveDisabled,
      progress,
      queueOptions,
      getControllerSceneSettings,
      onGroupChange,
      handleDialogHide,
      onCancelClick,
      onSaveClick,
      expandedItems,
      toggleExpansion,
      directionOptions,
      checkSaveDisabled,
      addSetting,
      removeSetting,
      updateSettingPositions,
      isDefaultTransitionVisible,
      toggleDefaultTransition,
      updateAllQueueSettings,
      scrollAreaRef,
      scrollToElement,
    };
  },
};
</script>

<style scoped>
.scene-dialog-card {
  width: 100%;
  max-width: 600px;
}

@media (max-width: 599px) {
  .scene-dialog-card {
    max-width: 100%;
    height: 100%;
  }
}

.scene-dialog-scroll {
  height: 60vh;
}

@media (max-width: 599px) {
  .scene-dialog-scroll {
    height: calc(80vh - 100px);
  }
}

/* Mobile optimizations */
@media (max-width: 599px) {
  .q-toolbar {
    min-height: 50px;
  }
}

.default-transition-container {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  padding: 12px;
}
</style>
