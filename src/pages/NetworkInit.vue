<template>
  <div>
    <MyCard class="full-height">
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
              <q-item-section style="flex: 1">
                <q-icon
                  class="network-icon-class"
                  :name="getSignalIcon(props.opt.signal, props.opt.encryption)"
                />
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
        <transition name="shake" mode="out-in">
          <q-input
            :class="{ shake: wifiData.message === 'Wrong password' }"
            filled
            v-model="password"
            label="Password"
            type="password"
            hint="Enter the password for the network"
            style="width: 80%"
          />
        </transition>
        {{ wifiData.message }}
        <div v-if="wifiData.message === 'Wrong password'">
          <p>password authentication failed, please try again</p>
        </div>
        <div v-if="wifiData.message === 'AP not found.'">
          <p>
            Accesspoint {{ wifiData.ssid }} could not be found, please try again
          </p>
        </div>
      </q-card-section>
      <!--<div v-if="wifiData.message !== ''">-->
      <div>
        <q-card-section>
          {{ wifiData.message }}
          <div v-if="wifiData.message === 'Connecting to network'">
            {{ wifiData.message }} <q-spinner />
          </div>
          <div v-if="wifiData.connected">
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
        </q-card-section>
      </div>

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
          @click="forgetWifi"
          style="margin-top: 16px"
        />
        <q-btn
          color="secondary"
          label="show dialog"
          @click="sh < owDialog"
          style="margin-top: 16px"
        />
        <q-btn
          color="secondary"
          label="hide dialog"
          @click="hideDialog"
          style="margin-top: 16px"
        />
      </q-card-actions>
    </MyCard>
    <MyCard class="full-height">
      <q-card-section>
        <div class="text-h6">Wifi Data</div>
      </q-card-section>
      <q-card-section>
        <div>Connected:{{ wifiData.connected }}</div>
        messages:
        <div v-for="(msg, index) in log" :key="index">- {{ msg }}</div>
      </q-card-section>
    </MyCard>
  </div>
  <!--
  <q-dialog v-model=false>
    <q-card class="shadow-4 col-auto fit q-gutter-md q-pa-md">
      <div v-if="!wifiData.connected">
        <h4>Connecting to network</h4>
        {{ wifiData.message }}
        <q-spinner />
      </div>
      <div v-if="wifiData.connected">
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
    </q-card>
  </q-dialog>
--></template>

<script>
import { ref, onMounted, watch, watchEffect } from "vue";
import useWebSocket, { wsStatus } from "../services/websocket";

import { controllersStore } from "src/stores/controllersStore.js";
import { infoDataStore } from "src/stores/infoDataStore.js";
import { storeStatus } from "src/stores/storeConstants";

import systemCommand from "src/services/systemCommands.js";

import MyCard from "src/components/myCard.vue";

