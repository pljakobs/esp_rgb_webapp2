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
          filled
          :type="hidePwd ? 'password' : 'text'"
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
              v-if="hidePwd"
              :name="outlinedVisibility"
              class="cursor-pointer"
              @click="togglePasswordVisibility"
            />
            <q-icon
              v-else
              :name="outlinedVisibilityOff"
              class="cursor-pointer"
              @click="togglePasswordVisibility"
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
        <q-input
          v-model="clockMasterTopic"
          label="Clock Master Topic"
          readonly
        />
        <q-toggle
          v-model="configData.data.sync.cmd_master_enabled"
          label="CMD"
          left-label
        />
        <q-input v-model="cmdMasterTopic" label="CMD Master Topic" readonly />
        <q-toggle
          v-model="configData.data.sync.color_master_enabled"
          label="Color"
          left-label
        />
        <q-input
          v-model="colorMasterTopic"
          label="Color Master Topic"
          readonly
        />
        <q-separator />
        <div>Controller is secondary for</div>
        <q-toggle
          v-model="configData.data.sync.clock_slave_enabled"
          label="Clock"
          left-label
        />
        <q-input v-model="clockSlaveTopic" label="Clock Slave Topic" readonly />
        <q-toggle
          v-model="configData.data.sync.cmd_slave_enabled"
          label="CMD"
          left-label
        />
        <q-input v-model="cmdSlaveTopic" label="CMD Slave Topic" readonly />
        <q-toggle
          v-model="configData.data.sync.color_slave_enabled"
          label="Color"
          left-label
        />
        <q-input v-model="colorSlaveTopic" label="Color Slave Topic" readonly />
      </q-card-section>
    </MyCard>
  </div>
</template>

<script>
import { ref, watchEffect, watch, computed } from "vue";
import { storeStatus } from "src/stores/storeConstants";
import { infoDataStore } from "src/stores/infoDataStore";
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
    const infoData = infoDataStore();

    const hidePwd = ref(true);
    const connectionItems = ref([]);

    // Derived MQTT topics
    const clockMasterTopic = computed(() => {
      return `${configData.data.network.mqtt.topic_base}/${configData.data.general.device_name}/clock_master`;
    });
    const cmdMasterTopic = computed(() => {
      return `${configData.data.network.mqtt.topic_base}/${configData.data.general.device_name}/cmd_master`;
    });
    const colorMasterTopic = computed(() => {
      return `${configData.data.network.mqtt.topic_base}/${configData.data.general.device_name}/color_master`;
    });
    const clockSlaveTopic = computed(() => {
      return `${configData.data.network.mqtt.topic_base}/${configData.data.general.device_name}/clock_slave`;
    });
    const cmdSlaveTopic = computed(() => {
      return `${configData.data.network.mqtt.topic_base}/${configData.data.general.device_name}/cmd_slave`;
    });
    const colorSlaveTopic = computed(() => {
      return `${configData.data.network.mqtt.topic_base}/${configData.data.general.device_name}/color_slave`;
    });

    const togglePasswordVisibility = () => {
      hidePwd.value = !hidePwd.value;
    };
    // Watch for changes in the MQTT settings and update the configDataStore
    watch(
      () => configData.data.network.mqtt,
      (newMqttSettings) => {
        console.log("MQTT settings changed:", newMqttSettings);
        configData.updateData("network.mqtt", newMqttSettings);
      },
      { deep: true },
    );

    // Watch for changes in the sync settings and update the configDataStore
    watch(
      () => [
        configData.data.sync.clock_master_enabled,
        configData.data.sync.cmd_master_enabled,
        configData.data.sync.color_master_enabled,
        configData.data.sync.clock_slave_enabled,
        configData.data.sync.cmd_slave_enabled,
        configData.data.sync.color_slave_enabled,
      ],
      (newSyncSettings) => {
        console.log("Sync settings changed:", newSyncSettings);
        configData.updateData("sync", {
          clock_master_enabled: newSyncSettings[0],
          cmd_master_enabled: newSyncSettings[1],
          color_master_enabled: newSyncSettings[2],
          clock_slave_enabled: newSyncSettings[3],
          cmd_slave_enabled: newSyncSettings[4],
          color_slave_enabled: newSyncSettings[5],
        });
      },
      { deep: true },
    );

    // Watch for changes in the infoData status and log changes
    watch(
      () => infoData.status,
      (newStatus, oldStatus) => {
        console.log("infoData.status changed from", oldStatus, "to", newStatus);
        console.log("infoData store content is now", infoData);
      },
    );

    // Watch for changes in the infoData status and update connectionItems
    watchEffect(() => {
      if (infoData.status === storeStatus.READY) {
        console.log("infoData.status", infoData.status);
        console.log("infoData.data", infoData.data);
        connectionItems.value = [
          { label: "SSID:", value: infoData.data.connection.ssid },
          { label: "MAC-Address:", value: infoData.data.connection.mac },
          {
            label: "DHCP:",
            value: infoData.data.connection.dhcp ? "yes" : "no",
          },
          { label: "IP-Address:", value: infoData.data.connection.ip },
          {
            label: "IP Netmask:",
            value: infoData.data.connection.netmask,
          },
          {
            label: "IP Gateway:",
            value: infoData.data.connection.gateway,
          },
        ];
      }
    });

    // Function to update configDataStore
    const updateConfig = (key, value) => {
      configData.updateData(key, value);
    };

    return {
      connectionItems,
      hidePwd,
      infoData,
      configData,
      storeStatus,
      outlinedWifi,
      outlinedHub,
      outlinedSettings,
      outlinedBadge,
      outlinedVisibility,
      outlinedVisibilityOff,
      clockMasterTopic,
      cmdMasterTopic,
      colorMasterTopic,
      clockSlaveTopic,
      cmdSlaveTopic,
      colorSlaveTopic,
      updateConfig,
      togglePasswordVisibility,
    };
  },
};
</script>
