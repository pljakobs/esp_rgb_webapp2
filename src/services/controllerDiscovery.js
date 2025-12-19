/**
 * Controller Discovery Service
 * Discovers ESP RGBWW controllers on the local network
 * Controllers advertise themselves via mDNS as "esprgbwwAPI._http._tcp.local"
 */

import { Preferences } from "@capacitor/preferences";
import { Network } from "@capacitor/network";

const STORAGE_KEY = "selected_controller";
const MDNS_SERVICE_TYPE = "_http._tcp"; // mDNS service type (without .local suffix)
const MDNS_SERVICE_NAME = "esprgbwwAPI"; // ESP RGBWW API service name
const MDNS_DOMAIN = "local."; // mDNS domain
const CONTROLLER_PORT = 80;

/**
 * Platform detection
 */
export const isNativeApp = () => {
  return window.Capacitor && window.Capacitor.isNativePlatform();
};

/**
 * Check if we're running in a web browser (served from controller)
 */
export const isWebApp = () => {
  return !isNativeApp() && window.location.hostname !== "localhost";
};

/**
 * Get the current controller connection info
 * - For web app: uses window.location.hostname
 * - For native app: retrieves from storage
 * - For development: uses localhost config
 */
export async function getCurrentController() {
  if (isWebApp()) {
    // Running as web app served from controller
    return {
      hostname: window.location.hostname,
      ip_address: window.location.hostname,
      source: "webapp",
    };
  }

  if (process.env.NODE_ENV === "development" && !isNativeApp()) {
    // Development mode (localhost)
    return {
      hostname: "localhost",
      ip_address: "192.168.29.31", // Default dev IP
      source: "development",
    };
  }

  // Native app - get from storage
  const stored = await Preferences.get({ key: STORAGE_KEY });
  if (stored.value) {
    try {
      return {
        ...JSON.parse(stored.value),
        source: "stored",
      };
    } catch (e) {
      console.error("Failed to parse stored controller:", e);
    }
  }

  return null;
}

/**
 * Save selected controller to storage
 */
export async function saveController(controller) {
  await Preferences.set({
    key: STORAGE_KEY,
    value: JSON.stringify({
      hostname: controller.hostname,
      ip_address: controller.ip_address,
      name: controller.name || controller.hostname,
    }),
  });
}

/**
 * Clear stored controller
 */
export async function clearStoredController() {
  await Preferences.remove({ key: STORAGE_KEY });
}

/**
 * Check network connectivity
 */
export async function checkNetworkStatus() {
  const status = await Network.getStatus();
  return {
    connected: status.connected,
    connectionType: status.connectionType,
  };
}

/**
 * Scan local network for controllers using native mDNS discovery
 */
