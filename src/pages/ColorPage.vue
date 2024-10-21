<template>
  <div>
    <MyCard>
      <q-card-section>
        <div class="text-h6">
          <q-icon :name="outlinedBadge" />
          Hostname
        </div>
        <q-input
          v-model="configData.data.general.device_name"
          label="Hostname"
          @blur="
            updateConfig(
              'general.device_name',
              configData.data.general.device_name,
            )
          "
        />
      </q-card-section>
    </MyCard>
    <MyCard>
      <q-card-section>
        <div class="text-h6">
          <q-icon :name="outlinedWifi" />
          Connection
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section>
        <dataTable :Items="connectionItems" />
      </q-card-section>
      <q-card-section>
        <div class="text-h6">
          <q-icon :name="outlinedSettings" />
          IP Settings
        </div>
        <div>
          IP settings require a restart to take effect. If changed, controller
          will restart automatically.
        </div>
        <div class="text-h7">
          <q-toggle
            v-model="configData.data.network.connection.dhcp"
            label="use dhcp"
            left-label
          />
        </div>
      </q-card-section>
      <q-card-section v-if="!configData.data.network.connection.dhcp">
        <div class="row">
          <div class="col-4">
            <q-input
              v-model="configData.data.network.connection.ip"
              label="IP Address"
              @blur="
                updateConfig(
                  'network.connection.ip',
                  configData.data.network.connection.ip,
                )
              "
            />
          </div>
          <div class="col-4">
            <q-input
              v-model="configData.data.network.connection.netmask"
              label="IP Netmask"
              @blur="
                updateConfig(
                  'network.connection.netmask',
                  configData.data.network.connection.netmask,
                )
              "
            />
          </div>
          <div class="col-4">
            <q-input
              v-model="configData.data.network.connection.gateway"
              label="IP Gateway"
              @blur="
                updateConfig(
                  'network.connection.gateway',
                  configData.data.network.connection.gateway,
                )
              "
            />
          </div>
        </div>
      </q-card-section>
    </MyCard>
    <MyCard>
      <q-card-section>
        <div class="text-h6">
          <q-icon :name="outlinedHub" />
          MQTT Settings
        </div>
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
          {{ configData.data.network.mqtt.enabled }}
        </div>
      </q-card-section>

      <q-card-section v-if="configData.data.network.mqtt.enabled">
        <q-separator />
        <div class="row">
          <div class="col-4">
            <q-input
              v-model="configData.data.network.mqtt.server"
              label="MQTT Server"
              @blur="
                updateConfig(
                  'network.mqtt.server',
                  configData.data.network.mqtt.server,
                )
              "
            />
          </div>
          <div class="col-4">
            <q-input
              v-model="configData.data.network.mqtt.port"
              label="Port"
              @blur="
                updateConfig(
                  'network.mqtt.port',
                  configData.data.network.mqtt.port,
                )
              "
            />
          </div>
          <div class="col-4">
            <q-input
              v-model="configData.data.network.mqtt.topic_base"
              label="Topic"
              @blur="
                updateConfig(
                  'network.mqtt.topic_base',
                  configData.data.network.mqtt.topic_base,
                )
              "
            />
          </div>
        </div>
        <q-input
          v-model="configData.data.network.mqtt.username"
          label="MQTT Username"
          @blur="
            updateConfig(
              'network.mqtt.username',
              configData.data.network.mqtt.username,
            )
          "
        />
        <q-input
          v-model="configData.data.network.mqtt.password"
          type="password"
          ,
          label="MQTT Password"
          @blur="
            updateConfig(
              'network.mqtt.password',
              configData.data.network.mqtt.password,
            )
          "
        >
          <template v-slot:append>
            <q-icon
              :name="hidePwd ? 'outlinedVisibilityOff' : 'outlinedVisibility'"
              class="cursor-pointer"
              @click="togglePasswordVisibility"
            />
          </template>
        </q-input>
        <q-separator />

        <div>Controller is primary for</div>
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-toggle
              v-model="configData.data.sync.clock_master_enabled"
              label="Clock"
              left-label
            />
          </div>
          <div class="col-6">
            <q-input
              v-model="clockMasterTopic"
              :placeholder="defaultClockMasterTopic"
              :disable="!configData.data.sync.clock_master_enabled"
              label="Clock Master Topic"
              @blur="updateConfig('sync.clock_master_topic', clockMasterTopic)"
            />
          </div>
        </div>
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-toggle
              v-model="configData.data.sync.cmd_master_enabled"
              label="CMD"
              left-label
            />
          </div>
          <div class="col-6">
            <q-input
              v-model="cmdMasterTopic"
              :placeholder="defaultCmdMasterTopic"
              :disable="!configData.data.sync.cmd_master_enabled"
              label="CMD Master Topic"
              @blur="updateConfig('sync.cmd_master_topic', cmdMasterTopic)"
            />
          </div>
        </div>
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-toggle
              v-model="configData.data.sync.color_master_enabled"
              label="Color"
              left-label
            />
          </div>
          <div class="col-6">
            <q-input
              v-model="colorMasterTopic"
              :placeholder="defaultColorMasterTopic"
              :disable="!configData.data.sync.color_master_enabled"
              label="Color Master Topic"
              @blur="updateConfig('sync.color_master_topic', colorMasterTopic)"
            />
          </div>
        </div>
        <q-separator />
        <div>Controller is secondary for</div>
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-toggle
              v-model="configData.data.sync.clock_slave_enabled"
              label="Clock"
              left-label
            />
          </div>
          <div class="col-6">
            <q-input
              v-model="clockSlaveTopic"
              :placeholder="defaultClockSlaveTopic"
              :disable="!configData.data.sync.clock_slave_enabled"
              label="Clock Slave Topic"
              @blur="updateConfig('sync.clock_slave_topic', clockSlaveTopic)"
            />
          </div>
        </div>
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-toggle
              v-model="configData.data.sync.cmd_slave_enabled"
              label="CMD"
              left-label
            />
          </div>
          <div class="col-6">
            <q-input
              v-model="cmdSlaveTopic"
              :placeholder="defaultCmdSlaveTopic"
              :disable="!configData.data.sync.cmd_slave_enabled"
              label="CMD Slave Topic"
              @blur="updateConfig('sync.cmd_slave_topic', cmdSlaveTopic)"
            />
          </div>
        </div>
        <div class="row q-col-gutter-md">
          <div class="col-6">
            <q-toggle
              v-model="configData.data.sync.color_slave_enabled"
              label="Color"
              left-label
            />
          </div>
          <div class="col-6">
            <q-input
              v-model="colorSlaveTopic"
              :placeholder="defaultColorSlaveTopic"
              :disable="!configData.data.sync.color_slave_enabled"
              label="Color Slave Topic"
              @blur="updateConfig('sync.color_slave_topic', colorSlaveTopic)"
            />
          </div>
        </div>
      </q-card-section>
    </MyCard>
  </div>
