import { useControllersStore } from "src/stores/controllersStore";
import { makeID } from "src/services/tools";

/**
 * Generic function to save any item type (preset, group, scene)
 * @param {Object} store - The store containing the data (e.g. appDataStore)
 * @param {String} itemType - Type of item: 'preset', 'group', or 'scene'
 * @param {Object} item - The item to save
 * @param {Function} progressCallback - Callback for progress updates
 * @param {Object} options - Optional processing functions
 */
export async function saveItem(
  store,
  itemType,
  item,
  progressCallback,
  options = {},
) {
  const controllers = useControllersStore();
  const pluralType = `${itemType}s`; // presets, groups, scenes

  // Generate ID if needed
  if (!item.id) {
    item.id = makeID();
  }

  // Add timestamp
  item.ts = Date.now();

  // Find if item exists already
  const existingItemIndex = store.data[pluralType].findIndex(
    (i) => i.id === item.id,
  );

  // Handle special pre-processing (like for presets)
  let itemToSync = item;
  let specialProps = {};

  if (options.preProcess) {
    const result = options.preProcess(item);
    itemToSync = result.itemToSync;
    specialProps = result.specialProps;
  }

  let payload;

  try {
    let completed = 0;
    for (const controller of controllers.data) {
      if (!controller.ip_address) {
        completed++;
        if (progressCallback)
          progressCallback(completed, controllers.data.length);
        continue;
      }

      // Get existing data from controller
      const existingDataResponse = await fetch(
        `http://${controller.ip_address}/data`,
      );
      const existingData = await existingDataResponse.json();
      const existingItem = existingData[pluralType].find(
        (i) => i.id === item.id,
      );

      // Create appropriate payload
      if (existingItem) {
        // Update existing item
        payload = { [`${pluralType}[id=${item.id}]`]: itemToSync };
      } else {
        // Add new item
        payload = { [`${pluralType}[]`]: [itemToSync] };
      }

      // Only send if it's new or newer
      if (!existingItem || existingItem.ts < item.ts) {
        const response = await fetch(`http://${controller.ip_address}/data`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }

      completed++;
      if (progressCallback) {
        console.log(
          `Progress for ${itemType}: ${completed}/${controllers.data.length}`,
        );
        progressCallback(completed, controllers.data.length);
      }
    }

    // Handle special post-processing (like for presets)
    if (options.postProcess) {
      item = options.postProcess(item, specialProps);
    }

    // Update local store
    if (existingItemIndex !== -1) {
      store.data[pluralType][existingItemIndex] = item;
      console.log(`Updated ${itemType}`, item.name || item.id);
    } else {
      store.data[pluralType].push(item);
      console.log(
        `Added ${itemType}`,
        item.name || item.id,
        "with id",
        item.id,
      );
    }

    return true;
  } catch (error) {
    console.error(`Error saving ${itemType}:`, error);
    return false;
  }
}

/**
 * Generic function to delete any item type
 * @param {Object} store - The store containing the data (e.g. appDataStore)
 * @param {String} itemType - Type of item: 'preset', 'group', or 'scene'
 * @param {Object} item - The item to delete
 * @param {Function} progressCallback - Callback for progress updates
 */
export async function deleteItem(store, itemType, item, progressCallback) {
  // Call the appropriate store method directly
  switch (itemType) {
    case "preset":
      return store.deletePreset(item, progressCallback);
    case "scene":
      return store.deleteScene(item, progressCallback);
    case "group":
      return store.deleteGroup(item, progressCallback);
    default:
      throw new Error(`Unknown item type: ${itemType}`);
  }
}

export async function deletePreset(store, preset, progressCallback) {
  return store.deletePreset(preset, progressCallback);
}

/**
 * Save a preset to controllers and store
 */
export async function savePreset(store, preset, progressCallback) {
  return saveItem(store, "preset", preset, progressCallback, {
    preProcess: (item) => {
      // Handle favorite status specially
      const isFavorite = item.favorite;
      const itemToSync = { ...item };
      delete itemToSync.favorite;
      return { itemToSync, specialProps: { favorite: isFavorite } };
    },
    postProcess: (item, specialProps) => {
      // Restore favorite status
      item.favorite = specialProps.favorite;
      return item;
    },
  });
}

/**
 * Save a scene to controllers and store
 */
export async function saveScene(store, scene, progressCallback) {
  return saveItem(store, "scene", scene, progressCallback);
}

/**
 * Save a group to controllers and store
 */
export async function saveGroup(store, group, progressCallback) {
  return saveItem(store, "group", group, progressCallback);
}

/**
 * Delete a scene from controllers and store
 */
export async function deleteScene(store, scene, progressCallback) {
  return deleteItem(store, "scene", scene, progressCallback);
}

/**
 * Delete a group from controllers and store
 */
export async function deleteGroup(store, group, progressCallback) {
  return deleteItem(store, "group", group, progressCallback);
}
