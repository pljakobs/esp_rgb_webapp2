import { watch } from "vue";
import { defineStore } from "pinia";
import { useControllersStore } from "src/stores/controllersStore";
import { storeStatus } from "src/stores/storeConstants";
import { makeID } from "src/services/tools";
import { apiService } from "src/services/api.js";
import { syncService } from "src/services/syncService.js";

const SYNC_LOCK_TIMEOUT_MS = 6000;
const SYNC_VERIFY_RETRIES = 3;
const SYNC_VERIFY_DELAY_MS = 150;
const MIN_REQUIRED_SYNC_LOCKS = 1;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(ms, 0)));

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = SYNC_LOCK_TIMEOUT_MS,
) {
  // Use the centralized API's requestToController method
  const urlParts = url.match(/http:\/\/([^\/]+)\/(.+)/);
  if (!urlParts) {
    throw new Error(`Invalid URL format: ${url}`);
  }

  const ipAddress = urlParts[1];
  const endpoint = urlParts[2];

  const { jsonData, error, status } = await apiService.requestToController(
    endpoint,
    { ip_address: ipAddress },
    options,
  );

  if (error) {
    if (error.isTimeout) {
      const abortError = new Error("Request timeout");
      abortError.name = "AbortError";
      throw abortError;
    }
    throw error;
  }

  // Return a response-like object to maintain compatibility
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => jsonData,
    text: async () =>
      typeof jsonData === "string" ? jsonData : JSON.stringify(jsonData),
  };
}

