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

    <!-- MQTT Server Configuration -->
    <q-card-section v-if="mqttEnabled" class="q-pt-none">
      <q-separator class="q-mb-md" />
      <div class="text-h6 q-mb-md">MQTT Server Configuration</div>
      <div class="row q-gutter-md" style="max-width: 600px">
        <div style="width: 180px">
          <q-input
            v-model="mqttServer"
            label="MQTT Server"
            @blur="updateMqttServer"
          />
        </div>
        <div style="width: 100px">
          <q-input v-model="mqttPort" label="Port" @blur="updateMqttPort" />
        </div>
        <div style="width: 120px">
          <q-input
            v-model="mqttTopicBase"
            label="Topic"
            @blur="updateMqttTopicBase"
          />
        </div>
      </div>
      <div class="row q-gutter-md q-mt-sm" style="max-width: 500px">
        <div style="width: 180px">
          <q-input
            v-model="mqttUsername"
            label="MQTT Username"
            @blur="updateMqttUsername"
          />
        </div>
        <div style="width: 180px">
          <q-input
            v-model="mqttPassword"
            filled
            :type="isPwd ? 'password' : 'text'"
            label="MQTT Password"
            hint="Password with toggle"
            @blur="updateMqttPassword"
          >
            <template #append>
              <svgIcon
                :name="
                  isPwd ? 'visibility_off_outlined' : 'visibility-outlined-24'
                "
                class="cursor-pointer"
                size="20px"
                @click="isPwd = !isPwd"
              />
            </template>
          </q-input>
        </div>
      </div>
    </q-card-section>

    <!-- Home Assistant Integration -->
    <q-card-section v-if="mqttEnabled" class="q-pt-none">
      <q-separator class="q-mb-md" />
      <div class="text-h6 q-mb-md">Home Assistant Integration</div>
      <q-toggle
        v-model="haEnabled"
        label="Enable Home Assistant Integration"
        left-label
        @update:model-value="updateHaEnabled"
      />

      <div v-if="haEnabled" class="q-mt-sm">
        <div class="row q-gutter-md" style="max-width: 500px">
          <div style="width: 180px">
            <q-input
              v-model="haDiscoveryPrefix"
              label="Discovery Prefix"
              hint="MQTT discovery topic prefix"
              @blur="updateHaDiscoveryPrefix"
            />
          </div>
          <div style="width: 180px">
            <q-input
              v-model="haNodeId"
              label="Node ID"
              hint="Unique identifier for this device (defaults to controller name)"
              @blur="updateHaNodeId"
            />
          </div>
        </div>
      </div>
    </q-card-section>

    <!-- Synchronization -->
    <q-card-section v-if="mqttEnabled" class="q-pt-none">
      <q-separator class="q-mb-md" />
      <div class="text-h6 q-mb-md">Synchronization</div>

      <div class="sync-table-container">
        <!-- Header row -->
        <div class="sync-header row text-grey-7 text-caption text-uppercase">
          <div class="col-4"></div>
          <div class="col-4 text-center">Primary</div>
          <div class="col-4 text-center">Secondary</div>
        </div>

        <!-- Clock row -->
        <div class="sync-row row items-center">
          <div class="col-4 sync-label">Clock</div>
          <div class="col-4 text-center">
            <q-toggle
              v-model="clockMasterEnabled"
              size="sm"
              @update:model-value="updateClockMasterEnabled"
            />
          </div>
          <div class="col-4 text-center">
            <q-toggle
              v-model="clockSlaveEnabled"
              size="sm"
              @update:model-value="updateClockSlaveEnabled"
            />
          </div>
        </div>

        <!-- CMD row -->
        <div class="sync-row row items-center">
          <div class="col-4 sync-label">CMD</div>
          <div class="col-4 text-center">
            <q-toggle
              v-model="cmdMasterEnabled"
              size="sm"
              @update:model-value="updateCmdMasterEnabled"
            />
          </div>
          <div class="col-4 text-center">
            <q-toggle
              v-model="cmdSlaveEnabled"
              size="sm"
              @update:model-value="updateCmdSlaveEnabled"
            />
          </div>
        </div>

        <!-- Color row -->
        <div class="sync-row row items-center">
          <div class="col-4 sync-label">Color</div>
          <div class="col-4 text-center">
            <q-toggle
              v-model="colorMasterEnabled"
              size="sm"
              @update:model-value="updateColorMasterEnabled"
            />
          </div>
          <div class="col-4 text-center">
            <q-toggle
              v-model="colorSlaveEnabled"
              size="sm"
              @update:model-value="updateColorSlaveEnabled"
            />
          </div>
        </div>
      </div>
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

    // Home Assistant settings
    const haEnabled = ref(configData.data.network.mqtt.homeassistant.enable);
    const haDiscoveryPrefix = ref(
      configData.data.network.mqtt.homeassistant.discovery_prefix,
    );
    const haNodeId = ref(
      configData.data.network.mqtt.homeassistant.node_id ||
        configData.data.general.device_name,
    );

    // Sync settings
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

    // Home Assistant update functions
    const updateHaEnabled = (value) => {
      configData.updateData("network.mqtt.homeassistant.enable", value, true);
    };

    const updateHaDiscoveryPrefix = () => {
      configData.updateData(
        "network.mqtt.homeassistant.discovery_prefix",
        haDiscoveryPrefix.value,
        true,
      );
    };

    const updateHaNodeId = () => {
      configData.updateData(
        "network.mqtt.homeassistant.node_id",
        haNodeId.value,
        true,
      );
    };

    // Sync update functions
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
      haEnabled,
      haDiscoveryPrefix,
      haNodeId,
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
      updateHaEnabled,
      updateHaDiscoveryPrefix,
      updateHaNodeId,
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

/* Synchronization table styling to match dataTable */
.sync-table-container {
  max-width: 350px;
  padding: 0 5%;
}

.sync-header {
  padding: 8px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.2);
  margin-bottom: 4px;
}

.sync-row {
  padding: 8px 0;
  margin: 0;
  min-height: 40px;
}

.sync-row:nth-child(even) {
  background-color: var(--q-primary-2, rgba(25, 118, 210, 0.08));
}

.sync-row:nth-child(odd) {
  background-color: transparent;
}

.sync-label {
  font-size: 14px;
  font-weight: 400;
  padding-left: 8px;
}

/* Dark mode support */
.body--dark .sync-row:nth-child(even) {
  background-color: rgba(255, 255, 255, 0.05);
}
</style>
