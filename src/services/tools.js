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
      icon: "led-strip-variant",
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
    icon: controller?.icon || "led-strip-variant",
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

  console.log("Sending scene to controllers");

  // Process each controller setting in the scene
  for (const setting of scene.settings) {
    try {
      const controllerId = setting.controller_id;
      let currentColor = {};

      // Get controller info with proper field names
      const controllerInfo = getControllerInfo(controllerId);
      console.log("Controller info:", controllerInfo);

      if (!controllerInfo || !controllerInfo.ip_address) {
        console.error(`No IP address found for controller ID: ${controllerId}`);
        continue; // Skip this controller and try the next one
      }

      // Use ip_address from the controller info
      const ipAddress = controllerInfo.ip_address;

      // Set color based on what's available in the settings
      if (setting.color?.hsv || setting.color?.raw) {
        console.log(`Setting color:`, setting.color);
        currentColor = { ...setting.color };
      } else if (setting.color?.Preset) {
        const presetId = setting.color.Preset.id;
        const preset = appData.data.presets?.find((p) => p.id === presetId);

        if (preset && preset.color) {
          currentColor = { ...preset.color };
        } else {
          console.warn(`Preset not found for ID: ${presetId}`);
          continue; // Skip this controller
        }
      }

      if (Object.keys(currentColor).length === 0) {
        console.warn("No color data to send");
        continue;
      }

      console.log("Sending", JSON.stringify(currentColor), "to", ipAddress);

      try {
        const response = await fetch(`http://${ipAddress}/color`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(currentColor),
        });

        if (!response.ok) {
          console.error(
            `Error sending color to ${ipAddress}: ${response.status}`,
          );
        } else {
          console.log(`Color successfully sent to ${ipAddress}`);
        }
      } catch (error) {
        console.error(`Network error sending color to ${ipAddress}:`, error);
      }
    } catch (error) {
      console.error("Error processing controller:", error);
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
};
