<template>
  <div>
    <InformationCard />
    <FirmwareUpdateCard />
    <ControllerConfigCard />
    <DebugFunctionCard v-if="infoData.data.build_type === 'debug'" />
  </div>
</template>

<script>
import { infoDataStore } from "src/stores/infoDataStore";
import InformationCard from "src/components/InformationCard.vue";
import FirmwareUpdateCard from "src/components/FirmwareUpdateCard.vue";
import ControllerConfigCard from "src/components/ControllerConfigCard.vue";
import DebugFunctionCard from "src/components/DebugFunctionCard.vue";

export default {
  components: {
    InformationCard,
    FirmwareUpdateCard,
    ControllerConfigCard,
    DebugFunctionCard,
  },
  setup() {
    const infoData = infoDataStore();

    return {
      infoData,
    };
  },
};
</script>