export default {
  components: {
    MyCard,
  },
  setup() {
    const controllers = controllersStore();
    const infoData = infoDataStore();
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

    const Dialog = ref(false);
    const maxRetries = 5;
    const retryDelay = 1000;
    const ws = useWebSocket();
    const log = ref([]);

    /**

     */
    const registerWebSocketCallback = () => {
      //wifiData.value.connected = params.station.connected;
      console.log("registerWebSocketCallback");
      ws.onJson("wifi_status", (params) => {
        console.log(
          "==> websocket: wifi_status",
          JSON.stringify(params, null, 2),
        );
        wifiData.value.connected = params.station.connected;
        wifiData.value.ssid = params.station.ssid;
        wifiData.value.dhcp = params.station.dhcp;
        wifiData.value.ip = params.station.ip;
        wifiData.value.netmask = params.station.netmask;
        wifiData.value.gateway = params.station.gateway;
        wifiData.value.mac = params.station.mac;
        wifiData.value.message = params.message;

        if (wifiData.value.connected) {
          wifiData.value.configured = true;
          wifiData.value.error = false;
          wifiData.value.errorMessage = "";
        } else {
          wifiData.value.configured = false;
          wifiData.value.error = false;
          wifiData.value.errorMessage = "";
        }

        console.log("message: ", params.message);
        if (params.message === "Wrong password") {
          Dialog.value = false;
        }

        console.log("wifiData", JSON.stringify(wifiData));
      });
    };

    /**
     * Function to show the dialog.
     */
    const showDialog = () => {
      Dialog.value = true;
      console.log("Dialog (showing)", Dialog.value);
    };

    watch(wifiData.value.message, (newMessage) => {
      console.log("wifiData.message", newMessage);
    });

    /**
     * Function to hide the dialog.
     */
    const hideDialog = () => {
      Dialog.value = false;
      console.log("Dialog (hiding)", Dialog.value);
    };

    watch(Dialog, (newShowDialog) => {
      console.log("Dialog (watch)", newShowDialog);
    });
    /**
     * Function to restart the controller.
     */
    const restartController = () => {
      systemCommand.restartController();
    };

    /**
     * Function to forget the WiFi network.
     */
    const forgetWifi = () => {
      systemCommand.forgetWifi();
    };

    const connectToNetwork = async () => {
      console.log(
        "selectedNetwork.value",
        JSON.stringify(selectedNetwork.value),
      );
      Dialog.value = true;
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
        log.value.push("connecting to network");
        wifiData.value.message = "Connecting to network";
        Dialog.value = true;
      } else {
        console.log("Failed to connect to network");
        log.value.push("Failed to connect to network");
        wifiData.value.connected = false;
        wifiData.value.message = "Failed to initiate connection";
        log.value.push("Failed to initiate connection");
        Dialog.value = true;
      }
    };

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

    const updateWifiData = () => {
      console.log("==== updateWifiData");
      //console.log("== infoData", JSON.stringify(infoData));
      if (infoData.storeStatus == storeStatus.LOADED) {
        console.log("populating wifiData");
        log.value.push("populating wifiData");
        wifiData.value.connected = infoData.data.connection.connected;
        wifiData.value.ssid = infoData.data.connection.ssid;
        wifiData.value.dhcp = infoData.data.connection.dhcp;
        wifiData.value.ip = infoData.data.connection.ip;
        wifiData.value.netmask = infoData.data.connection.netmask;
        wifiData.value.gateway = infoData.data.connection.gateway;
        wifiData.value.mac = infoData.data.connection.mac;
        wifiData.value.message = "";
        console.log("===>wifiData", wifiData.value.ssid);
      } else {
        console.log("==== creating empty wifiData structure");
        log.value.push("creating empty wifiData structure");
        wifiData.value.connected = "";
        wifiData.value.ssid = "";
        wifiData.value.dhcp = "";
        wifiData.value.ip = "";
        wifiData.value.netmask = "";
        wifiData.value.gateway = "";
        wifiData.value.mac = "";
        wifiData.value.message = "";
      }
    };

    onMounted(() => {
      console.log("onMounted NetworkInit, fetching Networks");
      fetchNetworks();
      console.log("onMounted registering callback");
      registerWebSocketCallback();
      console.log("onMounted updating wifiData");
      updateWifiData();
    });

    const getSignalIcon = (signalStrength, encryption) => {
      switch (encryption) {
        case "WPA":
        case "WPA2_PSK":
        case "WPA_WPA2_PSK": {
          if (signalStrength >= -50) {
            return "img:icons/network_wifi_locked_FILL0_wght400_GRAD0_opsz24.svg";
          } else if (signalStrength >= -65) {
            return "img:icons/network_wifi_3_bar_locked_FILL0_wght400_GRAD0_opsz24.svg";
          } else if (signalStrength >= -750) {
            return "img:icons/network_wifi_2_bar_locked_FILL0_wght400_GRAD0_opsz24.svg";
          } else if (signalStrength >= -90) {
            return "img:icons/network_wifi_1_bar_locked_FILL0_wght400_GRAD0_opsz24.svg";
          } else {
            return "img:icons/signal_wifi_statusbar_null_FILL0_wght400_GRAD0_opsz24.svg";
          }
        }
        default: {
          if (signalStrength >= -50) {
            return "img:icons/network_wifi_FILL0_wght400_GRAD0_opsz24.svg";
          } else if (signalStrength >= -65) {
            return "img:icons/network_wifi_3_bar_FILL0_wght400_GRAD0_opsz24.svg";
          } else if (signalStrength >= -750) {
            return "img:icons/network_wifi_2_bar_FILL0_wght400_GRAD0_opsz24.svg";
          } else if (signalStrength >= -90) {
            return "img:icons/network_wifi_1_bar_FILL0_wght400_GRAD0_opsz24.svg";
          } else {
            return "img:icons/signal_wifi_statusbar_null_FILL0_wght400_GRAD0_opsz24.svg";
          }
        }
      }
    };
    /**
     * Watches the wifiData object for changes and performs actions when the device is connected to the network.
     * Starts a countdown from 10 seconds and restarts the controller after the countdown reaches 0.
     * Redirects the user to the device's IP address after a delay of 3.5 seconds.
     * @param {Object} wifiData - The wifiData object containing information about the network connection.
     */
    watch(
      () => wifiData.value.message,
      (newVal, oldVal) => {
        log.value.push(newVal);
        if (
          oldVal === "Connecting to WiFi" &&
          newVal === "Connected to WiFi" &&
          Dialog
        ) {
          console.log("Connected to network, stopping access point");
          setTimeout(() => {
            systemCommand.restartController(); // Restart the controller, this will be a delayed command, so it will take ~2.5 seconds to restart
            console.log("controller restart initiated");
            let retryCount = 0;
            setTimeout(() => {
              const reconnectInterval = setInterval(() => {
                if (retryCount >= 15) {
                  clearInterval(reconnectInterval);
                  console.log("Max retry limit reached");
                  return;
                }
                fetch(`http://${wifiData.value.ip}`, { method: "OPTIONS" })
                  .then((response) => {
                    if (response.ok) {
                      clearInterval(reconnectInterval);
                      console.log(
                        "controller responded on new ip, redirecting to new ip",
                      );
                      window.location.href = `http://${wifiData.value.ip}/`;
                    }
                  })
                  .catch((error) => {
                    console.error("Error:", error);
                  });
                retryCount++;
              }, 2500);
            }, 5000);
          }, 1000);
        }
      },
    );

    return {
      wifiData,
      selectedNetwork,
      networks,
      password,
      ssid,
      getSignalIcon,
      restartController,
      forgetWifi,
      connectToNetwork,
      Dialog,
      showDialog,
      hideDialog,
      countdown,
      log,
    };
  },
};
</script>
<style scoped>
.icon-wrapper {
  width: 24px; /* Adjust this value as needed */
  text-align: center;
}
.shake {
  animation: shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  perspective: 1000px;
}
.network-icon-class {
  width: 1.5em;
  height: 1.5em;
}
@keyframes shake {
  10%,
  90% {
    transform: translate3d(-1px, 0, 0);
  }

  20%,
  80% {
    transform: translate3d(2px, 0, 0);
  }

  30%,
  50%,
  70% {
    transform: translate3d(-4px, 0, 0);
  }

  40%,
  60% {
    transform: translate3d(4px, 0, 0);
  }
}
</style>
