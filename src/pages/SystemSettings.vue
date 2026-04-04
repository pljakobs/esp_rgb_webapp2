<template>
  <div class="system-settings-layout">
    <div class="info-column">
      <InformationCard :collapsed="false" />
    </div>
    <div class="cards-column">
      <FirmwareUpdateCard />
      <HostnameCard />
      <ControllerConfigCard />
      <SaveRestoreConfig />
      <DebugFunctionCard v-if="infoData.data?.app?.build_type === 'debug'" />
      <LogViewerCard v-if="infoData.data?.app?.build_type === 'debug'" />
    </div>
  </div>
</template>

<script>
import { infoDataStore } from "src/stores/infoDataStore";
import InformationCard from "src/components/cards/InformationCard.vue";
import FirmwareUpdateCard from "src/components/cards/FirmwareUpdateCard.vue";
import LogViewerCard from "src/components/cards/LogViewerCard.vue";
import ControllerConfigCard from "src/components/cards/ControllerConfigCard.vue";
import SaveRestoreConfig from "src/components/SaveRestoreConfig.vue";
import DebugFunctionCard from "src/components/cards/DebugFunctionCard.vue";
import HostnameCard from "src/components/cards/HostnameCard.vue";

export default {
  components: {
    InformationCard,
    FirmwareUpdateCard,
    ControllerConfigCard,
    DebugFunctionCard,
    SaveRestoreConfig,
    LogViewerCard,
    HostnameCard,
  },
  setup() {
    const infoData = infoDataStore();

    return {
      infoData,
    };
  },
};
</script>

<style scoped>
.system-settings-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-column,
.cards-column {
  width: 100%;
  min-width: 0;
}

.cards-column {
  display: grid;
  gap: 16px;
}

@media (min-width: 900px) {
  .system-settings-layout {
    display: grid;
    grid-template-columns: minmax(360px, 1fr) minmax(360px, 1fr);
    align-items: flex-start;
  }

  .info-column {
    position: sticky;
    top: 0;
  }
}
</style>
