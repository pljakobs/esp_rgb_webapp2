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
                  @click.stop="toggleNode(prop.node)"
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
                      name="light_group"
                    />
                    <svgIcon
                      v-else-if="prop.node.nodeType === 'scene'"
                      name="scene"
                      class="scene-icon"
                    />
                    <svgIcon
                      v-else-if="prop.node.nodeType === 'controller'"
                      :name="prop.node.data.icon || 'led-strip-variant'"
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
                    @click.stop="applyScene(prop.node.data)"
                  >
                    <svgIcon name="star_outlined" />
                    <q-tooltip>setFavorite</q-tooltip>
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
      <q-btn flat color="primary" @click="openDialog">
        <template v-slot:default>
          <svgIcon name="scene" />
          <span>Add Scene</span>
        </template>
      </q-btn>
    </q-card-section>
  </MyCard>
</template>

<script>
/*
TodDo:
- adding groups dialog does not auto close after having saved all.
- remove play icon from scenes (not needed)
- delete button for scene does not work
- delete button for group should ask if all associated scenes should also be deleted
- scenes without a group - how should they be handled?
- saving a scene snapshot - progress callback seems not to work
*/
import { ref, computed, onMounted, watch } from "vue";
import { Dialog, colors, Notify } from "quasar";
import { useAppDataStore } from "src/stores/appDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import { useColorDataStore } from "src/stores/colorDataStore";
import MyCard from "src/components/myCard.vue";
import sceneDialog from "src/components/Dialogs/sceneDialog.vue";
import groupDialog from "src/components/Dialogs/groupDialog.vue";
import deleteItemDialog from "src/components/Dialogs/deleteItemDialog.vue";
import {
  applyScene,
  getControllerInfo,
  getPresetName,
  getControllerColorDisplay,
  makeID,
} from "src/services/tools.js";
import {
  saveGroup as saveGroupUtil,
  saveScene as saveSceneUtil,
  deleteGroup as deleteGroupUtil,
  deleteScene as deleteSceneUtil,
} from "src/services/saveDelete";

const { hsvToRgb } = colors;

