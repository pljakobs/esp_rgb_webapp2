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
import { useConfigBinding } from "src/composables/useConfigDataBindings";
import MyCard from "src/components/myCard.vue";

export default {
  components: {
    MyCard,
  },
  setup() {
    const configData = configDataStore();
    const isPwd = ref(true);

    const { model: mqttEnabled, save: updateMqttEnabled } = useConfigBinding(
      configData,
      "network.mqtt.enabled",
      {
        fallback: false,
        persist: true,
      },
    );

    const { model: mqttServer, save: updateMqttServer } = useConfigBinding(
      configData,
      "network.mqtt.server",
      {
        fallback: "",
        persist: true,
      },
    );

    const { model: mqttPort, save: updateMqttPort } = useConfigBinding(
      configData,
      "network.mqtt.port",
      {
        fallback: 1883,
        persist: true,
      },
    );

    const { model: mqttTopicBase, save: updateMqttTopicBase } =
      useConfigBinding(configData, "network.mqtt.topic_base", {
        fallback: "",
        persist: true,
      });

    const { model: mqttUsername, save: updateMqttUsername } = useConfigBinding(
      configData,
      "network.mqtt.username",
      {
        fallback: "",
        persist: true,
      },
    );

    const { model: mqttPassword, save: updateMqttPassword } = useConfigBinding(
      configData,
      "network.mqtt.password",
      {
        fallback: "",
        persist: true,
      },
    );

    const { model: haEnabled, save: updateHaEnabled } = useConfigBinding(
      configData,
      "network.mqtt.homeassistant.enable",
      {
        fallback: false,
        persist: true,
      },
    );

    const { model: haDiscoveryPrefix, save: updateHaDiscoveryPrefix } =
      useConfigBinding(configData, "network.mqtt.homeassistant.discovery_prefix", {
        fallback: "",
        persist: true,
      });

    const { model: haNodeId, save: updateHaNodeId } = useConfigBinding(
      configData,
      "network.mqtt.homeassistant.node_id",
      {
        fallback: configData.data?.general?.device_name || "",
        persist: true,
      },
    );

    const { model: clockMasterEnabled, save: updateClockMasterEnabled } =
      useConfigBinding(configData, "sync.clock_master_enabled", {
        fallback: false,
        persist: true,
      });

    const { model: cmdMasterEnabled, save: updateCmdMasterEnabled } =
      useConfigBinding(configData, "sync.cmd_master_enabled", {
        fallback: false,
        persist: true,
      });

    const { model: colorMasterEnabled, save: updateColorMasterEnabled } =
      useConfigBinding(configData, "sync.color_master_enabled", {
        fallback: false,
        persist: true,
      });

    const { model: clockSlaveEnabled, save: updateClockSlaveEnabled } =
      useConfigBinding(configData, "sync.clock_slave_enabled", {
        fallback: false,
        persist: true,
      });

    const { model: cmdSlaveEnabled, save: updateCmdSlaveEnabled } =
      useConfigBinding(configData, "sync.cmd_slave_enabled", {
        fallback: false,
        persist: true,
      });

    const { model: colorSlaveEnabled, save: updateColorSlaveEnabled } =
      useConfigBinding(configData, "sync.color_slave_enabled", {
        fallback: false,
        persist: true,
      });

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