export const useAppDataStore = defineStore("appData", {
  state: () => ({
    data: {
      "last-color": {},
      presets: [],
      scenes: [],
      groups: [],
      controllers: [], // Add controllers metadata
      "sync-lock": null, // Object with {id, ts} structure for distributed sync lock
    },
    storeStatus: storeStatus.store.IDLE,
    syncStatus: storeStatus.sync.NOT_STARTED,
    lastSyncTime: null, // Track when last sync completed
    syncInProgress: false, // Prevent immediate re-sync triggers
    error: null, // Add error property for compatibility with layout
    abortSaveOperation: false,
    syncWatchInitialized: false,
  }),

  getters: {
    // Legacy compatibility getter
    status: (state) => {
      // Map the new dual status system to old single status for backward compatibility
      if (state.storeStatus === storeStatus.store.LOADING) {
        return storeStatus.LOADING;
      }
      if (state.storeStatus === storeStatus.store.ERROR) {
        return storeStatus.ERROR;
      }
      if (state.storeStatus === storeStatus.store.READY) {
        if (state.syncStatus === storeStatus.sync.RUNNING) {
          return storeStatus.SYNCING;
        }
        if (state.syncStatus === storeStatus.sync.COMPLETED) {
          return storeStatus.SYNCED;
        }
        return storeStatus.READY;
      }
      return storeStatus.IDLE;
    },
  },

  actions: {
    async fetchData() {
      try {
        this.storeStatus = storeStatus.store.LOADING;
        this.error = null; // Clear previous errors
        const { jsonData } = await apiService.getData();

        if (!jsonData) {
          this.error = "No data received";
          this.storeStatus = storeStatus.store.ERROR;
          return;
        }
        this.data = jsonData;
        this.storeStatus = storeStatus.store.READY;
        // Don't automatically mark sync as completed on initial load
        // Let the sync process determine when synchronization is actually complete
        console.log("AppData store loaded, sync status remains:", this.syncStatus);

        console.log("lastColor data: ", this.data["last-color"]);
        console.log("presets data: ", this.data.presets);
        console.log("scenes data: ", this.data.scenes);
        console.log("groups data: ", this.data.groups);
        console.log("controllers data: ", this.data.controllers);
      } catch (error) {
        console.error("Failed to fetch app data:", error);
        this.error = error.message || "Failed to fetch app data";
        this.storeStatus = storeStatus.store.ERROR;
      }
    },

    watchForSync() {
      // Prevent duplicate initialization
      if (this.syncWatchInitialized) {
        console.log("⚠️ Sync watchers already initialized, skipping duplicate setup");
        return;
      }
      
      console.log("🔄 watchForSync() called - initializing sync watchers");
      const controllers = useControllersStore();

      const maybeStartSync = () => {
        console.log(`🔍 Sync check - Controllers: ${controllers.storeStatus}, App: ${this.storeStatus}, Sync: ${this.syncStatus}, InProgress: ${this.syncInProgress}`);
        
        // Prevent sync loops - don't sync if we just completed one
        if (this.syncInProgress) {
          console.log("⏸️ Sync in progress flag set - skipping to prevent loop");
          return;
        }
        
        // Sync should run whenever both stores are ready (unless already running)
        // This ensures we always get the latest data when UI opens
        if (
          controllers.storeStatus === storeStatus.store.READY &&
          this.storeStatus === storeStatus.store.READY &&
          this.syncStatus !== storeStatus.sync.RUNNING
        ) {
          console.log("✅ Starting synchronization to get latest data from all controllers...");
          this.syncInProgress = true; // Set flag to prevent immediate re-trigger
          
          this.synchronizeAllData((completed, total) => {
            console.log(`📊 Sync progress: ${completed}/${total}`);
          }).finally(() => {
            // Clear the flag after sync completes (success or failure)
            setTimeout(() => {
              this.syncInProgress = false;
              console.log("🔓 Sync lock released - future syncs allowed");
            }, 2000); // 2 second cooldown
          });
        } else {
          console.log(
            `❌ Sync conditions not met:`,
            `\n  - Controllers ready: ${controllers.storeStatus === storeStatus.store.READY}`,
            `\n  - App store ready: ${this.storeStatus === storeStatus.store.READY}`,
            `\n  - Sync not running: ${this.syncStatus !== storeStatus.sync.RUNNING}`
          );
        }
      };

      if (!this.syncWatchInitialized) {
        // Only watch for controllers becoming ready, not all status changes
        const stopControllersWatch = watch(
          () => controllers.storeStatus,
          (newStatus, oldStatus) => {
            console.log(`🎛️ Controllers store status changed: ${oldStatus} → ${newStatus}`);
            if (
              newStatus === storeStatus.store.READY &&
              oldStatus !== storeStatus.store.READY
            ) {
              console.log("🎛️ Controllers store became ready, checking sync...");
              maybeStartSync();
            }
          },
        );

        // Only watch for this store becoming ready, not all status changes
        const stopSelfWatch = watch(
          () => this.storeStatus,
          (newStatus, oldStatus) => {
            console.log(`📦 AppData store status changed: ${oldStatus} → ${newStatus}`);
            if (
              newStatus === storeStatus.store.READY &&
              oldStatus !== storeStatus.store.READY
            ) {
              console.log("📦 AppData store became ready, checking sync...");
              maybeStartSync();
            }
          },
        );

        this._syncWatchStops = [stopControllersWatch, stopSelfWatch];
        this.syncWatchInitialized = true;
        console.log("✅ Sync watchers initialized");
      }

      // Only trigger initial sync if both are ready and we haven't synced
      console.log("🔍 Initial sync check after watcher setup...");
      if (
        controllers.storeStatus === storeStatus.store.READY &&
        this.storeStatus === storeStatus.store.READY &&
        this.syncStatus !== storeStatus.sync.COMPLETED &&
        this.syncStatus !== storeStatus.sync.RUNNING
      ) {
        console.log("✅ Initial conditions met - triggering sync immediately");
        maybeStartSync();
      } else {
        console.log("❌ Initial sync conditions not met - will wait for status changes");
      }
    },

    /*************************************************************
     *
     * preset functions
     *
     **************************************************************/

    async savePreset(preset, progressCallback) {
      const controllers = useControllersStore();
      this.abortSaveOperation = false;

      // Validate preset before saving
      if (
        !preset.name ||
        typeof preset.name !== "string" ||
        preset.name.trim() === ""
      ) {
        console.error(
          "❌ Cannot save preset: name is required and cannot be empty",
        );
        return;
      }

      // Validate color data exists
      if (!preset.color || typeof preset.color !== "object") {
        console.error("❌ Cannot save preset: valid color data is required");
        return;
      }

      // Generate an ID if one doesn't exist
      if (!preset.id) {
        preset.id = makeID();
      }

      // Ensure ID is not 0 or "0"
      if (preset.id === 0 || preset.id === "0") {
        preset.id = makeID();
        console.warn(
          "⚠️ Preset had invalid ID (0), generated new ID:",
          preset.id,
        );
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

      // Validate group before saving
      if (
        !group.name ||
        typeof group.name !== "string" ||
        group.name.trim() === ""
      ) {
        console.error(
          "❌ Cannot save group: name is required and cannot be empty",
        );
        return;
      }

      // Validate controllers array exists
      if (!Array.isArray(group.controllers)) {
        console.error("❌ Cannot save group: controllers array is required");
        return;
      }

      // Ensure ID is valid
      if (!group.id || group.id === 0 || group.id === "0") {
        group.id = makeID();
        console.warn(
          "⚠️ Group had invalid/missing ID, generated new ID:",
          group.id,
        );
      }

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

      // Validate scene before saving
      if (
        !scene.name ||
        typeof scene.name !== "string" ||
        scene.name.trim() === ""
      ) {
        console.error(
          "❌ Cannot save scene: name is required and cannot be empty",
        );
        return {
          success: false,
          error: "Scene name is required and cannot be empty",
        };
      }

      // Validate controllers array exists
      if (!Array.isArray(scene.controllers)) {
        console.error("❌ Cannot save scene: controllers array is required");
        return { success: false, error: "Scene controllers array is required" };
      }

      // Ensure ID is valid
      if (!scene.id || scene.id === 0 || scene.id === "0") {
        scene.id = makeID();
        console.warn(
          "⚠️ Scene had invalid/missing ID, generated new ID:",
          scene.id,
        );
      }

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
      if (!controllerId || controllerId === 0 || controllerId === "0") {
        console.error(
          "❌ Invalid controller ID provided for metadata save:",
          controllerId,
        );
        return false;
      }

      // Validate metadata has required fields
      if (
        (!metadata.hostname || metadata.hostname.trim() === "") &&
        (!metadata.name || metadata.name.trim() === "")
      ) {
        console.error(
          "❌ Controller metadata must have either hostname or name",
        );
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
      const controllers = useControllersStore();

      // Use the current controller from the store
      if (controllers.currentController?.id) {
        return controllers.currentController.id;
      }

      // Fallback: try URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const controllerIdFromUrl = urlParams.get("controller_id");
      if (controllerIdFromUrl) {
        return controllerIdFromUrl;
      }

      // Last resort: use the first available visible controller
      const firstController = controllers.data.find(
        (c) => c.id && c.ip_address && c.visible === true,
      );

      if (firstController?.id) {
        console.log(`Using fallback controller ID: ${firstController.id}`);
        return firstController.id;
      }

      console.warn("⚠️ Could not determine current controller ID");
      return "unknown";
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

      let blockedByActiveLock = false;

      for (const controller of reachableControllers) {
        const controllerName = controller.hostname || controller.ip_address;
        try {
          const response = await fetchWithTimeout(
            `http://${controller.ip_address}/data`,
            {
              method: "GET",
              headers: {
                Accept: "application/json",
                "Cache-Control": "no-cache",
              },
            },
          );

          if (!response.ok) {
            console.warn(
              `⚠️ Failed to inspect sync lock on ${controllerName}: HTTP ${response.status}`,
            );
            continue;
          }

          const data = await response.json();
          const syncLock = data["sync-lock"];

          if (syncLock && syncLock.id && syncLock.id !== controllerId) {
            const timestamp = Number(syncLock.ts);
            if (!Number.isFinite(timestamp)) {
              console.log(
                `⏰ Sync lock on ${controllerName} has invalid timestamp, treating as stale`,
              );
              continue;
            }

            const lockAge = Date.now() - timestamp;
            if (lockAge < 5 * 60 * 1000) {
              console.log(
                `🔒 Sync lock held by ${syncLock.id} on ${controllerName} (age: ${Math.round(lockAge / 1000)}s)`,
              );
              blockedByActiveLock = true;
              break;
            }

            console.log(
              `⏰ Stale sync lock from ${syncLock.id} detected on ${controllerName} (age: ${Math.round(lockAge / 1000)}s), considering available`,
            );
          }
        } catch (error) {
          console.warn(
            `⚠️ Could not check sync lock on ${controllerName}: ${error.message}`,
          );
          // Continue checking other controllers - unreachable controllers don't block sync
        }
      }

      if (blockedByActiveLock) {
        return false;
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

      const sortedControllers = [...reachableControllers].sort((a, b) => {
        if (a.id === controllerId) {
          return -1;
        }
        if (b.id === controllerId) {
          return 1;
        }
        return 0;
      });

      const requiredLocks = Math.min(
        MIN_REQUIRED_SYNC_LOCKS,
        sortedControllers.length,
      );

      const acquiredLocks = [];
      const skippedControllers = [];

      try {
        for (const controller of sortedControllers) {
          const controllerName = controller.hostname || controller.ip_address;
          try {
            const checkResponse = await fetchWithTimeout(
              `http://${controller.ip_address}/data`,
              {
                method: "GET",
                headers: {
                  Accept: "application/json",
                  "Cache-Control": "no-cache",
                },
              },
            );

            if (!checkResponse.ok) {
              console.warn(
                `⚠️ Unable to inspect existing lock on ${controllerName}: HTTP ${checkResponse.status}`,
              );
              skippedControllers.push(controllerName);
              continue;
            }

            const data = await checkResponse.json();
            const existingLock = data["sync-lock"];

            if (
              existingLock &&
              existingLock.id &&
              existingLock.id !== controllerId
            ) {
              const timestamp = Number(existingLock.ts);
              if (Number.isFinite(timestamp)) {
                const lockAge = Date.now() - timestamp;
                if (lockAge < 5 * 60 * 1000) {
                  console.error(
                    `❌ Controller ${controllerName} already has active lock from ${existingLock.id} (age: ${Math.round(lockAge / 1000)}s)`,
                  );
                  await this.releaseSyncLock(controllerId, acquiredLocks);
                  return false;
                }
                console.log(
                  `⏰ Overriding stale lock from ${existingLock.id} on ${controllerName} (age: ${Math.round(lockAge / 1000)}s)`,
                );
              } else {
                console.log(
                  `⏰ Existing lock on ${controllerName} has invalid timestamp, overriding`,
                );
              }
            }

            const lockPayload = {
              "sync-lock": {
                id: controllerId,
                ts: Date.now(),
              },
            };

            const response = await fetchWithTimeout(
              `http://${controller.ip_address}/data`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(lockPayload),
              },
            );

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const verified = await this.verifySyncLock(
              controller,
              controllerId,
            );
            if (!verified) {
              throw new Error("Lock verification failed");
            }

            console.log(
              `🔒 Successfully acquired sync lock on ${controllerName}`,
            );
            acquiredLocks.push(controller);
          } catch (error) {
            console.error(
              `❌ Failed to acquire sync lock on ${controller.hostname || controller.ip_address}: ${error.message}`,
            );
            skippedControllers.push(controllerName);
            try {
              await this.releaseSyncLock(controllerId, [controller]);
            } catch (releaseError) {
              console.warn(
                `⚠️ Attempted to clear partial lock on ${controllerName} but failed: ${releaseError.message}`,
              );
            }
          }
        }

        if (acquiredLocks.length < requiredLocks) {
          console.error(
            `❌ Only acquired sync lock on ${acquiredLocks.length} controllers (minimum required ${requiredLocks})`,
          );
          await this.releaseSyncLock(controllerId, acquiredLocks);
          return false;
        }

        if (skippedControllers.length > 0) {
          console.warn(
            `⚠️ Skipped ${skippedControllers.length} controllers during lock acquisition: ${skippedControllers.join(", ")}`,
          );
        }

        console.log(
          `✅ Successfully acquired sync lock on ${acquiredLocks.length} controllers`,
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

    async verifySyncLock(controller, controllerId) {
      const controllerName = controller.hostname || controller.ip_address;
      let lastError = null;

      for (let attempt = 0; attempt < SYNC_VERIFY_RETRIES; attempt++) {
        try {
          const verifyResponse = await fetchWithTimeout(
            `http://${controller.ip_address}/data?cache_bust=${Date.now()}`,
            {
              method: "GET",
              headers: {
                Accept: "application/json",
                "Cache-Control": "no-cache",
              },
            },
          );

          if (!verifyResponse.ok) {
            lastError = new Error(`HTTP ${verifyResponse.status}`);
          } else {
            const currentData = await verifyResponse.json();
            const actualLock = currentData["sync-lock"];

            if (actualLock && actualLock.id === controllerId) {
              return true;
            }

            lastError = new Error(
              `expected ${controllerId}, found ${actualLock?.id ?? "no lock"}`,
            );
          }
        } catch (error) {
          lastError = error;
        }

        await sleep(SYNC_VERIFY_DELAY_MS * (attempt + 1));
      }

      console.error(
        `❌ Unable to verify sync lock on ${controllerName}: ${lastError?.message}`,
      );
      return false;
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

      const seenIps = new Set();
      const uniqueControllers = controllersToRelease.filter((controller) => {
        const key = controller.ip_address;
        if (!key || seenIps.has(key)) {
          return false;
        }
        seenIps.add(key);
        return true;
      });

      console.log(
        `🔓 Releasing sync lock for ${controllerId} on ${uniqueControllers.length} visible controllers`,
      );

      for (const controller of uniqueControllers) {
        const controllerName = controller.hostname || controller.ip_address;
        try {
          const response = await fetchWithTimeout(
            `http://${controller.ip_address}/data`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                "sync-lock": { id: "", ts: 0 },
              }),
            },
          );

          if (response.ok) {
            console.log(`🔓 Released sync lock on ${controllerName}`);
          } else {
            console.warn(
              `⚠️ Failed to release sync lock on ${controllerName}: HTTP ${response.status}`,
            );
          }
        } catch (error) {
          console.warn(
            `⚠️ Could not release sync lock on ${controllerName}: ${error.message}`,
          );
        }
      }
    },

    async synchronizeAllData(progressCallback) {
      // Only prevent sync if already running (not if completed)
      if (this.syncStatus === storeStatus.sync.RUNNING) {
        console.log("🔄 Synchronization already in progress, skipping");
        return false;
      }

      console.log("🔄 Starting synchronization to collect latest data from all controllers...");
      this.syncStatus = storeStatus.sync.RUNNING;

      try {
        // Use the simplified sync service (no distributed locking to avoid HTTP 400 errors)
        const success = await syncService.synchronizeData(progressCallback);

        if (success) {
          console.log("✅ Sync completed successfully");
          this.syncStatus = storeStatus.sync.COMPLETED;
          this.lastSyncTime = Date.now();
          // Don't refresh local data after sync to avoid triggering watch loop
          // The sync process already collected the latest data
          console.log("📦 Sync complete - skipping fetchData() to prevent watch loop");
          return true;
        } else {
          console.error("❌ Sync failed");
          this.syncStatus = storeStatus.sync.FAILED;
          return false;
        }
      } catch (error) {
        console.error("❌ Critical error during synchronization:", error);
        this.syncStatus = storeStatus.sync.FAILED;
        return false;
      }
    },

    // Manual sync trigger - useful for debugging or user-initiated sync
    async forceSynchronization(progressCallback) {
      console.log("🔄 Force synchronization requested");
      
      // Reset sync status to allow re-sync
      this.syncStatus = storeStatus.sync.NOT_STARTED;
      
      // Trigger sync
      return await this.synchronizeAllData(progressCallback);
    },
  },
});
