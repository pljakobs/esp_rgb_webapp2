<template>
  <MyCard icon="img:icons/wifi_outlined.svg" title="Connection">
    <q-card-section>
      <dataTable :items="connectionItems" />
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, watchEffect } from "vue";
import MyCard from "src/components/myCard.vue";
import dataTable from "src/components/dataTable.vue";
import { infoDataStore } from "src/stores/infoDataStore";
import { configDataStore } from "src/stores/configDataStore";
import { storeStatus } from "src/stores/storeConstants";

export default {
  components: {
    MyCard,
    dataTable,
  },
  setup() {
    const connectionItems = ref([]);

    const configData = configDataStore();
    const infoData = infoDataStore();

    watchEffect(() => {
      if (infoData.status === storeStatus.READY) {
        console.log("infoData.status", infoData.status);
        console.log("infoData.data", infoData.data);
        connectionItems.value = [
          { label: "SSID:", value: infoData.data.connection.ssid },
          { label: "MAC-Address:", value: infoData.data.connection.mac },
          {
            label: "DHCP:",
            value: infoData.data.connection.dhcp ? "yes" : "no",
          },
          { label: "IP-Address:", value: infoData.data.connection.ip },
          {
            label: "IP Netmask:",
            value: infoData.data.connection.netmask,
          },
          {
            label: "IP Gateway:",
            value: infoData.data.connection.gateway,
          },
        ];
      }
    });

    return {
      connectionItems,
      infoData,
      configData,
      storeStatus,
    };
  },
};
</script>

<style scoped>
.icon {
  color: var(--icon-color);
  fill: var(--icon-color);
}
</style>
