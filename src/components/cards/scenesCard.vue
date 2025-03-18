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
                  v-if="prop.node.children"
                  class="q-mr-xs cursor-pointer"
                  @click.stop="toggleNode(prop.node)"
                >
                  <svgIcon
                    name="arrow_drop_down"
                    :class="{ 'rotate-right': !isExpanded(prop.node.id) }"
                  />
                </div>
                <div v-else class="q-mr-xs" style="width: 24px"></div>

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
                      name="group"
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

                  <div>
                    <div
                      class="text-weight-medium"
                      :class="{ 'scene-label': prop.node.nodeType === 'scene' }"
                    >
                      {{ prop.node.label }}
                    </div>
                    <!-- Rest of the existing code -->
                  </div>
                </div>

                <!-- Actions buttons -->
                <div class="col-auto" v-if="prop.node.nodeType === 'group'">
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    @click.stop="takeSnapshot(prop.node.data)"
                  >
                    <svgIcon name="photo" />
                    <q-tooltip>take Scene Snapshot</q-tooltip>
                  </q-btn>
                </div>
                <div class="col-auto" v-if="prop.node.nodeType === 'scene'">
                  <q-btn
                    flat
                    round
                    dense
                    size="sm"
                    @click.stop="applyScene(prop.node.data)"
                  >
                    <svgIcon name="play_arrow" />
                    <q-tooltip>Apply scene</q-tooltip>
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
    <q-card-section class="flex justify-center">
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
import { ref, computed, onMounted, watch } from "vue";
import { Dialog, colors, Notify } from "quasar";
import { useAppDataStore } from "src/stores/appDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import { useColorDataStore } from "src/stores/colorDataStore";
import MyCard from "src/components/myCard.vue";
import sceneDialog from "src/components/Dialogs/sceneDialog.vue";
import {
  applyScene,
  getControllerInfo,
  getPresetName,
  getControllerColorDisplay,
} from "src/services/tools.js";

const { hsvToRgb } = colors;

export default {
  name: "scenesCard",
  components: {
    MyCard,
  },
  setup() {
    const appData = useAppDataStore();
    const controllersStore = useControllersStore();
    const colorDataStore = useColorDataStore(); // Correct import
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

        if (!groups.length || !scenes.length) {
          console.log("No groups or scenes found");
          debugStatus.value = `No data: Groups: ${groups.length || 0}, Scenes: ${
            scenes.length || 0
          }`;
          return [];
        }

        const result = groups
          .map((group) => {
            // Find all scenes for this group
            const groupScenes = scenes.filter(
              (scene) => scene.group_id === group.id,
            );

            if (groupScenes.length === 0) {
              return null;
            }

            // Create tree node for this group
            const groupNode = {
              id: `group-${group.id}`,
              label: group.name,
              nodeType: "group",
              data: group,
              children: groupScenes.map((scene) => {
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
              }),
            };

            return groupNode;
          })
          .filter(Boolean); // Remove null entries (groups with no scenes)

        debugStatus.value =
          result.length > 0 ? "" : "No scenes with controllers found";
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

    const addScene = () => {
      Dialog.create({
        component: sceneDialog,
      })
        .onOk((scene) => {
          handleSave(scene);
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
          handleSave(scene);
        })
        .onCancel(() => {
          console.log("Dialog canceled");
        });
    };

    const handleSave = (scene) => {
      console.log("Saving scene", scene);
      appData.saveScene(scene);

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
      console.log("Deleting scene", scene);
      appData.deleteScene(scene);
    };

    return {
      groupNodes,
      expandedNodes,
      onExpandedChange,
      isExpanded,
      toggleNode,
      openDialog: addScene,
      editScene,
      deleteScene,
      getControllerColorDisplay,
      hsvToRgb,
      debugStatus,
      getControllerInfo,
      getPresetName,
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
