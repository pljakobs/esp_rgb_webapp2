<template>
  <div>
    <q-card class="full-height shadow-4 col-auto fit q-gutter-md q-pa-md">
      <div class="row justify-center">
        <h4>application initialization</h4>
        <q-select
          filled
          v-model="selectedNetwork"
          :options="networks"
          :label="selectedNetwork ? 'Network selected' : 'Select a network'"
          hint="Select a network from the list"
          option-label="ssid"
          option-value="ssid"
          style="width: 80%"
        >
          <template v-slot:option="props">
            <q-item
              v-bind="props.itemProps"
              style="display: flex; justify-content: space-between; width: 100%"
            >
              <q-item-section style="flex: 7">
                {{ props.opt.ssid }}
              </q-item-section>
              <q-item-section style="flex: 2">
                {{ props.opt.signal }}
              </q-item-section>
              <q-item-section style="flex: 1">
                <q-icon :name="getEncryptionIcon(props.opt.encryption)" />
              </q-item-section>
            </q-item>
          </template>
        </q-select>

        <q-input
          filled
          v-model="selectedNetwork.ssid"
          :label="selectedNetwork ? 'SSID' : 'Enter SSID'"
          hint="Enter the SSID of the network"
          style="width: 80%"
        />

        <q-input
          filled
          v-model="password"
          label="Password"
          type="password"
          hint="Enter the password for the network"
          style="width: 80%"
        />

        <q-btn
          color="primary"
          label="Connect"
          @click="connectToNetwork"
          style="margin-top: 16px"
        />
      </div>
      <q-btn
        color="secondary"
        label="forget wifi"
        @click="onForgetWifi"
        style="margin-top: 16px"
      />
    </q-card>
  </div>
  <q-dialog v-model="wifiData.connected">
    <q-card>
      <q-card-section>
        <div class="popup">
          <h4>Connection Established</h4>
          <p>Connected to: {{ wifiData.ssid }}</p>
          <table>
            <tr>
              <td>Address</td>
              <td>
                <a :href="'http://' + wifiData.ip">{{ wifiData.ip }}</a>
              </td>
            </tr>
            <tr>
              <td>Netmask</td>
              <td>{{ wifiData.netmask }}</td>
            </tr>
            <tr>
              <td>Gateway</td>
              <td>{{ wifiData.gateway }}</td>
            </tr>
          </table>
          <p>Controller will restart in {{ countdown }} seconds</p>
          <q-btn
            color="secondary"
            label="restart now"
            @click="onRestartController"
            style="margin-top: 16px"
          />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, onMounted, watch } from "vue";
import useWebSocket from "src/services/websocket.js";

