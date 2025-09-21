<template>
  <MyCard icon="scene" title="Scenes">
    <q-card-section class="flex justify-center">
      <q-scroll-area class="inset-scroll-area">
        <div v-if="groupNodes && groupNodes.length > 0">
          <q-tree
            :nodes="groupNodes"
            node-key="id"
            :expanded="expandedNodes"
            @update:expanded="onExpandedChange"
            :accordion="true"
            no-icons
          >
            <!-- Custom toggle for expand/collapse -->
            <template v-slot:default-header="prop">
              <div class="row items-center full-width q-py-xs">
                <!-- Custom expand/collapse toggle -->
                <div
                  v-if="prop.node.children && prop.node.children.length > 0"
                  class="q-mr-xs cursor-pointer"
                  @click.stop="localToggleNode(prop.node)"
                >
                  <svgIcon
                    name="arrow_drop_down"
                    :class="{ 'rotate-right': !isExpanded(prop.node.id) }"
                  />
                </div>
                <div
                  v-else
                  class="q-mr-xs"
                  style="width: 8px; height: 16px"
                ></div>
                <!-- Add scene count badge -->
                <q-badge
                  v-if="prop.node.nodeType === 'group'"
                  color="primary"
                  rounded
                  class="q-ml-sm"
                >
                  {{ prop.node.sceneCount }}
                </q-badge>
                <!-- Node type icons and label -->
                <div
                  class="col row items-center no-wrap"
                  @click.stop="
                    prop.node.nodeType === 'scene' && applyScene(prop.node.data)
                  "
                  :class="{
                    'cursor-pointer': prop.node.nodeType === 'scene',
                    'scene-clickable': prop.node.nodeType === 'scene',
                  }"
                >
                  <div class="q-mr-sm">
                    <svgIcon
                      v-if="prop.node.nodeType === 'group'"
                      name="lights/light_group"
                    />
                    <svgIcon
                      v-else-if="prop.node.nodeType === 'scene'"
                      name="lights/scene"
                      class="scene-icon"
                    />
                    <svgIcon
                      v-else-if="prop.node.nodeType === 'controller'"
                      :name="getCustomControllerIcon(prop.node.data)"
                    />
                  </div>
                  <div
                    class="text-weight-medium"
                    :class="{ 'scene-label': prop.node.nodeType === 'scene' }"
                  >
                    {{ prop.node.label }}
                  </div>
                </div>

                <!-- Actions buttons for Groups -->
                <div class="col-auto" v-if="prop.node.nodeType === 'group'">
                  <!-- Take snapshot button -->
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    @click.stop="snapshotScene(prop.node.data)"
                  >
                    <svgIcon name="photo" />
                    <q-tooltip>Take Scene Snapshot</q-tooltip>
                  </q-btn>

                  <!-- Edit group button -->
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    @click.stop="editGroup(prop.node.data)"
                  >
                    <svgIcon name="edit" />
                    <q-tooltip>Edit group</q-tooltip>
                  </q-btn>

                  <!-- Delete group button -->
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    @click.stop="deleteGroup(prop.node.data)"
                  >
                    <svgIcon name="delete" />
                    <q-tooltip>Delete group</q-tooltip>
                  </q-btn>
                </div>

                <!-- Actions buttons for Scenes -->
                <div class="col-auto" v-if="prop.node.nodeType === 'scene'">
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    @click.stop="toggleFavoriteScene(prop.node.data)"
                  >
                    <svgIcon
                      name="star_outlined"
                      :isSelected="prop.node.data.favorite"
                    />
                    <q-tooltip>{{
                      prop.node.data.favorite
                        ? "Remove from favorites"
                        : "Add to favorites"
                    }}</q-tooltip>
                  </q-btn>

                  <!-- Edit button -->
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    @click.stop="editScene(prop.node.data)"
                  >
                    <svgIcon name="edit" />
                    <q-tooltip>Edit scene</q-tooltip>
                  </q-btn>

                  <!-- Delete button -->
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    @click.stop="deleteScene(prop.node.data)"
                  >
                    <svgIcon name="delete" />
                    <q-tooltip>Delete scene</q-tooltip>
                  </q-btn>
                </div>

                <!-- Color badges for controllers -->
                <div
                  class="col-auto"
                  v-if="prop.node.nodeType === 'controller'"
                >
                  <!-- HSV Color Badge -->
                  <div v-if="prop.node.data.color?.hsv" class="q-mr-sm">
                    <q-badge
                      :style="{
                        backgroundColor: `rgb(${hsvToRgb(prop.node.data.color.hsv).r}, ${
                          hsvToRgb(prop.node.data.color.hsv).g
                        }, ${hsvToRgb(prop.node.data.color.hsv).b})`,
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border: '1px solid black',
                      }"
                      round
                    />
                  </div>
                  <!-- RAW Color Badge -->
                  <div v-else-if="prop.node.data.color?.raw" class="q-mr-sm">
                    <q-badge
                      :style="{
                        backgroundColor: `rgb(${prop.node.data.color.raw.r}, ${prop.node.data.color.raw.g}, ${prop.node.data.color.raw.b})`,
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border: '1px solid black',
                      }"
                      round
                    />
                  </div>
                  <!-- Preset Badge -->
                  <div v-else-if="prop.node.data.color?.Preset" class="q-mr-sm">
                    <q-badge color="primary" class="text-caption">
                      {{ getPresetName(prop.node.data.color.Preset.id) }}
                    </q-badge>
                  </div>
                </div>
              </div>
            </template>
          </q-tree>
        </div>
        <div v-else>
          <div class="no-scenes-container">
            <div class="no-scenes-message">
              <div>No scenes available</div>
              <div class="text-caption q-mt-sm">
                {{ debugStatus }}
              </div>
            </div>
          </div>
        </div>
      </q-scroll-area>
    </q-card-section>
    <q-card-section class="flex justify-center q-gutter-md">
      <q-btn flat color="primary" @click="openAddGroupDialog">
        <template v-slot:default>
          <svgIcon name="light_group" />
          <span>Add Group</span>
        </template>
      </q-btn>
      <q-btn flat color="primary" @click="openAddSceneDialog">
        <template v-slot:default>
          <svgIcon name="scene" />
          <span>Add Scene</span>
        </template>
      </q-btn>
    </q-card-section>
  </MyCard>