export default {
  name: "scenesCard",
  components: {
    MyCard,
  },
  setup() {
    const appData = useAppDataStore();
    const controllersStore = useControllersStore();
    const colorDataStore = useColorDataStore();
    const expandedNodes = ref([]);
    const debugStatus = ref("Loading data...");

    // Ensure controllers are loaded and initialize data
    onMounted(async () => {
      console.log("Mounted scenesCard");
      debugStatus.value = "Checking data availability...";

      try {
        console.log("Initial store state:");
        console.log("- controllers:", controllersStore.data?.length || 0);
        console.log("- appData groups:", appData.data?.groups?.length || 0);
        console.log("- appData scenes:", appData.data?.scenes?.length || 0);

        if (!controllersStore.data || controllersStore.data.length === 0) {
          debugStatus.value = "Loading controllers...";
          await controllersStore.fetchControllers();
        }

        if (!appData.data?.groups || appData.data.groups.length === 0) {
          debugStatus.value = "Loading groups and scenes...";
          // You may need to add a method to fetch groups/scenes if they're not loaded automatically
          if (typeof appData.fetchData === "function") {
            await appData.fetchData();
          }
        }

        // Force recomputation of groupNodes
        debugStatus.value = "Building scene tree...";
      } catch (error) {
        console.error("Error initializing scene data:", error);
        debugStatus.value = "Error loading data";
      }
    });

    // Watch for data changes to trigger recomputation of the tree
    watch(
      () => [
        controllersStore.data?.length,
        appData.data?.groups?.length,
        appData.data?.scenes?.length,
      ],
      ([controllers, groups, scenes]) => {
        console.log(
          `Data updated - Controllers: ${controllers || 0}, Groups: ${
            groups || 0
          }, Scenes: ${scenes || 0}`,
        );
        debugStatus.value =
          groups && scenes ? "Updating scene tree..." : "Waiting for data...";
      },
      { immediate: true },
    );

    // Functions to handle node expansion
    const isExpanded = (nodeId) => {
      return expandedNodes.value.includes(nodeId);
    };

    const toggleNode = (node) => {
      const nodeId = node.id;
      if (isExpanded(nodeId)) {
        expandedNodes.value = expandedNodes.value.filter((id) => id !== nodeId);
      } else {
        expandedNodes.value.push(nodeId);
      }
    };

    // Get the hierarchical data structure for QTree
    const groupNodes = computed(() => {
      try {
        // Use optional chaining and default to empty array to avoid errors
        const groups = appData.data?.groups || [];
        const scenes = appData.data?.scenes || [];

        console.log("Computing groupNodes");
        console.log("Groups:", groups.length || 0);
        console.log("Scenes:", scenes.length || 0);

        if (groups.length === 0) {
          console.log("No groups found");
          debugStatus.value = "No groups available";
          return [];
        }

        // Process ALL groups, even empty ones
        const result = groups.map((group) => {
          // Find all scenes for this group
          const groupScenes = scenes.filter(
            (scene) => scene.group_id === group.id,
          );

          // Count scenes in this group
          const sceneCount = groupScenes.length;

          // Map scenes if there are any
          let children = [];
          if (groupScenes.length > 0) {
            children = groupScenes.map((scene) => {
              // For each scene, map settings to controller nodes
              const controllerNodes =
                scene.settings?.map((setting) => {
                  const controllerInfo = getControllerInfo(
                    setting.controller_id,
                  );
                  return {
                    id: `controller-${scene.id}-${setting.controller_id}`,
                    label: controllerInfo.hostname,
                    nodeType: "controller",
                    data: {
                      ...setting,
                      hostname: controllerInfo.hostname,
                      ip: controllerInfo.ip,
                      online: controllerInfo.online,
                      icon: controllerInfo.icon,
                    },
                  };
                }) || [];

              // Return the scene node with its controller children
              return {
                id: `scene-${scene.id}`,
                label: scene.name,
                nodeType: "scene",
                data: scene,
                children: controllerNodes,
              };
            });
          }

          // Create tree node for this group - all groups have 'children' now
          const groupNode = {
            id: `group-${group.id}`,
            label: group.name,
            nodeType: "group",
            data: group,
            sceneCount: sceneCount,
            children: children,
          };

          return groupNode;
        });

        // Debug logging outside the map function
        console.log("FINAL GROUP NODES STRUCTURE:");
        console.log(
          JSON.stringify(
            result.map((group) => ({
              id: group.id,
              label: group.label,
              nodeType: group.nodeType,
              groupId: group.data.id,
              sceneCount: group.sceneCount,
              childrenCount: group.children.length,
            })),
            null,
            2,
          ),
        );

        // Check for duplicate groups
        const groupIds = result.map((g) => g.data.id);
        const uniqueGroupIds = [...new Set(groupIds)];
        if (groupIds.length !== uniqueGroupIds.length) {
          console.warn(
            "DUPLICATE GROUPS DETECTED!",
            groupIds.filter((id, idx) => groupIds.indexOf(id) !== idx),
          );
        }

        debugStatus.value = "";
        return result;
      } catch (error) {
        console.error("Error in groupNodes computed:", error);
        debugStatus.value = "Error building scene tree";
        return [];
      }
    });

    const onExpandedChange = (expanded) => {
      expandedNodes.value = expanded;
    };

    // Scene Management Functions
    const addScene = () => {
      Dialog.create({
        component: sceneDialog,
      })
        .onOk((scene) => {
          handleSaveScene(scene);
        })
        .onCancel(() => {
          console.log("Dialog canceled");
        });
    };

    const editScene = (scene) => {
      Dialog.create({
        component: sceneDialog,
        componentProps: {
          scene,
        },
      })
        .onOk((scene) => {
          handleSaveScene(scene);
        })
        .onCancel(() => {
          console.log("Dialog canceled");
        });
    };

    const handleSaveScene = (scene) => {
      console.log("Saving scene", scene);

      // Extract any callbacks just like we do with groups
      const saveComplete = scene.saveComplete;
      const updateProgress = scene.updateProgress;

      // Remove callbacks from the scene object
      if (saveComplete) delete scene.saveComplete;
      if (updateProgress) delete scene.updateProgress;

      // Use the utility function with progress callback
      saveSceneUtil(appData, scene, (completed, total) => {
        // Update dialog progress if available
        if (updateProgress) {
          updateProgress(completed, total);
        }

        // When complete, signal to close dialog
        if (completed === total && saveComplete) {
          setTimeout(() => {
            saveComplete();
          }, 50);
        }
      });

      // Expand the parent group node
      const groupNodeId = `group-${scene.group_id}`;
      if (!expandedNodes.value.includes(groupNodeId)) {
        expandedNodes.value.push(groupNodeId);
      }

      // Expand this scene node
      const sceneNodeId = `scene-${scene.id}`;
      if (!expandedNodes.value.includes(sceneNodeId)) {
        expandedNodes.value.push(sceneNodeId);
      }
    };

    const deleteScene = (scene) => {
      console.log("Delete scene clicked");

      Dialog.create({
        component: deleteItemDialog,
        componentProps: {
          item: scene,
          itemType: "scene",
        },
      });
    };

    // Group Management Functions
    const addGroup = () => {
      Dialog.create({
        component: groupDialog,
        persistent: true,
      })
        .onOk((result) => {
          console.log("Saving group", result);

          // Extract the callbacks from the result
          const group = { ...result };
          const saveComplete = group.saveComplete;
          const updateProgress = group.updateProgress;

          // Remove the callbacks from the group object
          delete group.saveComplete;
          delete group.updateProgress;

          // Create a notification for the saving process
          const saveNotif = Notify.create({
            message: "Saving group...",
            caption: "0% complete",
            color: "primary",
            position: "bottom-right",
            timeout: 0,
            progress: 0,
            actions: [{ icon: "close", color: "white" }],
          });

          // Call the utility function with progress callback
          saveGroupUtil(appData, group, (completed, total) => {
            const percent = Math.round((completed / total) * 100);

            // Update the notification
            setTimeout(() => {
              saveNotif({
                caption: `${percent}% complete (${completed}/${total} controllers)`,
                progress: completed / total,
              });

              // Also update the dialog's progress if dialog is still showing
              if (updateProgress) {
                updateProgress(completed, total);
              }
            }, 10);

            // When complete, show success message and close the dialog
            if (completed === total) {
              setTimeout(() => {
                saveNotif({
                  message: "Group saved successfully!",
                  caption: "All controllers updated",
                  timeout: 2000,
                  progress: 1,
                });

                // Signal completion to close the dialog
                if (saveComplete) {
                  saveComplete();
                }
              }, 50);
            }
          });

          // Expand this group node
          const groupNodeId = `group-${group.id}`;
          if (!expandedNodes.value.includes(groupNodeId)) {
            expandedNodes.value.push(groupNodeId);
          }
        })
        .onCancel(() => {
          console.log("Group dialog canceled");
        });
    };

    const editGroup = (group) => {
      Dialog.create({
        component: groupDialog,
        componentProps: {
          group,
        },
        persistent: true, // Make it persistent like addGroup
      })
        .onOk((result) => {
          console.log("Editing group", result);

          // Extract the callbacks from the result - same pattern as addGroup
          const group = { ...result };
          const saveComplete = group.saveComplete;
          const updateProgress = group.updateProgress;

          // Remove the callbacks from the group object
          delete group.saveComplete;
          delete group.updateProgress;

          // Create a notification for the saving process
          const saveNotif = Notify.create({
            message: "Editing group...",
            caption: "0% complete",
            color: "primary",
            position: "bottom-right",
            timeout: 0,
            progress: 0,
            actions: [{ icon: "close", color: "white" }],
          });

          // Call the utility function with progress callback
          saveGroupUtil(appData, group, (completed, total) => {
            const percent = Math.round((completed / total) * 100);
            console.log(
              `Group save progress: ${completed}/${total} (${percent}%)`,
            );

            // Update the notification
            setTimeout(() => {
              saveNotif({
                caption: `${percent}% complete (${completed}/${total} controllers)`,
                progress: completed / total,
              });

              // Also update the dialog's progress if dialog is still showing
              if (updateProgress) {
                console.log("Updating progress in dialog");
                updateProgress(completed, total);
              }
            }, 10);

            // When complete, show success message and close the dialog
            if (completed === total) {
              console.log("Save complete, closing dialog");
              setTimeout(() => {
                saveNotif({
                  message: "Group saved successfully!",
                  caption: "All controllers updated",
                  timeout: 2000,
                  progress: 1,
                });

                // Signal completion to close the dialog
                if (saveComplete) {
                  console.log("Calling saveComplete to close dialog");
                  saveComplete();
                }
              }, 50);
            }
          });

          // Expand this group node
          const groupNodeId = `group-${group.id}`;
          if (!expandedNodes.value.includes(groupNodeId)) {
            expandedNodes.value.push(groupNodeId);
          }
        })
        .onCancel(() => {
          console.log("Group dialog canceled");
        });
    };

    const deleteGroup = (group) => {
      // Check if group has scenes
      const scenes = appData.data?.scenes || [];
      const groupScenes = scenes.filter((scene) => scene.group_id === group.id);

      console.log("delte group clicked");
      // Create blocking condition if there are scenes in this group
      const blockingCondition =
        groupScenes.length > 0
          ? {
              message: `This group contains ${groupScenes.length} scene(s) which must be deleted first.`,
              count: groupScenes.length,
            }
          : null;

      Dialog.create({
        component: deleteItemDialog,
        componentProps: {
          item: group,
          itemType: "group",
          blockingCondition,
        },
      });
    };

    const snapshotScene = async (group) => {
      console.log("Taking snapshot for group:", group.name);

      // Get all controllers
      const controllers = controllersStore.data || [];
      if (!controllers.length) {
        Notify.create({
          message: "No controllers available for snapshot",
          color: "negative",
        });
        return;
      }

      try {
        // Filter out controllers without IP addresses to get accurate count
        const validControllers = controllers.filter((c) => c.ip_address);
        const totalControllers = validControllers.length;

        // Create a persistent notification with progress for data collection phase
        const collectNotif = Notify.create({
          message: "Collecting controller states...",
          caption: `0/${totalControllers} controllers processed`,
          color: "info",
          position: "bottom-right",
          timeout: 0, // Persistent until manually dismissed
          progress: true,
          actions: [{ icon: "close", color: "white" }],
        });

        // Fetch color info for each controller
        const settings = [];
        let processedCount = 0;

        for (const controller of validControllers) {
          try {
            // Update notification with current controller
            collectNotif({
              caption: `Processing ${
                controller.hostname || controller.ip_address
              }... (${processedCount}/${totalControllers})`,
              progress: processedCount / totalControllers,
            });

            const response = await fetch(
              `http://${controller.ip_address}/color`,
            );

            if (!response.ok) {
              console.error(
                `Error fetching color from ${controller.ip_address}: ${response.status}`,
              );
              continue;
            }

            const colorData = await response.json();

            // Only add controllers that returned valid color data
            if (colorData.hsv || colorData.raw) {
              settings.push({
                controller_id: controller.id,
                color: {
                  ...(colorData.hsv ? { hsv: colorData.hsv } : {}),
                  ...(colorData.raw ? { raw: colorData.raw } : {}),
                },
              });
            }
          } catch (error) {
            console.error(
              `Network error fetching color from ${controller.ip_address}:`,
              error,
            );
          } finally {
            // Update progress regardless of success/failure
            processedCount++;
            collectNotif({
              caption: `${processedCount}/${totalControllers} controllers processed`,
              progress: processedCount / totalControllers,
            });
          }
        }

        // Close the data collection notification
        collectNotif({
          message: `Collection complete: ${settings.length} controller states captured`,
          timeout: 1000,
          progress: 1,
        });

        // Create a new scene object with the fetched settings
        const newScene = {
          id: makeID(),
          name: `Snapshot ${new Date().toLocaleTimeString()}`,
          group_id: group.id,
          settings: settings,
        };

        console.log("Created scene snapshot:", newScene);

        // Open dialog with prepopulated data
        Dialog.create({
          component: sceneDialog,
          componentProps: {
            scene: newScene,
          },
        }).onOk((scene) => {
          // Use the existing handleSaveScene function instead of duplicating code
          handleSaveScene(scene);
        });
      } catch (error) {
        console.error("Error taking snapshot:", error);
        Notify.create({
          message: "Failed to take snapshot: " + error.message,
          color: "negative",
        });
      }
    };

    return {
      groupNodes,
      expandedNodes,
      onExpandedChange,
      isExpanded,
      toggleNode,
      openDialog: addScene,
      openAddGroupDialog: addGroup,
      editScene,
      deleteScene,
      editGroup,
      deleteGroup,
      getControllerColorDisplay,
      hsvToRgb,
      debugStatus,
      getControllerInfo,
      getPresetName,
      applyScene,
      snapshotScene,
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
