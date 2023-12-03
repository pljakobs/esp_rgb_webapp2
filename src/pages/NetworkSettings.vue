<template>
  <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md">
    <q-card-section>
      <div class="text-h6">
        <q-icon name="wifi" />
        Connection
      </div>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <dataTable :Items="connectionItems" />
    </q-card-section>
    <q-card-section>
      <div class="text-h6">IP Settings</div>
      <div>
        IP settings require a restart to take effect. If changed, controller
        will restart automatically.
      </div>
      <div class="text-h7">
        <q-toggle
          v-model="network.connection.dhcp.value"
          label="use dhcp"
          left-label
        />
      </div>
    </q-card-section>
    <q-card-section v-if="!network.connection.dhcp.value">
      <q-input v-model="network.connection.ip.value" label="IP Address" />
      <q-input v-model="network.connection.netmask.value" label="IP Netmask" />
      <q-input v-model="network.connection.gateway.value" label="IP Gateway" />
    </q-card-section>
  </q-card>
  <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md">
    <q-card-section>
      <div class="text-h6">MQTT Settings</div>
      <div>
        MQTT setings require a restart to take effect. If changed, controller
        will restart automatically
      </div>
      <div class="text-h7">
        <q-toggle
          v-model="network.mqtt.enabled.value"
          label="enable MQTT"
          left-label
        />
        {{ network.mqtt.enabled.value }}
      </div>
    </q-card-section>

    <q-card-section v-if="network.mqtt.enabled.value">
      <q-separator />
      <q-input v-model="network.mqtt.server.value" label="MQTT Server" />
      <q-input v-model="network.mqtt.port.value" label="MQTT Port" />

      <q-input v-model="network.mqtt.username.value" label="MQTT Username" />
      <q-input
        v-model="network.mqtt.password.value"
        filled
        :type="isPwd ? 'password' : 'text'"
        hint="Password with toggle"
      >
        <template v-slot:append>
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
        v-model="sync.clock_master_enabled.value"
        label="Clock"
        left-label
      />
      <q-toggle
        v-model="sync.cmd_master_enabled.value"
        label="CMD"
        left-label
      />
      <q-toggle
        v-model="sync.color_master_enabled.value"
        label="Color"
        left-label
      />
      <q-separator />
      <div>Controller is secondary for</div>
      <q-toggle
        v-model="sync.clock_slave_enabled.value"
        label="Clock"
        left-label
      />
      <q-toggle v-model="sync.cmd_slave_enabled.value" label="CMD" left-label />
      <q-toggle
        v-model="sync.color_slave_enabled.value"
        label="Color"
        left-label
      />
    </q-card-section>
  </q-card>
</template>

<script>
import dataTable from "components/dataTable.vue";
import { ref, watch, computed, onMounted, watchEffect } from "vue";
import { configDataStore, createComputedProperties } from "src/store";

export default {
  components: {
    dataTable,
  },
  setup() {
    const store = configDataStore();
    const isPwd = ref(true);
    const fields = [
      "network.connection.dhcp",
      "network.connection.ip",
      "network.connection.netmask",
      "network.connection.gateway",
      "ap.secured",
      "ap.password",
      "ap.ssid",
      "network.mqtt.enabled",
      "network.mqtt.server",
      "network.mqtt.port",
      "network.mqtt.username",
      "network.mqtt.password",
      "network.mqtt.topic_base",
      "security.api_secured",
      "sync.clock_master_enabled",
      "sync.clock_master_interval",
      "sync.clock_slave_enabled",
      "sync.clock_slave_topic",
      "sync.cmd_master_enabled",
      "sync.cmd_slave_enabled",
      "sync.cmd_slave_topic",
      "sync.color_master_enabled",
      "sync.color_master_interval_ms",
      "sync.color_slave_enabled",
      "sync.color_slave_topic",
    ];

    const computedProperties = createComputedProperties(store, fields);

    const connectionItems = [
      { label: "SSID:", value: "IoT" },
      { label: "IP-Address:", value: computedProperties.network.connection.ip },
      {
        label: "IP Netmask:",
        value: computedProperties.network.connection.netmask,
      },
      {
        label: "IP Gateway:",
        value: computedProperties.network.connection.gateway,
      },
    ];

    return {
      connectionItems,
      isPwd,
      ...computedProperties,
    };
  },
};
</script>
