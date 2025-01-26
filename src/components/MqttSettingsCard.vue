<template>
  <MyCard icon="settings_outlined" title="MQTT Settings">
    <q-card-section>
      <div>
        MQTT settings require a restart to take effect. If changed, controller
        will restart automatically.
      </div>
      <div class="text-h7">
        <q-toggle
          v-model="mqttEnabled"
          label="enable MQTT"
          left-label
          @update:model-value="updateMqttEnabled"
        />
      </div>
    </q-card-section>

    <q-card-section v-if="mqttEnabled">
      <q-separator />
      <div class="row">
        <div class="col-4">
          <q-input
            v-model="mqttServer"
            label="MQTT Server"
            @blur="updateMqttServer"
          />
        </div>
        <div class="col-4">
          <q-input v-model="mqttPort" label="Port" @blur="updateMqttPort" />
        </div>
        <div class="col-4">
          <q-input
            v-model="mqttTopicBase"
            label="Topic"
            @blur="updateMqttTopicBase"
          />
        </div>
      </div>
      <q-input
        v-model="mqttUsername"
        label="MQTT Username"
        @blur="updateMqttUsername"
      />
      <q-input
        v-model="mqttPassword"
        filled
        :type="isPwd ? 'password' : 'text'"
        label="MQTT Password"
        hint="Password with toggle"
        @blur="updateMqttPassword"
      >
        <template #append>
          <q-icon
            :name="
              isPwd
                ? 'img:icons/visibility_off_outlined.svg'
                : 'img:icons/visibility-outlined-24.svg'
            "
            class="cursor-pointer"
            @click="isPwd = !isPwd"
          />
        </template>
      </q-input>
      <q-separator />

      <div>Controller is primary for</div>
      <q-toggle
        v-model="clockMasterEnabled"
        label="Clock"
        left-label
        @update:model-value="updateClockMasterEnabled"
      />
      <q-toggle
        v-model="cmdMasterEnabled"
        label="CMD"
        left-label
        @update:model-value="updateCmdMasterEnabled"
      />
      <q-toggle
        v-model="colorMasterEnabled"
        label="Color"
        left-label
        @update:model-value="updateColorMasterEnabled"
      />
      <q-separator />
      <div>Controller is secondary for</div>
      <q-toggle
        v-model="clockSlaveEnabled"
        label="Clock"
        left-label
        @update:model-value="updateClockSlaveEnabled"
      />
      <q-toggle
        v-model="cmdSlaveEnabled"
        label="CMD"
        left-label
        @update:model-value="updateCmdSlaveEnabled"
      />
      <q-toggle
        v-model="colorSlaveEnabled"
        label="Color"
        left-label
        @update:model-value="updateColorSlaveEnabled"
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

    const mqttEnabled = ref(configData.data.network.mqtt.enabled);
    const mqttServer = ref(configData.data.network.mqtt.server);
    const mqttPort = ref(configData.data.network.mqtt.port);
    const mqttTopicBase = ref(configData.data.network.mqtt.topic_base);
    const mqttUsername = ref(configData.data.network.mqtt.username);
    const mqttPassword = ref(configData.data.network.mqtt.password);
    const clockMasterEnabled = ref(configData.data.sync.clock_master_enabled);
    const cmdMasterEnabled = ref(configData.data.sync.cmd_master_enabled);
    const colorMasterEnabled = ref(configData.data.sync.color_master_enabled);
    const clockSlaveEnabled = ref(configData.data.sync.clock_slave_enabled);
    const cmdSlaveEnabled = ref(configData.data.sync.cmd_slave_enabled);
    const colorSlaveEnabled = ref(configData.data.sync.color_slave_enabled);

    const updateMqttEnabled = (value) => {
      configData.updateData("network.mqtt.enabled", value, true);
    };

    const updateMqttServer = () => {
      configData.updateData("network.mqtt.server", mqttServer.value, true);
    };

    const updateMqttPort = () => {
      configData.updateData("network.mqtt.port", mqttPort.value, true);
    };

    const updateMqttTopicBase = () => {
      configData.updateData(
        "network.mqtt.topic_base",
        mqttTopicBase.value,
        true,
      );
    };

    const updateMqttUsername = () => {
      configData.updateData("network.mqtt.username", mqttUsername.value, true);
    };

    const updateMqttPassword = () => {
      configData.updateData("network.mqtt.password", mqttPassword.value, true);
    };

    const updateClockMasterEnabled = (value) => {
      configData.updateData("sync.clock_master_enabled", value, true);
    };

    const updateCmdMasterEnabled = (value) => {
      configData.updateData("sync.cmd_master_enabled", value, true);
    };

    const updateColorMasterEnabled = (value) => {
      configData.updateData("sync.color_master_enabled", value, true);
    };

    const updateClockSlaveEnabled = (value) => {
      configData.updateData("sync.clock_slave_enabled", value, true);
    };

    const updateCmdSlaveEnabled = (value) => {
      configData.updateData("sync.cmd_slave_enabled", value, true);
    };

    const updateColorSlaveEnabled = (value) => {
      configData.updateData("sync.color_slave_enabled", value, true);
    };

    return {
      configData,
      isPwd,
      mqttEnabled,
      mqttServer,
      mqttPort,
      mqttTopicBase,
      mqttUsername,
      mqttPassword,
      clockMasterEnabled,
      cmdMasterEnabled,
      colorMasterEnabled,
      clockSlaveEnabled,
      cmdSlaveEnabled,
      colorSlaveEnabled,
      updateMqttEnabled,
      updateMqttServer,
      updateMqttPort,
      updateMqttTopicBase,
      updateMqttUsername,
      updateMqttPassword,
      updateClockMasterEnabled,
      updateCmdMasterEnabled,
      updateColorMasterEnabled,
      updateClockSlaveEnabled,
      updateCmdSlaveEnabled,
      updateColorSlaveEnabled,
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
