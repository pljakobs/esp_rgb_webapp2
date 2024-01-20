<template>
  <div>
    <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md">
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
              <q-item-section>
                <q-icon :name="getSignalIcon(props.opt.signal)" />
              </q-item-section>
              <q-item-section>
                {{ props.opt.ssid }}
              </q-item-section>
              <q-item-section>
                <q-icon :name="getEncryptionIcon(props.opt.encryption)" />
              </q-item-section>
            </q-item>
          </template>
        </q-select>

        <q-input
          filled
          v-model="selectedNetwork"
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
    </q-card>
  </div>
  <div v-if="wifiData.connected" class="popup">
    <h3>Connection Established</h3>
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
    const selectedNetwork = ref(null);
    const networks = ref([]);
    const password = ref("");
    const ssid = ref("");
    const ip_address = window.location.hostname;

    const { onJson, isOpen } = useWebSocket();

    watch(isOpen, (newIsOpen) => {
      if (newIsOpen) {
        console.log("registering wifi_connect callback");
        onJson("wifi_connected", (params) => {
          wifiData.value.connected = params.connected;
          wifiData.value.ssid = params.ssid;
          wifiData.value.dhcp = params.dhcp;
          wifiData.value.ip = params.ip;
          wifiData.value.netmask = params.netmask;
          wifiData.value.gateway = params.gateway;
          wifiData.value.mac = params.mac;
        });
      }
    });

    const connectToNetwork = async () => {
      console.log("Connecting to network:", ssid.value);
      console.log("Password:", password.value);

      const response = await fetch(`http://${ip_address}/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ssid: ssid.value,
          password: password.value,
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
        setTimeout(() => fetchNetworks(), 15000); // fetch networks ever 15s
      }
    };

    onMounted(() => {
      fetchNetworks();
    });

    const getSignalIcon = (signalStrength) => {
      if (signalStrength >= 75) {
        return "signal_wifi_4_bar";
      } else if (signalStrength >= 50) {
        return "signal_wifi_3_bar";
      } else if (signalStrength >= 25) {
        return "signal_wifi_2_bar";
      } else {
        return "signal_wifi_1_bar";
      }
    };

    const getEncryptionIcon = (encryption) => {
      switch (encryption) {
        case "WPA":
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
      connectToNetwork,
    };
  },
};
</script>