export default {
  setup() {
    const wifiData = ref({
      connected: false,
      ssid: null,
      dhcp: null,
      ip: null,
      netmask: null,
      gateway: null,
      mac: null,
    });
    const selectedNetwork = ref({ ssid: "", signal: 0, encryption: "" });
    const networks = ref([]);
    const password = ref("");
    const ssid = ref("");
    const countdown = ref(0);

    const ip_address =
      process.env.NODE_ENV === "development"
        ? "192.168.29.49"
        : window.location.hostname;
    const { onJson, isOpen } = useWebSocket();

    watch(isOpen, (newIsOpen) => {
      if (newIsOpen) {
        console.log("registering status callback");
        registerWebSocketCallback();
      }
    });

    watch(wifiData, (newWifiData) => {
      if (newWifiData.connected) {
        countdown.value = 10; // Start countdown from 10 seconds
        const countdownInterval = setInterval(() => {
          countdown.value--;
          if (countdown.value <= 0) {
            clearInterval(countdownInterval);
            setTimeout(() => {
              sysCmd("restart");
            }, 2000); // Wait for 2 seconds before restarting
            window.location.href = "http://" + newWifiData.ip;
          }
        }, 1000);
      }
    });

    const registerWebSocketCallback = () => {
      onJson("wifi_status", (params) => {
        wifiData.value.connected = params.station.connected;
        wifiData.value.ssid = params.station.ssid;
        wifiData.value.dhcp = params.station.dhcp;
        wifiData.value.ip = params.station.ip;
        wifiData.value.netmask = params.station.netmask;
        wifiData.value.gateway = params.station.gateway;
        wifiData.value.mac = params.station.mac;
      });
    };

    const onRestartController = () => {
      sysCmd("restart");
    };

    const onForgetWifi = () => {
      sysCmd("forget_wifi_and_restart");
    };

    const sysCmd = async (command) => {
      console.log(`Sending command: ${command}`);
      const body = JSON.stringify({ cmd: command });
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

    const connectToNetwork = async () => {
      console.log(
        "selectedNetwork.value",
        JSON.stringify(selectedNetwork.value),
      );
      console.log("Connecting to network:", selectedNetwork.value.ssid);
      console.log("Password:", password.value);

      const new_ssid = selectedNetwork.value.ssid;
      const new_password = password.value;
      const response = await fetch(`http://${ip_address}/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ssid: new_ssid,
          password: new_password,
        }),
      });

      if (response.ok) {
        console.log("connecting to network");
      } else {
        console.log("Failed to connect to network");
      }
    };

    watch(selectedNetwork, (newVal) => {
      ssid.value = newVal;
    });

    const fetchNetworks = async (retryCount = 0) => {
      try {
        if (ip_address !== null) {
          console.log("fetching networks");
          // step 1: get the list of available networks
          let response = await fetch(`http://${ip_address}/networks`, {
            method: "GET",
          });
          if (response.status === 429 && retryCount < maxRetries) {
            // Too many requests, retry after a delay
            console.log(
              `Request limit reached, retrying after ${
                retryDelay * 2 ** retryCount
              }ms...`,
            );
            setTimeout(
              () => fetchNetworks(retryCount + 1),
              retryDelay * 2 ** retryCount,
            );
            return;
          }
          let responseJson = await response.json();
          responseJson.available.sort((a, b) => {
            return b.signal - a.signal;
          });
          networks.value = responseJson["available"];
          console.log("networks", JSON.stringify(networks.value));

          // step 2: scan for available wifi networks
          response = await fetch(`http://${ip_address}/scan_networks`, {
            method: "POST",
          });
          if (response.status === 429 && retryCount < maxRetries) {
            // Too many requests, retry after a delay
            console.log(
              `Request limit reached, retrying after ${
                retryDelay * 2 ** retryCount
              }ms...`,
            );
            setTimeout(
              () => fetchNetworks(retryCount + 1),
              retryDelay * 2 ** retryCount,
            );
            return;
          }
        }
      } catch (error) {
        console.log("error fetching networks", error);
      } finally {
        setTimeout(() => fetchNetworks(), 30000); // fetch networks ever 15s
      }
    };

    onMounted(() => {
      fetchNetworks();
      if (isOpen) {
        registerWebSocketCallback();
      }
    });

    const getSignalIcon = (signalStrength) => {
      console.log(` strength: ${signalStrength}`);
      let icon;
      if (signalStrength >= -50) {
        icon = "signal_wifi_4_bar";
      } else if (signalStrength >= -65) {
        icon = "signal_wifi_3_bar";
      } else if (signalStrength >= -80) {
        icon = "signal_wifi_2_bar";
      } else if (signalStrength >= -90) {
        icon = "signal_wifi_1_bar";
      } else {
        icon = "signal_wifi_0_bar";
      }
      // Add '_round' to the icon name to use the filled version
      icon += "_round";
      console.log(`Icon: ${icon}`);
      return icon;
    };
    const getEncryptionIcon = (encryption) => {
      switch (encryption) {
        case "WPA":
        case "WPA2_PSK":
        case "WPA_WPA2_PSK":
          return "lock";
        case "WEP":
          return "lock_outline";
        default:
          return "lock_open";
      }
    };

    return {
      wifiData,
      selectedNetwork,
      networks,
      password,
      ssid,
      getEncryptionIcon,
      getSignalIcon,
      onRestartController,
      onForgetWifi,
      connectToNetwork,
      countdown,
    };
  },
};
</script>
<style scoped>
.icon-wrapper {
  width: 24px; /* Adjust this value as needed */
  text-align: center;
}
</style>
