<template>
  <div>
    <ConnectionCard />
    <HostnameCard />
    <IpSettingsCard />
    <MqttSettingsCard />
  </div>
</template>

<script>
import HostnameCard from "src/components/cards/HostnameCard.vue";
import ConnectionCard from "src/components/cards/ConnectionCard.vue";
import IpSettingsCard from "src/components/cards/IpSettingsCard.vue";
import MqttSettingsCard from "src/components/cards/MqttSettingsCard.vue";

export default {
  components: {
    HostnameCard,
    ConnectionCard,
    IpSettingsCard,
    MqttSettingsCard,
  },
};
</script>

<style scoped>
/* Add any necessary styles here */
</style>
