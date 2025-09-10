import { ref, computed, watch } from "vue";
import { defineStore } from "pinia";
import { useAppDataStore } from "src/stores/appDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import {
  getControllerInfo,
  makeID,
  getControllersInGroup,
  getPresetName,
} from "src/services/tools";
import {
  saveGroup as saveGroupUtil,
  saveScene as saveSceneUtil,
  deleteGroup as deleteGroupUtil,
  deleteScene as deleteSceneUtil,
} from "src/services/saveDelete";

export const useScenesStore = defineStore("scenes", {
  state: () => ({
    expandedNodes: [],
    debugStatus: "Loading data...",
    initialized: false,
  }),

  getters: {
    // Transform the data into hierarchical structure for the tree component
    groupNodes() {
      // Changed from arrow function to regular method
      const appData = useAppDataStore();
      const groups = appData.data?.groups || [];
      const scenes = appData.data?.scenes || [];

      console.log("📊 Building scene tree with:", {
        groups: groups.length,
        scenes: scenes.length,
      });

      if (groups.length === 0) {
        this.debugStatus = "No groups defined yet. Create a group first.";
        return [];
      }

      const nodes = groups.map((group) => {
        // Find all scenes for this group
        const groupScenes = scenes.filter(
          (scene) => scene.group_id === group.id,
        );
        const sceneCount = groupScenes.length;

        // Map scenes to tree nodes
        let children = [];
        if (groupScenes.length > 0) {
          children = groupScenes.map((scene) => {
            // Map controllers for this scene
            const controllerNodes =
              scene.settings?.map((setting) => {
                const controllerInfo = getControllerInfo(setting.controller_id);
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

            return {
              id: `scene-${scene.id}`,
              label: scene.name,
              nodeType: "scene",
              data: scene,
              children: controllerNodes,
            };
          });
        }

        return {
          id: `group-${group.id}`,
          label: group.name,
          nodeType: "group",
          data: group,
          sceneCount: sceneCount,
          children: children,
        };
      });

      return nodes;
    },
  },

  actions: {
    initialize() {
      const appData = useAppDataStore();
      console.log("🔍 Initializing scenes store...");
      console.log("🔍 AppData loaded:", !!appData.data);

      if (appData.data) {
        console.log("🔍 Groups:", appData.data.groups?.length || 0);
        console.log("🔍 Scenes:", appData.data.scenes?.length || 0);
      }

      // Set up a watcher to see when the structure is generated
      watch(
        () => this.groupNodes,
        (newNodes) => {
          if (newNodes.length > 0 && !this.initialized) {
            console.log("🌲 ScenesStore structure fully generated:");
            console.log("📊 Groups:", newNodes.length);
            console.log("📋 Structure details:", newNodes);

            // Count scenes and controllers
            let sceneCount = 0;
            let controllerCount = 0;

            newNodes.forEach((group) => {
              sceneCount += group.children.length;
              group.children.forEach((scene) => {
                controllerCount += scene.children.length;
              });
            });

            console.log("🎬 Total scenes:", sceneCount);
            console.log("🎮 Total controller settings:", controllerCount);

            this.debugStatus = `Loaded ${newNodes.length} groups with ${sceneCount} scenes`;
            this.initialized = true;
          }
        },
        { deep: true, immediate: true },
      );

      // Also watch for changes in the appData store that should trigger reprocessing
      watch(
        () => [appData.data?.groups, appData.data?.scenes],
        () => {
          if (this.initialized) {
            console.log(
              "🔄 ScenesStore detected data change, structure will update",
            );
          }
        },
        { deep: true },
      );
    },

    toggleNode(node) {
      console.log("🔄 Store toggleNode called with:", node);
      console.log("Current expanded nodes:", this.expandedNodes);

      const nodeId = node.id; // Extract ID from the node object

      // Create a new array to ensure reactivity
      const newExpanded = [...this.expandedNodes];

      if (newExpanded.includes(nodeId)) {
        // Remove the node from expanded list
        this.expandedNodes = newExpanded.filter((id) => id !== nodeId);
        console.log(
          `Node ${nodeId} collapsed, expanded nodes:`,
          this.expandedNodes,
        );
      } else {
        // Add the node to expanded list
        newExpanded.push(nodeId);
        this.expandedNodes = newExpanded;
        console.log(
          `Node ${nodeId} expanded, expanded nodes:`,
          this.expandedNodes,
        );
      }
    },

    async snapshotScene(group) {
      const controllers = useControllersStore();
      const groupControllers = getControllersInGroup(group);
      const settings = [];

      console.log("Taking snapshot for group:", group.name);
      console.log("Controllers in group:", groupControllers);

      for (const controller of groupControllers) {
        if (!controller.ip_address) continue;

        try {
          const response = await fetch(`http://${controller.ip_address}/color`);
          if (!response.ok) continue;

          const colorData = await response.json();
          console.log(`Got color data from ${controller.hostname}:`, colorData);

          if (colorData.hsv) {
            settings.push({
              controller_id: String(controller.id),
              color: { hsv: colorData.hsv },
            });
          } else if (colorData.raw) {
            settings.push({
              controller_id: String(controller.id),
              color: { raw: colorData.raw },
            });
          } else if (colorData.preset) {
            settings.push({
              controller_id: String(controller.id),
              color: { Preset: { id: colorData.preset.id } },
            });
          }
        } catch (error) {
          console.error(`Error fetching from ${controller.ip_address}:`, error);
        }
      }

      return {
        id: makeID(),
        name: `Snapshot ${new Date().toLocaleTimeString()}`,
        group_id: group.id,
        settings: settings,
        ts: Date.now(),
      };
    },

    async saveScene(scene, progressCallback, completeCallback) {
      const appData = useAppDataStore();
      console.log("Saving scene:", scene);

      try {
        // Pass the scene to the appData store to save it
        await appData.saveScene(scene, progressCallback);

        // Expand the scene's group node for better UX
        const groupNodeId = `group-${scene.group_id}`;
        if (!this.expandedNodes.includes(groupNodeId)) {
          this.expandedNodes.push(groupNodeId);
        }

        // Call the completion callback if provided
        if (completeCallback) {
          completeCallback();
        }

        return true;
      } catch (error) {
        console.error("Error saving scene:", error);
        return false;
      }
    },

    async saveGroup(group, progressCallback) {
      const appData = useAppDataStore();
      console.log("Saving group:", group);

      try {
        // Check if the group has an ID, if not, generate one
        if (!group.id) {
          group.id = makeID();
        }

        // Save the group through appData store
        await appData.saveGroup(group, progressCallback);

        // Expand the new group node
        const groupNodeId = `group-${group.id}`;
        if (!this.expandedNodes.includes(groupNodeId)) {
          this.expandedNodes.push(groupNodeId);
        }

        return true;
      } catch (error) {
        console.error("Error saving group:", error);
        throw error;
      }
    },

    debugState() {
      const appData = useAppDataStore();
      console.log("🧪 DEBUG: SceneStore State");
      console.log("AppData loaded:", !!appData.data);
      console.log("Groups:", appData.data?.groups?.length || 0);
      console.log("Scenes:", appData.data?.scenes?.length || 0);
      console.log("First groups:", appData.data?.groups?.slice(0, 3));
      console.log("First scenes:", appData.data?.scenes?.slice(0, 3));
      console.log("Expanded nodes:", this.expandedNodes);
      console.log("Initialized:", this.initialized);
      console.log("Debug status:", this.debugStatus);

      return {
        appData: !!appData.data,
        groups: appData.data?.groups?.length || 0,
        scenes: appData.data?.scenes?.length || 0,
        initialized: this.initialized,
      };
    },
  },
});
