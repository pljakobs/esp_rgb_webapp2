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
      controllers: [], // Add controllers metadata
      "sync-lock": null, // Object with {id, ts} structure for distributed sync lock
    },
    status: storeStatus.IDLE,
    abortSaveOperation: false,
    syncWatchInitialized: false,
  }),

  actions: {
    async fetchData() {
      try {
        this.status = storeStatus.LOADING;
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
          console.log(
            "controllers data: ",
            JSON.stringify(this.data.controllers || []),
          );
        }
      } catch (error) {
        console.error("error fetching app-data:", error);
        this.status = storeStatus.ERROR;
      }
    },

    watchForSync() {
      const controllers = useControllersStore();

      const maybeStartSync = () => {
        if (
          controllers.status === storeStatus.READY &&
          this.status === storeStatus.READY &&
          this.status !== storeStatus.SYNCED &&
          this.status !== storeStatus.SYNCING
        ) {
          console.log("Both stores are ready, starting synchronization...");
          this.synchronizeAllData((completed, total) => {
            console.log(`Sync progress: ${completed}/${total}`);
          });
        }
      };

      if (!this.syncWatchInitialized) {
        const stopControllersWatch = watch(
          () => controllers.status,
          () => {
            maybeStartSync();
          },
        );

        const stopSelfWatch = watch(
          () => this.status,
          () => {
            maybeStartSync();
          },
        );

        this._syncWatchStops = [stopControllersWatch, stopSelfWatch];
        this.syncWatchInitialized = true;
      }

      maybeStartSync();
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

        console.log(
          `🗑️ Deleting group '${group.name}' from ${totalControllers} controllers`,
        );

        for (const controller of controllers.data) {
          console.log(
            `📡 Processing controller ${controller.name} (${controller.ip_address})`,
          );

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
              console.log(
                `⏰ Timeout reached for controller ${controller.name}`,
              );
              abortController.abort();
            }, timeoutMs);

            try {
              const response = await fetch(
                `http://${controller.ip_address}/data`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                  },
                  body: JSON.stringify(payload),
                  signal: abortController.signal,
                },
              );

              if (!response.ok) {
                const errorText = await response.text();
                if (errorText.includes("BadSelector")) {
                  console.log(
                    `⚠️ Group not found on ${controller.name}, already deleted`,
                  );
                } else {
                  console.warn(
                    `⚠️ Error from ${controller.name}: ${errorText}`,
                  );
                }
              } else {
                console.log(
                  `✅ Successfully deleted group from ${controller.name}`,
                );
              }
            } finally {
              clearTimeout(timeoutId);
            }
          } catch (error) {
            if (error.name === "AbortError") {
              console.error(
                `⏰ Timeout deleting from controller ${controller.name} after 8 seconds`,
              );
            } else {
              console.warn(
                `❌ Network error with ${controller.name}:`,
                error.message,
              );
            }
            // Continue with other controllers even if one fails
          }

          // Always increment counter and update progress
          completed++;
          console.log(
            `📊 Group delete progress: ${completed}/${totalControllers}`,
          );
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
      console.log("Starting scene save operation");
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
        const totalControllers = controllers.data.length;

        console.log(
          `Saving scene '${scene.name}' to ${totalControllers} controllers`,
        );

        for (const controller of controllers.data) {
          if (!controller.ip_address) {
            console.log(`Skipping controller - no IP address`);
            completed++;
            if (progressCallback) {
              progressCallback(completed, totalControllers);
            }
            continue;
          }

          try {
            // Add timeout protection
            const timeoutMs = 8000;
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => {
              console.log(`Timeout reached for controller ${controller.name}`);
              abortController.abort();
            }, timeoutMs);

            try {
              // Check existing scene
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
              const existingScene = existingData.scenes?.find(
                (s) => s.id === scene.id,
              );

              if (existingScene) {
                // Update existing scene
                payload = { [`scenes[id=${scene.id}]`]: scene };
                console.log("Updating existing scene on", controller.name);
              } else {
                // Add new scene
                payload = { "scenes[]": [scene] };
                console.log("Adding new scene to", controller.name);
              }

              // Only update if needed
              if (!existingScene || existingScene.ts < scene.ts) {
                console.log("Scene save payload:", JSON.stringify(payload));

                const response = await fetch(
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

                if (!response.ok) {
                  throw new Error(`POST failed with status ${response.status}`);
                }

                console.log(
                  `✅ Successfully saved scene to ${controller.name}`,
                );
                successCount++;
              } else {
                console.log(`Skipping ${controller.name} - already up to date`);
                successCount++;
              }
            } finally {
              clearTimeout(timeoutId);
            }
          } catch (error) {
            if (error.name === "AbortError") {
              console.error(
                `Timeout saving to controller ${controller.name} after 8 seconds`,
              );
            } else {
              console.error(
                `Error saving to controller ${controller.name}:`,
                error.message,
              );
            }

            const errorMsg =
              error.message || error.toString() || "Network error";
            saveErrors.push({
              controller: controller.hostname || controller.ip_address,
              error: errorMsg,
            });
          }

          completed++;
          console.log(`Scene save progress: ${completed}/${totalControllers}`);
          if (progressCallback) {
            progressCallback(completed, totalControllers);
          }
        }

        // Update local store
        if (existingSceneIndex !== -1) {
          this.data.scenes[existingSceneIndex] = scene;
          console.log("✅ Updated scene locally:", scene.name);
        } else {
          this.data.scenes.push(scene);
          console.log(
            "✅ Added scene locally:",
            scene.name,
            "with id",
            scene.id,
          );
        }

        // Log summary
        console.log("Scene save operation complete");
        console.log("Success count:", successCount);
        console.log("Error count:", saveErrors.length);

        if (saveErrors.length > 0) {
          console.warn(
            `Scene saved with ${saveErrors.length} controller(s) unreachable:`,
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

        console.log("Scene save result:", JSON.stringify(result, null, 2));
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
      } finally {
        // Refresh data like other functions do
        this.fetchData();
      }
    },

    async deleteScene(scene, progressCallback) {
      const controllers = useControllersStore();
      let payload = { [`scenes[id=${scene.id}]`]: [] };

      try {
        let completed = 0;
        const totalControllers = controllers.data.length;

        console.log(
          `Deleting scene '${scene.name}' from ${totalControllers} controllers`,
        );

        for (const controller of controllers.data) {
          if (!controller.ip_address) {
            console.log(`Skipping controller - no IP address`);
            completed++;
            if (progressCallback) {
              progressCallback(completed, totalControllers);
            }
            continue;
          }

          try {
            // Add timeout protection like other functions
            const timeoutMs = 8000;
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => {
              console.log(`Timeout reached for controller ${controller.name}`);
              abortController.abort();
            }, timeoutMs);

            try {
              const response = await fetch(
                `http://${controller.ip_address}/data`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                  },
                  body: JSON.stringify(payload),
                  signal: abortController.signal,
                },
              );

              if (!response.ok) {
                const errorText = await response.text();
                if (errorText.includes("BadSelector")) {
                  console.log(
                    `Scene not found on ${controller.name}, already deleted`,
                  );
                } else {
                  console.warn(`Error from ${controller.name}: ${errorText}`);
                }
              } else {
                console.log(
                  `✅ Successfully deleted scene from ${controller.name}`,
                );
              }
            } finally {
              clearTimeout(timeoutId);
            }
          } catch (error) {
            if (error.name === "AbortError") {
              console.error(
                `Timeout deleting from controller ${controller.name} after 8 seconds`,
              );
            } else {
              console.warn(
                `Network error with ${controller.name}:`,
                error.message,
              );
            }
          }

          completed++;
          console.log(
            `Scene delete progress: ${completed}/${totalControllers}`,
          );
          if (progressCallback) {
            progressCallback(completed, totalControllers);
          }
        }

        // Update local store
        this.data.scenes = this.data.scenes.filter((s) => s.id !== scene.id);
        console.log(`✅ Deleted local scene: ${scene.name}`);
        console.log(`Scene delete completed successfully`);
        return true;
      } catch (error) {
        console.error("❌ Critical error deleting scene:", error);
        throw error;
      } finally {
        // Refresh data like other functions do
        this.fetchData();
      }
    },
    /*************************************************************
     *
     * controller metadata functions
     *
     **************************************************************/

    async saveControllerMetadata(controllerId, metadata, progressCallback) {
      const controllers = useControllersStore();
      this.abortSaveOperation = false;

      // Ensure we have a valid controller ID
      if (!controllerId) {
        console.error("No controller ID provided for metadata save");
        return false;
      }

      // Add timestamp to the metadata
      metadata.ts = Date.now();
      metadata.id = controllerId;

      console.log(
        "Saving controller metadata:",
        JSON.stringify(metadata, null, 2),
      );

      const existingControllerIndex = this.data.controllers.findIndex(
        (c) => c.id === controllerId,
      );

      try {
        let completed = 0;
        const totalControllers = controllers.data.length;

        console.log(
          `🔄 Saving controller metadata for '${metadata.name || metadata.hostname}' to ${totalControllers} controllers`,
        );

        for (const controller of controllers.data) {
          if (this.abortSaveOperation) {
            console.log("Save operation aborted");
            break;
          }

          if (!controller.ip_address) {
            console.warn(
              `Controller ${controller.name || controller.hostname} has no IP address, skipping`,
            );
            completed++;
            if (progressCallback) {
              progressCallback(completed, totalControllers);
            }
            continue;
          }

          // Check if the controller already has this metadata
          let existingMetadata = null;
          try {
            const response = await fetch(
              `http://${controller.ip_address}/data`,
              {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                },
              },
            );

            if (response.ok) {
              const data = await response.json();
              if (data.controllers && Array.isArray(data.controllers)) {
                existingMetadata = data.controllers.find(
                  (c) => c.id === controllerId,
                );
              }
            }
          } catch (fetchError) {
            console.warn(
              `Failed to fetch existing metadata from ${controller.name || controller.hostname}: ${fetchError.message}`,
            );
          }

          if (existingMetadata) {
            console.log(
              `Controller ${controller.name || controller.hostname} has existing metadata with ts: ${existingMetadata.ts}`,
            );
          } else {
            console.log(
              `Controller ${controller.name || controller.hostname} has no existing metadata`,
            );
          }

          if (!existingMetadata || existingMetadata.ts < metadata.ts) {
            let payload;
            if (existingMetadata) {
              // Update existing metadata
              payload = { [`controllers[id=${controllerId}]`]: metadata };
            } else {
              // Add new metadata
              payload = { controllers: [metadata] };
            }

            console.log(
              `Sending metadata to ${controller.name || controller.hostname}: ${JSON.stringify(payload)}`,
            );

            try {
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
                console.error(
                  `Failed to save metadata to ${controller.name || controller.hostname}: ${response.status} ${response.statusText}`,
                );
              } else {
                console.log(
                  `Successfully saved metadata to ${controller.name || controller.hostname}`,
                );
              }
            } catch (saveError) {
              console.error(
                `Error saving metadata to ${controller.name || controller.hostname}: ${saveError.message}`,
              );
            }
          } else {
            console.log(
              `Controller ${controller.name || controller.hostname} already has newer metadata (${existingMetadata.ts} >= ${metadata.ts})`,
            );
          }

          completed++;
          if (progressCallback) {
            progressCallback(completed, totalControllers);
          }
        }

        if (!this.abortSaveOperation) {
          // Update local appDataStore
          if (existingControllerIndex !== -1) {
            this.data.controllers[existingControllerIndex] = metadata;
            console.log("Updated existing controller metadata locally");
          } else {
            this.data.controllers.push(metadata);
            console.log("Added new controller metadata locally");
          }
        }

        console.log("Controller metadata save operation completed");
        return true;
      } catch (error) {
        console.error("Error saving controller metadata:", error);
        return false;
      }
    },

    /*************************************************************
     *
     * sync function
     *
     **************************************************************/

    // Utility function to normalize controller ID for sync lock timing
    normalizeControllerId(controllerId) {
      // Convert controller ID to a consistent format for timing calculations
      // ESP32 IDs are longer, ESP8266 IDs are shorter - normalize to 8 digits
      const idStr = String(controllerId);
      const hash = idStr.split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a; // Convert to 32-bit integer
      }, 0);
      return Math.abs(hash) % 100000000; // 8-digit normalized ID
    },

    // Get the current controller ID (this would be determined by the context)
    getCurrentControllerId() {
      // TODO: This should be determined by the application context
      // For now, we'll try to get it from the URL or configuration
      // This might need to be passed as a parameter or stored in the app state

      // Try to get from current URL or configuration
      const urlParams = new URLSearchParams(window.location.search);
      const controllerIdFromUrl = urlParams.get("controller_id");

      if (controllerIdFromUrl) {
        return controllerIdFromUrl;
      }

      // Fallback: try to determine from hostname or configuration
      // This is a placeholder - you'll need to implement the actual logic
      // based on how your application determines the current controller
      console.warn(
        "⚠️ Could not determine current controller ID, using fallback method",
      );

      // As a last resort, use the first available visible controller
      const controllers = useControllersStore();
      const firstController = controllers.data.find(
        (c) => c.id && c.ip_address && c.visible === true,
      );
      return firstController?.id || "unknown";
    },

    // Check if sync lock is available across all controllers
    async checkSyncLockAvailable(controllerId) {
      const controllers = useControllersStore();
      const reachableControllers = controllers.data.filter(
        (c) =>
          c.id !== null &&
          c.id !== undefined &&
          c.ip_address &&
          c.visible === true,
      );

      console.log(
        `🔐 Checking sync locks across ${reachableControllers.length} visible controllers for ${controllerId}`,
      );

      for (const controller of reachableControllers) {
        try {
          const response = await fetch(`http://${controller.ip_address}/data`, {
            method: "GET",
            timeout: 5000,
          });

          if (response.ok) {
            const data = await response.json();
            const syncLock = data["sync-lock"];

            if (syncLock && syncLock.id && syncLock.id !== controllerId) {
              // Check if the lock is recent (less than 5 minutes old)
              const lockAge = Date.now() - syncLock.ts;
              if (lockAge < 5 * 60 * 1000) {
                // 5 minutes
                console.log(
                  `🔒 Sync lock held by ${syncLock.id} on ${controller.hostname || controller["ip-address"]} (age: ${Math.round(lockAge / 1000)}s)`,
                );
                return false;
              } else {
                console.log(
                  `⏰ Stale sync lock from ${syncLock.id} detected on ${controller.hostname || controller["ip-address"]} (age: ${Math.round(lockAge / 1000)}s), considering available`,
                );
              }
            }
          }
        } catch (error) {
          console.warn(
            `⚠️ Could not check sync lock on ${controller.hostname || controller["ip-address"]}: ${error.message}`,
          );
          // Continue checking other controllers - unreachable controllers don't block sync
        }
      }

      console.log(`✅ Sync lock available for ${controllerId}`);
      return true;
    },

    // Acquire sync lock on all reachable controllers
    async acquireSyncLock(controllerId) {
      const controllers = useControllersStore();
      const reachableControllers = controllers.data.filter(
        (c) =>
          c.id !== null &&
          c.id !== undefined &&
          c.ip_address &&
          c.visible === true,
      );

      console.log(
        `🔐 Acquiring sync lock for ${controllerId} across ${reachableControllers.length} visible controllers`,
      );

      const acquiredLocks = [];

      try {
        for (const controller of reachableControllers) {
          try {
            // First, check if this controller already has a lock
            const checkResponse = await fetch(
              `http://${controller.ip_address}/data`,
              {
                method: "GET",
                timeout: 5000,
              },
            );

            if (checkResponse.ok) {
              const data = await checkResponse.json();
              const existingLock = data["sync-lock"];

              if (
                existingLock &&
                existingLock.id &&
                existingLock.id !== controllerId
              ) {
                // Check if the existing lock is still valid (not stale)
                const lockAge = Date.now() - existingLock.ts;
                if (lockAge < 5 * 60 * 1000) {
                  // 5 minutes
                  console.error(
                    `❌ Controller ${controller.hostname || controller["ip-address"]} already has active lock from ${existingLock.id} (age: ${Math.round(lockAge / 1000)}s)`,
                  );
                  // Roll back all acquired locks
                  await this.releaseSyncLock(controllerId, acquiredLocks);
                  return false;
                }
                console.log(
                  `⏰ Overriding stale lock from ${existingLock.id} on ${controller.hostname || controller.ip_address} (age: ${Math.round(lockAge / 1000)}s)`,
                );
              }
            }

            // Proceed to acquire the lock
            const lockData = {
              id: controllerId,
              ts: Date.now(),
            };

            const response = await fetch(
              `http://${controller.ip_address}/data`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  "sync-lock": lockData,
                }),
                timeout: 5000,
              },
            );

            if (response.ok) {
              // Verify that our lock was actually set by reading the current state
              const verifyResponse = await fetch(
                `http://${controller.ip_address}/data`,
                {
                  method: "GET",
                  timeout: 5000,
                },
              );

              if (verifyResponse.ok) {
                const currentData = await verifyResponse.json();
                const actualLock = currentData["sync-lock"];

                if (actualLock && actualLock.id === controllerId) {
                  console.log(
                    `🔒 Successfully acquired sync lock on ${controller.hostname || controller.ip_address}`,
                  );
                  acquiredLocks.push(controller);
                } else {
                  // The firmware didn't set our lock (another controller's lock is still there)
                  const existingControllerId = actualLock?.id || "no lock";
                  console.error(
                    `❌ Lock acquisition failed on ${controller.hostname || controller.ip_address}: found ${existingControllerId}`,
                  );
                  throw new Error(
                    `Lock not acquired, found: ${existingControllerId}`,
                  );
                }
              } else {
                throw new Error(
                  `Verification GET failed: HTTP ${verifyResponse.status}`,
                );
              }
            } else {
              throw new Error(`HTTP ${response.status}`);
            }
          } catch (error) {
            console.error(
              `❌ Failed to acquire sync lock on ${controller.hostname || controller["ip-address"]}: ${error.message}`,
            );
            // Roll back all acquired locks
            await this.releaseSyncLock(controllerId, acquiredLocks);
            return false;
          }
        }

        console.log(
          `✅ Successfully acquired sync lock on all ${acquiredLocks.length} controllers`,
        );
        return true;
      } catch (error) {
        console.error(
          `❌ Error during sync lock acquisition: ${error.message}`,
        );
        await this.releaseSyncLock(controllerId, acquiredLocks);
        return false;
      }
    },

    // Release sync lock on specified controllers (or all if not specified)
    async releaseSyncLock(controllerId, specificControllers = null) {
      const controllers = useControllersStore();
      const controllersToRelease =
        specificControllers ||
        controllers.data.filter(
          (c) =>
            c.id !== null &&
            c.id !== undefined &&
            c.ip_address &&
            c.visible === true,
        );

      console.log(
        `🔓 Releasing sync lock for ${controllerId} on ${controllersToRelease.length} visible controllers`,
      );

      for (const controller of controllersToRelease) {
        try {
          const response = await fetch(`http://${controller.ip_address}/data`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              "sync-lock": { id: "", ts: 0 },
            }),
            timeout: 5000,
          });

          if (response.ok) {
            console.log(
              `🔓 Released sync lock on ${controller.hostname || controller.ip_address}`,
            );
          } else {
            console.warn(
              `⚠️ Failed to release sync lock on ${controller.hostname || controller.ip_address}: HTTP ${response.status}`,
            );
          }
        } catch (error) {
          console.warn(
            `⚠️ Could not release sync lock on ${controller.hostname || controller.ip_address}: ${error.message}`,
          );
        }
      }
    },

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

      // Get the current controller's ID (from the active connection or configuration)
      const currentControllerId = this.getCurrentControllerId();
      if (!currentControllerId || currentControllerId === "unknown") {
        console.error(
          "❌ Cannot determine current controller ID for sync lock",
        );
        return false;
      }

      // Validate that we have visible controllers to sync with
      const reachableControllers = controllers.data.filter(
        (c) =>
          c.id !== null &&
          c.id !== undefined &&
          c.ip_address &&
          c.visible === true,
      );

      if (reachableControllers.length === 0) {
        console.error(
          "❌ No visible reachable controllers found - sync cannot proceed",
        );
        return false;
      }

      // Verify the current controller ID is valid
      const currentControllerExists = reachableControllers.some(
        (c) => c.id === currentControllerId,
      );
      if (!currentControllerExists) {
        console.error(
          `❌ Current controller ID '${currentControllerId}' not found in visible reachable controllers`,
        );
        return false;
      }

      console.log(
        `🔐 Starting sync process from controller ${currentControllerId} with ${reachableControllers.length} visible reachable controllers`,
      );

      // SYNC LOCK PHASE: Acquire distributed lock
      console.log("🔐 Phase 0: Acquiring distributed sync lock...");

      // Check if sync lock is available
      const lockAvailable =
        await this.checkSyncLockAvailable(currentControllerId);
      if (!lockAvailable) {
        console.log("🔒 Sync lock not available, waiting...");

        // Calculate wait time based on normalized controller ID to avoid thundering herd
        const normalizedId = this.normalizeControllerId(currentControllerId);
        const waitTime = 2000 + (normalizedId % 8000); // Wait 2-10 seconds based on ID

        console.log(
          `⏳ Waiting ${waitTime}ms before retry (based on controller ID ${normalizedId})`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));

        // Retry once more
        const retryLockAvailable =
          await this.checkSyncLockAvailable(currentControllerId);
        if (!retryLockAvailable) {
          console.log(
            "🔒 Sync lock still not available after retry, aborting sync",
          );
          return false;
        }
      }

      // Try to acquire the lock
      const lockAcquired = await this.acquireSyncLock(currentControllerId);
      if (!lockAcquired) {
        console.log("❌ Failed to acquire sync lock, aborting sync");
        return false;
      }

      // Set status to SYNCING to prevent duplicate syncs
      this.status = storeStatus.SYNCING;

      try {
        console.log(
          "🚀 Starting robust synchronization across all controllers...",
        );

        // PHASE 1: Collection - gather all data from all controllers
        const allData = {
          presets: [],
          scenes: [],
          groups: [],
          controllers: [],
        };

        // Keep track of which objects each controller has
        const controllerObjects = {};
        const unreachableControllers = [];

        console.log(
          `📡 Phase 1: Collecting data from ${reachableControllers.length} visible controllers...`,
        );

        // Fetch data from all visible controllers with robust error handling
        for (const controller of reachableControllers) {
          if (!controller.ip_address) {
            console.log(`⏭️ Skipping ${controller.hostname} - no IP address`);
            continue;
          }

          try {
            console.log(
              `📥 Fetching data from ${controller.hostname} (${controller.ip_address})`,
            );

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
                  "Cache-Control": "no-cache",
                },
              },
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
              console.warn(
                `❌ HTTP ${response.status} from ${controller.hostname}`,
              );
              unreachableControllers.push(controller);
              continue;
            }

            const data = await response.json();

            // CRITICAL DEBUG - This should always appear
            console.log(
              `CRITICAL DEBUG: Processing controller ${controller.hostname}`,
            );
            console.log(`CRITICAL DEBUG: data.scenes exists? ${!!data.scenes}`);
            console.log(
              `CRITICAL DEBUG: data.scenes.length = ${data.scenes?.length}`,
            );

            console.log(
              `✅ Got data from ${controller.hostname}: ${data.presets?.length || 0} presets, ${data.scenes?.length || 0} scenes, ${data.groups?.length || 0} groups | DEBUG: scenes array? ${Array.isArray(data.scenes)} | scenes[0]: ${data.scenes?.[0] ? "exists" : "missing"}`,
            );

            // Debug: Always log scenes data structure, even if empty
            console.log(
              `DEBUG ${controller.hostname}: data.scenes is array? ${Array.isArray(data.scenes)}, length: ${data.scenes?.length || "undefined"}`,
            );
            if (data.scenes && data.scenes.length > 0) {
              console.log(
                `DEBUG: First scene from ${controller.hostname}:`,
                data.scenes[0],
              );
            } else {
              console.log(
                `DEBUG: ${controller.hostname} has no scenes in data.scenes array`,
              );
            }

            // Track objects by controller for efficient updating
            controllerObjects[controller.id] = {
              presets: new Map(),
              scenes: new Map(),
              groups: new Map(),
              controllers: new Map(),
              invalidPresets: [],
              invalidScenes: [],
              invalidGroups: [],
              invalidControllers: [],
            };

            // Add all items to our collection arrays
            if (Array.isArray(data.presets)) {
              data.presets.forEach((preset) => {
                if (preset.id && preset.id !== "" && preset.ts) {
                  // Collect ALL versions - let Phase 2 handle timestamp-based deduplication
                  allData.presets.push(preset);
                  console.log(
                    `✅ Collected preset: ${preset.name} (ID: ${preset.id}, TS: ${preset.ts})`,
                  );
                  controllerObjects[controller.id].presets.set(
                    preset.id,
                    preset.ts,
                  );
                } else {
                  console.log(
                    `🗑️ Found preset with invalid ID: "${preset.name}" (ID: "${preset.id}", TS: ${preset.ts}) - will be deleted`,
                  );
                  // Track invalid presets for deletion - store the actual preset object
                  if (!controllerObjects[controller.id].invalidPresets) {
                    controllerObjects[controller.id].invalidPresets = [];
                  }
                  controllerObjects[controller.id].invalidPresets.push(preset);
                }
              });
            }

            if (Array.isArray(data.scenes)) {
              console.log(
                `🔍 Processing ${data.scenes.length} scenes from ${controller.hostname}`,
              );
              data.scenes.forEach((scene, index) => {
                if (index < 2) {
                  // Log first 2 scenes for debugging
                  console.log(`🔍 Scene ${index}:`, scene);
                  console.log(
                    `🔍 Scene ID check: ${!!scene.id}, TS check: ${!!scene.ts}`,
                  );
                }

                // Only process scenes with valid IDs for master list - but track ALL scenes for deletion detection
                if (scene.id && scene.id !== "" && scene.ts) {
                  // Collect ALL versions - let Phase 2 handle timestamp-based deduplication
                  allData.scenes.push(scene);
                  console.log(
                    `✅ Collected scene: ${scene.name} (ID: ${scene.id}, TS: ${scene.ts})`,
                  );
                  // Track this valid scene for comparison
                  controllerObjects[controller.id].scenes.set(
                    scene.id,
                    scene.ts,
                  );
                } else {
                  console.log(
                    `� Found scene with missing/invalid ID: "${scene.name}" (ID: "${scene.id}", TS: ${scene.ts}) - checking for consolidation`,
                  );

                  // Track invalid scenes for deletion - store the actual scene object
                  if (!controllerObjects[controller.id].invalidScenes) {
                    controllerObjects[controller.id].invalidScenes = [];
                  }
                  controllerObjects[controller.id].invalidScenes.push(scene);
                }
              });
            }

            if (Array.isArray(data.groups)) {
              data.groups.forEach((group) => {
                // Only process groups with valid IDs - groups without IDs should be deleted/ignored
                if (group.id && group.id !== "" && group.ts) {
                  // Collect ALL versions - let Phase 2 handle timestamp-based deduplication
                  allData.groups.push(group);
                  console.log(
                    `✅ Collected group: ${group.name} (ID: ${group.id}, TS: ${group.ts})`,
                  );
                  // Track this valid group for comparison
                  controllerObjects[controller.id].groups.set(
                    group.id,
                    group.ts,
                  );
                } else {
                  console.log(
                    `� Found group with missing/invalid ID: "${group.name}" (ID: "${group.id}", TS: ${group.ts}) - checking for consolidation`,
                  );

                  // Track invalid groups for deletion - store the actual group object
                  if (!controllerObjects[controller.id].invalidGroups) {
                    controllerObjects[controller.id].invalidGroups = [];
                  }
                  controllerObjects[controller.id].invalidGroups.push(group);
                }
              });
            }

            if (Array.isArray(data.controllers)) {
              data.controllers.forEach((controllerMetadata) => {
                // Only process controllers with valid hostnames
                if (
                  controllerMetadata.hostname &&
                  controllerMetadata.hostname !== "" &&
                  controllerMetadata.ts
                ) {
                  // Collect ALL versions - let Phase 2 handle timestamp-based deduplication
                  allData.controllers.push(controllerMetadata);
                  console.log(
                    `✅ Collected controller metadata: ${controllerMetadata.hostname} (TS: ${controllerMetadata.ts})`,
                  );
                  // Track this valid controller metadata for comparison
                  controllerObjects[controller.id].controllers.set(
                    controllerMetadata.hostname,
                    controllerMetadata.ts,
                  );
                } else {
                  console.log(
                    `� Found controller with missing/invalid hostname: "${controllerMetadata.hostname}" (TS: ${controllerMetadata.ts}) - checking for consolidation`,
                  );

                  // Track invalid controllers for deletion - store the actual controller object
                  if (!controllerObjects[controller.id].invalidControllers) {
                    controllerObjects[controller.id].invalidControllers = [];
                  }
                  controllerObjects[controller.id].invalidControllers.push(
                    controllerMetadata,
                  );
                }
              });
            }
          } catch (error) {
            // Handle different types of network errors more specifically
            if (error.name === "AbortError") {
              console.warn(
                `⏰ Timeout fetching from ${controller.hostname} (8s timeout exceeded)`,
              );
            } else if (
              error instanceof TypeError &&
              error.message.includes("NetworkError")
            ) {
              console.warn(
                `🔌 Network error with ${controller.hostname}: Controller may be offline`,
              );
            } else if (
              error instanceof TypeError &&
              error.message.includes("fetch")
            ) {
              console.warn(
                `📡 Fetch error with ${controller.hostname}: ${error.message}`,
              );
            } else {
              console.warn(
                `❌ Unexpected error fetching from ${controller.hostname}:`,
                error.message,
              );
            }
            unreachableControllers.push(controller);
            // Continue with next controller regardless of error type
            continue;
          }
        }

        console.log(
          `Collection complete: Found ${allData.presets.length} preset versions, ${allData.scenes.length} scene versions, ${allData.groups.length} group versions across all controllers`,
        );

        // Debug: Log allData.scenes contents
        console.log("Debug: allData.scenes content:", allData.scenes);
        if (unreachableControllers.length > 0) {
          console.warn(
            `⚠️ ${unreachableControllers.length} controllers were unreachable:`,
            unreachableControllers.map((c) => c.hostname),
          );
        }

        // PHASE 2: Find the most recent versions
        const latestItems = {
          presets: new Map(),
          scenes: new Map(),
          groups: new Map(),
          controllers: new Map(),
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

        // Process controllers
        for (const controllerMetadata of allData.controllers) {
          if (!controllerMetadata.hostname) continue;

          const existing = latestItems.controllers.get(
            controllerMetadata.hostname,
          );
          if (!existing || controllerMetadata.ts > existing.ts) {
            latestItems.controllers.set(
              controllerMetadata.hostname,
              controllerMetadata,
            );
          }
        }

        console.log(
          `Phase 2 complete: After timestamp-based deduplication: ${latestItems.presets.size} unique presets, ${latestItems.scenes.size} unique scenes, ${latestItems.groups.size} unique groups, ${latestItems.controllers.size} unique controllers`,
        );

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

        // Clean up scenes with NULL/invalid values
        const invalidScenesToDelete = [];
        console.log("🧹 Cleaning up scenes with NULL/invalid values...");

        // Debug: Log a sample scene to see its structure
        if (latestItems.scenes.size > 0) {
          const firstScene = latestItems.scenes.values().next().value;
          console.log("🔍 Sample scene structure:", firstScene);
        }

        for (const [sceneId, scene] of latestItems.scenes.entries()) {
          let isInvalid = false;
          const issues = [];

          // Scenes don't have a separate controller_id field - controller info is in the scene ID
          // The scene ID format appears to be "controllerId-sceneLocalId"
          // So we validate that the scene ID has the correct format instead
          if (
            !sceneId ||
            typeof sceneId !== "string" ||
            !sceneId.includes("-")
          ) {
            issues.push("invalid scene ID format");
            isInvalid = true;
          }

          // Check for NULL or invalid group_id - scenes without group_id are illegal
          if (scene.group_id === null || scene.group_id === undefined) {
            issues.push("NULL group_id");
            isInvalid = true;
          }

          // Check for NULL or invalid name
          if (
            !scene.name ||
            scene.name === null ||
            scene.name === undefined ||
            (typeof scene.name === "string" && scene.name.trim() === "")
          ) {
            issues.push("NULL/empty name");
            isInvalid = true;
          }

          if (isInvalid) {
            console.log(
              `🗑️ ILLEGAL SCENE: "${scene.name || "unnamed"}" (ID: ${sceneId}) has invalid values: ${issues.join(", ")} - PRUNING from all controllers`,
            );
            latestItems.scenes.delete(sceneId);
            invalidScenesToDelete.push(sceneId);
          }
        } // Add deletion tasks for invalid scenes to all controllers that have them
        if (invalidScenesToDelete.length > 0) {
          console.log(
            `🗑️ Found ${invalidScenesToDelete.length} ILLEGAL scenes to PRUNE from all controllers`,
          );

          for (const [controllerId, controllerData] of Object.entries(
            controllerObjects,
          )) {
            for (const sceneId of invalidScenesToDelete) {
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
                console.log(
                  `🗑️ PRUNING illegal scene ${sceneId} from controller ${controllerId}`,
                );
              }
            }
          }
        }

        // PHASE 3: Prepare updates for each controller
        console.log("🔧 Phase 3: Preparing updates for each controller...");

        for (const controller of controllers.data) {
          if (!controller.ip_address) {
            console.log(
              `⏭️ Skipping ${controller.hostname || controller.name || "unknown"} - no IP address`,
            );
            continue;
          }

          // Use the same ID format that was used during collection
          const controllerKey = String(controller.id);

          if (!controllerObjects[controllerKey]) {
            console.log(
              `⏭️ Skipping ${controller.hostname || controller.name || "unknown"} - no data collected (was unreachable)`,
            );
            continue;
          }

          console.log(
            `🔧 Preparing updates for ${controller.hostname || controller.name || controller.ip_address}`,
          );

          // Initialize the update object for this controller
          if (!updates[controllerKey]) {
            updates[controllerKey] = {
              presetsToAdd: [],
              presetsToUpdate: [],
              presetsToDelete: [], // Initialize this array
              scenesToAdd: [],
              scenesToUpdate: [],
              groupsToAdd: [],
              groupsToUpdate: [],
              scenesToDelete: [], // Initialize this array
              groupsToDelete: [], // Initialize this array
              controllersToAdd: [],
              controllersToUpdate: [],
              controllersToDelete: [],
            };
          }

          // Check each preset
          for (const [id, preset] of latestItems.presets.entries()) {
            const controllerTs =
              controllerObjects[controllerKey].presets.get(id);
            if (!controllerTs) {
              // Controller doesn't have this preset - add it
              updates[controllerKey].presetsToAdd.push(preset);
              console.log(
                `📝 Will ADD preset "${preset.name}" to ${controller.hostname}`,
              );
            } else if (controllerTs < preset.ts) {
              // Controller has older version - update it
              updates[controllerKey].presetsToUpdate.push(preset);
              console.log(
                `📝 Will UPDATE preset "${preset.name}" on ${controller.hostname}`,
              );
            }
          }

          // Check for extra presets on this controller that aren't in our master valid list
          for (const [presetId] of controllerObjects[
            controllerKey
          ].presets.entries()) {
            if (!latestItems.presets.has(presetId)) {
              // Controller has a preset that's not in our valid master list - delete it
              updates[controllerKey].presetsToDelete.push(presetId);
              console.log(
                `🗑️ Will DELETE extra preset (ID: ${presetId}) from ${controller.hostname} - not in master list`,
              );
            }
          }

          // Add invalid presets for deletion
          if (controllerObjects[controllerKey].invalidPresets?.length > 0) {
            for (const invalidPreset of controllerObjects[controllerKey]
              .invalidPresets) {
              // For invalid presets, we need to delete by a property that exists (like name or timestamp)
              // Since the preset ID is invalid, we'll need to use a different approach
              updates[controllerKey].presetsToDelete.push({
                type: "invalid",
                name: invalidPreset.name,
                ts: invalidPreset.ts,
              });
              console.log(
                `🗑️ Will DELETE invalid preset "${invalidPreset.name}" from ${controller.hostname} - has invalid ID`,
              );
            }
          }

          // Check each scene
          for (const [id, scene] of latestItems.scenes.entries()) {
            const controllerTs =
              controllerObjects[controllerKey].scenes.get(id);
            if (!controllerTs) {
              // Controller doesn't have this scene - add it
              updates[controllerKey].scenesToAdd.push(scene);
              console.log(
                `📝 Will ADD scene "${scene.name}" to ${controller.hostname}`,
              );
            } else if (controllerTs < scene.ts) {
              // Controller has older version - update it
              updates[controllerKey].scenesToUpdate.push(scene);
              console.log(
                `📝 Will UPDATE scene "${scene.name}" on ${controller.hostname}`,
              );
            }
          }

          // Check each group
          for (const [id, group] of latestItems.groups.entries()) {
            const controllerTs =
              controllerObjects[controllerKey].groups.get(id);
            if (!controllerTs) {
              // Controller doesn't have this group - add it
              updates[controllerKey].groupsToAdd.push(group);
              console.log(
                `📝 Will ADD group "${group.name}" to ${controller.hostname}`,
              );
            } else if (controllerTs < group.ts) {
              // Controller has older version - update it
              updates[controllerKey].groupsToUpdate.push(group);
              console.log(
                `📝 Will UPDATE group "${group.name}" on ${controller.hostname}`,
              );
            }
          }

          // Check each controller metadata
          for (const [
            hostname,
            controllerMetadata,
          ] of latestItems.controllers.entries()) {
            const controllerTs =
              controllerObjects[controllerKey].controllers.get(hostname);
            if (!controllerTs) {
              // Controller doesn't have this controller metadata - add it
              updates[controllerKey].controllersToAdd.push(controllerMetadata);
              console.log(
                `📝 Will ADD controller metadata "${controllerMetadata.hostname}" to ${controller.hostname}`,
              );
            } else if (controllerTs < controllerMetadata.ts) {
              // Controller has older version - update it
              updates[controllerKey].controllersToUpdate.push(
                controllerMetadata,
              );
              console.log(
                `📝 Will UPDATE controller metadata "${controllerMetadata.hostname}" on ${controller.hostname}`,
              );
            }
          }

          // Check for extra scenes on this controller that aren't in our master valid list
          for (const [sceneId] of controllerObjects[
            controllerKey
          ].scenes.entries()) {
            if (!latestItems.scenes.has(sceneId)) {
              // Controller has a scene that's not in our valid master list - delete it
              updates[controllerKey].scenesToDelete.push(sceneId);
              console.log(
                `🗑️ Will DELETE extra scene (ID: ${sceneId}) from ${controller.hostname} - not in master list`,
              );
            }
          }

          // Add invalid scenes for deletion
          if (controllerObjects[controllerKey].invalidScenes?.length > 0) {
            for (const invalidScene of controllerObjects[controllerKey]
              .invalidScenes) {
              // For invalid scenes, we need to delete by a property that exists (like name or timestamp)
              // Since the scene ID is invalid, we'll need to use a different approach
              updates[controllerKey].scenesToDelete.push({
                type: "invalid",
                name: invalidScene.name,
                ts: invalidScene.ts,
                group_id: invalidScene.group_id,
              });
              console.log(
                `🗑️ Will DELETE invalid scene "${invalidScene.name}" from ${controller.hostname} - has invalid ID`,
              );
            }
          }

          // Add invalid groups for deletion
          if (controllerObjects[controllerKey].invalidGroups?.length > 0) {
            for (const invalidGroup of controllerObjects[controllerKey]
              .invalidGroups) {
              if (!updates[controllerKey].groupsToDelete) {
                updates[controllerKey].groupsToDelete = [];
              }
              updates[controllerKey].groupsToDelete.push({
                type: "invalid",
                name: invalidGroup.name,
                ts: invalidGroup.ts,
              });
              console.log(
                `🗑️ Will DELETE invalid group "${invalidGroup.name}" from ${controller.hostname} - has invalid ID`,
              );
            }
          }

          // Check for extra groups on this controller that aren't in our master valid list
          for (const [groupId] of controllerObjects[
            controllerKey
          ].groups.entries()) {
            if (!latestItems.groups.has(groupId)) {
              // Controller has a group that's not in our valid master list - delete it
              if (!updates[controllerKey].groupsToDelete) {
                updates[controllerKey].groupsToDelete = [];
              }
              updates[controllerKey].groupsToDelete.push(groupId);
              console.log(
                `🗑️ Will DELETE extra group (ID: ${groupId}) from ${controller.hostname} - not in master list`,
              );
            }
          }

          const totalOpsForController =
            updates[controllerKey].presetsToAdd.length +
            updates[controllerKey].presetsToUpdate.length +
            (updates[controllerKey].presetsToDelete?.length || 0) +
            updates[controllerKey].scenesToAdd.length +
            updates[controllerKey].scenesToUpdate.length +
            updates[controllerKey].groupsToAdd.length +
            updates[controllerKey].groupsToUpdate.length +
            (updates[controllerKey].scenesToDelete?.length || 0) +
            (updates[controllerKey].groupsToDelete?.length || 0);

          console.log(
            `📊 Controller ${controller.hostname || controller.name}: ${totalOpsForController} operations planned`,
          );
        }

        // Log summary before Phase 4
        console.log("📋 Update Summary:");
        for (const [controllerKey, update] of Object.entries(updates)) {
          const controller = controllers.data.find(
            (c) => String(c.id) === controllerKey,
          );
          const name = controller?.hostname || controller?.name || "Unknown";
          const totalOps =
            update.presetsToAdd.length +
            update.presetsToUpdate.length +
            update.scenesToAdd.length +
            update.scenesToUpdate.length +
            update.groupsToAdd.length +
            update.groupsToUpdate.length +
            (update.presetsToDelete?.length || 0) +
            (update.scenesToDelete?.length || 0) +
            (update.groupsToDelete?.length || 0);
          console.log(
            `  ${name}: ${totalOps} total operations (+${update.presetsToAdd.length}/${update.presetsToUpdate.length} presets, +${update.scenesToAdd.length}/${update.scenesToUpdate.length} scenes, +${update.groupsToAdd.length}/${update.groupsToUpdate.length} groups, -${update.presetsToDelete?.length || 0} presets, -${update.scenesToDelete?.length || 0} scenes, -${update.groupsToDelete?.length || 0} groups)`,
          );
        }

        // PHASE 4: Execute updates with robust error handling
        console.log(
          "🚀 Phase 4: Executing updates across visible controllers...",
        );

        // Calculate total updates for progress
        const totalUpdates = Object.values(updates).reduce((sum, update) => {
          return (
            sum +
            update.presetsToAdd.length +
            update.presetsToUpdate.length +
            (update.presetsToDelete ? update.presetsToDelete.length : 0) +
            update.scenesToAdd.length +
            update.scenesToUpdate.length +
            (update.scenesToDelete ? update.scenesToDelete.length : 0) +
            update.groupsToAdd.length +
            update.groupsToUpdate.length +
            (update.groupsToDelete ? update.groupsToDelete.length : 0)
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

          const controllerName =
            controller?.hostname ||
            controller?.name ||
            controller?.ip_address ||
            "Unknown";
          console.log(
            `🔄 Synchronizing ${controllerName}... (${Object.keys(update).reduce((sum, key) => sum + (Array.isArray(update[key]) ? update[key].length : 0), 0)} operations)`,
          );

          // Helper function for robust HTTP requests with timeout
          const robustRequest = async (payload, operation) => {
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => {
              console.log(`⏰ Timeout for ${operation} on ${controllerName}`);
              abortController.abort();
            }, 8000); // 8 second timeout

            try {
              const response = await fetch(
                `http://${controller.ip_address}/data`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                  },
                  body: JSON.stringify(payload),
                  signal: abortController.signal,
                },
              );

              clearTimeout(timeoutId);

              if (!response.ok) {
                throw new Error(
                  `HTTP ${response.status}: ${await response.text()}`,
                );
              }

              return { success: true };
            } catch (error) {
              clearTimeout(timeoutId);
              if (error.name === "AbortError") {
                throw new Error(`Timeout after 8 seconds`);
              }
              throw error;
            }
          };

          // Batch add presets
          if (update.presetsToAdd.length > 0) {
            try {
              const payload = { "presets[]": update.presetsToAdd };
              await robustRequest(
                payload,
                `adding ${update.presetsToAdd.length} presets`,
              );
              console.log(
                `✅ Added ${update.presetsToAdd.length} presets to ${controllerName}`,
              );
              completedUpdates += update.presetsToAdd.length;
            } catch (error) {
              console.error(
                `❌ Failed to add presets to ${controllerName}:`,
                error.message,
              );
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
              console.log(
                `✅ Updated preset ${preset.name} on ${controllerName}`,
              );
              completedUpdates++;
            } catch (error) {
              console.error(
                `❌ Failed to update preset ${preset.name} on ${controllerName}:`,
                error.message,
              );
              failedOperations++;
              completedUpdates++; // Count as completed to avoid hanging
            }
            if (progressCallback) {
              progressCallback(completedUpdates, totalUpdates);
            }
          }

          // Delete orphaned presets
          if (update.presetsToDelete && update.presetsToDelete.length > 0) {
            for (const presetToDelete of update.presetsToDelete) {
              try {
                let payload;
                let description;

                if (
                  typeof presetToDelete === "object" &&
                  presetToDelete.type === "invalid"
                ) {
                  // For invalid presets without proper IDs, we need to use a different approach
                  // We'll need to get the current presets list and find the matching preset by properties
                  const presetsResponse = await robustRequest(
                    { presets: [] },
                    `getting presets from ${controller.name || controller.hostname} for invalid preset cleanup`,
                  );

                  if (presetsResponse?.presets) {
                    // Find the preset by name and timestamp to get its actual array index
                    const presetIndex = presetsResponse.presets.findIndex(
                      (preset) =>
                        preset.name === presetToDelete.name &&
                        preset.ts === presetToDelete.ts,
                    );

                    if (presetIndex !== -1) {
                      payload = { [`presets[${presetIndex}]`]: [] };
                      description = `deleting invalid preset "${presetToDelete.name}" at index ${presetIndex}`;
                    } else {
                      console.log(
                        `⚠️ Invalid preset "${presetToDelete.name}" not found on ${controller.name || controller.hostname}, may have been already deleted`,
                      );
                      completedUpdates++;
                      continue;
                    }
                  } else {
                    console.error(
                      `❌ Could not retrieve presets list from ${controller.name || controller.hostname} for invalid preset cleanup`,
                    );
                    failedOperations++;
                    completedUpdates++;
                    continue;
                  }
                } else {
                  // Regular preset deletion by ID
                  const presetId =
                    typeof presetToDelete === "object"
                      ? presetToDelete.id
                      : presetToDelete;
                  payload = { [`presets[id=${presetId}]`]: [] };
                  description = `deleting orphaned preset ${presetId}`;
                }

                if (payload) {
                  await robustRequest(payload, description);
                  console.log(
                    `✅ Deleted ${typeof presetToDelete === "object" && presetToDelete.type === "invalid" ? "invalid" : "orphaned"} preset from ${controller.name || controller.hostname}`,
                  );
                }
                completedUpdates++;
              } catch (error) {
                console.error(
                  `❌ Failed to delete preset from ${controller.name || controller.hostname}:`,
                  error.message,
                );
                failedOperations++;
                completedUpdates++; // Count as completed to avoid hanging
              }
              if (progressCallback) {
                progressCallback(completedUpdates, totalUpdates);
              }
            }
          }

          // Delete orphaned scenes
          if (update.scenesToDelete && update.scenesToDelete.length > 0) {
            for (const sceneToDelete of update.scenesToDelete) {
              try {
                let payload;
                let description;

                if (
                  typeof sceneToDelete === "object" &&
                  sceneToDelete.type === "invalid"
                ) {
                  // For invalid scenes without proper IDs, we need to use a different approach
                  // We'll need to get the current scenes list and find the matching scene by properties
                  const scenesResponse = await robustRequest(
                    { scenes: [] },
                    `getting scenes from ${controller.name || controller.hostname} for invalid scene cleanup`,
                  );

                  if (scenesResponse?.scenes) {
                    // Find the scene by name and timestamp to get its actual array index
                    const sceneIndex = scenesResponse.scenes.findIndex(
                      (scene) =>
                        scene.name === sceneToDelete.name &&
                        scene.ts === sceneToDelete.ts &&
                        scene.group_id === sceneToDelete.group_id,
                    );

                    if (sceneIndex !== -1) {
                      payload = { [`scenes[${sceneIndex}]`]: [] };
                      description = `deleting invalid scene "${sceneToDelete.name}" at index ${sceneIndex}`;
                    } else {
                      console.log(
                        `⚠️ Invalid scene "${sceneToDelete.name}" not found on ${controller.name || controller.hostname}, may have been already deleted`,
                      );
                      completedUpdates++;
                      continue;
                    }
                  } else {
                    console.error(
                      `❌ Could not retrieve scenes list from ${controller.name || controller.hostname} for invalid scene cleanup`,
                    );
                    failedOperations++;
                    completedUpdates++;
                    continue;
                  }
                } else {
                  // Regular scene deletion by ID
                  const sceneId =
                    typeof sceneToDelete === "object"
                      ? sceneToDelete.id
                      : sceneToDelete;
                  payload = { [`scenes[id=${sceneId}]`]: [] };
                  description = `deleting orphaned scene ${sceneId}`;
                }

                if (payload) {
                  await robustRequest(payload, description);
                  console.log(
                    `✅ Deleted ${typeof sceneToDelete === "object" && sceneToDelete.type === "invalid" ? "invalid" : "orphaned"} scene from ${controller.name || controller.hostname}`,
                  );
                }
                completedUpdates++;
              } catch (error) {
                console.error(
                  `❌ Failed to delete scene from ${controller.name || controller.hostname}:`,
                  error.message,
                );
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
              await robustRequest(
                payload,
                `adding ${update.scenesToAdd.length} scenes`,
              );
              console.log(
                `✅ Added ${update.scenesToAdd.length} scenes to ${controllerName}`,
              );
              completedUpdates += update.scenesToAdd.length;
            } catch (error) {
              console.error(
                `❌ Failed to add scenes to ${controllerName}:`,
                error.message,
              );
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
              console.log(
                `✅ Updated scene ${scene.name} on ${controllerName}`,
              );
              completedUpdates++;
            } catch (error) {
              console.error(
                `❌ Failed to update scene ${scene.name} on ${controllerName}:`,
                error.message,
              );
              failedOperations++;
              completedUpdates++; // Count as completed to avoid hanging
            }
            if (progressCallback) {
              progressCallback(completedUpdates, totalUpdates);
            }
          }

          // Delete orphaned groups
          if (update.groupsToDelete && update.groupsToDelete.length > 0) {
            for (const groupToDelete of update.groupsToDelete) {
              try {
                let payload;
                let description;

                if (
                  typeof groupToDelete === "object" &&
                  groupToDelete.type === "invalid"
                ) {
                  // For invalid groups without proper IDs, we need to use a different approach
                  // We'll need to get the current groups list and find the matching group by properties
                  const groupsResponse = await robustRequest(
                    { groups: [] },
                    `getting groups from ${controller.name || controller.hostname} for invalid group cleanup`,
                  );

                  if (groupsResponse?.groups) {
                    // Find the group by name and timestamp to get its actual array index
                    const groupIndex = groupsResponse.groups.findIndex(
                      (group) =>
                        group.name === groupToDelete.name &&
                        group.ts === groupToDelete.ts,
                    );

                    if (groupIndex !== -1) {
                      payload = { [`groups[${groupIndex}]`]: [] };
                      description = `deleting invalid group "${groupToDelete.name}" at index ${groupIndex}`;
                    } else {
                      console.log(
                        `⚠️ Invalid group "${groupToDelete.name}" not found on ${controller.name || controller.hostname}, may have been already deleted`,
                      );
                      completedUpdates++;
                      continue;
                    }
                  } else {
                    console.error(
                      `❌ Could not retrieve groups list from ${controller.name || controller.hostname} for invalid group cleanup`,
                    );
                    failedOperations++;
                    completedUpdates++;
                    continue;
                  }
                } else {
                  // Regular group deletion by ID
                  const groupId =
                    typeof groupToDelete === "object"
                      ? groupToDelete.id
                      : groupToDelete;
                  payload = { [`groups[id=${groupId}]`]: [] };
                  description = `deleting orphaned group ${groupId}`;
                }

                if (payload) {
                  await robustRequest(payload, description);
                  console.log(
                    `✅ Deleted ${typeof groupToDelete === "object" && groupToDelete.type === "invalid" ? "invalid" : "orphaned"} group from ${controller.name || controller.hostname}`,
                  );
                }
                completedUpdates++;
              } catch (error) {
                console.error(
                  `❌ Failed to delete group from ${controller.name || controller.hostname}:`,
                  error.message,
                );
                failedOperations++;
                completedUpdates++; // Count as completed to avoid hanging
              }
              if (progressCallback) {
                progressCallback(completedUpdates, totalUpdates);
              }
            }
          }

          // Batch add groups
          if (update.groupsToAdd.length > 0) {
            try {
              const payload = { "groups[]": update.groupsToAdd };
              await robustRequest(
                payload,
                `adding ${update.groupsToAdd.length} groups`,
              );
              console.log(
                `✅ Added ${update.groupsToAdd.length} groups to ${controllerName}`,
              );
              completedUpdates += update.groupsToAdd.length;
            } catch (error) {
              console.error(
                `❌ Failed to add groups to ${controllerName}:`,
                error.message,
              );
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
              console.log(
                `✅ Updated group ${group.name} on ${controllerName}`,
              );
              completedUpdates++;
            } catch (error) {
              console.error(
                `❌ Failed to update group ${group.name} on ${controllerName}:`,
                error.message,
              );
              failedOperations++;
              completedUpdates++; // Count as completed to avoid hanging
            }
            if (progressCallback) {
              progressCallback(completedUpdates, totalUpdates);
            }
          }
        }

        // PHASE 5: Update local state and complete synchronization
        console.log(
          "📝 Phase 5: Updating local state with synchronized data...",
        );

        // Update local state with the latest versions
        this.data.presets = Array.from(latestItems.presets.values());
        this.data.scenes = Array.from(latestItems.scenes.values());
        this.data.groups = Array.from(latestItems.groups.values());
        this.data.controllers = Array.from(latestItems.controllers.values());

        console.log("🎉 Synchronization completed successfully!");
        console.log(
          `📊 Final stats: ${completedUpdates} operations completed, ${failedOperations} operations failed`,
        );

        if (unreachableControllers.length > 0) {
          console.warn(
            `⚠️ Note: ${unreachableControllers.length} controllers were unreachable and may need manual synchronization`,
          );
        }

        this.status = storeStatus.SYNCED;

        // Release the sync lock
        await this.releaseSyncLock(currentControllerId);
        console.log(`🔓 Released sync lock for ${currentControllerId}`);

        return true;
      } catch (error) {
        console.error("❌ Critical error during synchronization:", error);
        this.status = storeStatus.ERROR;

        // Always release the sync lock on error
        await this.releaseSyncLock(currentControllerId);
        console.log(
          `🔓 Released sync lock for ${currentControllerId} after error`,
        );

        return false;
      }
    },
  },
});
