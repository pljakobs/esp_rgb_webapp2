<template>
  <q-page padding>
    <div id="q-app" class="bg-blue-grey-2" style="min-height: 100vh">
      <div
        id="parent"
        class="fit row wrap justify-center items-start content-start"
      >
        <div
          class="col-xs-12 col-sm-5 col-md-5 col-lg-4 q-gutter-md"
          justify-center
        >
          application initialization
          <q-select
            filled
            v-model="selectedNetwork"
            :options="networks"
            label="Select a network"
            hint="Select a network from the list"
            option-label="ssid"
            option-value="ssid"
          />
          {{ JSON.stringify(networks, null, 2) }}
        </div>
      </div>
    </div>
  </q-page>
</template>

<script>
import { ref, onMounted } from "vue";

const maxRetries = 5; // Maximum number of retries
const retryDelay = 1000; // Delay for the first retry in milliseconds

export default {
  setup() {
    const networks = ref(null);

    const ip_address = window.location.hostname;
    console.log("ip address:", ip_address);

    const fetchNetworks = async (retryCount = 0) => {
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
        networks.value = await response.json();
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
        let responseJson = await response.json();
        responseJson.available.sort((a, b) => {
          return b.signal - a.signal;
        });
        networks.value = responseJson["available"];
        console.log("networks", JSON.stringify(networks.value));

        console.log("==> response.available:", responseJson.available);
      }
    };

    onMounted(() => {
      fetchNetworks();
      setInterval(fetchNetworks, 10000); // Re-run every 10 seconds
    });

    return { networks };
  },
};
</script>
