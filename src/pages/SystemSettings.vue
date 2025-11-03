<template>
  <div>
    <InformationCard :collapsed="false" />
    <FirmwareUpdateCard />
    <HostnameCard />
    <ControllerConfigCard />
    <SaveRestoreConfig />
    <!--<DebugFunctionCard v-if="infoData.data.build_type === 'debug'" />-->
    <DebugFunctionCard />
    <LogViewerCard />
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
