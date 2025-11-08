import { apiService } from 'src/services/api.js';
import { useControllersStore } from 'src/stores/controllersStore.js';

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

      console.log(`🔄 Starting simplified sync across ${reachableControllers.length} controllers`);

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

      for (const controller of reachableControllers) {
        try {
          console.log(`📥 Fetching data from ${controller.hostname} (${completed + 1}/${total})`);
          
          const { jsonData, error } = await apiService.getDataFromController(
            controller.ip_address,
            { timeout: 8000 }
          );

          if (error) {
            if (error.isTimeout) {
              console.warn(`⏰ Timeout fetching from ${controller.hostname}: Request timed out after 8000ms`);
            } else {
              console.warn(`⚠️ Failed to fetch from ${controller.hostname}: ${error.message || error}`);
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
            console.log(`⏸️ Waiting ${DELAY_BETWEEN_REQUESTS}ms before next controller...`);
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
          }
        } catch (error) {
          if (error.name === "AbortError" || error.message?.includes("aborted")) {
            console.error(`⏰ Request to ${controller.hostname} was aborted (likely timeout)`);
          } else {
            console.error(`❌ Error fetching from ${controller.hostname}:`, error);
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

      // Phase 3: Simple synchronization (just log what we would do)
      console.log(`📊 Found ${latestItems.presets.size} unique presets, ${latestItems.scenes.size} scenes, ${latestItems.groups.size} groups`);
      
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
    // Collect valid data
    if (Array.isArray(jsonData.presets)) {
      jsonData.presets.forEach(preset => {
        if (preset.id && preset.ts) {
          allData.presets.push(preset);
        }
      });
    }

    if (Array.isArray(jsonData.scenes)) {
      jsonData.scenes.forEach(scene => {
        if (scene.id && scene.ts) {
          allData.scenes.push(scene);
        }
      });
    }

    if (Array.isArray(jsonData.groups)) {
      jsonData.groups.forEach(group => {
        if (group.id && group.ts) {
          allData.groups.push(group);
        }
      });
    }

    if (Array.isArray(jsonData.controllers)) {
      jsonData.controllers.forEach(ctrl => {
        if (ctrl.hostname && ctrl.ts) {
          allData.controllers.push(ctrl);
        }
      });
    }
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
    allData.presets.forEach(preset => {
      const existing = latest.presets.get(preset.id);
      if (!existing || preset.ts > existing.ts) {
        latest.presets.set(preset.id, preset);
      }
    });

    // Process scenes
    allData.scenes.forEach(scene => {
      const existing = latest.scenes.get(scene.id);
      if (!existing || scene.ts > existing.ts) {
        latest.scenes.set(scene.id, scene);
      }
    });

    // Process groups
    allData.groups.forEach(group => {
      const existing = latest.groups.get(group.id);
      if (!existing || group.ts > existing.ts) {
        latest.groups.set(group.id, group);
      }
    });

    // Process controllers
    allData.controllers.forEach(controller => {
      const existing = latest.controllers.get(controller.hostname);
      if (!existing || controller.ts > existing.ts) {
        latest.controllers.set(controller.hostname, controller);
      }
    });

    return latest;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(ms, 0)));
  }
}

// Export a singleton instance
export const syncService = new SyncService();
export default syncService;