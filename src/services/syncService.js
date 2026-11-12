import { apiService } from "src/services/api.js";
import { useControllersStore } from "src/stores/controllersStore.js";

/**
 * Distributed Synchronization Service
 * Handles sync locks and data synchronization across multiple controllers
 */
export class SyncService {
  constructor() {
    this.SYNC_LOCK_TIMEOUT_MS = 6000;
    this.SYNC_VERIFY_RETRIES = 3;
    this.SYNC_VERIFY_DELAY_MS = 150;
    this.MIN_REQUIRED_SYNC_LOCKS = 1;
    this.isCurrentlySyncing = false; // Simple sync lock
  }

  /**
   * Get the current controller ID
   */
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

    // Fallback: use the first available visible controller
    const firstController = controllers.data.find(
      (c) => c.id && c.ip_address && c.visible === true,
    );

    if (firstController?.id) {
      console.log(`Using fallback controller ID: ${firstController.id}`);
      return firstController.id;
    }

    console.warn("⚠️ Could not determine current controller ID");
    return "unknown";
  }

  /**
   * Acquire distributed sync locks across all controllers
   * @param {Array} controllers - List of controllers to lock
   * @returns {Object} Result with success, locksAcquired, staleLocks, reason, shouldRetry
   */
  async acquireDistributedLocks(controllers) {
    const currentId = this.getCurrentControllerId();
    const now = Date.now(); // Unix timestamp in milliseconds
    const lockExpiryMs = this.SYNC_LOCK_TIMEOUT_MS;

    console.log(`🔒 Acquiring distributed locks for ${currentId}`);

    let locksAcquired = 0;
    let staleLocks = 0;

    // Phase 1: Check for existing locks
    for (const controller of controllers) {
      const { jsonData, error } = await apiService.getDataFromController(
        controller.ip_address,
        { timeout: 5000 },
      );

      if (error || !jsonData) {
        console.warn(`⚠️ Cannot check lock on ${controller.hostname}`);
        continue;
      }

      const existingLock = jsonData["sync-lock"] || { id: "", ts: 0 };
      const lockAge = now - existingLock.ts;

      // Check if there's a valid lock by another client
      if (
        existingLock.id &&
        existingLock.id !== currentId &&
        lockAge < lockExpiryMs
      ) {
        console.warn(
          `❌ Valid lock exists on ${controller.hostname} by ${existingLock.id}`,
        );
        return {
          success: false,
          locksAcquired: 0,
          reason: `Valid lock exists on ${controller.hostname} by ${existingLock.id}`,
          lockedBy: existingLock.id,
          shouldRetry: true,
        };
      }

      if (existingLock.id && lockAge >= lockExpiryMs) {
        staleLocks++;
        console.log(
          `🔓 Stale lock on ${controller.hostname} (${Math.round(lockAge / 1000)}s old)`,
        );
      }
    }

    // Phase 2: Acquire locks on all controllers
    for (const controller of controllers) {
      const lockData = {
        "sync-lock": { id: currentId, ts: now },
      };

      const { error } = await apiService.updateDataOnController(
        controller.ip_address,
        lockData,
        { timeout: 5000 },
      );

      if (error) {
        console.error(`❌ Failed to acquire lock on ${controller.hostname}`);
        // Release locks we already acquired
        await this.releaseDistributedLocks(
          controllers.slice(0, locksAcquired),
          currentId,
        );
        return {
          success: false,
          locksAcquired,
          reason: `Failed to acquire lock on ${controller.hostname}`,
          shouldRetry: true,
        };
      }

      locksAcquired++;
    }

    console.log(
      `✅ Acquired ${locksAcquired} locks${staleLocks > 0 ? ` (${staleLocks} stale)` : ""}`,
    );
    return {
      success: true,
      locksAcquired,
      staleLocks,
    };
  }

  /**
   * Verify that distributed locks are still held
   * @param {Array} controllers - Controllers to verify
   * @param {string} expectedLockId - Expected lock holder ID
   * @returns {Object} Result with success, reason, shouldRetry
   */
  async verifyDistributedLocks(controllers, expectedLockId) {
    console.log(`🔍 Verifying distributed locks for ${expectedLockId}`);

    for (const controller of controllers) {
      const { jsonData, error } = await apiService.getDataFromController(
        controller.ip_address,
        { timeout: 5000 },
      );

      if (error || !jsonData) {
        console.warn(`⚠️ Cannot verify lock on ${controller.hostname}`);
        return {
          success: false,
          reason: `Cannot verify lock on ${controller.hostname}`,
          shouldRetry: true,
        };
      }

      const lock = jsonData["sync-lock"] || { id: "", ts: 0 };

      if (lock.id !== expectedLockId) {
        console.error(
          `❌ Lock verification failed on ${controller.hostname}: expected ${expectedLockId}, got ${lock.id}`,
        );
        return {
          success: false,
          reason: `Verification failed on ${controller.hostname}: lock held by ${lock.id}`,
          shouldRetry: true,
        };
      }
    }

    console.log(`✅ All locks verified for ${expectedLockId}`);
    return { success: true };
  }

  /**
   * Release distributed locks
   * @param {Array} controllers - Controllers to release locks from
   * @param {string} lockId - Lock holder ID to release
   */
  async releaseDistributedLocks(controllers, lockId) {
    console.log(`🔓 Releasing distributed locks for ${lockId}`);

    const maxReleaseRetries = 2;

    for (const controller of controllers) {
      const lockData = {
        "sync-lock": { id: "", ts: 0 },
      };

      let released = false;
      for (let attempt = 0; attempt <= maxReleaseRetries; attempt++) {
        const { error } = await apiService.updateDataOnController(
          controller.ip_address,
          lockData,
          { timeout: 5000 },
        );
        if (!error) {
          released = true;
          break;
        }
        if (attempt < maxReleaseRetries) {
          console.warn(
            `⚠️ Failed to release lock on ${controller.hostname}, retrying (${attempt + 1}/${maxReleaseRetries})...`,
            error,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (!released) {
        console.error(
          `❌ Could not release lock on ${controller.hostname} after ${maxReleaseRetries + 1} attempts. ` +
            `The lock will expire automatically after the stale timeout.`,
        );
      }
    }
  }

  /**
   * Collect consolidated view of all presets, scenes, and groups from all controllers
   * - Fetches list of hosts from /hosts endpoint
   * - Collects /data from each host
   * - Removes duplicates (same ID)
   * - Filters out illegal objects (empty name, id=0, missing required fields)
   * - Returns consolidated view without modifying controllers
   */
  async getConsolidatedView(progressCallback) {
    // Check if already syncing
    if (this.isCurrentlySyncing) {
      console.log(
        "🔄 Collection already in progress, skipping duplicate request",
      );
      return null;
    }

    this.isCurrentlySyncing = true;

    try {
      return await this._collectConsolidatedView(progressCallback);
    } finally {
      this.isCurrentlySyncing = false;
    }
  }

  async _collectConsolidatedView(progressCallback) {
    try {
      // Fetch the list of all hosts from the /hosts endpoint
      console.log("📋 Fetching list of hosts from /hosts endpoint");
      const { jsonData: hostsResponse, error: hostsError } =
        await apiService.getHosts(true);

      if (
        hostsError ||
        !hostsResponse ||
        !hostsResponse.hosts ||
        !Array.isArray(hostsResponse.hosts)
      ) {
        console.error("❌ Failed to fetch hosts list:", hostsError);
        return null;
      }

      const hostsData = hostsResponse.hosts;

      // Get current controller ID to ensure it's always included
      const currentControllerId = await this.getCurrentControllerId();

      // Read every potential write target before deciding between updates and inserts.
      const pushTargets = hostsData
        .filter(
          (h) =>
            h.id &&
            h.ip_address &&
            (h.visible === true || h.id === currentControllerId),
        )
        .map((h) => ({
          id: h.id,
          hostname: h.hostname || h.id,
          ip_address: h.ip_address,
        }));
      const reachableControllers = pushTargets;

      if (reachableControllers.length === 0) {
        console.error("❌ No reachable controllers found");
        return null;
      }

      console.log(
        `🔄 Collecting data from ${reachableControllers.length} controllers`,
      );

      // Collect all data from all controllers
      const allData = {
        presets: [],
        scenes: [],
        groups: [],
        controllers: [],
      };

      // Track which IDs already exist on each controller so the push phase
      // can update existing items with [id=X] and only append truly new ones.
      const controllerDataMap = new Map();

      let completed = 0;
      const total = reachableControllers.length;
      // Delay between requests to avoid overwhelming controllers (rate limiting)
      const DELAY_BETWEEN_REQUESTS = 800; // 800ms delay to prevent 429 errors

      for (const controller of reachableControllers) {
        try {
          console.log(
            `📥 Fetching from ${controller.hostname} (${completed + 1}/${total})`,
          );

          const { jsonData, error } = await apiService.getDataFromController(
            controller.ip_address,
            { timeout: 8000 },
          );

          if (error) {
            if (error.isTimeout) {
              console.warn(`⏰ Timeout fetching from ${controller.hostname}`);
            } else {
              console.warn(
                `⚠️ Failed to fetch from ${controller.hostname}: ${error.message || error}`,
              );
            }
          } else if (
            Array.isArray(jsonData?.scenes) &&
            Array.isArray(jsonData?.groups)
          ) {
            this.collectDataFromController(jsonData, allData);
            // Record which IDs this controller already has so we can route
            // updates vs. inserts precisely during the push phase.
            controllerDataMap.set(controller.id, {
              sceneIds: new Set(
                (jsonData.scenes || [])
                  .filter((s) => s.id)
                  .map((s) => String(s.id)),
              ),
              groupIds: new Set(
                (jsonData.groups || [])
                  .filter((g) => g.id)
                  .map((g) => String(g.id)),
              ),
              scenes: jsonData.scenes || [],
              groups: jsonData.groups || [],
            });
          } else {
            console.warn(`Missing scene/group arrays in data from ${controller.hostname}`);
          }

          completed++;
          if (progressCallback) {
            progressCallback(completed, total);
          }

          // Add delay between requests
          if (completed < total) {
            await this.sleep(DELAY_BETWEEN_REQUESTS);
          }
        } catch (error) {
          console.error(
            `❌ Error fetching from ${controller.hostname}:`,
            error,
          );
          completed++;
          if (progressCallback) {
            progressCallback(completed, total);
          }
        }
      }

      // Build consolidated view: deduplicate and filter illegal items
      const consolidated = this.buildConsolidatedView(allData);

      console.log(
        `📊 Consolidated view: ${consolidated.presets.length} presets, ${consolidated.scenes.length} scenes, ${consolidated.groups.length} groups`,
      );

      // Include snapshots so the write phase can skip unchanged objects.
      return {
        data: consolidated,
        controllers: reachableControllers,
        pushTargets: pushTargets,
        controllerDataMap,
      };
    } catch (error) {
      console.error("❌ Error during data collection:", error);
      return null;
    }
  }

  /**
   * Build consolidated view by removing duplicates and filtering illegal items
   * @param {Object} allData - Raw data collected from all controllers
   * @returns {Object} Consolidated and cleaned data
   */
  buildConsolidatedView(allData) {
    const consolidated = {
      presets: [], // Presets are controller-local
      scenes: [],
      groups: [],
      controllers: [],
    };

    // Deduplicate presets - SKIPPED (Local only)
    /*
    const presetMap = new Map();
    allData.presets.forEach((preset) => {
      if (this.isValidItem(preset, "preset")) {
        const existing = presetMap.get(preset.id);
        // Keep the one with the latest timestamp
        if (!existing || preset.ts > existing.ts) {
          presetMap.set(preset.id, preset);
        }
      }
    });
    consolidated.presets = Array.from(presetMap.values());
    */

    // Deduplicate and merge scenes
    const sceneMap = new Map();
    allData.scenes.forEach((scene) => {
      if (!this.isValidItem(scene, "scene")) {
        return;
      }

      const normalizedScene = this.normalizeSceneForSync(scene);
      const existing = sceneMap.get(normalizedScene.id);

      if (!existing) {
        // First occurrence of this scene
        sceneMap.set(normalizedScene.id, { ...normalizedScene });
      } else {
        // Merge with existing scene
        const merged = this.mergeScenes(existing, normalizedScene);
        sceneMap.set(normalizedScene.id, merged);
      }
    });
    consolidated.scenes = Array.from(sceneMap.values());

    // Deduplicate groups
    const groupMap = new Map();
    allData.groups.forEach((group) => {
      if (!this.isValidItem(group, "group")) {
        return;
      }

      const normalizedGroup = this.normalizeGroupForSync(group);
      const existing = groupMap.get(normalizedGroup.id);
      if (!existing || normalizedGroup.ts > existing.ts) {
        groupMap.set(normalizedGroup.id, normalizedGroup);
      }
    });
    consolidated.groups = Array.from(groupMap.values());

    // Deduplicate controllers
    const controllerMap = new Map();
    allData.controllers.forEach((controller) => {
      if (controller.hostname && controller.hostname !== "") {
        const existing = controllerMap.get(controller.hostname);
        if (!existing || controller.ts > existing.ts) {
          controllerMap.set(controller.hostname, controller);
        }
      }
    });
    consolidated.controllers = Array.from(controllerMap.values());

    return consolidated;
  }

  /**
   * Merge two scenes with the same ID
   * Select the newest complete revision; merging steps resurrects removals.
   * @param {Object} existing - Existing scene in map
   * @param {Object} newScene - New scene to merge
   * @returns {Object} Merged scene
   */
  mergeScenes(existing, newScene) {
    return { ...(newScene.ts > existing.ts ? newScene : existing) };
  }

  normalizeSceneForSync(scene) {
    const normalized = { ...scene };

    if (normalized.transition && typeof normalized.transition === "object") {
      normalized.transition = this.normalizeTransitionForSync(
        normalized.transition,
      );
    }

    if (Array.isArray(normalized.settings)) {
      normalized.settings = normalized.settings.map((setting) => {
        if (!setting || typeof setting !== "object") {
          return setting;
        }

        const normalizedSetting = { ...setting };
        if (normalizedSetting.light === -1) delete normalizedSetting.light;
        if (
          normalizedSetting.light_id === null ||
          normalizedSetting.light_id === ""
        ) {
          delete normalizedSetting.light_id;
        }
        if (
          normalizedSetting.transition &&
          typeof normalizedSetting.transition === "object"
        ) {
          normalizedSetting.transition = this.normalizeTransitionForSync(
            normalizedSetting.transition,
          );
        }

        if (
          normalizedSetting.color &&
          typeof normalizedSetting.color === "object"
        ) {
          normalizedSetting.color = this.normalizeColorForSync(
            normalizedSetting.color,
          );
        }

        return normalizedSetting;
      });
    }

    return normalized;
  }

  normalizeGroupForSync(group) {
    const normalized = { ...group };
    if (!Array.isArray(normalized.controller_ids)) {
      normalized.controller_ids = [];
    }
    return normalized;
  }

  normalizeColorForSync(color) {
    if (typeof color.id === "string" && !color.Preset) {
      const { id, ...properties } = color;
      return { ...properties, Preset: { id } };
    }
    return color;
  }

  normalizeTransitionForSync(transition) {
    const normalized = { ...transition };
    if (normalized.cmd === null || normalized.cmd === undefined) {
      normalized.cmd = "";
    }
    if (normalized.q === null || normalized.q === undefined) {
      normalized.q = "";
    }
    return normalized;
  }

  /**
   * Check if an item is valid (not illegal)
   * @param {Object} item - Item to validate
   * @param {string} type - Type of item (preset, scene, group)
   * @returns {boolean} True if valid
   */
  isValidItem(item, type) {
    // Must have an ID that's not 0 or empty
    if (!item.id || item.id === 0 || item.id === "0" || item.id === "") {
      console.debug(`Filtering out ${type} with invalid id:`, item.id);
      return false;
    }

    // Must have a name that's not empty
    if (!item.name || item.name === "") {
      console.debug(`Filtering out ${type} with empty name, id:`, item.id);
      return false;
    }

    // Must have a timestamp
    if (!item.ts || item.ts === 0) {
      console.debug(`Filtering out ${type} without timestamp, id:`, item.id);
      return false;
    }

    return true;
  }

  /**
   * Helper method to collect data from a controller response
   * @param {Object} jsonData - Controller response data
   * @param {Object} allData - Accumulated data object
   */
  collectDataFromController(jsonData, allData) {
    // Collect valid data
    // Presets are controller-local, so we don't collect them for sync
    /*
    if (Array.isArray(jsonData.presets)) {
      jsonData.presets.forEach((preset) => {
        if (preset.id && preset.ts) {
          allData.presets.push(preset);
        }
      });
    }
    */

    if (Array.isArray(jsonData.scenes)) {
      jsonData.scenes.forEach((scene) => {
        if (scene.id && scene.ts) {
          allData.scenes.push(scene);
        }
      });
    }

    if (Array.isArray(jsonData.groups)) {
      jsonData.groups.forEach((group) => {
        if (group.id && group.ts) {
          allData.groups.push(group);
        }
      });
    }

    if (Array.isArray(jsonData.controllers)) {
      jsonData.controllers.forEach((ctrl) => {
        if (ctrl.hostname && ctrl.ts) {
          allData.controllers.push(ctrl);
        }
      });
    }
  }

  /**
   * Calculate changes needed for a specific controller
   * Compares controller's current data against consolidated truth
   * @param {Object} controllerData - Current data from the controller
   * @param {Object} consolidated - Consolidated truth (newest valid versions)
   * @returns {Object} Changes needed: { presets, scenes, groups } with full valid items
   */
  calculateChangesForController(controllerData, consolidated) {
    // For now, we send the complete consolidated list to every controller
    // The controller firmware will handle:
    // - Creating missing items
    // - Updating items with older timestamps
    // - Removing duplicates (same ID) by keeping newest
    // - Removing invalid items (nil name/id)

    // Future optimization: calculate actual diffs and send only changes

    // TODO: Stale-delete problem
    // When a scene or group is deleted (via deleteScene / deleteGroup), the
    // delete is broadcast to all currently-reachable controllers.  If one or
    // more controllers are offline at that moment, they rejoin the swarm later
    // still carrying the deleted item.  The current sync strategy is purely
    // additive (newest-timestamp wins for updates, new items are appended), so
    // the deleted item resurfaces and is pushed back to all controllers.
    //
    // Possible solution:
    // Introduce a category-level timestamp (e.g. `scenes_ts`, `groups_ts`) that
    // is bumped on every write *including deletes*.  During collection each
    // controller reports its category timestamps; a controller whose
    // `scenes_ts` is older than the authoritative value is known to be behind
    // and must accept the authoritative list wholesale (clear + replace) rather
    // than a merge.  This lets the sync distinguish "controller has extra items
    // because it hasn't received the delete" from "controller has extra items
    // because it created them locally while offline".
    //
    // The authoritative category timestamp can be stored in the cfgdb root
    // object, e.g.  { scenes_ts: <unix-ms>, groups_ts: <unix-ms> }, and
    // written by the firmware whenever an array is modified.  The webapp would
    // need to read and compare these during getConsolidatedView and adjust the
    // push strategy accordingly.
    return {
      presets: consolidated.presets,
      scenes: consolidated.scenes,
      groups: consolidated.groups,
    };
  }

  /**
   * Synchronize consolidated data across all controllers
   * 1. Collects consolidated view (deduplicated, validated)
   * 2. Pushes consolidated data to all controllers
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<boolean>} True if sync successful
   */
  async synchronizeData(progressCallback) {
    if (this.isCurrentlySyncing) {
      console.warn("Synchronization already in progress");
      return false;
    }
    this.isCurrentlySyncing = true;
    try {
      return await this._synchronizeCollectedData(progressCallback);
    } finally {
      this.isCurrentlySyncing = false;
    }
  }

  async _synchronizeCollectedData(progressCallback) {
    console.log("🔄 Starting synchronization");

    // Phase 1: Get consolidated view (includes controller list)
    const result = await this._collectConsolidatedView(progressCallback);
    if (!result) {
      console.error("❌ Failed to get consolidated view");
      return false;
    }

    const {
      data: consolidated,
      pushTargets,
      controllerDataMap,
    } = result;

    // Phase 2: Push consolidated data to all controllers (including current invisible controller)
    console.log(
      `📤 Pushing consolidated data to ${pushTargets.length} controllers`,
    );

    let successCount = 0;
    let failureCount = 0;

    for (const controller of pushTargets) {
      try {
        const known = controllerDataMap.get(controller.id);
        if (!known) {
          console.error(
            `Skipping ${controller.hostname}: collection failed; refusing blind inserts`,
          );
          failureCount++;
          continue;
        }

        // Build a single smart payload:
        //  - items that exist on the controller  → "key[id=X]": item  (update)
        //  - items that are new to the controller → "key[]": [items]  (append)
        // The chunker in api.js will split this into ≤1200-byte HTTP requests.
        const payload = {};

        const newScenes = [];
        for (const scene of consolidated.scenes) {
          if (known.sceneIds.has(String(scene.id))) {
            const existing = known.scenes.filter(
              (item) => String(item.id) === String(scene.id),
            );
            if (
              existing.length !== 1 ||
              this._compareArrays([scene], existing, "id")
            ) {
              payload[`scenes[id=${scene.id}]`] = scene;
            }
          } else {
            newScenes.push(scene);
          }
        }
        if (newScenes.length > 0) payload["scenes[]"] = newScenes;

        const newGroups = [];
        for (const group of consolidated.groups) {
          if (known.groupIds.has(String(group.id))) {
            const existing = known.groups.filter(
              (item) => String(item.id) === String(group.id),
            );
            if (
              existing.length !== 1 ||
              this._compareArrays([group], existing, "id")
            ) {
              payload[`groups[id=${group.id}]`] = group;
            }
          } else {
            newGroups.push(group);
          }
        }
        if (newGroups.length > 0) payload["groups[]"] = newGroups;

        if (Object.keys(payload).length === 0) {
          console.log(`✅ ${controller.hostname}: nothing to push`);
          successCount++;
          continue;
        }

        const updateCount = Object.keys(payload).filter((key) =>
          key.includes("[id="),
        ).length;
        const insertCount = newScenes.length + newGroups.length;
        console.log(
          `📤 Pushing to ${controller.hostname}: ${updateCount} update(s), ${insertCount} insert(s)`,
        );

        const { error, jsonData } = await apiService.updateDataOnController(
          controller.ip_address,
          payload,
          { timeout: 8000 },
        );

        if (error || jsonData?.success === false) {
          console.error(
            `❌ Failed to push to ${controller.hostname}:`,
            error || jsonData,
          );
          failureCount++;
        } else {
          console.log(`✅ Successfully pushed to ${controller.hostname}`);
          successCount++;
        }

        // Delay between pushes to avoid overwhelming controllers (rate limiting)
        await this.sleep(500);
      } catch (error) {
        console.error(`❌ Error pushing to ${controller.hostname}:`, error);
        failureCount++;
      }
    }

    console.log(
      `🎉 Sync complete: ${successCount} succeeded, ${failureCount} failed`,
    );

    // Phase 3: Verify all controllers agree (verify all push targets including current invisible controller)
    if (failureCount === 0) {
      // Give controllers a moment to persist the newly written data before verifying.
      await this.sleep(800);

      console.log(
        `🔍 Verifying data consistency across ${pushTargets.length} controllers...`,
      );
      const verificationResult = await this.verifyDataConsistency(
        pushTargets,
        consolidated,
      );

      if (!verificationResult.consistent) {
        console.error(
          `❌ Data inconsistency detected: ${verificationResult.message}`,
        );
        if (verificationResult.inconsistencies?.length) {
          for (const inc of verificationResult.inconsistencies) {
            console.error(`  • ${inc.controller} [${inc.type}]: ${inc.issue}`);
          }
        }
        return false;
      }

      console.log(`✅ All controllers have consistent data`);
    }

    return failureCount === 0;
  }

  /**
   * Verify that all controllers have consistent data after sync
   * @param {Array} controllers - List of controllers to verify
   * @param {Object} expectedData - The consolidated data that was pushed
   * @returns {Promise<Object>} Result with consistent flag and message
   */
  async verifyDataConsistency(controllers, expectedData) {
    const inconsistencies = [];
    let fetchErrors = 0;

    for (const controller of controllers) {
      try {
        console.log(`🔍 Verifying ${controller.hostname}...`);

        const { jsonData, error } = await apiService.getDataFromController(
          controller.ip_address,
          { timeout: 5000 },
        );

        if (error || !jsonData) {
          console.warn(
            `⚠️ Failed to fetch verification data from ${controller.hostname}`,
          );
          fetchErrors++;
          continue;
        }

        // Compare presets - SKIPPED (Local only)
        /*
        const presetMismatch = this._compareArrays(
          expectedData.presets,
          jsonData.presets || [],
          "id",
        );
        if (presetMismatch) {
          inconsistencies.push({
            controller: controller.hostname,
            type: "presets",
            issue: presetMismatch,
          });
        }
        */

        // Compare scenes
        const sceneMismatch = this._compareArrays(
          expectedData.scenes,
          jsonData.scenes || [],
          "id",
        );
        if (sceneMismatch) {
          inconsistencies.push({
            controller: controller.hostname,
            type: "scenes",
            issue: sceneMismatch,
          });
        }

        // Compare groups
        const groupMismatch = this._compareArrays(
          expectedData.groups,
          jsonData.groups || [],
          "id",
        );
        if (groupMismatch) {
          inconsistencies.push({
            controller: controller.hostname,
            type: "groups",
            issue: groupMismatch,
          });
        }

        // Small delay between verification requests
        await this.sleep(300);
      } catch (error) {
        console.error(`❌ Error verifying ${controller.hostname}:`, error);
        fetchErrors++;
      }
    }

    if (fetchErrors > 0) {
      return {
        consistent: false,
        message: `Failed to fetch data from ${fetchErrors} controller(s)`,
        inconsistencies,
        fetchErrors,
      };
    }

    if (inconsistencies.length > 0) {
      return {
        consistent: false,
        message: `Found ${inconsistencies.length} inconsistency(ies)`,
        inconsistencies,
      };
    }

    return {
      consistent: true,
      message: "All controllers have consistent data",
    };
  }

  /**
   * Compare two arrays of objects by a key field
   * @param {Array} expected - Expected array
   * @param {Array} actual - Actual array from controller
   * @param {String} keyField - Field to use as unique identifier
   * @returns {String|null} Description of mismatch, or null if arrays match
   */
  _compareArrays(expected, actual, keyField) {
    const expectedMap = this._toNewestByIdMap(expected, keyField);
    const actualMap = this._toNewestByIdMap(actual, keyField);

    if (actual.length !== actualMap.size) {
      return "Duplicate or invalid items in controller data";
    }
    if (actualMap.size > expectedMap.size) {
      return "Unexpected items in controller data";
    }

    for (const [id, expectedItem] of expectedMap.entries()) {
      if (!actualMap.has(id)) {
        return `Missing item with ${keyField}=${id}`;
      }

      const actualItem = actualMap.get(id);
      if (this._canonicalItem(expectedItem) !== this._canonicalItem(actualItem)) {
        return `Content mismatch for ${keyField}=${id}; recollect before retrying`;
      }
    }

    return null;
  }

  _canonicalItem(item) {
    const normalized = Array.isArray(item.settings)
      ? this.normalizeSceneForSync(item)
      : this.normalizeGroupForSync(item);
    const sortKeys = (value) => {
      if (Array.isArray(value)) return value.map(sortKeys);
      if (value && typeof value === "object") {
        return Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, sortKeys(value[key])]),
        );
      }
      return value;
    };
    return JSON.stringify(sortKeys(normalized));
  }

  _toNewestByIdMap(items, keyField) {
    const map = new Map();
    for (const item of items || []) {
      const id = item?.[keyField];
      if (!id) continue;

      const existing = map.get(id);
      if (!existing) {
        map.set(id, item);
        continue;
      }

      const existingTs = Number(existing?.ts || 0);
      const currentTs = Number(item?.ts || 0);
      if (!Number.isFinite(existingTs) || currentTs >= existingTs) {
        map.set(id, item);
      }
    }
    return map;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(ms, 0)));
  }
}

// Export a singleton instance
export const syncService = new SyncService();
export default syncService;
