<template>
  <div>
    <ConnectionCard />
    <IpSettingsCard />
    <MqttSettingsCard />
    <RsyslogSettingsCard />
    <TelemetryCard />

  </div>
</template>

<script>
import ConnectionCard from "src/components/cards/ConnectionCard.vue";
import IpSettingsCard from "src/components/cards/IpSettingsCard.vue";
import MqttSettingsCard from "src/components/cards/MqttSettingsCard.vue";
import RsyslogSettingsCard from "src/components/cards/RsyslogSettingsCard.vue";
import TelemetryCard from "src/components/cards/TelemetryCard.vue";


export default {
  components: {
    ConnectionCard,
    IpSettingsCard,
    MqttSettingsCard,
    RsyslogSettingsCard,
    TelemetryCard,
  },
};
</script>

<style scoped>
/* Add any necessary styles here */
</style>
