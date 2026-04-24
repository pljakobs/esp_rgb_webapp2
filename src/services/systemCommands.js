import { useControllersStore } from "src/stores/controllersStore";
import initializeStores from "./initializeStores";
import { apiService } from "./api";

const sysCmd = async (cmd, data) => {
  const controllers = useControllersStore();
  console.log(`Sending command: ${cmd}`);
  console.log("Additional body:", data);
  if (!controllers.currentController) {
    const err = new Error("sysCmd: no current controller selected");
    console.error(err.message);
    throw err;
  }
  try {
    const { jsonData, error, status } = await apiService.systemCommand(
      { cmd, ...data },
      controllers.currentController,
    );

    if (error) {
      throw new Error(
        `System command failed${status ? ` (status: ${status})` : ""}: ${error.message || String(error)}`,
      );
    }

    const result = jsonData;
    console.log("Command result:", result);
    return result;
  } catch (error) {
    console.error("Error executing system command:", error);
    throw error;
  }
};

/**
 * Object representing system command API.
 * this just implements the systemCommand api of the firmware
 * be aware that all commands other than the debug one will be
 * executed with a 1.5s delay on the controller and thus cannot
 * be chained.
 *
 * @typedef {Object} systemCommand
 *  restartController - Restarts the controller.
 *  stopAP - Stops the access point.
 *  forgetWifi - Forgets the Wi-Fi network.
 *  forgetWifiAndRestart - Forgets the Wi-Fi network and restarts.
 *  umountfs - Unmounts the file system.
 *  mountfs - Mounts the file system.
 *  switchRom - Switches the ROM.
 *  debug - Enables or disables debugging.
 */
const systemCommand = {
  restartController: () => {
    console.log("this would restart the controller");
    sysCmd("restart");
    setTimeout(() => initializeStores({ force: true }), 5000);
  },

  stopAP: () => {
    sysCmd("stopap");
  },

  forgetWifi: () => {
    sysCmd("forget_wifi");
  },

  forgetWifiAndRestart: () => {
    sysCmd("forget_wifi_and_restart");
    setTimeout(() => initializeStores({ force: true }), 5000);
  },

  umountfs: () => {
    sysCmd("umountfs");
  },

  mountfs: () => {
    sysCmd("mountfs");
  },

  switchRom: () => {
    sysCmd("switch_rom");
    setTimeout(() => initializeStores({ force: true }), 5000);
  },
  debug: (enable) => {
    sysCmd("debug", { enable });
  },
  forgetControllers: () => {
    console.log("tell the controller to forget all other controllers");
    sysCmd("forget_controllers");
  },
};

export default systemCommand;
