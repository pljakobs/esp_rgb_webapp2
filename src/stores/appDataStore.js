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

      // Only proceed if not already synced or syncing
      if (
        this.status === storeStatus.SYNCED ||
        this.status === storeStatus.SYNCING
      ) {
        console.log("Synchronization already completed or in progress");
        return;
      }

      // Immediate check if both stores are ready
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
        return; // Exit early - no need to set up watchers
      }

      // Set up a watcher for the controllers store status
      watch(
        () => controllers.status,
        (newStatus) => {
          if (
            newStatus === storeStatus.READY &&
            this.status === storeStatus.READY &&
            this.status !== storeStatus.SYNCED &&
            this.status !== storeStatus.SYNCING
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
            controllers.status === storeStatus.READY &&
            this.status !== storeStatus.SYNCED &&
            this.status !== storeStatus.SYNCING
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
          let existingPreset = null;
          try {
            const timeout = new AbortController();
            const timeoutId = setTimeout(() => timeout.abort(), 5000); // 5 second timeout

            const existingDataResponse = await fetch(
              `http://${controller.ip_address}/data`,
              {
                signal: timeout.signal,
                headers: { Accept: "application/json" },
              },
            );

            clearTimeout(timeoutId);

            if (!existingDataResponse.ok) {
              console.warn(
                `Cannot fetch existing data from ${controller.ip_address}, skipping...`,
              );
              completed++;
              if (progressCallback) {
                progressCallback(completed, controllers.data.length);
              }
              continue;
            }

            const existingData = await existingDataResponse.json();
            existingPreset = existingData.presets.find(
              (p) => p.id === preset.id,
            );
          } catch (fetchError) {
            console.warn(
              `Error fetching existing data from ${controller.ip_address}:`,
              fetchError.message,
            );
            completed++;
            if (progressCallback) {
              progressCallback(completed, controllers.data.length);
            }
            continue;
          }

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

            try {
              const saveTimeout = new AbortController();
              const saveTimeoutId = setTimeout(
                () => saveTimeout.abort(),
                10000,
              ); // 10 second timeout

              const response = await fetch(
                `http://${controller.ip_address}/data`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(payload),
                  signal: saveTimeout.signal,
                },
              );

              clearTimeout(saveTimeoutId);

              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
            } catch (saveError) {
              if (saveError.name === "AbortError") {
                console.warn(
                  `Timeout saving to ${controller.ip_address} (10s timeout exceeded)`,
                );
              } else {
                console.warn(
                  `Error saving to ${controller.ip_address}:`,
                  saveError.message,
                );
              }
              // Continue with next controller
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

      try {
        let completed = 0;
        const totalControllers = controllers.data.length;

        console.log(
          `🔄 Saving group '${group.name}' to ${totalControllers} controllers`,
        );

        for (const controller of controllers.data) {
          console.log(
            `📡 Processing controller ${controller.name} (${controller.ip_address})`,
          );

          try {
            // Use the same robust timeout pattern as scenes
            const timeoutMs = 8000; // 8 second timeout
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => {
              console.log(
                `⏰ Timeout reached for controller ${controller.name}`,
              );
              abortController.abort();
            }, timeoutMs);

            try {
              // First, get existing data
              const existingDataResponse = await fetch(
                `http://${controller.ip_address}/data`,
                {
                  signal: abortController.signal,
                  headers: {
                    "Cache-Control": "no-cache",
                    Accept: "application/json",
                  },
                },
              );

              if (!existingDataResponse.ok) {
                throw new Error(
                  `GET failed with status ${existingDataResponse.status}`,
                );
              }

              const existingData = await existingDataResponse.json();
              const existingGroup = existingData.groups?.find(
                (g) => g.id === group.id,
              );

              let payload;
              if (existingGroup) {
                // Update existing group
                payload = { [`groups[id=${group.id}]`]: group };
                console.log(`🔄 Updating existing group on ${controller.name}`);
              } else {
                // Add new group
                payload = { "groups[]": [group] };
                console.log(`➕ Adding new group to ${controller.name}`);
              }

              // Only update if needed
              if (!existingGroup || existingGroup.ts < group.ts) {
                const postResponse = await fetch(
                  `http://${controller.ip_address}/data`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                    signal: abortController.signal,
                  },
                );

                if (!postResponse.ok) {
                  throw new Error(
                    `POST failed with status ${postResponse.status}`,
                  );
                }

                console.log(
                  `✅ Successfully updated controller ${controller.name}`,
                );
              } else {
                console.log(
                  `⏭️ Skipping ${controller.name} - already up to date`,
                );
              }
            } finally {
              clearTimeout(timeoutId);
            }
          } catch (error) {
            if (error.name === "AbortError") {
              console.error(
                `⏰ Timeout updating controller ${controller.name} after 8 seconds`,
              );
            } else {
              console.error(
                `❌ Error updating controller ${controller.name}:`,
                error.message,
              );
            }
            // Continue with other controllers even if one fails
          }

          completed++;
          console.log(
            `📊 Group save progress: ${completed}/${totalControllers}`,
          );
          if (progressCallback) {
            progressCallback(completed, totalControllers);
          }
        }

        // Update local store after all controllers processed
        if (existingGroupIndex !== -1) {
          this.data.groups[existingGroupIndex] = group;
          console.log(`✅ Updated local group: ${group.name}`);
        } else {
          this.data.groups.push(group);
          console.log(
            `✅ Added local group: ${group.name} with id ${group.id}`,
          );
        }

        console.log(`🎉 Group save completed successfully`);
        return true;
      } catch (error) {
        console.error("❌ Critical error saving group:", error);
        throw error;
      } finally {
        // Always refresh data regardless of success/failure
        this.fetchData();
      }
    },

    async deleteGroup(group, progressCallback) {
      const controllers = useControllersStore();
      let payload = { [`groups[id=${group.id}]`]: [] };

      try {
        let completed = 0;
        const totalControllers = controllers.data.length;
        
        console.log(`🗑️ Deleting group '${group.name}' from ${totalControllers} controllers`);
        
        for (const controller of controllers.data) {
          console.log(`📡 Processing controller ${controller.name} (${controller.ip_address})`);
          
          if (!controller.ip_address) {
            console.log(`⏭️ Skipping ${controller.name} - no IP address`);
            completed++;
            if (progressCallback) {
              progressCallback(completed, totalControllers);
            }
            continue;
          }

          try {
            // Use the same robust timeout pattern as other operations
            const timeoutMs = 8000; // 8 second timeout
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => {
              console.log(`⏰ Timeout reached for controller ${controller.name}`);
              abortController.abort();
            }, timeoutMs);

            try {
              const response = await fetch(
                `http://${controller.ip_address}/data`,
                {
                  method: "POST",
                  headers: { 
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                  },
                  body: JSON.stringify(payload),
                  signal: abortController.signal,
                },
              );

              if (!response.ok) {
                const errorText = await response.text();
                if (errorText.includes("BadSelector")) {
                  console.log(`⚠️ Group not found on ${controller.name}, already deleted`);
                } else {
                  console.warn(`⚠️ Error from ${controller.name}: ${errorText}`);
                }
              } else {
                console.log(`✅ Successfully deleted group from ${controller.name}`);
              }
              
            } finally {
              clearTimeout(timeoutId);
            }
            
          } catch (error) {
            if (error.name === 'AbortError') {
              console.error(`⏰ Timeout deleting from controller ${controller.name} after 8 seconds`);
            } else {
              console.warn(`❌ Network error with ${controller.name}:`, error.message);
            }
            // Continue with other controllers even if one fails
          }

          // Always increment counter and update progress
          completed++;
          console.log(`📊 Group delete progress: ${completed}/${totalControllers}`);
          if (progressCallback) {
            progressCallback(completed, totalControllers);
          }
        }

        // Update local store regardless of individual controller errors
        this.data.groups = this.data.groups.filter((g) => g.id !== group.id);
        console.log(`✅ Deleted local group: ${group.name}`);
        console.log(`🎉 Group delete completed successfully`);
        return true;
        
      } catch (error) {
        console.error("❌ Critical error deleting group:", error);
        throw error;
      } finally {
        // Always refresh data regardless of success/failure
        this.fetchData();
      }
    },

    /*************************************************************
     *
     * scene functions
     *
     **************************************************************/

    async saveScene(scene, progressCallback) {
      console.log("🚀🚀🚀 STARTING SCENE SAVE OPERATION 🚀🚀🚀");
      console.log("Scene to save:", scene.name, "ID:", scene.id);

      const controllers = useControllersStore();
      console.log("Controllers available:", controllers.data.length);

      const existingSceneIndex = this.data.scenes.findIndex(
        (s) => s.id === scene.id,
      );

      // Add timestamp to the scene
      scene.ts = Date.now();

      let payload;
      let saveErrors = [];
      let successCount = 0;

      try {
        let completed = 0;
        for (const controller of controllers.data) {
          if (!controller.ip_address) {
            completed++;
            if (progressCallback) {
              progressCallback(completed, controllers.data.length);
            }
            continue;
          }

          try {
            // Create AbortController for timeout
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), 10000); // 10 second timeout

            // Check existing scene with timeout
            const existingDataResponse = await fetch(
              `http://${controller.ip_address}/data`,
              {
                signal: abortController.signal,
              },
            );

            if (!existingDataResponse.ok) {
              throw new Error(
                `HTTP ${existingDataResponse.status}: ${existingDataResponse.statusText}`,
              );
            }

            const existingData = await existingDataResponse.json();
            clearTimeout(timeoutId);

            const existingScene = existingData.scenes.find(
              (s) => s.id === scene.id,
            );

            if (existingScene) {
              // Update existing scene
              payload = { [`scenes[id=${scene.id}]`]: scene };
              console.log("🧪 DEBUG: Updating existing scene");
              console.log("🧪 Scene data:", JSON.stringify(scene, null, 2));
              console.log("updateScene payload: ", JSON.stringify(payload));
            } else {
              // Add new scene
              payload = { "scenes[]": [scene] };
              console.log("🧪 DEBUG: Adding new scene");
              console.log("🧪 Scene data:", JSON.stringify(scene, null, 2));
              console.log("addScene payload: ", JSON.stringify(payload));
            }

            if (!existingScene || existingScene.ts < scene.ts) {
              console.log(
                "scene uri: ",
                `http://${controller.ip_address}/data`,
              );
              console.log("scene payload: ", JSON.stringify(payload));

              // Create new AbortController for save request
              const saveAbortController = new AbortController();
              const saveTimeoutId = setTimeout(
                () => saveAbortController.abort(),
                10000,
              );

              const response = await fetch(
                `http://${controller.ip_address}/data`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(payload),
                  signal: saveAbortController.signal,
                },
              );

              clearTimeout(saveTimeoutId);

              if (!response.ok) {
                // Try to get error details from response
                let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
                try {
                  const errorText = await response.text();
                  if (errorText) {
                    errorDetails += ` - ${errorText}`;
                  }
                } catch (e) {
                  // Ignore if we can't read response text
                }
                throw new Error(errorDetails);
              }

              console.log(
                `✅ Scene saved successfully to controller ${controller.hostname || controller.ip_address}`,
              );
              successCount++;
            } else {
              console.log(
                `⏭️ Scene already up-to-date on controller ${controller.hostname || controller.ip_address}`,
              );
              successCount++;
            }
          } catch (error) {
            console.log("🔥 CONTROLLER ERROR CAUGHT:", error);
            console.log(
              "🔥 Controller:",
              controller.hostname || controller.ip_address,
            );
            console.log("🔥 Error type:", error.name);
            console.log("🔥 Error message:", error.message);

            const errorMsg =
              error.message || error.toString() || "Network error";
            console.warn(
              `⚠️ Failed to save scene to controller ${controller.hostname || controller.ip_address}: ${errorMsg}`,
            );
            saveErrors.push({
              controller: controller.hostname || controller.ip_address,
              error: errorMsg,
            });
          }

          completed++;
          if (progressCallback) {
            console.log("progressCallback: ", completed);
            progressCallback(completed, controllers.data.length);
          }
        }

        // Always update local store regardless of network errors
        if (existingSceneIndex !== -1) {
          // Update the scene in the local store
          this.data.scenes[existingSceneIndex] = scene;
          console.log("✅ Updated scene locally:", scene.name);
        } else {
          // Add the new scene to the local store
          this.data.scenes.push(scene);
          console.log(
            "✅ Added scene locally:",
            scene.name,
            "with id",
            scene.id,
          );
        }

        // Log summary
        console.log("🎯 SAVE OPERATION COMPLETE - GENERATING SUMMARY:");
        console.log("🎯 Success count:", successCount);
        console.log("🎯 Error count:", saveErrors.length);
        console.log("🎯 Save errors:", saveErrors);

        if (saveErrors.length > 0) {
          console.warn(
            `⚠️ Scene saved with ${saveErrors.length} controller(s) unreachable:`,
            saveErrors,
          );
        } else {
          console.log(
            `✅ Scene "${scene.name}" saved successfully to all ${successCount} controllers`,
          );
        }

        const result = {
          success: true,
          successCount,
          errors: saveErrors,
          totalControllers: controllers.data.length,
        };

        console.log(
          "🎬 AppDataStore returning result:",
          JSON.stringify(result, null, 2),
        );
        console.log("🚀🚀🚀 SCENE SAVE OPERATION FINISHED 🚀🚀🚀");
        return result;
      } catch (error) {
        console.error("❌ Critical error saving scene:", error);

        // Still try to save locally even if there's a critical error
        try {
          if (existingSceneIndex !== -1) {
            this.data.scenes[existingSceneIndex] = scene;
            console.log("✅ Updated scene locally despite error:", scene.name);
          } else {
            this.data.scenes.push(scene);
            console.log(
              "✅ Added scene locally despite error:",
              scene.name,
              "with id",
              scene.id,
            );
          }
        } catch (localError) {
          console.error("❌ Failed to save scene locally:", localError);
        }

        const errorMessage =
          error?.message ||
          error?.toString() ||
          "Critical error occurred during save operation";

        return {
          success: false,
          error: errorMessage,
          successCount,
          errors: saveErrors,
          totalControllers: controllers.data?.length || 0,
        };
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

      // Check if we're already syncing or have completed sync
      if (this.status === storeStatus.SYNCING) {
        console.log("🔄 Synchronization already in progress, skipping");
        return false;
      }

      if (this.status === storeStatus.SYNCED) {
        console.log("✅ Synchronization already completed, skipping");
        return true;
      }

      // Set status to SYNCING to prevent duplicate syncs
      this.status = storeStatus.SYNCING;

      try {
        console.log("🚀 Starting robust synchronization across all controllers...");

        // PHASE 1: Collection - gather all data from all controllers
        const allData = {
          presets: [],
          scenes: [],
          groups: [],
        };

        // Keep track of which objects each controller has
        const controllerObjects = {};
        const unreachableControllers = [];

        console.log(`📡 Phase 1: Collecting data from ${controllers.data.length} controllers...`);

        // Fetch data from all controllers with robust error handling
        for (const controller of controllers.data) {
          if (!controller.ip_address) {
            console.log(`⏭️ Skipping ${controller.hostname} - no IP address`);
            continue;
          }

          try {
            console.log(`📥 Fetching data from ${controller.hostname} (${controller.ip_address})`);
            
            // Add timeout to prevent hanging on unreachable controllers
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => {
              console.log(`⏰ Timeout reached for ${controller.hostname}`);
              abortController.abort();
            }, 8000); // 8 second timeout

            const response = await fetch(
              `http://${controller.ip_address}/data`,
              {
                signal: abortController.signal,
                headers: {
                  Accept: "application/json",
                  "Cache-Control": "no-cache"
                },
              },
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
              console.warn(`❌ HTTP ${response.status} from ${controller.hostname}`);
              unreachableControllers.push(controller);
              continue;
            }

            const data = await response.json();
            console.log(`✅ Got data from ${controller.hostname}: ${data.presets?.length || 0} presets, ${data.scenes?.length || 0} scenes, ${data.groups?.length || 0} groups`);

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
            // Handle different types of network errors more specifically
            if (error.name === "AbortError") {
              console.warn(`⏰ Timeout fetching from ${controller.hostname} (8s timeout exceeded)`);
            } else if (error instanceof TypeError && error.message.includes("NetworkError")) {
              console.warn(`🔌 Network error with ${controller.hostname}: Controller may be offline`);
            } else if (error instanceof TypeError && error.message.includes("fetch")) {
              console.warn(`📡 Fetch error with ${controller.hostname}: ${error.message}`);
            } else {
              console.warn(`❌ Unexpected error fetching from ${controller.hostname}:`, error.message);
            }
            unreachableControllers.push(controller);
            // Continue with next controller regardless of error type
            continue;
          }
        }

        console.log(`📊 Collection complete: Found ${allData.presets.length} presets, ${allData.scenes.length} scenes, ${allData.groups.length} groups across all controllers`);
        if (unreachableControllers.length > 0) {
          console.warn(`⚠️ ${unreachableControllers.length} controllers were unreachable:`, unreachableControllers.map(c => c.hostname));
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

        // PHASE 4: Execute updates with robust error handling
        console.log("🚀 Phase 4: Executing updates across controllers...");
        
        // Calculate total updates for progress
        const totalUpdates = Object.values(updates).reduce((sum, update) => {
          return (
            sum +
            update.presetsToAdd.length +
            update.presetsToUpdate.length +
            update.scenesToAdd.length +
            update.scenesToUpdate.length +
            (update.scenesToDelete ? update.scenesToDelete.length : 0) +
            update.groupsToAdd.length +
            update.groupsToUpdate.length
          );
        }, 0);

        console.log(`📊 Total synchronization operations: ${totalUpdates}`);
        let completedUpdates = 0;
        let failedOperations = 0;

        // Execute updates for each controller with robust error handling
        for (const [controllerId, update] of Object.entries(updates)) {
          const controller = controllers.data.find(
            (c) => String(c.id) === controllerId,
          );
          if (!controller || !controller.ip_address) continue;

          console.log(`🔄 Synchronizing ${controller.name}...`);

          // Helper function for robust HTTP requests with timeout
          const robustRequest = async (payload, operation) => {
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => {
              console.log(`⏰ Timeout for ${operation} on ${controller.name}`);
              abortController.abort();
            }, 8000); // 8 second timeout

            try {
              const response = await fetch(
                `http://${controller.ip_address}/data`,
                {
                  method: "POST",
                  headers: { 
                    "Content-Type": "application/json",
                    "Accept": "application/json" 
                  },
                  body: JSON.stringify(payload),
                  signal: abortController.signal,
                },
              );

              clearTimeout(timeoutId);

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
              }

              return { success: true };
            } catch (error) {
              clearTimeout(timeoutId);
              if (error.name === 'AbortError') {
                throw new Error(`Timeout after 8 seconds`);
              }
              throw error;
            }
          };

          // Batch add presets
          if (update.presetsToAdd.length > 0) {
            try {
              const payload = { "presets[]": update.presetsToAdd };
              await robustRequest(payload, `adding ${update.presetsToAdd.length} presets`);
              console.log(`✅ Added ${update.presetsToAdd.length} presets to ${controller.name}`);
              completedUpdates += update.presetsToAdd.length;
            } catch (error) {
              console.error(`❌ Failed to add presets to ${controller.name}:`, error.message);
              failedOperations += update.presetsToAdd.length;
              completedUpdates += update.presetsToAdd.length; // Count as completed to avoid hanging
            }
            if (progressCallback) {
              progressCallback(completedUpdates, totalUpdates);
            }
          }

          // Individual preset updates
          for (const preset of update.presetsToUpdate) {
            try {
              const payload = { [`presets[id=${preset.id}]`]: preset };
              await robustRequest(payload, `updating preset ${preset.name}`);
              console.log(`✅ Updated preset ${preset.name} on ${controller.name}`);
              completedUpdates++;
            } catch (error) {
              console.error(`❌ Failed to update preset ${preset.name} on ${controller.name}:`, error.message);
              failedOperations++;
              completedUpdates++; // Count as completed to avoid hanging
            }
            if (progressCallback) {
              progressCallback(completedUpdates, totalUpdates);
            }
          }

          // Delete orphaned scenes
          if (update.scenesToDelete && update.scenesToDelete.length > 0) {
            for (const sceneId of update.scenesToDelete) {
              try {
                const payload = { [`scenes[id=${sceneId}]`]: [] };
                await robustRequest(payload, `deleting orphaned scene ${sceneId}`);
                console.log(`✅ Deleted orphaned scene ${sceneId} from ${controller.name}`);
                completedUpdates++;
              } catch (error) {
                console.error(`❌ Failed to delete orphaned scene ${sceneId} from ${controller.name}:`, error.message);
                failedOperations++;
                completedUpdates++; // Count as completed to avoid hanging
              }
              if (progressCallback) {
                progressCallback(completedUpdates, totalUpdates);
              }
            }
          }

          // Batch add scenes
          if (update.scenesToAdd.length > 0) {
            try {
              const payload = { "scenes[]": update.scenesToAdd };
              await robustRequest(payload, `adding ${update.scenesToAdd.length} scenes`);
              console.log(`✅ Added ${update.scenesToAdd.length} scenes to ${controller.hostname}`);
              completedUpdates += update.scenesToAdd.length;
            } catch (error) {
              console.error(`❌ Failed to add scenes to ${controller.hostname}:`, error.message);
              failedOperations += update.scenesToAdd.length;
              completedUpdates += update.scenesToAdd.length; // Count as completed to avoid hanging
            }
            if (progressCallback) {
              progressCallback(completedUpdates, totalUpdates);
            }
          }

          // Individual scene updates
          for (const scene of update.scenesToUpdate) {
            try {
              const payload = { [`scenes[id=${scene.id}]`]: scene };
              await robustRequest(payload, `updating scene ${scene.name}`);
              console.log(`✅ Updated scene ${scene.name} on ${controller.hostname}`);
              completedUpdates++;
            } catch (error) {
              console.error(`❌ Failed to update scene ${scene.name} on ${controller.hostname}:`, error.message);
              failedOperations++;
              completedUpdates++; // Count as completed to avoid hanging
            }
            if (progressCallback) {
              progressCallback(completedUpdates, totalUpdates);
            }
          }

          // Batch add groups
          if (update.groupsToAdd.length > 0) {
            try {
              const payload = { "groups[]": update.groupsToAdd };
              await robustRequest(payload, `adding ${update.groupsToAdd.length} groups`);
              console.log(`✅ Added ${update.groupsToAdd.length} groups to ${controller.hostname}`);
              completedUpdates += update.groupsToAdd.length;
            } catch (error) {
              console.error(`❌ Failed to add groups to ${controller.hostname}:`, error.message);
              failedOperations += update.groupsToAdd.length;
              completedUpdates += update.groupsToAdd.length; // Count as completed to avoid hanging
            }
            if (progressCallback) {
              progressCallback(completedUpdates, totalUpdates);
            }
          }

          // Individual group updates
          for (const group of update.groupsToUpdate) {
            try {
              const payload = { [`groups[id=${group.id}]`]: group };
              await robustRequest(payload, `updating group ${group.name}`);
              console.log(`✅ Updated group ${group.name} on ${controller.hostname}`);
              completedUpdates++;
            } catch (error) {
              console.error(`❌ Failed to update group ${group.name} on ${controller.hostname}:`, error.message);
              failedOperations++;
              completedUpdates++; // Count as completed to avoid hanging
            }
            if (progressCallback) {
              progressCallback(completedUpdates, totalUpdates);
            }
          }
        }

        // PHASE 5: Update local state and complete synchronization
        console.log("📝 Phase 5: Updating local state with synchronized data...");
        
        // Update local state with the latest versions
        this.data.presets = Array.from(latestItems.presets.values());
        this.data.scenes = Array.from(latestItems.scenes.values());
        this.data.groups = Array.from(latestItems.groups.values());

        console.log("🎉 Synchronization completed successfully!");
        console.log(`📊 Final stats: ${completedUpdates} operations completed, ${failedOperations} operations failed`);
        
        if (unreachableControllers.length > 0) {
          console.warn(`⚠️ Note: ${unreachableControllers.length} controllers were unreachable and may need manual synchronization`);
        }
        
        this.status = storeStatus.SYNCED;
        return true;
      } catch (error) {
        console.error("❌ Critical error during synchronization:", error);
        this.status = storeStatus.ERROR;
        return false;
      }
    },
  },
});
