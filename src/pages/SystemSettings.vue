<template>
  <div>
    <InformationCard />
    <FirmwareUpdateCard />
    <ControllerConfigCard />
  </div>
</template>

<script>
import { infoDataStore } from "src/stores/infoDataStore";
import InformationCard from "src/components/InformationCard.vue";
import FirmwareUpdateCard from "src/components/FirmwareUpdateCard.vue";
import ControllerConfigCard from "src/components/ControllerConfigCard.vue";

export default {
  components: {
    InformationCard,
    FirmwareUpdateCard,
    ControllerConfigCard,
  },
  setup() {
    const infoData = infoDataStore();

    return {
      infoData,
    };
  },
};
</script>
