<template>
  <MyCard title="System Information" icon="img:icons/info_outlined.svg">
    <q-card-section>
      <dataTable :items="systemInfoData" />
    </q-card-section>
  </MyCard>
</template>

<script>
import { computed } from "vue";
import { infoDataStore } from "src/stores/infoDataStore";
import dataTable from "components/dataTable.vue";
import MyCard from "src/components/myCard.vue";

export default {
  components: {
    MyCard,
    dataTable,
  },
  setup() {
    const infoData = infoDataStore();

    const systemInfoData = computed(() => {
      if (!infoData.data) {
        console.log("informationCard::systemInfoData - infoData store empty");
        return [];
      }
      return [
        { label: "Device ID", value: infoData.data.deviceid },
        { label: "Current ROM", value: infoData.data.current_rom },
        { label: "Git Version", value: infoData.data.git_version },
        { label: "Build Type", value: infoData.data["build_type"] },
        { label: "Git Date", value: infoData.data.git_date },
        { label: "Webapp Version", value: infoData.data.webapp_version },
        { label: "Sming Version", value: infoData.data.sming },
        { label: "Uptime", value: infoData.data.uptime },
        { label: "Heap Free", value: infoData.data.heap_free },
        { label: "SoC", value: infoData.data.soc },
      ];
    });

    return {
      systemInfoData,
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
