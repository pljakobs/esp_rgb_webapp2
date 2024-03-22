<template>
  <div>
    <MyCard>
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
            />
          </div>
          <div class="col-4">
            <q-input
              v-model="configData.data.network.connection.netmask"
              label="IP Netmask"
            />
          </div>
          <div class="col-4">
            <q-input
              v-model="configData.data.network.connection.gateway"
              label="IP Gateway"
            />
          </div>
        </div>
      </q-card-section>
    </MyCard>
    <MyCard>
      <q-card-section>
        <div class="text-h6">MQTT Settings</div>
        <div>
          MQTT setings require a restart to take effect. If changed, controller
          will restart automatically
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
  </div>
</template>

<script>
import { ref, watchEffect, watch } from "vue";
import { storeStatus } from "src/stores/storeConstants";
import { infoDataStore } from "src/stores/infoDataStore";
import { configDataStore } from "src/stores/configDataStore";

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

    const isPwd = ref(true);
    const connectionItems = ref([]);
    // add a watchEffect for when infoData.status goes out of storeStatus.READY again (e.g. when the connection is lost)

    watch(
      () => infoData.status,
      (newStatus, oldStatus) => {
        console.log("infoData.status changed from", oldStatus, "to", newStatus);
        console.log("infoData store content is now", infoData);
      },
    );
    /**
     * Watches for changes in the infoData status and updates the connectionItems value accordingly.
     * If the infoData status is READY, it populates the connectionItems array with the relevant connection information.
     * The connectionItems array contains objects with label-value pairs representing different connection properties.
     * The label represents the name of the property, and the value represents the corresponding value.
     * The connection properties include SSID, MAC Address, DHCP status, IP Address, IP Netmask, and IP Gateway.
     */
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

    return {
      connectionItems,
      isPwd,
      infoData,
      configData,
      storeStatus,
    };
  },
};
</script>