</template>

<script>
import { computed, onMounted } from "vue";
import { Dialog, colors, Notify } from "quasar";
import { useAppDataStore } from "src/stores/appDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import { useScenesStore } from "src/stores/scenesStore";
import MyCard from "src/components/myCard.vue";
import sceneDialog from "src/components/Dialogs/sceneDialog.vue";
import groupDialog from "src/components/Dialogs/groupDialog.vue";
import deleteItemDialog from "src/components/Dialogs/deleteItemDialog.vue";
import { applyScene, getPresetName } from "src/services/tools.js";

const { hsvToRgb } = colors;

export default {
  name: "scenesCard",
  components: {
    MyCard,
  },
  setup() {
    const appData = useAppDataStore();
    const controllersStore = useControllersStore();
    const scenesStore = useScenesStore();

    // Initialize the scenes store when the component mounts
    onMounted(() => {
      console.log("🎬 ScenesCard: Initializing scenes store");
      scenesStore.initialize();

      // Add debug output about stores
      setTimeout(() => {
        console.log("🔍 DEBUG: ScenesCard component state");
        console.log("SceneStore state:", scenesStore.debugState());
        console.log("GroupNodes:", scenesStore.groupNodes?.length || 0);

        // Force expand first group for testing
        if (scenesStore.groupNodes?.length > 0) {
          const firstGroupId = scenesStore.groupNodes[0].id;
          console.log("🔍 Forcing expand of first group:", firstGroupId);
          scenesStore.expandedNodes = [firstGroupId];
        }
      }, 1000);
    });

    const isExpanded = (nodeId) => {
      return scenesStore.expandedNodes.includes(nodeId);
    };

    // Local toggle function to ensure proper context
    const localToggleNode = (node) => {
      console.log("Local toggle node called with:", node.id);

      // Create a new array to ensure reactivity
      let newExpanded = [...scenesStore.expandedNodes];

      if (newExpanded.includes(node.id)) {
        // If already expanded, remove it to collapse
        newExpanded = newExpanded.filter((id) => id !== node.id);
      } else {
        // If not expanded, add it to expand
        newExpanded.push(node.id);
      }

      // Update the store
      scenesStore.expandedNodes = newExpanded;
      console.log("New expanded nodes:", scenesStore.expandedNodes);
    };

    // Handle expanded nodes change from q-tree
    const onExpandedChange = (expanded) => {
      console.log(" Tree reports expanded nodes changed to:", expanded);
      scenesStore.expandedNodes = expanded;
    };

    const handleSnapshotScene = async (group) => {
      try {
        const collectNotif = Notify.create({
          message: `Collecting states for group '${group.name}'`,
          color: "info",
          timeout: 2000,
          progress: true,
        });

        const sceneSnapshot = await scenesStore.snapshotScene(group);

        collectNotif({
          message: "Collection complete",
          timeout: 1000,
        });

        openSceneDialog(sceneSnapshot);
      } catch (error) {
        console.error("Error taking snapshot:", error);
        Notify.create({
          message: "Failed to take snapshot: " + error.message,
          color: "negative",
        });
      }
    };

    // Updated openSceneDialog function with better error handling and forced closure
    const openSceneDialog = (existingScene = null) => {
      // If editing an existing scene, get a fresh copy from the store
      let sceneToEdit = null;

      if (existingScene) {
        // Get fresh data from the store
        const freshScene = appData.data.scenes.find(
          (s) => s.id === existingScene.id,
        );
        if (freshScene) {
          // Make a deep copy to ensure we're completely disconnected from the store
          sceneToEdit = JSON.parse(JSON.stringify(freshScene));
        } else {
          sceneToEdit = existingScene; // Fallback if not found
        }
      }

      // Store the dialog reference
      let dialogRef;

      dialogRef = Dialog.create({
        component: sceneDialog,
        componentProps: sceneToEdit ? { scene: sceneToEdit } : undefined,
        persistent: true,
        noRouteDismiss: true,
      }).onOk((scene) => {
        // Extract callbacks
        const saveComplete = scene.saveComplete;
        const updateProgress = scene.updateProgress;

        // Create a deep copy without the callback functions
        const sceneToSave = JSON.parse(JSON.stringify(scene));
        delete sceneToSave.saveComplete;
        delete sceneToSave.updateProgress;

        // Progress handler just forwards the progress to the dialog
        const progressHandler = (completed, total) => {
          if (updateProgress) {
            updateProgress(completed, total);
          }
        };

        // Completion handler will close the dialog and show notifications
        const completeCallback = (result) => {
          console.log("🎬 Save operation complete, closing dialog");
          console.log(
            "🎬 Save result received:",
            JSON.stringify(result, null, 2),
          );
          console.log("🎬 Result type:", typeof result);
          console.log("🎬 Result success value:", result?.success);
          console.log("🎬 Result errors:", result?.errors);

          // Show appropriate notification based on result
          if (result && result.success === true) {
            if (result.errors && result.errors.length > 0) {
              // Partial success - some controllers failed
              console.log("🟡 Showing partial success notification");
              Notify.create({
                type: "warning",
                message: `Scene "${sceneToSave.name}" saved locally and to ${result.successCount} controllers, but ${result.errors.length} controller(s) unreachable`,
                timeout: 5000,
                actions: [{ icon: "close", color: "white" }],
              });
            } else {
              // Full success
              console.log("🟢 Showing full success notification");
              Notify.create({
                type: "positive",
                message: `Scene "${sceneToSave.name}" saved successfully to all controllers`,
                timeout: 3000,
              });
            }
          } else {
            // Failed to save or no result
            const errorMessage = result?.error || "Unknown error occurred";
            console.log("🔴 Showing error notification:", errorMessage);
            console.error("Scene save failed:", errorMessage, result);

            Notify.create({
              type: "negative",
              message: `Failed to save scene "${sceneToSave.name}": ${errorMessage}`,
              timeout: 5000,
              actions: [{ icon: "close", color: "white" }],
            });
          }

          if (saveComplete) {
            saveComplete();
          }
        };

        // Log for debugging
        console.log("Saving scene:", sceneToSave.name);

        // Call save with both callbacks
        scenesStore.saveScene(sceneToSave, progressHandler, completeCallback);
      });
    };

    const openGroupDialog = (existingGroup = null) => {
      try {
        console.log("Opening group dialog with:", existingGroup);

        // Create default empty group if none is provided
        const defaultGroup = existingGroup || {
          id: "",
          name: "",
          controllers: [], // Keep for backward compatibility
          controller_ids: [], // Add this for the groupDialog component
          ts: Date.now(),
        };

        console.log("Group data being passed to dialog:", defaultGroup);

        Dialog.create({
          component: groupDialog,
          componentProps: { group: defaultGroup }, // Always pass a group object
          persistent: true,
        }).onOk((result) => {
          try {
            console.log("Dialog returned:", result);

            // Extract callbacks
            const group = { ...result };
            const saveComplete = group.saveComplete;
            const updateProgress = group.updateProgress;

            // Remove callbacks
            delete group.saveComplete;
            delete group.updateProgress;

            const notifyProgress = (completed, total) => {
              if (updateProgress) updateProgress(completed, total);
              if (completed === total && saveComplete) saveComplete();
            };

            scenesStore.saveGroup(group, notifyProgress);
          } catch (err) {
            console.error("Error in dialog onOk handler:", err);
            Notify.create({
              type: "negative",
              message: "Error saving group: " + err.message,
            });
          }
        });
      } catch (err) {
        console.error("Error opening group dialog:", err);
        Notify.create({
          type: "negative",
          message: "Error opening dialog: " + err.message,
        });
      }
    };

    const deleteItem = (item, itemType) => {
      let blockingCondition = null;

      if (itemType === "group") {
        // Check if group has scenes
        const scenes = appData.data?.scenes || [];
        const groupScenes = scenes.filter(
          (scene) => scene.group_id === item.id,
        );

        if (groupScenes.length > 0) {
          blockingCondition = {
            message: `This group contains ${groupScenes.length} scene(s) which must be deleted first.`,
            count: groupScenes.length,
          };
        }
      }

      Dialog.create({
        component: deleteItemDialog,
        componentProps: {
          item,
          itemType,
          blockingCondition,
        },
      });
    };

    // Function to get custom controller icon from appDataStore
    const getCustomControllerIcon = (controllerData) => {
      console.log(
        "getCustomControllerIcon called for scene controller:",
        controllerData?.controller_id,
      );

      if (
        controllerData &&
        controllerData.controller_id &&
        appData.data &&
        appData.data.controllers
      ) {
        const controllerMetadata = appData.data.controllers.find(
          (c) => c.id === controllerData.controller_id,
        );
        if (controllerMetadata && controllerMetadata.icon) {
          console.log(
            "Found controller icon in appDataStore:",
            controllerMetadata.icon,
          );
          return controllerMetadata.icon; // Should already include 'lights/' prefix
        }
      }

      // Fallback to default light icon
      console.log("No icon found in appDataStore, using default");
      return "lights/lightbulb_outlined";
    };

    return {
      // Store refs
      groupNodes: computed(() => scenesStore.groupNodes),
      expandedNodes: computed(() => scenesStore.expandedNodes),
      debugStatus: computed(() => scenesStore.debugStatus),

      // Local UI methods
      isExpanded,
      localToggleNode, // Use the local handler
      onExpandedChange,

      openAddGroupDialog: () => openGroupDialog(null),
      editGroup: openGroupDialog,
      deleteGroup: (group) => deleteItem(group, "group"),

      openAddSceneDialog: () => openSceneDialog(null),
      editScene: openSceneDialog,
      deleteScene: (scene) => deleteItem(scene, "scene"),
      snapshotScene: handleSnapshotScene,

      // Utility functions that stay in component
      hsvToRgb,
      getPresetName,
      applyScene,
      getCustomControllerIcon,

      // Toggle favorite directly through appData store
      toggleFavoriteScene: async (scene) => {
        const oldFavorite = scene.favorite;
        scene.favorite = !scene.favorite;

        try {
          const result = await appData.saveScene(scene);

          if (result.errors && result.errors.length > 0) {
            console.warn(
              `⚠️ Scene favorite toggled locally, but some controllers unreachable:`,
              result.errors,
            );
            Notify.create({
              type: "warning",
              message: `Favorite toggled locally, but ${result.errors.length} controller(s) unreachable`,
              timeout: 3000,
            });
          } else {
            console.log(`✅ Scene favorite toggled successfully`);
          }
        } catch (error) {
          console.error("Error toggling scene favorite:", error);
          // Revert the change on error
          scene.favorite = oldFavorite;
          Notify.create({
            type: "negative",
            message: `Failed to toggle favorite: ${error.message}`,
            timeout: 5000,
            actions: [{ icon: "close", color: "white" }],
          });
        }
      },
    };
  },
};
</script>

<style scoped>
.no-scenes-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  vertical-align: middle;
}
.no-scenes-message {
  background-color: #f0f0f0;
  padding: 20px;
  border-radius: 10px;
  text-align: center;
  vertical-align: middle;
  color: #333;
}
.inset-scroll-area {
  height: 300px;
  width: 100%;
  max-width: 400px;
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.1);
  margin: 10px;
}
.rotate-right {
  transform: rotate(-90deg);
  transition: transform 0.3s;
}
:deep(.q-tree__arrow) {
  display: none !important;
}

.scene-clickable {
  transition: background-color 0.2s;
  border-radius: 4px;
  padding: 2px 4px;
}

.scene-clickable:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.scene-label {
  color: #1976d2; /* Primary color to indicate it's interactive */
}

.scene-icon {
  color: #1976d2; /* Match the label color */
}
</style>
