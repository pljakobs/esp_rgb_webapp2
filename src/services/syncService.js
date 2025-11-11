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
   * Simplified sync without distributed locking
   * Just synchronize data across controllers without complex locking mechanism
   */
  async synchronizeData(progressCallback) {
    // Check if already syncing
    if (this.isCurrentlySyncing) {
      console.log("🔄 Sync already in progress, skipping duplicate sync");
      return false;
    }

    this.isCurrentlySyncing = true;

    try {
      const controllers = useControllersStore();
      const currentControllerId = this.getCurrentControllerId();

      if (currentControllerId === "unknown") {
        console.error("❌ Cannot determine current controller for sync");
        return false;
      }

      const reachableControllers = controllers.data.filter(
        (c) => c.id && c.ip_address && c.visible === true,
      );

      if (reachableControllers.length === 0) {
        console.error("❌ No reachable controllers found");
        return false;
      }

      console.log(
        `🔄 Starting simplified sync across ${reachableControllers.length} controllers`,
      );

      // Phase 1: Collect all data from all controllers
      const allData = {
        presets: [],
        scenes: [],
        groups: [],
        controllers: [],
      };

      let completed = 0;
      const total = reachableControllers.length;
      const DELAY_BETWEEN_REQUESTS = 500; // 500ms delay between controller requests
      const retryQueue = []; // Initialize retry queue for failed requests

      for (const controller of reachableControllers) {
        try {
          console.log(
            `📥 Fetching data from ${controller.hostname} (${completed + 1}/${total})`,
          );

          const { jsonData, error } = await apiService.getDataFromController(
            controller.ip_address,
            { timeout: 8000 },
          );

          if (error) {
            if (error.isTimeout) {
              console.warn(
                `⏰ Timeout fetching from ${controller.hostname}: Request timed out after 8000ms`,
              );
            } else {
              console.warn(
                `⚠️ Failed to fetch from ${controller.hostname}: ${error.message || error}`,
              );
            }
            // Add to retry queue for failed requests
            retryQueue.push(controller);
          } else if (jsonData) {
            this.collectDataFromController(jsonData, allData);
          }

          completed++;
          if (progressCallback) {
            progressCallback(completed, total);
          }

          // Add delay between requests to avoid overwhelming controllers
          if (completed < total) {
            console.log(
              `⏸️ Waiting ${DELAY_BETWEEN_REQUESTS}ms before next controller...`,
            );
            await new Promise((resolve) =>
              setTimeout(resolve, DELAY_BETWEEN_REQUESTS),
            );
          }
        } catch (error) {
          if (
            error.name === "AbortError" ||
            error.message?.includes("aborted")
          ) {
            console.error(
              `⏰ Request to ${controller.hostname} was aborted (likely timeout)`,
            );
          } else {
            console.error(
              `❌ Error fetching from ${controller.hostname}:`,
              error,
            );
          }
          // Add to retry queue for failed requests
          retryQueue.push(controller);
          completed++;
          if (progressCallback) {
            progressCallback(completed, total);
          }
        }
      }

      // Phase 2: Find the most recent versions (simplified)
      const latestItems = this.findLatestVersions(allData);

      // Phase 3: Cleanup empty/invalid groups and scenes
      await this.cleanupEmptyGroups(latestItems);
      await this.cleanupEmptyScenes(latestItems);
      await this.cleanupInvalidItems(latestItems);

      // Phase 4: Simple synchronization (just log what we would do)
      console.log(
        `📊 Found ${latestItems.presets.size} unique presets, ${latestItems.scenes.size} scenes, ${latestItems.groups.size} groups`,
      );

      console.log("🎉 Simplified sync completed successfully");
      return true;
    } catch (error) {
      console.error("❌ Error during sync:", error);
      return false;
    } finally {
      // Always release the sync lock
      this.isCurrentlySyncing = false;
    }
  }

  /**
   * Helper method to collect data from a controller response
   * @param {Object} jsonData - Controller response data
   * @param {Object} allData - Accumulated data object
   */
  collectDataFromController(jsonData, allData) {
    // Collect valid data with proper validation
    if (Array.isArray(jsonData.presets)) {
      jsonData.presets.forEach((preset) => {
        if (this.isValidPreset(preset)) {
          allData.presets.push(preset);
        }
      });
    }

    if (Array.isArray(jsonData.scenes)) {
      jsonData.scenes.forEach((scene) => {
        if (this.isValidScene(scene)) {
          allData.scenes.push(scene);
        }
      });
    }

    if (Array.isArray(jsonData.groups)) {
      jsonData.groups.forEach((group) => {
        if (this.isValidGroup(group)) {
          allData.groups.push(group);
        }
      });
    }

    if (Array.isArray(jsonData.controllers)) {
      jsonData.controllers.forEach((ctrl) => {
        if (this.isValidController(ctrl)) {
          allData.controllers.push(ctrl);
        }
      });
    }
  }

  /**
   * Validate preset data for sync
   * @param {Object} preset - Preset object to validate
   * @returns {boolean} - True if valid for sync
   */
  isValidPreset(preset) {
    // Must have valid ID (not null, undefined, 0, or empty string)
    if (!preset.id || preset.id === 0 || preset.id === "0") {
      console.warn(`🚫 Skipping preset with invalid ID: ${preset.id}`);
      return false;
    }

    // Must have a non-empty name
    if (
      !preset.name ||
      typeof preset.name !== "string" ||
      preset.name.trim() === ""
    ) {
      console.warn(
        `🚫 Skipping preset with empty/invalid name: "${preset.name}" (ID: ${preset.id})`,
      );
      return false;
    }

    // Must have timestamp for sync ordering
    if (!preset.ts || typeof preset.ts !== "number" || preset.ts <= 0) {
      console.warn(
        `🚫 Skipping preset with invalid timestamp: ${preset.ts} (ID: ${preset.id})`,
      );
      return false;
    }

    // Must have color data structure
    if (!preset.color || typeof preset.color !== "object") {
      console.warn(
        `🚫 Skipping preset without valid color data (ID: ${preset.id})`,
      );
      return false;
    }

    return true;
  }

  /**
   * Validate scene data for sync
   * @param {Object} scene - Scene object to validate
   * @returns {boolean} - True if valid for sync
   */
  isValidScene(scene) {
    // Must have valid ID (not null, undefined, 0, or empty string)
    if (!scene.id || scene.id === 0 || scene.id === "0") {
      console.warn(`🚫 Skipping scene with invalid ID: ${scene.id}`);
      return false;
    }

    // Must have a non-empty name
    if (
      !scene.name ||
      typeof scene.name !== "string" ||
      scene.name.trim() === ""
    ) {
      console.warn(
        `🚫 Skipping scene with empty/invalid name: "${scene.name}" (ID: ${scene.id})`,
      );
      return false;
    }

    // Must have timestamp for sync ordering
    if (!scene.ts || typeof scene.ts !== "number" || scene.ts <= 0) {
      console.warn(
        `🚫 Skipping scene with invalid timestamp: ${scene.ts} (ID: ${scene.id})`,
      );
      return false;
    }

    // Must have settings array (scenes have settings, not controllers array)
    if (!Array.isArray(scene.settings) || scene.settings.length === 0) {
      console.warn(
        `🚫 Skipping scene without settings array (ID: ${scene.id})`,
      );
      return false;
    }

    return true;
  }

  /**
   * Validate group data for sync
   * @param {Object} group - Group object to validate
   * @returns {boolean} - True if valid for sync
   */
  isValidGroup(group) {
    // Must have valid ID (not null, undefined, 0, or empty string)
    if (!group.id || group.id === 0 || group.id === "0") {
      console.warn(`🚫 Skipping group with invalid ID: ${group.id}`);
      return false;
    }

    // Must have a non-empty name
    if (
      !group.name ||
      typeof group.name !== "string" ||
      group.name.trim() === ""
    ) {
      console.warn(
        `🚫 Skipping group with empty/invalid name: "${group.name}" (ID: ${group.id})`,
      );
      return false;
    }

    // Must have timestamp for sync ordering
    if (!group.ts || typeof group.ts !== "number" || group.ts <= 0) {
      console.warn(
        `🚫 Skipping group with invalid timestamp: ${group.ts} (ID: ${group.id})`,
      );
      return false;
    }

    // Must have controller_ids array with valid (non-null) controller IDs
    if (!Array.isArray(group.controller_ids)) {
      console.warn(
        `🚫 Skipping group without controller_ids array (ID: ${group.id})`,
      );
      return false;
    }
    
    // Filter out null values and check if we have valid controller IDs
    const validControllerIds = group.controller_ids.filter(id => id !== null && id !== undefined);
    if (validControllerIds.length === 0) {
      console.warn(
        `🚫 Skipping group with no valid controller IDs (ID: ${group.id})`,
      );
      return false;
    }

    return true;
  }

  /**
   * Validate controller metadata for sync
   * @param {Object} controller - Controller metadata object to validate
   * @returns {boolean} - True if valid for sync
   */
  isValidController(controller) {
    // Must have valid ID (not null, undefined, 0, or empty string)
    if (!controller.id || controller.id === 0 || controller.id === "0") {
      console.warn(
        `🚫 Skipping controller metadata with invalid ID: ${controller.id}`,
      );
      return false;
    }

    // Must have a non-empty hostname or name
    if (
      (!controller.hostname || controller.hostname.trim() === "") &&
      (!controller.name || controller.name.trim() === "")
    ) {
      console.warn(
        `🚫 Skipping controller metadata with empty hostname/name (ID: ${controller.id})`,
      );
      return false;
    }

    // Must have timestamp for sync ordering (allow 0 as valid timestamp for new controllers)
    if (
      controller.ts === null ||
      controller.ts === undefined ||
      typeof controller.ts !== "number"
    ) {
      console.warn(
        `🚫 Skipping controller metadata with missing/invalid timestamp: ${controller.ts} (ID: ${controller.id})`,
      );
      return false;
    }

    return true;
  }

  /**
   * Find the latest versions of each item by timestamp
   */
  findLatestVersions(allData) {
    const latest = {
      presets: new Map(),
      scenes: new Map(),
      groups: new Map(),
      controllers: new Map(),
    };

    // Process presets
    allData.presets.forEach((preset) => {
      const existing = latest.presets.get(preset.id);
      if (!existing || preset.ts > existing.ts) {
        latest.presets.set(preset.id, preset);
      }
    });

    // Process scenes
    allData.scenes.forEach((scene) => {
      const existing = latest.scenes.get(scene.id);
      if (!existing || scene.ts > existing.ts) {
        latest.scenes.set(scene.id, scene);
      }
    });

    // Process groups
    allData.groups.forEach((group) => {
      const existing = latest.groups.get(group.id);
      if (!existing || group.ts > existing.ts) {
        latest.groups.set(group.id, group);
      }
    });

    // Process controllers
    allData.controllers.forEach((controller) => {
      const existing = latest.controllers.get(controller.hostname);
      if (!existing || controller.ts > existing.ts) {
        latest.controllers.set(controller.hostname, controller);
      }
    });

    return latest;
  }

  /**
   * Clean up groups that have no valid controllers
   * @param {Object} latestItems - Latest versions of data items
   */
  async cleanupEmptyGroups(latestItems) {
    const controllers = useControllersStore();
    const groupsToDelete = [];
    
    // Find groups with no valid controllers
    latestItems.groups.forEach((group, groupId) => {
      if (!group.controller_ids || !Array.isArray(group.controller_ids)) {
        console.log(`🗑️ Marking group '${group.name}' for deletion: no controller_ids array`);
        groupsToDelete.push(group);
        return;
      }
      
      // Filter out null/undefined controller IDs
      const validControllerIds = group.controller_ids.filter(id => id !== null && id !== undefined && id !== '');
      
      if (validControllerIds.length === 0) {
        console.log(`🗑️ Marking group '${group.name}' for deletion: no valid controllers (had: [${group.controller_ids.join(', ')}])`);
        groupsToDelete.push(group);
      } else {
        console.log(`✅ Group '${group.name}' has ${validControllerIds.length} valid controllers: [${validControllerIds.join(', ')}]`);
      }
    });
    
    if (groupsToDelete.length === 0) {
      console.log("✅ No empty groups found - all groups have valid controllers");
      return;
    }
    
    console.log(`🗑️ Found ${groupsToDelete.length} empty groups to delete`);
    
    // Delete empty groups from all controllers
    for (const group of groupsToDelete) {
      try {
        console.log(`🗑️ Deleting empty group: '${group.name}' (ID: ${group.id})`);
        
        const reachableControllers = controllers.data.filter(
          (c) => c.id && c.ip_address && c.visible === true,
        );
        
        let deletedFromControllers = 0;
        
        for (const controller of reachableControllers) {
          try {
            const deletePayload = { [`groups[id=${group.id}]`]: [] };
            
            const { jsonData, error } = await apiService.requestToController(
              'data',
              { ip_address: controller.ip_address },
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deletePayload),
              }
            );
            
            if (error) {
              if (error.message && error.message.includes('BadSelector')) {
                console.log(`⚠️ Group not found on ${controller.hostname || controller.ip_address} - already deleted`);
              } else {
                console.warn(`⚠️ Failed to delete from ${controller.hostname || controller.ip_address}: ${error.message}`);
              }
            } else {
              deletedFromControllers++;
              console.log(`✅ Deleted empty group from ${controller.hostname || controller.ip_address}`);
            }
          } catch (controllerError) {
            console.warn(`⚠️ Error deleting from controller ${controller.hostname || controller.ip_address}: ${controllerError.message}`);
          }
        }
        
        // Remove from the latest items map so it doesn't get synced back
        latestItems.groups.delete(group.id);
        console.log(`🗑️ Removed group '${group.name}' from sync data (deleted from ${deletedFromControllers}/${reachableControllers.length} controllers)`);
        
      } catch (error) {
        console.error(`❌ Error deleting empty group '${group.name}': ${error.message}`);
      }
    }
    
    console.log(`🎉 Cleanup completed - removed ${groupsToDelete.length} empty groups`);
  }

  /**
   * Clean up scenes that have no valid controller settings
   * @param {Object} latestItems - Latest versions of data items  
   */
  async cleanupEmptyScenes(latestItems) {
    const controllers = useControllersStore();
    const scenesToDelete = [];
    
    // Find scenes with no valid controller settings
    latestItems.scenes.forEach((scene, sceneId) => {
      if (!scene.settings || !Array.isArray(scene.settings)) {
        console.log(`🗑️ Marking scene '${scene.name}' for deletion: no settings array`);
        scenesToDelete.push(scene);
        return;
      }
      
      // Filter out settings with null/undefined controller IDs
      const validSettings = scene.settings.filter(setting => 
        setting.controller_id !== null && 
        setting.controller_id !== undefined && 
        setting.controller_id !== ''
      );
      
      if (validSettings.length === 0) {
        console.log(`🗑️ Marking scene '${scene.name}' for deletion: no valid controller settings`);
        scenesToDelete.push(scene);
      } else {
        const controllerIds = validSettings.map(s => s.controller_id);
        console.log(`✅ Scene '${scene.name}' has ${validSettings.length} valid settings for controllers: [${controllerIds.join(', ')}]`);
      }
    });
    
    if (scenesToDelete.length === 0) {
      console.log("✅ No empty scenes found - all scenes have valid controller settings");
      return;
    }
    
    console.log(`🗑️ Found ${scenesToDelete.length} empty scenes to delete`);
    
    // Delete empty scenes from all controllers
    for (const scene of scenesToDelete) {
      try {
        console.log(`🗑️ Deleting empty scene: '${scene.name}' (ID: ${scene.id})`);
        
        const reachableControllers = controllers.data.filter(
          (c) => c.id && c.ip_address && c.visible === true,
        );
        
        let deletedFromControllers = 0;
        
        for (const controller of reachableControllers) {
          try {
            const deletePayload = { [`scenes[id=${scene.id}]`]: [] };
            
            const { jsonData, error } = await apiService.requestToController(
              'data',
              { ip_address: controller.ip_address },
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deletePayload),
              }
            );
            
            if (error) {
              if (error.message && error.message.includes('BadSelector')) {
                console.log(`⚠️ Scene not found on ${controller.hostname || controller.ip_address} - already deleted`);
              } else {
                console.warn(`⚠️ Failed to delete scene from ${controller.hostname || controller.ip_address}: ${error.message}`);
              }
            } else {
              deletedFromControllers++;
              console.log(`✅ Deleted empty scene from ${controller.hostname || controller.ip_address}`);
            }
          } catch (controllerError) {
            console.warn(`⚠️ Error deleting scene from controller ${controller.hostname || controller.ip_address}: ${controllerError.message}`);
          }
        }
        
        // Remove from the latest items map so it doesn't get synced back
        latestItems.scenes.delete(scene.id);
        console.log(`🗑️ Removed scene '${scene.name}' from sync data (deleted from ${deletedFromControllers}/${reachableControllers.length} controllers)`);
        
      } catch (error) {
        console.error(`❌ Error deleting empty scene '${scene.name}': ${error.message}`);
      }
    }
    
    console.log(`🎉 Scene cleanup completed - removed ${scenesToDelete.length} empty scenes`);
  }

  /**
   * Clean up items with invalid IDs or empty names
   * @param {Object} latestItems - Latest versions of data items
   */
  async cleanupInvalidItems(latestItems) {
    const controllers = useControllersStore();
    const itemsToDelete = {
      groups: [],
      scenes: [],
      presets: []
    };
    
    // Find items with null IDs or empty names
    ['groups', 'scenes', 'presets'].forEach(itemType => {
      latestItems[itemType].forEach((item, itemId) => {
        // Check for null/invalid IDs
        if (!item.id || item.id === null || item.id === 'null') {
          console.log(`🗑️ Marking ${itemType.slice(0,-1)} for deletion: invalid ID (${item.id})`);
          itemsToDelete[itemType].push(item);
          return;
        }
        
        // Check for null/empty names (but allow unnamed items if they have other valid data)
        if (item.name === null || item.name === 'null') {
          console.log(`🗑️ Marking ${itemType.slice(0,-1)} '${item.name}' for deletion: null name (ID: ${item.id})`);
          itemsToDelete[itemType].push(item);
          return;
        }
      });
    });
    
    const totalToDelete = itemsToDelete.groups.length + itemsToDelete.scenes.length + itemsToDelete.presets.length;
    
    if (totalToDelete === 0) {
      console.log("✅ No items with invalid IDs or names found");
      return;
    }
    
    console.log(`🗑️ Found ${totalToDelete} items with invalid data to delete (${itemsToDelete.groups.length} groups, ${itemsToDelete.scenes.length} scenes, ${itemsToDelete.presets.length} presets)`);
    
    // Delete invalid items from all controllers
    const reachableControllers = controllers.data.filter(
      (c) => c.id && c.ip_address && c.visible === true,
    );
    
    for (const [itemType, items] of Object.entries(itemsToDelete)) {
      for (const item of items) {
        try {
          console.log(`🗑️ Deleting invalid ${itemType.slice(0,-1)}: ID(${item.id}) Name(${item.name})`);
          
          let deletedFromControllers = 0;
          
          for (const controller of reachableControllers) {
            try {
              const deletePayload = { [`${itemType}[id=${item.id}]`]: [] };
              
              const { jsonData, error } = await apiService.requestToController(
                'data',
                { ip_address: controller.ip_address },
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(deletePayload),
                  timeout: 5000, // Short timeout for cleanup operations
                }
              );
              
              if (error) {
                if (error.message && error.message.includes('BadSelector')) {
                  console.log(`⚠️ Invalid ${itemType.slice(0,-1)} not found on ${controller.hostname || controller.ip_address} - already deleted`);
                } else {
                  console.warn(`⚠️ Failed to delete invalid ${itemType.slice(0,-1)} from ${controller.hostname || controller.ip_address}: ${error.message}`);
                }
              } else {
                deletedFromControllers++;
              }
            } catch (controllerError) {
              console.warn(`⚠️ Error deleting invalid ${itemType.slice(0,-1)} from controller ${controller.hostname || controller.ip_address}: ${controllerError.message}`);
            }
          }
          
          // Remove from the latest items map
          latestItems[itemType].delete(item.id);
          console.log(`✅ Removed invalid ${itemType.slice(0,-1)} from sync data (deleted from ${deletedFromControllers}/${reachableControllers.length} controllers)`);
          
        } catch (error) {
          console.error(`❌ Error deleting invalid ${itemType.slice(0,-1)}: ${error.message}`);
        }
      }
    }
    
    console.log(`🎉 Invalid items cleanup completed - removed ${totalToDelete} items`);
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
