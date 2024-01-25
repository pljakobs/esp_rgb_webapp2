const sysCmd = async (command, additionalBody = {}) => {
  console.log(`Sending command: ${command}`);
  console.log("Additional body:", additionalBody);
  const response = await fetch(`http://${ip_address}/system`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: body,
  });
  if (response.ok) {
    console.log(`Command ${command} executed successfully`);
  } else {
    console.log(`Failed to execute command: ${command}`);
  }
};

const systemCommand = {
  restartController: () => {
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
