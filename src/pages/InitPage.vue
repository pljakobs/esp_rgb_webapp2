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
        </div>
      </div>
    </div>
  </q-page>
</template>

<script>
import { ref, onMounted } from "vue";

export default {
  setup() {
    const networks = ref(null);

    const ip_address = window.location.hostname;
    console.log("ip address:", ip_address);

    const fetchNetworks = async () => {
      // step 1: scan for available  wifi networks
      let response = await fetch(`http://${ip_address}/scan_networks`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      //step 2: get the list of available networks
      response = await fetch(`http://${ip_address}/networks`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      networks.value = await response.json();
    };

    onMounted(fetchNetworks);

    return { networks };
  },
};
</script>
