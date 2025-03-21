import { watch } from "vue";
import { defineStore } from "pinia";
import { fetchApi } from "src/stores/storeHelpers";
import { useControllersStore } from "src/stores/controllersStore";
import { storeStatus } from "src/stores/storeConstants";
import { makeID } from "src/services/tools";

export const useAppDataStore = defineStore("appData", {
  state: () => ({
    data: {
      lastColor: {},
      presets: [],
      scenes: [],
      groups: [],
    },
    status: storeStatus.IDLE,
    abortSaveOperation: false,
  }),

  actions: {
    async fetchData() {
      try {
        const { jsonData, error } = await fetchApi("data");
        if (error) {
          console.error("error fetching app-data:", error);
          this.status = storeStatus.ERROR;
        } else {
          console.log("preset data fetched: ", JSON.stringify(jsonData));
          this.data = jsonData;
          this.status = storeStatus.READY;

          console.log("lastColor data: ", JSON.stringify(this.data.lastColor));
          console.log("presets data: ", JSON.stringify(this.data.presets));
          console.log("scenes data: ", JSON.stringify(this.data.scenes));
          console.log("groups data: ", JSON.stringify(this.data.groups));
        }
      } catch (error) {
        console.error("error fetching app-data:", error);
        this.status = storeStatus.ERROR;
      }
    },

    watchForSync() {
      const controllers = useControllersStore();

      if (
        controllers.status === storeStatus.READY &&
        this.status === storeStatus.READY
      ) {
        console.log(
          "Both stores are already ready, starting synchronization...",
        );
        this.synchronizeAllData((completed, total) => {
          console.log(`Sync progress: ${completed}/${total}`);
        });
      }
      // Set up a watcher for the controllers store status
      watch(
        () => controllers.status,
        (newStatus) => {
          if (
            newStatus === storeStatus.READY &&
            this.status === storeStatus.READY
          ) {
            console.log("Both stores are ready, starting synchronization...");
            this.synchronizeAllData((completed, total) => {
              console.log(`Sync progress: ${completed}/${total}`);
            });
          }
        },
      );

      // Also watch our own status in case controllers become ready first
      watch(
        () => this.status,
        (newStatus) => {
          if (
            newStatus === storeStatus.READY &&
            controllers.status === storeStatus.READY
          ) {
            console.log("Both stores are ready, starting synchronization...");
            this.synchronizeAllData((completed, total) => {
              console.log(`Sync progress: ${completed}/${total}`);
            });
          }
        },
      );
    },

    /*************************************************************
     *
     * preset functions
     *
     **************************************************************/

    async savePreset(preset, progressCallback) {
      const controllers = useControllersStore();
      this.abortSaveOperation = false;

      // Generate an ID if one doesn't exist
      if (!preset.id) {
        preset.id = makeID();
      }

      // Add or update timestamp
      preset.ts = Date.now();

      // Store the favorite status and temporarily remove it from the preset
      // so it doesn't get synchronized to other controllers
      const isFavorite = preset.favorite;
      const presetToSync = { ...preset };
      delete presetToSync.favorite;

      const existingPresetIndex = this.data.presets.findIndex(
        (p) => p.id === preset.id,
      );

      let payload;

      try {
        let completed = 0;
        for (const controller of controllers.data) {
          if (this.abortSaveOperation) {
            console.log("Save operation aborted");
            return; // Exit early
          }

          // Check if the controller already has this preset
          const existingDataResponse = await fetch(
            `http://${controller.ip_address}/data`,
          );
          const existingData = await existingDataResponse.json();
          const existingPreset = existingData.presets.find(
            (p) => p.id === preset.id,
          );

          if (existingPreset) {
            // Update existing preset
            payload = { [`presets[id=${preset.id}]`]: presetToSync };
            console.log("updatePreset payload: ", JSON.stringify(payload));
          } else {
            // Add new preset
            payload = { "presets[]": [presetToSync] };
            console.log("addPreset payload: ", JSON.stringify(payload));
          }

          if (!existingPreset || existingPreset.ts < preset.ts) {
            console.log("preset uri: ", `http://${controller.ip_address}/data`);
            console.log("preset payload: ", JSON.stringify(payload));
            const response = await fetch(
              `http://${controller.ip_address}/data`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              },
            );
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
          }

          completed++;
          if (progressCallback) {
            progressCallback(completed, controllers.data.length);
          }
        }

        // Restore the favorite status
        preset.favorite = isFavorite;

        if (!this.abortSaveOperation) {
          if (existingPresetIndex !== -1) {
            // Update the preset in the local store
            this.data.presets[existingPresetIndex] = preset;
            console.log("updated preset", preset.name);
          } else {
            // Add the new preset to the local store
            this.data.presets.push(preset);
            console.log("added preset", preset.name, "with id", preset.id);
          }
        }
      } catch (error) {
        console.error("error saving preset:", error);
      }
    },

    async deletePreset(preset, progressCallback) {
      const controllers = useControllersStore();
      let payload = { [`presets[id=${preset.id}]`]: [] };

      try {
        let completed = 0;
        for (const controller of controllers.data) {
          if (!controller.ip_address) {
            completed++;
            if (progressCallback)
              progressCallback(completed, controllers.data.length);
            continue;
          }

          try {
            // Wrap each controller request in its own try/catch
            const response = await fetch(
              `http://${controller.ip_address}/data`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              },
            );

            if (!response.ok) {
              const errorText = await response.text();
              // If it's a BadSelector error, just log and continue
              if (errorText.includes("BadSelector")) {
                console.log(
                  `Preset not found on ${controller.ip_address}, continuing...`,
                );
              } else {
                console.warn(
                  `Error from ${controller.ip_address}: ${errorText}`,
                );
              }
            }
          } catch (controllerError) {
            // Log network errors but continue with next controller
            console.warn(
              `Network error with ${controller.ip_address}:`,
              controllerError,
            );
          }

          // Always increment counter and update progress
          completed++;
          if (progressCallback) {
            progressCallback(completed, controllers.data.length);
          }
        }

        // Update local store regardless of individual controller errors
        this.data.presets = this.data.presets.filter((p) => p.id !== preset.id);
        console.log("deleted preset", preset.name);
      } catch (error) {
        console.error("error deleting preset:", error);
      }
    },

    // Toggle favorite status (local only)
    async toggleFavorite(preset) {
      const controllers = useControllersStore();
      const presetIndex = this.data.presets.findIndex(
        (p) => p.id === preset.id,
      );

      if (presetIndex !== -1) {
        // Toggle the favorite status locally only
        const updatedPreset = { ...this.data.presets[presetIndex] };
        updatedPreset.favorite = !updatedPreset.favorite;

        const payload = { [`presets[id=${preset.id}]`]: updatedPreset };
        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/data`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        // Update in local store only
        this.data.presets[presetIndex] = updatedPreset;
        console.log(
          `Set preset ${updatedPreset.name} favorite status to ${updatedPreset.favorite}`,
        );
      }
    },

    /*************************************************************
     *
     * group functions
     *
     **************************************************************/

    async saveGroup(group, progressCallback) {
      const controllers = useControllersStore();
      const existingGroupIndex = this.data.groups.findIndex(
        (g) => g.id === group.id,
      );

      // Add timestamp to the group
      group.ts = Date.now();

      let payload;

      try {
        let completed = 0;
        for (const controller of controllers.data) {
          const existingDataResponse = await fetch(
            `http://${controller.ip_address}/data`,
          );
          const existingData = await existingDataResponse.json();
          const existingGroup = existingData.groups.find(
            (g) => g.id === group.id,
          );
          if (existingGroup) {
            // Update existing group
            payload = { [`groups[id=${group.id}]`]: group };
            console.log("updateGroup payload: ", JSON.stringify(payload));
          } else {
            // Add new group
            payload = { "groups[]": [group] };
            console.log("addGroup payload: ", JSON.stringify(payload));
          }
          if (!existingGroup || existingGroup.ts < group.ts) {
            console.log("group uri: ", `http://${controller.ip_address}/data`);
            console.log("group payload: ", JSON.stringify(payload));
            const response = await fetch(
              `http://${controller.ip_address}/data`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              },
            );
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
          }
          completed++;
          if (progressCallback) {
            progressCallback(completed, controllers.data.length);
          }
        }

        if (existingGroupIndex !== -1) {
          // Update the group in the local store
          this.data.groups[existingGroupIndex] = group;
          console.log("updated group", group.name);
        } else {
          // Add the new group to the local store
          this.data.groups.push(group);
          console.log("added group", group.name, "with id", group.id);
        }
      } catch (error) {
        console.error("error saving group:", error);
      }
      this.fetchData();
    },

    async deleteGroup(group, progressCallback) {
      const controllers = useControllersStore();
      let payload = { [`groups[id=${group.id}]`]: [] };

      try {
        let completed = 0;
        for (const controller of controllers.data) {
          if (!controller.ip_address) {
            completed++;
            if (progressCallback)
              progressCallback(completed, controllers.data.length);
            continue;
          }

          try {
            // Wrap controller request in try/catch
            const response = await fetch(
              `http://${controller.ip_address}/data`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              },
            );

            if (!response.ok) {
              const errorText = await response.text();
              if (errorText.includes("BadSelector")) {
                console.log(
                  `Group not found on ${controller.ip_address}, continuing...`,
                );
              } else {
                console.warn(
                  `Error from ${controller.ip_address}: ${errorText}`,
                );
              }
            }
          } catch (controllerError) {
            // Log network errors but continue
            console.warn(
              `Network error with ${controller.ip_address}:`,
              controllerError,
            );
          }

          // Always increment counter and update progress
          completed++;
          if (progressCallback) {
            progressCallback(completed, controllers.data.length);
          }
        }

        // Update local store regardless of individual controller errors
        this.data.groups = this.data.groups.filter((g) => g.id !== group.id);
        console.log("deleted group", group.name);
      } catch (error) {
        console.error("error deleting group:", error);
      }
    },

    /*************************************************************
     *
     * scene functions
     *
     **************************************************************/

    async saveScene(scene, progressCallback) {
      const controllers = useControllersStore();
      const existingSceneIndex = this.data.scenes.findIndex(
        (s) => s.id === scene.id,
      );

      // Add timestamp to the scene
      scene.ts = Date.now();

      let payload;

      try {
        let completed = 0;
        for (const controller of controllers.data) {
          const existingDataResponse = await fetch(
            `http://${controller.ip_address}/data`,
          );
          const existingData = await existingDataResponse.json();
          const existingScene = existingData.scenes.find(
            (s) => s.id === scene.id,
          );

          if (existingScene) {
            // Update existing scene
            payload = { [`scenes[id=${scene.id}]`]: scene };
            console.log("updateScene payload: ", JSON.stringify(payload));
          } else {
            // Add new scene
            payload = { "scenes[]": [scene] };
            console.log("addScene payload: ", JSON.stringify(payload));
          }

          if (!existingScene || existingScene.ts < scene.ts) {
            console.log("scene uri: ", `http://${controller.ip_address}/data`);
            console.log("scene payload: ", JSON.stringify(payload));
            const response = await fetch(
              `http://${controller.ip_address}/data`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              },
            );
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
          }
          completed++;
          if (progressCallback) {
            console.log("progressCallback: ", completed);
            progressCallback(completed, controllers.data.length);
          }
        }

        if (existingSceneIndex !== -1) {
          // Update the scene in the local store
          this.data.scenes[existingSceneIndex] = scene;
          console.log("updated scene", scene.name);
        } else {
          // Add the new scene to the local store
          this.data.scenes.push(scene);
          console.log("added scene", scene.name, "with id", scene.id);
        }
      } catch (error) {
        console.error("error saving scene:", error);
      }
    },

    async deleteScene(scene, progressCallback) {
      const controllers = useControllersStore();
      let payload = { [`scenes[id=${scene.id}]`]: [] };

      try {
        let completed = 0;
        for (const controller of controllers.data) {
          if (!controller.ip_address) {
            completed++;
            if (progressCallback)
              progressCallback(completed, controllers.data.length);
            continue;
          }

          try {
            // Wrap controller request in try/catch
            const response = await fetch(
              `http://${controller.ip_address}/data`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              },
            );

            if (!response.ok) {
              const errorText = await response.text();
              if (errorText.includes("BadSelector")) {
                console.log(
                  `Scene not found on ${controller.ip_address}, continuing...`,
                );
              } else {
                console.warn(
                  `Error from ${controller.ip_address}: ${errorText}`,
                );
              }
            }
          } catch (controllerError) {
            // Log network errors but continue
            console.warn(
              `Network error with ${controller.ip_address}:`,
              controllerError,
            );
          }

          // Always increment counter and update progress
          completed++;
          if (progressCallback) {
            progressCallback(completed, controllers.data.length);
          }
        }

        // Update local store regardless of individual controller errors
        this.data.scenes = this.data.scenes.filter((s) => s.id !== scene.id);
        console.log("deleted scene", scene.name);
      } catch (error) {
        console.error("error deleting scene:", error);
      }
    },

    /*************************************************************
     *
     * sync function
     *
     **************************************************************/

    async synchronizeAllData(progressCallback) {
      const controllers = useControllersStore();
      this.status = storeStatus.LOADING;

      try {
        console.log("Starting synchronization across all controllers...");

        // PHASE 1: Collection - gather all data from all controllers
        const allData = {
          presets: [],
          scenes: [],
          groups: [],
        };

        // Keep track of which objects each controller has
        const controllerObjects = {};

        // Fetch data from all controllers
        for (const controller of controllers.data) {
          if (!controller.ip_address) continue;

          try {
            const response = await fetch(
              `http://${controller.ip_address}/data`,
            );
            if (!response.ok) {
              console.warn(`Could not fetch data from ${controller.hostname}`);
              continue;
            }

            const data = await response.json();

            // Track objects by controller for efficient updating
            controllerObjects[controller.id] = {
              presets: new Map(),
              scenes: new Map(),
              groups: new Map(),
            };

            // Add all items to our collection arrays
            if (Array.isArray(data.presets)) {
              data.presets.forEach((preset) => {
                if (preset.id && preset.ts) {
                  allData.presets.push(preset);
                  controllerObjects[controller.id].presets.set(
                    preset.id,
                    preset.ts,
                  );
                }
              });
            }

            if (Array.isArray(data.scenes)) {
              data.scenes.forEach((scene) => {
                if (scene.id && scene.ts) {
                  allData.scenes.push(scene);
                  controllerObjects[controller.id].scenes.set(
                    scene.id,
                    scene.ts,
                  );
                }
              });
            }

            if (Array.isArray(data.groups)) {
              data.groups.forEach((group) => {
                if (group.id && group.ts) {
                  allData.groups.push(group);
                  controllerObjects[controller.id].groups.set(
                    group.id,
                    group.ts,
                  );
                }
              });
            }
          } catch (error) {
            console.warn(`Error fetching from ${controller.hostname}:`, error);
          }
        }

        // PHASE 2: Find the most recent versions
        const latestItems = {
          presets: new Map(),
          scenes: new Map(),
          groups: new Map(),
        };

        // Process presets
        for (const preset of allData.presets) {
          if (!preset.id) continue;

          const existing = latestItems.presets.get(preset.id);
          if (!existing || preset.ts > existing.ts) {
            latestItems.presets.set(preset.id, preset);
          }
        }

        // Process scenes
        for (const scene of allData.scenes) {
          if (!scene.id) continue;

          const existing = latestItems.scenes.get(scene.id);
          if (!existing || scene.ts > existing.ts) {
            latestItems.scenes.set(scene.id, scene);
          }
        }

        // Process groups
        for (const group of allData.groups) {
          if (!group.id) continue;

          const existing = latestItems.groups.get(group.id);
          if (!existing || group.ts > existing.ts) {
            latestItems.groups.set(group.id, group);
          }
        }

        const validGroupIds = new Set(Array.from(latestItems.groups.keys()));
        const scenesToDelete = [];

        const updates = {};

        // Find scenes with missing groups and remove them
        for (const [sceneId, scene] of latestItems.scenes.entries()) {
          if (!validGroupIds.has(scene.group_id)) {
            console.log(
              `Scene "${scene.name}" (ID: ${sceneId}) has invalid group_id, marking for deletion`,
            );
            latestItems.scenes.delete(sceneId);
            scenesToDelete.push(sceneId);
          }
        }

        // Add deletion tasks to controllers that have these orphaned scenes
        if (scenesToDelete.length > 0) {
          for (const [controllerId, controllerData] of Object.entries(
            controllerObjects,
          )) {
            for (const sceneId of scenesToDelete) {
              if (controllerData.scenes.has(sceneId)) {
                // Make sure we have this controller in our updates map
                if (!updates[controllerId]) {
                  updates[controllerId] = {
                    presetsToAdd: [],
                    presetsToUpdate: [],
                    scenesToAdd: [],
                    scenesToUpdate: [],
                    scenesToDelete: [],
                    groupsToAdd: [],
                    groupsToUpdate: [],
                  };
                } else if (!updates[controllerId].scenesToDelete) {
                  updates[controllerId].scenesToDelete = [];
                }

                // Add this scene ID to the delete list for this controller
                updates[controllerId].scenesToDelete.push(sceneId);
              }
            }
          }
        }

        // PHASE 3: Prepare updates for each controller
        for (const controller of controllers.data) {
          if (!controller.ip_address || !controllerObjects[controller.id])
            continue;

          updates[controller.id] = {
            presetsToAdd: [],
            presetsToUpdate: [],
            scenesToAdd: [],
            scenesToUpdate: [],
            groupsToAdd: [],
            groupsToUpdate: [],
          };

          // Check each preset
          for (const [id, preset] of latestItems.presets.entries()) {
            const controllerTs =
              controllerObjects[controller.id].presets.get(id);
            if (!controllerTs) {
              // Controller doesn't have this preset - add it
              updates[controller.id].presetsToAdd.push(preset);
            } else if (controllerTs < preset.ts) {
              // Controller has older version - update it
              updates[controller.id].presetsToUpdate.push(preset);
            }
          }

          // Check each scene
          for (const [id, scene] of latestItems.scenes.entries()) {
            const controllerTs =
              controllerObjects[controller.id].scenes.get(id);
            if (!controllerTs) {
              // Controller doesn't have this scene - add it
              updates[controller.id].scenesToAdd.push(scene);
            } else if (controllerTs < scene.ts) {
              // Controller has older version - update it
              updates[controller.id].scenesToUpdate.push(scene);
            }
          }

          // Check each group
          for (const [id, group] of latestItems.groups.entries()) {
            const controllerTs =
              controllerObjects[controller.id].groups.get(id);
            if (!controllerTs) {
              // Controller doesn't have this group - add it
              updates[controller.id].groupsToAdd.push(group);
            } else if (controllerTs < group.ts) {
              // Controller has older version - update it
              updates[controller.id].groupsToUpdate.push(group);
            }
          }
        }

        // PHASE 4: Execute updates with batched operations
        // Calculate total updates for progress
        const totalUpdates = Object.values(updates).reduce((sum, update) => {
          return (
            sum +
            update.presetsToAdd.length +
            update.presetsToUpdate.length +
            update.scenesToAdd.length +
            update.scenesToUpdate.length +
            update.groupsToAdd.length +
            update.groupsToUpdate.length
          );
        }, 0);

        console.log(
          "**********************************************************",
        );
        console.log("* SYNCHRONIZATION SUMMARY");
        console.log("* Total updates needed:", totalUpdates);
        console.log("* Controllers to update:", Object.keys(updates).length);
        // Log details for each controller if needed
        for (const [controllerId, update] of Object.entries(updates)) {
          const controller = controllers.data.find(
            (c) => String(c.id) === controllerId,
          );
          console.log(`* Controller: ${controller?.hostname || controllerId}`);
          console.log(`*   Presets to add:   ${update.presetsToAdd.length}`);
          console.log(
            `*   Presets to update: ${update.presetsToUpdate.length}`,
          );
          console.log(`*   Scenes to add:    ${update.scenesToAdd.length}`);
          console.log(`*   Scenes to update: ${update.scenesToUpdate.length}`);
          console.log(`*   Groups to add:    ${update.groupsToAdd.length}`);
          console.log(`*   Groups to update: ${update.groupsToUpdate.length}`);
        }
        console.log(
          "**********************************************************",
        );
        let completedUpdates = 0;

        for (const [controllerId, update] of Object.entries(updates)) {
          const controller = controllers.data.find(
            (c) => String(c.id) === controllerId,
          );
          if (!controller || !controller.ip_address) continue;

          // Batch add operations
          if (update.presetsToAdd.length > 0) {
            try {
              const payload = { "presets[]": update.presetsToAdd };
              await fetch(`http://${controller.ip_address}/data`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              completedUpdates += update.presetsToAdd.length;
              if (progressCallback) {
                progressCallback(completedUpdates, totalUpdates);
              }
            } catch (error) {
              console.error(
                `Error adding presets to ${controller.hostname}:`,
                error,
              );
            }
          }

          // Individual update operations
          for (const preset of update.presetsToUpdate) {
            try {
              const payload = { [`presets[id=${preset.id}]`]: preset };
              await fetch(`http://${controller.ip_address}/data`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              completedUpdates++;
              if (progressCallback) {
                progressCallback(completedUpdates, totalUpdates);
              }
            } catch (error) {
              console.error(
                `Error updating preset on ${controller.hostname}:`,
                error,
              );
            }
          }

          // Repeat for scenes and groups
          if (update.scenesToDelete && update.scenesToDelete.length > 0) {
            for (const sceneId of update.scenesToDelete) {
              try {
                const payload = { [`scenes[id=${sceneId}]`]: [] };
                await fetch(`http://${controller.ip_address}/data`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                completedUpdates++;
                if (progressCallback) {
                  progressCallback(completedUpdates, totalUpdates);
                }
              } catch (error) {
                console.error(
                  `Error deleting orphaned scene ${sceneId} on ${controller.hostname}:`,
                  error,
                );
              }
            }
          }

          for (const scene of update.scenesToUpdate) {
            try {
              const payload = { [`scenes[id=${scene.id}]`]: scene };
              await fetch(`http://${controller.ip_address}/data`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              completedUpdates++;
              if (progressCallback) {
                progressCallback(completedUpdates, totalUpdates);
              }
            } catch (error) {
              console.error(
                `Error updating scene on ${controller.hostname}:`,
                error,
              );
            }
          }

          // Batch add operations for groups
          if (update.groupsToAdd.length > 0) {
            try {
              const payload = { "groups[]": update.groupsToAdd };
              await fetch(`http://${controller.ip_address}/data`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              completedUpdates += update.groupsToAdd.length;
              if (progressCallback) {
                progressCallback(completedUpdates, totalUpdates);
              }
            } catch (error) {
              console.error(
                `Error adding groups to ${controller.hostname}:`,
                error,
              );
            }
          }

          // Individual group update operations
          for (const group of update.groupsToUpdate) {
            try {
              const payload = { [`groups[id=${group.id}]`]: group };
              await fetch(`http://${controller.ip_address}/data`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              completedUpdates++;
              if (progressCallback) {
                progressCallback(completedUpdates, totalUpdates);
              }
            } catch (error) {
              console.error(
                `Error updating group on ${controller.hostname}:`,
                error,
              );
            }
          }
        }

        // Update local state with the latest versions
        this.data.presets = Array.from(latestItems.presets.values());
        this.data.scenes = Array.from(latestItems.scenes.values());
        this.data.groups = Array.from(latestItems.groups.values());

        console.log("Synchronization completed successfully");
        this.status = storeStatus.READY;
        return true;
      } catch (error) {
        console.error("Error during synchronization:", error);
        this.status = storeStatus.ERROR;
        return false;
      }
    },
  },
});