export async function scanForControllers(options = {}) {
  const {
    timeout = 10000, // 10 seconds for mDNS discovery
    onProgress = null,
  } = options;

  const controllers = [];
  const networkStatus = await checkNetworkStatus();

  if (!networkStatus.connected) {
    throw new Error("No network connection");
  }

  // Try native mDNS discovery first (for native apps)
  if (isNativeApp()) {
    try {
      console.log("Starting native mDNS discovery for", MDNS_SERVICE_NAME);
      // Dynamically import Zeroconf
      const { Zeroconf } = await import("@devioarts/capacitor-mdns");

      // Watch for services
      await Zeroconf.watch({
        type: MDNS_SERVICE_TYPE,
        domain: MDNS_DOMAIN,
      });

      // Listen for service discoveries
      const listener = await Zeroconf.addListener(
        "serviceResolved",
        (result) => {
          console.log("mDNS service resolved:", result);
          // Check if this is an ESP RGBWW controller
          if (result.service?.name?.includes(MDNS_SERVICE_NAME)) {
            const controller = {
              ip_address:
                result.service.ipv4Addresses?.[0] ||
                result.service.addresses?.[0],
              hostname: result.service.hostname || result.service.name,
              name: result.service.txtRecord?.name || result.service.name,
              port: result.service.port || CONTROLLER_PORT,
              firmware: result.service.txtRecord?.version,
              id: result.service.txtRecord?.id,
              isEspRgbwwController: true,
            };
            // Only add if we have a valid IP
            if (controller.ip_address) {
              controllers.push(controller);
              if (onProgress) {
                onProgress({
                  found: controllers.length,
                  controller,
                });
              }
            }
          }
        },
      );

      // Start scanning
      await Zeroconf.scan({
        type: MDNS_SERVICE_TYPE,
        domain: MDNS_DOMAIN,
      });

      // Wait for discovery to complete
      await new Promise((resolve) => setTimeout(resolve, timeout));

      // Stop scanning and remove listener
      await Zeroconf.unwatch({
        type: MDNS_SERVICE_TYPE,
        domain: MDNS_DOMAIN,
      });

      if (listener) {
        listener.remove();
      }

      console.log(`mDNS discovery found ${controllers.length} controllers`);

      if (controllers.length > 0) {
        return controllers;
      }
    } catch (error) {
      console.warn(
        "Native mDNS discovery failed, falling back to IP scan:",
        error,
      );
    }
  }

  // Fallback: IP range scanning (for web or if mDNS fails)
  console.log("Falling back to IP range scanning");

  const commonPrefixes = [
    "192.168.1.",
    "192.168.0.",
    "192.168.29.",
    "10.0.0.",
    "10.0.1.",
  ];

  const scanPromises = [];

  for (const prefix of commonPrefixes) {
    for (let i = 1; i <= 50; i++) {
      const ip = `${prefix}${i}`;
      scanPromises.push(
        checkController(ip, 2000)
          .then((controller) => {
            if (controller) {
              controllers.push(controller);
              if (onProgress) {
                onProgress({
                  found: controllers.length,
                  ip,
                  controller,
                });
              }
            }
          })
          .catch(() => {
            // Ignore failures
          }),
      );
    }
  }

  await Promise.allSettled(scanPromises);

  return controllers;
}

/**
 * Check if a specific IP is an ESP RGBWW controller
 */
async function checkController(ip, timeout = 2000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`http://${ip}/info`, {
      signal: controller.signal,
      mode: "cors",
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();

      // Verify it's an ESP RGBWW controller by checking the expected structure
      if (data.general && data.general.device_name) {
        return {
          ip_address: ip,
          hostname: data.network?.mdns?.name || ip,
          name: data.general.device_name,
          firmware: data.firmware?.version,
          soc: data.general?.soc,
          isEspRgbwwController: true,
        };
      }
    }
  } catch (e) {
    // Not a controller or unreachable
  } finally {
    clearTimeout(timeoutId);
  }

  return null;
}

/**
 * Perform a quick check to see if the stored controller is still reachable
 */
export async function verifyController(controller, timeout = 2000) {
  if (!controller || !controller.ip_address) {
    return false;
  }

  const result = await checkController(controller.ip_address, timeout);
  return result !== null;
}

/**
 * Initialize controller discovery
 * Returns the controller to use, or null if discovery is needed
 */
export async function initializeControllerDiscovery() {
  // Web app - use current host
  if (isWebApp()) {
    return {
      hostname: window.location.hostname,
      ip_address: window.location.hostname,
      source: "webapp",
    };
  }

  // Development - use configured IP
  if (process.env.NODE_ENV === "development" && !isNativeApp()) {
    return {
      hostname: "localhost",
      ip_address: "192.168.29.31",
      source: "development",
    };
  }

  // Native app - check stored controller
  const stored = await getCurrentController();
  if (stored && stored.ip_address) {
    // Verify it's still reachable
    const isReachable = await verifyController(stored, 3000);
    if (isReachable) {
      return stored;
    }
    console.warn("Stored controller is no longer reachable");
  }

  // No controller available - need to discover
  return null;
}

export default {
  getCurrentController,
  saveController,
  clearStoredController,
  checkNetworkStatus,
  scanForControllers,
  verifyController,
  initializeControllerDiscovery,
  isNativeApp,
  isWebApp,
};
