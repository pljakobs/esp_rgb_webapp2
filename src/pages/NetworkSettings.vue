<template>
  <div>
    <ConnectionCard />
    <IpSettingsCard />
    <MqttSettingsCard />
  </div>
</template>

<script>
import ConnectionCard from "src/components/cards/ConnectionCard.vue";
import IpSettingsCard from "src/components/cards/IpSettingsCard.vue";
import MqttSettingsCard from "src/components/cards/MqttSettingsCard.vue";

export default {
  components: {
    ConnectionCard,
    IpSettingsCard,
    MqttSettingsCard,
  },
};
</script>

<style scoped>
/* Add any necessary styles here */
</style>
