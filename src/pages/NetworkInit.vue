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
</template>

<script>
import { ref, onMounted, watch } from "vue";

export default {
  setup() {
    const selectedNetwork = ref(null);
    const networks = ref([]);
    const password = ref("");
    const ssid = ref("");
    const ip_address = window.location.hostname;

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
        console.log("Connected to network");
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

    return {
      selectedNetwork,
      networks,
      password,
      ssid,
      connectToNetwork,
    };
  },
};
</script>
