<template>
  <div
    v-if="
      infoData.status === storeStatus.LOADING ||
      configData.status === storeStatus.LOADING
    "
  >
    <q-spinner />
  </div>
  <div
    v-if="
      infoData.status === storeStatus.READY &&
      configData.status === storeStatus.READY
    "
  >
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
      <q-card-section v-if="!configData.network.connection.dhcp.value">
        <q-input
          v-model="configData.network.connection.ip.value"
          label="IP Address"
        />
        <q-input
          v-model="configData.network.connection.netmask.value"
          label="IP Netmask"
        />
        <q-input
          v-model="configData.network.connection.gateway.value"
          label="IP Gateway"
        />
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
            v-model="configData.network.mqtt.enabled.value"
            label="enable MQTT"
            left-label
          />
          {{ configData.network.mqtt.enabled.value }}
        </div>
      </q-card-section>

      <q-card-section v-if="configData.network.mqtt.enabled.value">
        <q-separator />
        <q-row>
          <q-col cols="4">
            <q-input
              v-model="configData.network.mqtt.server.value"
              label="MQTT Server"
            />
          </q-col>
          <q-col cols="3">
            <q-input
              v-model="configData.network.mqtt.port.value"
              label="Port"
            />
          </q-col>
          <q-col cols="5">
            <q-input
              v-model="configData.network.mqtt.topic_base.value"
              label="Topic"
            />
          </q-col>
        </q-row>
        <q-input
          v-model="configData.network.mqtt.username.value"
          label="MQTT Username"
        />
        <q-input
          v-model="configData.network.mqtt.password.value"
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
          v-model="configData.sync.clock_master_enabled.value"
          label="Clock"
          left-label
        />
        <q-toggle
          v-model="configData.sync.cmd_master_enabled.value"
          label="CMD"
          left-label
        />
        <q-toggle
          v-model="configData.sync.color_master_enabled.value"
          label="Color"
          left-label
        />
        <q-separator />
        <div>Controller is secondary for</div>
        <q-toggle
          v-model="configData.sync.clock_slave_enabled.value"
          label="Clock"
          left-label
        />
        <q-toggle
          v-model="sync.cmd_slave_enabled.value"
          label="CMD"
          left-label
        />
        <q-toggle
          v-model="configData.sync.color_slave_enabled.value"
          label="Color"
          left-label
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script>
import dataTable from "components/dataTable.vue";
import { ref } from "vue";
import { configDataStore, infoDataStore, storeStatus } from "src/store";

export default {
  components: {
    dataTable,
  },
  setup() {
    const configData = configDataStore();
    const infoData = infoDataStore();

    const isPwd = ref(true);

    const connectionItems = [
      { label: "SSID:", value: infoData.connection.ssid },
      { label: "MAC-Address:", value: infoData.connection.mac },
      {
        label: "DHCP:",
        value: infoData.network.connection.dhcp ? "yes" : "no",
      },
      { label: "IP-Address:", value: configData.network.connection.ip },
      {
        label: "IP Netmask:",
        value: infoData.connection.netmask,
      },
      {
        label: "IP Gateway:",
        value: infoData.connection.gateway,
      },
    ];
    onMounted(async () => {
      await colorData.fetchData();
      console.log(colorData.state);
      isLoading.value = false;
    });
    onMounted(async () => {
      await colorData.fetchData();
      console.log(colorData.state);
      isLoading.value = false;
    });
    return {
      connectionItems,
      isPwd,
      infoDataStore,
      configData,
      storeStatus,
    };
  },
};
</script>
