import { infoDataStore } from "src/stores/infoDataStore";
import { useAppDataStore } from "src/stores/appDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import { Notify } from "quasar";

function makeID() {
  const infoData = infoDataStore();
  const controllerID = infoData.data.deviceid;

  const localID = getLocalID(8);
  return `${controllerID}-${localID}`;
}

function getLocalID(n) {
  let min = Math.pow(10, n);
  let max = min * 10 - 1;
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Gets controllers by their IDs from a group's controller_id array
 * @param {Object|string} group - The group object or group ID
 * @returns {Array} Array of controller objects belonging to this group
 */
function getControllersInGroup(group) {
  const appData = useAppDataStore();
  const controllersStore = useControllersStore();

  // Find the group if only ID was provided
  let groupObject;
  if (typeof group === "object") {
    groupObject = group;
  } else {
    // Find group by ID
    groupObject = appData.data?.groups?.find((g) => g.id === group);
    if (!groupObject) {
      console.warn(`Group not found for ID: ${group}`);
      return [];
    }
  }

  // Ensure the group has a controller_ids array
  if (
    !groupObject.controller_ids ||
    !Array.isArray(groupObject.controller_ids)
  ) {
    console.log(`Group "${groupObject.name}" has no controller_ids array`);
    return [];
  }

  // Convert all IDs to strings for reliable comparison
  const controllerIds = groupObject.controller_ids.map((id) => String(id));

  // Get all valid controllers that match the IDs in the group
  const controllers = controllersStore.data || [];
  const groupControllers = controllers.filter(
    (controller) =>
      controller.ip_address && controllerIds.includes(String(controller.id)),
  );

  return groupControllers;
}

/**
 * Gets controller information by ID
 * @param {string|number} controllerId - The ID of the controller
 * @returns {Object} Controller information object
 */
function getControllerInfo(controllerId) {
  const controllersStore = useControllersStore();

  if (!controllersStore.data) {
    console.log("Controller store data is not available");
    return {
      hostname: `Unknown (${controllerId})`,
      ip_address: "",
      online: false,
      icon: "lightbulb",
    };
  }

  // Convert both IDs to strings for comparison to avoid type issues
  const controller = controllersStore.data.find(
    (c) => String(c.id) === String(controllerId),
  );

  if (!controller) {
    console.log(`Controller not found for ID: ${controllerId}`);
    console.log(
      "Available controllers:",
      controllersStore.data.map((c) => ({
        id: c.id,
        hostname: c.hostname,
        ip_address: c.ip_address,
      })),
    );
  }

  return {
    hostname: controller?.hostname || `Unknown (${controllerId})`,
    ip_address: controller?.ip_address || "",
    online: controller?.online || false,
    icon: controller?.icon || "lightbulb",
  };
}

/**
 * Gets the name of a preset by its ID
 * @param {string|number} presetId - The ID of the preset
 * @returns {string} The preset name or "Unknown"
 */
function getPresetName(presetId) {
  const appData = useAppDataStore();
  const preset = appData.data?.presets?.find((p) => p.id === presetId);
  return preset ? preset.name : "Unknown";
}

/**
 * Helper to display controller color nicely
 * @param {Object} setting - Controller setting with color information
 * @returns {string} Human-readable color description
 */
function getControllerColorDisplay(setting) {
  if (!setting || !setting.color) return "No color";

  if (setting.color.hsv) {
    const { h, s, v } = setting.color.hsv;
    return `HSV (${h}°, ${s}%, ${v}%)`;
  }

  if (setting.color.raw) {
    const { r, g, b } = setting.color.raw;
    return `RGB (${r}, ${g}, ${b})`;
  }

  if (setting.color.Preset) {
    return `Preset: ${getPresetName(setting.color.Preset.id)}`;
  }

  return "No color";
}

/**
 * Applies a scene to controllers
 * @param {Object} scene - The scene object to apply
 * @returns {Promise<void>}
 */
/**
 * Applies a scene to controllers
 * @param {Object} scene - The scene object to apply
 * @returns {Promise<void>}
 */
async function applyScene(scene) {
  console.log("Applying scene:", scene.name);
  const appData = useAppDataStore();

  if (!scene.settings || scene.settings.length === 0) {
    console.warn(`Scene "${scene.name}" has no controller settings`);
    Notify.create({
      message: `Scene "${scene.name}" has no controller settings`,
      color: "warning",
    });
    return;
  }

  console.log("Processing scene settings");

  // Group settings by controller ID to build sequences for each controller
  const settingsByController = {};

  // First, group settings by controller ID
  for (const setting of scene.settings) {
    const controllerId = String(setting.controller_id);

    if (!settingsByController[controllerId]) {
      settingsByController[controllerId] = [];
    }

    // Add to the controller's settings array
    settingsByController[controllerId].push(setting);
  }

  // Sort settings by position for each controller
  Object.keys(settingsByController).forEach((controllerId) => {
    settingsByController[controllerId].sort((a, b) => {
      return (a.pos || 0) - (b.pos || 0);
    });
  });

  // Now process each controller and its settings
  for (const [controllerId, settings] of Object.entries(settingsByController)) {
    try {
      // Get controller info
      const controllerInfo = getControllerInfo(controllerId);

      if (!controllerInfo || !controllerInfo.ip_address) {
        console.error(`No IP address found for controller ID: ${controllerId}`);
        continue; // Skip this controller
      }

      const ipAddress = controllerInfo.ip_address;

      // Build the sequence array for this controller
      const sequence = [];

      for (const setting of settings) {
        // Parse the color information
        let colorObject = {};

        if (setting.color?.hsv) {
          // Convert HSV values to strings
          colorObject = {
            hsv: {
              h: String(setting.color.hsv.h),
              s: String(setting.color.hsv.s),
              v: String(setting.color.hsv.v),
            },
          };
        } else if (setting.color?.raw) {
          // Convert RAW values to strings
          colorObject = {
            raw: {
              r: String(setting.color.raw.r),
              g: String(setting.color.raw.g),
              b: String(setting.color.raw.b),
            },
          };

          // Add cw/ww if present
          if (setting.color.raw.cw !== undefined) {
            colorObject.raw.cw = String(setting.color.raw.cw);
          }
          if (setting.color.raw.ww !== undefined) {
            colorObject.raw.ww = String(setting.color.raw.ww);
          }
        } else if (setting.color?.Preset) {
          const presetId = setting.color.Preset.id;
          const preset = appData.data.presets?.find((p) => p.id === presetId);

          if (preset && preset.color) {
            // Process preset color values to ensure they're strings
            if (preset.color.hsv) {
              colorObject = {
                hsv: {
                  h: String(preset.color.hsv.h),
                  s: String(preset.color.hsv.s),
                  v: String(preset.color.hsv.v),
                },
              };
            } else if (preset.color.raw) {
              colorObject = {
                raw: {
                  r: String(preset.color.raw.r),
                  g: String(preset.color.raw.g),
                  b: String(preset.color.raw.b),
                },
              };

              // Add cw/ww if present
              if (preset.color.raw.cw !== undefined) {
                colorObject.raw.cw = String(preset.color.raw.cw);
              }
              if (preset.color.raw.ww !== undefined) {
                colorObject.raw.ww = String(preset.color.raw.ww);
              }
            }
          } else {
            console.warn(`Preset not found for ID: ${presetId}`);
            continue; // Skip this setting
          }
        } else {
          console.warn("No valid color found in setting:", setting);
          continue; // Skip this setting
        }

        // Build the transition object from the setting
        if (setting.transition) {
          const transitionItem = { ...colorObject };

          // Always set cmd to "fade" for color transitions
          transitionItem.cmd = "fade";

          // Add queue type
          if (setting.transition.q) {
            transitionItem.q = setting.transition.q;
          }

          // Add direction if present
          if (setting.transition.d !== undefined) {
            transitionItem.d = String(setting.transition.d);
          }

          // Add either speed or time based on the setting
          if (setting.transition.s && setting.transition.s > 0) {
            transitionItem.s = String(setting.transition.s);
          } else if (setting.transition.t) {
            transitionItem.t = String(setting.transition.t);
          }

          // Add requeue if present
          if (setting.transition.r !== undefined) {
            transitionItem.r = setting.transition.r;
          }

          sequence.push(transitionItem);
        } else {
          // If no transition, just use a default fade
          const defaultItem = {
            ...colorObject,
            cmd: "fade",
            t: "1000", // Default 1 second transition as string
          };
          sequence.push(defaultItem);
        }
      }

      // Only proceed if we have items in the sequence
      if (sequence.length === 0) {
        console.warn(`No valid sequence items for controller ${controllerId}`);
        continue;
      }

      console.log(
        `Processing sequence with ${sequence.length} items for ${ipAddress}`,
      );

      // Case 1: If there's only one item, send it directly without wrapping
      if (sequence.length === 1) {
        try {
          const response = await fetch(`http://${ipAddress}/color`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(sequence[0]), // Send single item directly
          });

          if (!response.ok) {
            console.error(
              `Error sending command to ${ipAddress}: ${response.status}`,
            );
          } else {
            console.log(`Command successfully sent to ${ipAddress}`);
          }
        } catch (error) {
          console.error(
            `Network error sending command to ${ipAddress}:`,
            error,
          );
        }
      }
      // Case 2: Multiple items - handle size limit
      else {
        // Split into chunks that fit within 1024 bytes
        const chunks = [];
        let currentChunk = [];
        let currentSize = 0;

        for (const item of sequence) {
          // Estimate the size in bytes when serialized to JSON
          // Add some buffer for wrapper and encoding overhead
          const itemJson = JSON.stringify(item);
          const itemSize = new TextEncoder().encode(itemJson).length + 10; // +10 for array syntax & commas

          // If adding this item would exceed our limit, start a new chunk
          if (currentSize + itemSize > 200) {
            // Using 900 to be safe (below 1024)
            if (currentChunk.length > 0) {
              chunks.push([...currentChunk]);
              currentChunk = [];
              currentSize = 0;
            }
          }

          // Add the item to the current chunk
          currentChunk.push(item);
          currentSize += itemSize;
        }

        // Add the last chunk if it has items
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
        }

        console.log(`Split sequence into ${chunks.length} chunks`);

        // Send each chunk with proper queue behavior
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];

          // For all chunks after the first one, set queue to "back"
          if (i > 0) {
            // Force queue mode to "back" for all items in subsequent chunks
            for (const item of chunk) {
              item.q = "back";
            }
          }

          try {
            const response = await fetch(`http://${ipAddress}/color`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ cmds: chunk }),
            });

            if (!response.ok) {
              console.error(
                `Error sending chunk ${i + 1}/${chunks.length} to ${ipAddress}: ${response.status}`,
              );
              break; // Stop sending more chunks if one fails
            } else {
              console.log(
                `Chunk ${i + 1}/${chunks.length} sent to ${ipAddress}`,
              );
            }
          } catch (error) {
            console.error(
              `Network error sending chunk ${i + 1}/${chunks.length} to ${ipAddress}:`,
              error,
            );
            break; // Stop sending more chunks if one fails
          }
        }
      }
    } catch (error) {
      console.error(`Error processing controller ${controllerId}:`, error);
    }
  }

  Notify.create({
    message: `Scene "${scene.name}" applied`,
    color: "positive",
  });
}

export {
  makeID,
  getControllerInfo,
  applyScene,
  getPresetName,
  getControllerColorDisplay,
  getControllersInGroup,
};