</template>

<script>
import { ref, computed, watch } from "vue";
import { configDataStore } from "src/stores/configDataStore";
import {
  outlinedWifi,
  outlinedHub,
  outlinedSettings,
  outlinedBadge,
  outlinedVisibility,
  outlinedVisibilityOff,
} from "@quasar/extras/material-icons-outlined";
import dataTable from "components/dataTable.vue";
import MyCard from "components/myCard.vue";

export default {
  components: {
    dataTable,
    MyCard,
  },
  setup() {
    const configData = configDataStore();
    const hidePwd = ref(true);

    const defaultClockMasterTopic = computed(() => {
      return `${configData.data.network.mqtt.topic_base}/${configData.data.general.device_name}/clock_master`;
    });
    const defaultCmdMasterTopic = computed(() => {
      return `${configData.data.network.mqtt.topic_base}/${configData.data.general.device_name}/cmd_master`;
    });
    const defaultColorMasterTopic = computed(() => {
      return `${configData.data.network.mqtt.topic_base}/${configData.data.general.device_name}/color_master`;
    });
    const defaultClockSlaveTopic = computed(() => {
      return `${configData.data.network.mqtt.topic_base}/${configData.data.general.device_name}/clock_slave`;
    });
    const defaultCmdSlaveTopic = computed(() => {
      return `${configData.data.network.mqtt.topic_base}/${configData.data.general.device_name}/cmd_slave`;
    });
    const defaultColorSlaveTopic = computed(() => {
      return `${configData.data.network.mqtt.topic_base}/${configData.data.general.device_name}/color_slave`;
    });

    const clockMasterTopic = ref(
      configData.data.sync.clock_master_topic || defaultClockMasterTopic.value,
    );
    const cmdMasterTopic = ref(
      configData.data.sync.cmd_master_topic || defaultCmdMasterTopic.value,
    );
    const colorMasterTopic = ref(
      configData.data.sync.color_master_topic || defaultColorMasterTopic.value,
    );
    const clockSlaveTopic = ref(
      configData.data.sync.clock_slave_topic || defaultClockSlaveTopic.value,
    );
    const cmdSlaveTopic = ref(
      configData.data.sync.cmd_slave_topic || defaultCmdSlaveTopic.value,
    );
    const colorSlaveTopic = ref(
      configData.data.sync.color_slave_topic || defaultColorSlaveTopic.value,
    );

    const updateConfig = (key, value) => {
      configData.updateData(key, value);
    };

    watch(
      () => configData.data.sync.clock_master_enabled,
      (newVal) => {
        if (!newVal) {
          clockMasterTopic.value = defaultClockMasterTopic.value;
        }
      },
    );

    watch(
      () => configData.data.sync.cmd_master_enabled,
      (newVal) => {
        if (!newVal) {
          cmdMasterTopic.value = defaultCmdMasterTopic.value;
        }
      },
    );

    watch(
      () => configData.data.sync.color_master_enabled,
      (newVal) => {
        if (!newVal) {
          colorMasterTopic.value = defaultColorMasterTopic.value;
        }
      },
    );

    watch(
      () => configData.data.sync.clock_slave_enabled,
      (newVal) => {
        if (!newVal) {
          clockSlaveTopic.value = defaultClockSlaveTopic.value;
        }
      },
    );

    watch(
      () => configData.data.sync.cmd_slave_enabled,
      (newVal) => {
        if (!newVal) {
          cmdSlaveTopic.value = defaultCmdSlaveTopic.value;
        }
      },
    );

    watch(
      () => configData.data.sync.color_slave_enabled,
      (newVal) => {
        if (!newVal) {
          colorSlaveTopic.value = defaultColorSlaveTopic.value;
        }
      },
    );

    const togglePasswordVisibility = () => {
      hidePwd.value = !hidePwd.value;
    };

    return {
      configData,
      hidePwd,
      defaultClockMasterTopic,
      defaultCmdMasterTopic,
      defaultColorMasterTopic,
      defaultClockSlaveTopic,
      defaultCmdSlaveTopic,
      defaultColorSlaveTopic,
      clockMasterTopic,
      cmdMasterTopic,
      colorMasterTopic,
      clockSlaveTopic,
      cmdSlaveTopic,
      colorSlaveTopic,
      togglePasswordVisibility,
      updateConfig,
    };
  },
};
</script>
