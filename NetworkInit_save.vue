<template>
  <div>
    <q-card class="full-height shadow-4 col-auto fit q-gutter-md q-pa-md">
      <!--
      <q-card-section class="row justify-center">
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
      </q-card-section>
    -->
      <q-card-actions>
        <q-btn
          color="primary"
          label="Connect"
          @click="connectToNetwork"
          style="margin-top: 16px"
        />
        <q-btn
          color="secondary"
          label="forget wifi"
          @click="onForgetWifi"
          style="margin-top: 16px"
        />
        <q-btn
          color="secondary"
          label="show dialog"
          @click="doShowDialog"
          style="margin-top: 16px"
        />
        <q-btn
          color="secondary"
          label="hide dialog"
          @click="doHideDialog"
          style="margin-top: 16px"
        />
      </q-card-actions>
      <q-card-section>
        {{ showDialog }}
      </q-card-section>
    </q-card>
  </div>

  <q-dialog v-model="showDialog">
    <!--<q-card>

      <div v-if="wifiData.connected !== 'connected'">
        <q-card-section>
          <h4>Connecting to network</h4>
          {{ wifiData.message }}
          <q-spinner />
        </q-card-section>
      </div>
    </q-card>
    -->
    <q-card>
      <div v-if="!wifiData">
        <h4>no wifi data available (yet)</h4>
      </div>
    </q-card>
  </q-dialog>

  <!--
  </q-dialog>
  <q-dialog v-model="showDialog.value">
    <q-card>
      <q-card-section>
        <div class="popup">
          <div v-if="!wifidata.connected">
            <h4>Connecting to network</h4>
            {{ wifiData.message }}
            <q-spinner />
          </div>
          <div v-if="connectionError">
            <h4>Connection Failed</h4>
            <p>{{ connectionErrorMessage }}</p>
            <q-btn
              color="secondary"
              label="Ok"
              @click="onOk"
              style="margin-top: 16px"
            />
          </div>
          <div v-if="wifidata.connected">
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
          </div>
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
  -->
</template>

<script>
import { ref, onMounted, watch } from "vue";
import useWebSocket from "src/services/websocket.js";
import { controllersStore, storeStatus } from "src/store/index.js";
import systemCommand from "src/services/systemCommands.js";

export default {
  setup() {
    const controllers = controllersStore();
    const wifiData = ref({
      connected: false,
      message: "",
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
    const wifiConfigured = ref(false);
    const connectionError = ref(false);
    const connectionErrorMessage = ref("");

    const showDialog = ref(false);

    const { onJson, isOpen } = useWebSocket();

    /**
     * @brief registers relevant callbacks.
     *
     * This function watches the "isOpen" variable and when it becomes true, it registers the status callback
     * by calling the "registerWebSocketCallback" function.
     */
    watch(isOpen, (newIsOpen) => {
      if (newIsOpen) {
        console.log("registering status callback");
        registerWebSocketCallback();
      }
    });

    /**
     * Watches the wifiData object for changes and performs actions when the device is connected to the network.
     * Starts a countdown from 10 seconds and restarts the controller after the countdown reaches 0.
     * Redirects the user to the device's IP address after a delay of 3.5 seconds.
     * @param {Object} wifiData - The wifiData object containing information about the network connection.
     */

    watch(wifiData, (newWifiData) => {
      if (newWifiData.connected) {
        countdown.value = 10; // Start countdown from 10 seconds
        const countdownInterval = setInterval(() => {
          countdown.value--;
          if (countdown.value <= 0) {
            sysCmd("restart"); // Restart the controller, this will be a delayed command, so it will take ~2.5 seconds to restart
            clearInterval(countdownInterval);
            setTimeout(() => {
              window.location.href = "http://" + newWifiData.ip;
            }, 3500);
          }
        }, 1000);
      }
    });

    /**
     * @brief Registers a WebSocket callback to update the WiFi status.
     *
     * This function registers a WebSocket callback on "wifi_satus" that updates the local WiFi status based on the data received from the controller .
     * It updates the `wifiData` object with the connected status, SSID, DHCP status, IP address, netmask, gateway, MAC address, and message.
     * If the WiFi is connected, it sets `wifiConfigured` to true and `connectionError` to false.
     * If the WiFi is not connected, it sets `connectionError` to true and `connectionErrorMessage` to the received message.
     */
    const registerWebSocketCallback = () => {
      //wifiData.value.connected = params.station.connected;
      onJson("wifi_status", (params) => {
        wifiData.value.connected = params.station.connected;
        wifiData.value.ssid = params.station.ssid;
        wifiData.value.dhcp = params.station.dhcp;
        wifiData.value.ip = params.station.ip;
        wifiData.value.netmask = params.station.netmask;
        wifiData.value.gateway = params.station.gateway;
        wifiData.value.mac = params.station.mac;
        wifiData.value.message = params.message;

        if (wifiData.value.connected) {
          wifiConfigured.value = true;
          connectionError.value = false;
        } else {
          connectionError.value = true;
          connectionErrorMessage.value = params.message;
        }
      });
    };

    const doShowDialog = () => {
      showDialog.value = true;
      console.log("showDialog (showing)", showDialog.value);
    };

    const doHideDialog = () => {
      showDialog.value = false;
      console.log("showDialog (hiding)", showDialog.value);
    };

    const onRestartController = () => {
      systemCommand.restController;
    };

    const onForgetWifi = () => {
      systemCommand.forgetWifi;
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
      const response = await fetch(
        `http://${controllers.currentController.ip_address}/connect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ssid: new_ssid,
            password: new_password,
          }),
        },
      );

      if (response.ok) {
        console.log("connecting to network");
        wifiConfigured.value = true;
      } else {
        console.log("Failed to connect to network");
        connectionError.value = true;
        connectionErrorMessage.value = "Failed to connect to network";
      }
    };

    const onOk = () => {
      connectionError.value = false;
      connectionErrorMessage.value = "";
      wifiConfigured.value = false;
    };

    watch(selectedNetwork, (newVal) => {
      ssid.value = newVal;
    });

    const fetchNetworks = async (retryCount = 0) => {
      try {
        if (controllers.currentController.ip_address !== null) {
          console.log("fetching networks");
          // step 1: get the list of available networks
          let response = await fetch(
            `http://${controllers.currentController.ip_address}/networks`,
            {
              method: "GET",
            },
          );
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
          response = await fetch(
            `http://${controllers.currentController.ip_address}/scan_networks`,
            {
              method: "POST",
            },
          );
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
      ...wifiData,
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
      //wifiConfigured,
      //connectionError,
      //connectionErrorMessage,
      //onOk,
      showDialog,
      doShowDialog,
      doHideDialog,
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
