import { controllersStore, storeStatus } from "src/store/index.js";

const sysCmd = async (command, additionalBody = {}) => {
  const controllers = controllersStore();
  console.log(`Sending command: ${command}`);
  console.log("Additional body:", additionalBody);
  const body = JSON.stringify({ cmd: command, ...additionalBody });
  const response = await fetch(
    `http://${controllers.currentController.ip_address}/system`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: body,
    },
  );
  if (response.ok) {
    console.log(`Command ${command} executed successfully`);
  } else {
    console.log(`Failed to execute command: ${command}`);
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
  },

  stopAP: () => {
    sysCmd("stopap");
  },

  forgetWifi: () => {
    sysCmd("forget_wifi");
  },

  forgetWifiAndRestart: () => {
    sysCmd("forget_wifi_and_restart");
  },

  umountfs: () => {
    sysCmd("umountfs");
  },

  mountfs: () => {
    sysCmd("mountfs");
  },

  switchRom: () => {
    sysCmd("switch_rom");
  },

  debug: (enable) => {
    sysCmd("debug", enable.toString());
  },
};

export default systemCommand;
