<template>
  <div>
    <ConnectionCard />
    <HostnameCard />
    <IpSettingsCard />
    <MqttSettingsCard />
  </div>
</template>

<script>
import HostnameCard from "src/components/HostnameCard.vue";
import ConnectionCard from "src/components/ConnectionCard.vue";
import IpSettingsCard from "src/components/IpSettingsCard.vue";
import MqttSettingsCard from "src/components/MqttSettingsCard.vue";

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
