import { watch } from "vue";
import { defineStore } from "pinia";
import { useControllersStore } from "src/stores/controllersStore";
import { storeStatus } from "src/stores/storeConstants";
import {
  broadcastToControllers,
  getModifyPost,
  createAbortTimeout,
} from "src/services/tools";
import { makeID } from "src/services/tools";
import { apiService } from "src/services/api.js";
import { syncService } from "src/services/syncService.js";

const SYNC_LOCK_TIMEOUT_MS = 6000;
const SYNC_VERIFY_RETRIES = 3;

// NOTE: ConfigDB selector values must be unquoted, e.g. `collection[id=${x}]`.
// Quoted selectors (`id="${x}"`) are treated as literal quote characters by
// firmware parser and result in HTTP 400 BadSelector.
const SYNC_VERIFY_DELAY_MS = 150;
const MIN_REQUIRED_SYNC_LOCKS = 1;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(ms, 0)));

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = SYNC_LOCK_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const { signal, ...rest } = options;
  let abortHandler;

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      abortHandler = () => controller.abort();
      signal.addEventListener("abort", abortHandler);
    }
  }

  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (abortHandler && signal) {
      signal.removeEventListener("abort", abortHandler);
    }
    throw error;
  }
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
        const { jsonData } = await apiService.getData();

        if (!jsonData) {
          this.storeStatus = storeStatus.store.ERROR;
          return;
        }

        // Merge fetched data with local data based on timestamps instead of blindly overwriting
        // This preserves optimistic updates and prevents race conditions when switching controllers
        if (this.data && (this.data.presets || this.data.controllers)) {
          console.log("Merging fetched data with local data...");

          // Helper for timestamp comparison and merging
          const mergeItems = (localList, remoteList, type) => {
            if (!remoteList) return localList || [];
            if (!localList) return remoteList;

            const itemMap = new Map();

            // Add local items (with optimistic updates)
            for (const item of localList) {
              if (item.id) itemMap.set(item.id, item);
            }

            // Merge remote items only if they are newer
            for (const item of remoteList) {
              if (!item.id) continue;

              const localItem = itemMap.get(item.id);
              // Sanitizing remote item timestamp if it's 0 (invalid)
              if (!item.ts) item.ts = 0;

              if (!localItem) {
                // New item from remote
                itemMap.set(item.id, item);
              } else {
                // Determine which one is newer
                const localTs = localItem.ts || 0;
                const remoteTs = item.ts || 0;

                if (remoteTs > localTs) {
                  // Remote is newer, update local
                  itemMap.set(item.id, item);
                  console.log(
                    `Updated ${type} ${item.id} from remote (newer timestamp: ${remoteTs} > ${localTs})`,
                  );
                } else if (remoteTs < localTs) {
                  // Keep local (optimistic update or unsynced change)
                  console.log(
                    `Kept local ${type} ${item.id} (newer timestamp: ${localTs} > ${remoteTs})`,
                  );
                }
              }
            }

            return Array.from(itemMap.values());
          };

          // Merge collections
          this.data["last-color"] =
            jsonData["last-color"] || this.data["last-color"];
          this.data["sync-lock"] =
            jsonData["sync-lock"] || this.data["sync-lock"];

          this.data.presets = mergeItems(
            this.data.presets,
            jsonData.presets,
            "preset",
          );
          this.data.scenes = mergeItems(
            this.data.scenes,
            jsonData.scenes,
            "scene",
          );
          this.data.groups = mergeItems(
            this.data.groups,
            jsonData.groups,
            "group",
          );

          // Special handling for controllers: use hostname as key if id is missing or for deduplication
          // But strict merging usually uses IDs. Let's assume ID presence for consistency with other collections
          // However, controllers array structure might differ. Let's strictly merge by ID if present
          this.data.controllers = mergeItems(
            this.data.controllers,
            jsonData.controllers,
            "controller",
          );
        } else {
          // No local data yet, just use fetched data
          this.data = jsonData;
        }

        this.storeStatus = storeStatus.store.READY;

        console.log("Data fetch completed and merged");
      } catch (error) {
        console.error("Failed to fetch app data:", error);
        this.storeStatus = storeStatus.store.ERROR;
      }
    },

    watchForSync() {
      const controllers = useControllersStore();

      const maybeStartSync = () => {
        // Simple condition: store is ready and sync not completed or running
        if (
          controllers.storeStatus === storeStatus.store.READY &&
          this.storeStatus === storeStatus.store.READY &&
          this.syncStatus !== storeStatus.sync.COMPLETED &&
          this.syncStatus !== storeStatus.sync.RUNNING
        ) {
          console.log(
            "Controllers ready, starting one-time synchronization...",
          );
          this.synchronizeAllData((completed, total) => {
            console.log(`Sync progress: ${completed}/${total}`);
          });
        } else {
          console.log(
            `Sync check: controllers=${controllers.storeStatus}, app=${this.storeStatus}, sync=${this.syncStatus} - no sync needed`,
          );
        }
      };

      if (!this.syncWatchInitialized) {
        // Only watch for controllers becoming ready, not all status changes
        const stopControllersWatch = watch(
          () => controllers.storeStatus,
          (newStatus, oldStatus) => {
            if (
              newStatus === storeStatus.store.READY &&
              oldStatus !== storeStatus.store.READY
            ) {
              console.log("Controllers store became ready, checking sync...");
              maybeStartSync();
            }
          },
        );

        // Only watch for this store becoming ready, not all status changes
        const stopSelfWatch = watch(
          () => this.storeStatus,
          (newStatus, oldStatus) => {
            if (
              newStatus === storeStatus.store.READY &&
              oldStatus !== storeStatus.store.READY
            ) {
              console.log("AppData store became ready, checking sync...");
              maybeStartSync();
            }
          },
        );

        this._syncWatchStops = [stopControllersWatch, stopSelfWatch];
        this.syncWatchInitialized = true;
      }

      // Only trigger initial sync if both are ready and we haven't synced
      if (
        controllers.storeStatus === storeStatus.store.READY &&
        this.storeStatus === storeStatus.store.READY &&
        this.syncStatus !== storeStatus.sync.COMPLETED &&
        this.syncStatus !== storeStatus.sync.RUNNING
      ) {
        maybeStartSync();
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

      // Generate an ID if one doesn't exist
      if (!preset.id) {
        preset.id = makeID();
      }

      // Add or update timestamp
      // Use standard Unix timestamp (milliseconds)
      preset.ts = Date.now();

      const presetToSync = { ...preset };

      const existingPresetIndex = this.data.presets.findIndex(
        (p) => p.id === preset.id,
      );

      let payload;

      try {
        let completed = 0;
        // Presets are controller local, only save to current controller
        const targetControllers = controllers.currentController
          ? [controllers.currentController]
          : [];

        for (const controller of targetControllers) {
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
                progressCallback(completed, targetControllerss.length);
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

          if (
            !existingPreset ||
            existingPreset.ts < preset.ts ||
            existingPreset.ts > preset.ts + 60
          ) {
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
            progressCallback(completed, targetControllers.length);
          }
        }

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
        // Presets are controller local, only delete from current controller
        const targetControllers = controllers.currentController
          ? [controllers.currentController]
          : [];

        for (const controller of targetControllers) {
          if (!controller.ip_address) {
            completed++;
            if (progressCallback)
              progressCallback(completed, targetControllers.length);
            continue;
          }

          try {
            // Wrap each controller request in its own try/catch
            const abort = createAbortTimeout(5000, () => {
              console.warn(
                `Timeout deleting preset from ${controller.ip_address} (5s)`,
              );
            });
            const response = await fetch(
              `http://${controller.ip_address}/data`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: abort.signal,
              },
            );
            abort.clear();

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
            progressCallback(completed, targetControllers.length);
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
        const newFavorite = !this.data.presets[presetIndex].favorite;
        const payload = {
          [`presets[id=${preset.id}]`]: { favorite: newFavorite },
        };

        const response = await fetch(
          `http://${controllers.currentController["ip_address"]}/data`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        this.data.presets[presetIndex] = {
          ...this.data.presets[presetIndex],
          favorite: newFavorite,
        };
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
      // Use standard Unix timestamp (milliseconds)
      group.ts = Date.now();

      try {
        console.log(
          `🔄 Saving group '${group.name}' to ${controllers.data.length} controllers`,
        );

        // Broadcast save operation to all controllers
        const { successCount, failureCount } = await broadcastToControllers(
          controllers.data,
          async (controller) => {
            const controllerName =
              controller.hostname || controller.name || controller.ip_address;
            console.log(`📡 Processing controller ${controllerName}`);

            const result = await getModifyPost(
              controller.ip_address,
              (existingData) => {
                const existingGroup = existingData.groups?.find(
                  (g) => g.id === group.id,
                );

                // Skip if already up to date, unless the timestamp is unreasonably in the future (garbage/overflow)
                if (
                  existingGroup &&
                  existingGroup.ts >= group.ts &&
                  existingGroup.ts < group.ts + 60
                ) {
                  console.log(
                    `⏭️ Skipping ${controllerName} - already up to date`,
                  );
                  return null; // No changes needed
                }

                // Determine payload
                if (existingGroup) {
                  console.log(
                    `🔄 Updating existing group on ${controllerName}`,
                  );
                  return { [`groups[id=${group.id}]`]: group };
                } else {
                  console.log(`➕ Adding new group to ${controllerName}`);
                  return { "groups[]": [group] };
                }
              },
            );

            if (result.success) {
              console.log(
                `✅ Successfully updated controller ${controllerName}`,
              );
            }
          },
          progressCallback,
        );

        console.log(
          `📊 Group save completed: ${successCount} succeeded, ${failureCount} failed`,
        );

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
      const payload = { [`groups[id=${group.id}]`]: [] };

      try {
        console.log(
          `🗑️ Deleting group '${group.name}' from ${controllers.data.length} controllers`,
        );

        // Broadcast delete operation to all controllers
        const { successCount, failureCount } = await broadcastToControllers(
          controllers.data.filter((c) => c.ip_address), // Skip controllers without IP
          async (controller) => {
            const controllerName =
              controller.hostname || controller.name || controller.ip_address;
            console.log(`📡 Processing controller ${controllerName}`);

            const abort = createAbortTimeout(8000, () => {
              console.log(
                `⏰ Timeout reached for controller ${controllerName}`,
              );
            });

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
                  signal: abort.signal,
                },
              );

              if (!response.ok) {
                const errorText = await response.text();
                if (errorText.includes("BadSelector")) {
                  console.log(
                    `⚠️ Group not found on ${controllerName}, already deleted`,
                  );
                } else {
                  console.warn(`⚠️ Error from ${controllerName}: ${errorText}`);
                }
              } else {
                console.log(
                  `✅ Successfully deleted group from ${controllerName}`,
                );
              }
            } finally {
              abort.clear();
            }
          },
          progressCallback,
        );

        console.log(
          `📊 Group delete completed: ${successCount} succeeded, ${failureCount} failed`,
        );

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
      // Use standard Unix timestamp (milliseconds)
      scene.ts = Date.now();

      let saveErrors = [];
      let successCount = 0;

      try {
        console.log(
          `Saving scene '${scene.name}' to ${controllers.data.length} controllers`,
        );

        // Broadcast save operation to all controllers
        const result = await broadcastToControllers(
          controllers.data.filter((c) => c.ip_address), // Skip controllers without IP
          async (controller) => {
            const controllerName =
              controller.hostname || controller.name || controller.ip_address;

            const result = await getModifyPost(
              controller.ip_address,
              (existingData) => {
                const existingScene = existingData.scenes?.find(
                  (s) => s.id === scene.id,
                );

                // Skip if already up to date, unless the timestamp is unreasonably in the future (garbage/overflow)
                if (
                  existingScene &&
                  existingScene.ts >= scene.ts &&
                  existingScene.ts < scene.ts + 60
                ) {
                  console.log(
                    `Skipping ${controllerName} - already up to date`,
                  );
                  return null;
                }

                // Determine payload
                if (existingScene) {
                  console.log("Updating existing scene on", controllerName);
                  return { [`scenes[id=${scene.id}]`]: scene };
                } else {
                  console.log("Adding new scene to", controllerName);
                  return { "scenes[]": [scene] };
                }
              },
            );

            if (result.success) {
              console.log(`✅ Successfully saved scene to ${controllerName}`);
              successCount++;
            } else if (result.skipped) {
              successCount++;
            }
          },
          progressCallback,
        );

        saveErrors =
          result.failureCount > 0 ? [{ count: result.failureCount }] : [];

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
        console.log("Success count:", result.successCount);
        console.log("Error count:", result.failureCount);

        if (result.failureCount > 0) {
          console.warn(
            `Scene saved with ${result.failureCount} controller(s) unreachable`,
          );
        } else {
          console.log(
            `✅ Scene "${scene.name}" saved successfully to all ${result.successCount} controllers`,
          );
        }

        const resultObj = {
          success: true,
          successCount: result.successCount,
          errors: saveErrors,
          totalControllers: controllers.data.filter((c) => c.ip_address).length,
        };

        console.log("Scene save result:", JSON.stringify(resultObj, null, 2));
        return resultObj;
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
          totalControllers:
            controllers.data?.filter((c) => c.ip_address).length || 0,
        };
      } finally {
        // Refresh data like other functions do
        this.fetchData();
      }
    },

    async deleteScene(scene, progressCallback) {
      const controllers = useControllersStore();
      const payload = { [`scenes[id=${scene.id}]`]: [] };

      try {
        console.log(
          `Deleting scene '${scene.name}' from ${controllers.data.length} controllers`,
        );

        // Broadcast delete operation to all controllers
        const { successCount, failureCount } = await broadcastToControllers(
          controllers.data.filter((c) => c.ip_address), // Skip controllers without IP
          async (controller) => {
            const controllerName =
              controller.hostname || controller.name || controller.ip_address;

            const abort = createAbortTimeout(8000, () => {
              console.log(`Timeout reached for controller ${controllerName}`);
            });

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
                  signal: abort.signal,
                },
              );

              if (!response.ok) {
                const errorText = await response.text();
                if (errorText.includes("BadSelector")) {
                  console.log(
                    `Scene not found on ${controllerName}, already deleted`,
                  );
                } else {
                  console.warn(`Error from ${controllerName}: ${errorText}`);
                }
              } else {
                console.log(
                  `✅ Successfully deleted scene from ${controllerName}`,
                );
              }
            } finally {
              abort.clear();
            }
          },
          progressCallback,
        );

        console.log(
          `Scene delete completed: ${successCount} succeeded, ${failureCount} failed`,
        );

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
      // Use standard Unix timestamp (milliseconds)
      metadata.ts = Date.now();
      metadata.id = controllerId;

      console.log(
        "Saving controller metadata:",
        JSON.stringify(metadata, null, 2),
      );

      const existingControllerIndex = this.data.controllers.findIndex(
        (c) => c.id === controllerId,
      );

      // Optimistic Update: Update local store immediately for instant UI feedback
      // instead of waiting for the slow network sync loop to complete.
      if (existingControllerIndex !== -1) {
        this.data.controllers[existingControllerIndex] = metadata;
        console.log(
          "Updated existing controller metadata locally (Optimistic)",
        );
      } else {
        this.data.controllers.push(metadata);
        console.log("Added new controller metadata locally (Optimistic)");
      }

      try {
        let completed = 0;
        // Snapshot the list of controllers to ensure the process continues correctly
        // even if the user switches controllers (which updates controllers.data)
        const targetControllers = [...controllers.data];
        const totalControllers = targetControllers.length;

        console.log(
          `🔄 Saving controller metadata for '${metadata.name || metadata.hostname}' to ${totalControllers} controllers`,
        );

        for (const controller of targetControllers) {
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
            const readAbort = createAbortTimeout(5000, () => {
              console.warn(
                `Timeout reading metadata from ${controller.name || controller.hostname} (5s)`,
              );
            });
            const response = await fetch(
              `http://${controller.ip_address}/data`,
              {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                },
                signal: readAbort.signal,
              },
            );
            readAbort.clear();

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

          if (
            !existingMetadata ||
            existingMetadata.ts < metadata.ts ||
            existingMetadata.ts > metadata.ts + 60
          ) {
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
              const writeAbort = createAbortTimeout(5000, () => {
                console.warn(
                  `Timeout saving metadata to ${controller.name || controller.hostname} (5s)`,
                );
              });
              const response = await fetch(
                `http://${controller.ip_address}/data`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(payload),
                  signal: writeAbort.signal,
                },
              );
              writeAbort.clear();

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

            // checkSyncLockAvailable
            // Use standard Unix timestamp (milliseconds)
            const now = Date.now();
            const lockAge = now - timestamp;

            // Check if timestamp is in the future (garbage) allows overwriting
            // If timestamp is > now + 60s, it's considered invalid/garbage
            const isFutureGarbage = timestamp > now + 60000;

            if (lockAge < 300000 && !isFutureGarbage) {
              console.log(
                `🔒 Sync lock held by ${syncLock.id} on ${controllerName} (age: ${Math.round(lockAge / 1000)}s)`,
              );
              blockedByActiveLock = true;
              break;
            }

            console.log(
              `⏰ Stale sync lock from ${syncLock.id} detected on ${controllerName} (age: ${Math.round(lockAge)}s), considering available`,
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
                // acquireSyncLock
                // Use standard Unix timestamp (milliseconds)
                const now = Date.now();
                const lockAge = now - timestamp;

                // Check if timestamp is in the future (garbage) allows overwriting
                // If timestamp is > now + 60s, it's considered invalid/garbage
                const isFutureGarbage = timestamp > now + 60000;

                if (lockAge < 300000 && !isFutureGarbage) {
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
            `http://${controller.ip_address}/data`,
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

            // Convert both to strings for comparison to avoid type mismatch issues
            const expectedId = String(controllerId);
            const actualId = actualLock?.id ? String(actualLock.id) : null;

            if (actualId && actualId === expectedId) {
              console.log(
                `✅ Verified sync lock on ${controllerName} for ${controllerId}`,
              );
              return true;
            } else {
              lastError = new Error(
                `expected ${expectedId} (${typeof controllerId}), found ${actualId ?? "no lock"} (${typeof actualLock?.id})`,
              );
            }
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
      // Check if we're already syncing or have completed sync
      if (this.syncStatus === storeStatus.sync.RUNNING) {
        console.log("🔄 Synchronization already in progress, skipping");
        return false;
      }

      if (this.syncStatus === storeStatus.sync.COMPLETED) {
        console.log("✅ Synchronization already completed, skipping");
        return true;
      }

      console.log("🔄 Starting simplified synchronization...");
      this.syncStatus = storeStatus.sync.RUNNING;

      try {
        // Use the simplified sync service (no distributed locking to avoid HTTP 400 errors)
        const success = await syncService.synchronizeData(progressCallback);

        if (success) {
          console.log("✅ Sync completed successfully");
          this.syncStatus = storeStatus.sync.COMPLETED;
          // Refresh local data after sync
          await this.fetchData();
          return true;
        } else {
          console.error("❌ Sync failed");
          this.syncStatus = storeStatus.sync.FAILED;
          return false;
        }

        /* DEAD CODE
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

        // Helper to sanitize timestamps
        const now = Date.now();
        const sanitizeTs = (item, type) => {
          // If timestamp is in the future (with 1 hour buffer), assume it's invalid/garbage
          // and overwrite it with current timestamp to bring it back to valid range
          if (item.ts > now + 3600000) {
            console.log(
              `🔧 Fixing future timestamp for ${type} "${item.name || item.id || item.hostname}" (ID: ${item.id}): ${item.ts} -> ${now}`,
            );
            item.ts = now;
          }
        };

        // Process presets
        for (const preset of allData.presets) {
          if (!preset.id) continue;
          sanitizeTs(preset, "preset");

          const existing = latestItems.presets.get(preset.id);
          if (!existing || preset.ts > existing.ts) {
            latestItems.presets.set(preset.id, preset);
          }
        }

        // Process scenes
        for (const scene of allData.scenes) {
          if (!scene.id) continue;
          sanitizeTs(scene, "scene");

          const existing = latestItems.scenes.get(scene.id);
          if (!existing || scene.ts > existing.ts) {
            latestItems.scenes.set(scene.id, scene);
          }
        }

        // Process groups
        for (const group of allData.groups) {
          if (!group.id) continue;
          sanitizeTs(group, "group");

          const existing = latestItems.groups.get(group.id);
          if (!existing || group.ts > existing.ts) {
            latestItems.groups.set(group.id, group);
          }
        }

        // Process controllers
        for (const controllerMetadata of allData.controllers) {
          if (!controllerMetadata.hostname) continue;
          sanitizeTs(controllerMetadata, "controller");

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

        for (const controller of reachableControllers) {
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

              const data = await response.json();
              return data;
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

                  if (
                    scenesResponse?.scenes &&
                    Array.isArray(scenesResponse.scenes)
                  ) {
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
                    console.warn(
                      `⚠️ No scenes array returned from ${controller.name || controller.hostname}, skipping invalid scene cleanup (controller may not support this feature)`,
                    );
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

                  if (
                    groupsResponse?.groups &&
                    Array.isArray(groupsResponse.groups)
                  ) {
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
                    console.warn(
                      `⚠️ No groups array returned from ${controller.name || controller.hostname}, skipping invalid group cleanup (controller may not support this feature)`,
                    );
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
        */
      } catch (error) {
        console.error("❌ Critical error during synchronization:", error);
        this.syncStatus = storeStatus.sync.FAILED;
        return false;
      }
    },
  },
});
