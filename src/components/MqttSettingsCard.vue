<template>
  <MyCard icon="img:icons/settings_outlined.svg" title="MQTT Settings">
    <q-card-section>
      <div>
        MQTT settings require a restart to take effect. If changed, controller
        will restart automatically.
      </div>
      <div class="text-h7">
        <q-toggle
          v-model="configData.data.network.mqtt.enabled"
          label="enable MQTT"
          left-label
        />
      </div>
    </q-card-section>

    <q-card-section v-if="configData.data.network.mqtt.enabled">
      <q-separator />
      <div class="row">
        <div class="col-4">
          <q-input
            v-model="configData.data.network.mqtt.server"
            label="MQTT Server"
          />
        </div>
        <div class="col-4">
          <q-input v-model="configData.data.network.mqtt.port" label="Port" />
        </div>
        <div class="col-4">
          <q-input
            v-model="configData.data.network.mqtt.topic_base"
            label="Topic"
          />
        </div>
      </div>
      <q-input
        v-model="configData.data.network.mqtt.username"
        label="MQTT Username"
      />
      <q-input
        v-model="configData.data.network.mqtt.password"
        filled
        :type="isPwd ? 'password' : 'text'"
        hint="Password with toggle"
      >
        <template #append>
          <q-icon
            :name="isPwd ? 'visibility_off' : 'visibility'"
            class="cursor-pointer"
            @click="isPwd = !isPwd"
          />
        </template>
      </q-input>
      <q-separator />

      <div>Controller is primary for</div>
      <q-toggle
        v-model="configData.data.sync.clock_master_enabled"
        label="Clock"
        left-label
      />
      <q-toggle
        v-model="configData.data.sync.cmd_master_enabled"
        label="CMD"
        left-label
      />
      <q-toggle
        v-model="configData.data.sync.color_master_enabled"
        label="Color"
        left-label
      />
      <q-separator />
      <div>Controller is secondary for</div>
      <q-toggle
        v-model="configData.data.sync.clock_slave_enabled"
        label="Clock"
        left-label
      />
      <q-toggle
        v-model="configData.data.sync.cmd_slave_enabled"
        label="CMD"
        left-label
      />
      <q-toggle
        v-model="configData.data.sync.color_slave_enabled"
        label="Color"
        left-label
      />
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref } from "vue";
import { configDataStore } from "src/stores/configDataStore";
import MyCard from "src/components/myCard.vue";

export default {
  components: {
    MyCard,
  },
  setup() {
    const configData = configDataStore();
    const isPwd = ref(true);

    return {
      configData,
      isPwd,
    };
  },
};
</script>

<style scoped>
/* Add any necessary styles here */
</style>
