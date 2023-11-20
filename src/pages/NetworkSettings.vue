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
          v-model="useManualIPConfig"
          label="Manual IP configuration"
          left-label
        />
      </div>
    </q-card-section>
    <q-card-section v-if="useManualIPConfig === true">
      <q-input v-model="IPAddress" label="IP Address" />
      <q-input v-model="IPNetmask" label="IP Netmask" />
      <q-input v-model="IPGateway" label="IP Gateway" />
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
        <q-toggle v-model="useMQTT" label="enable MQTT" left-label />
      </div>
    </q-card-section>

    <q-card-section v-if="useMQTT === true">
      <q-separator />
      <q-input v-model="MQTTServer" label="MQTT Server" />
      <q-input v-model="MQTTPort" label="MQTT Port" />
      <q-toggle
        v-model="useMQTTAuth"
        label="Server requires Authentication"
        label-left
      />
      <div v-if="useMQTTAuth === true">
        <q-input v-model="MQTTUser" label="MQTT Username" />
        <q-input
          v-model="MQTTpassword"
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
      </div>
      <q-separator />
      <div>Controller is primary for</div>
      <q-toggle v-model="MQTTClockMaster" label="Clock" left-label />
      <q-toggle v-model="MQTTCmdMaster" label="CMD" left-label />
      <q-toggle v-model="MQTTColorMaster" label="Color" left-label />
      <q-separator />
      <div>Controller is secondary for</div>
      <q-toggle v-model="MQTTClockSlave" label="Clock" left-label />
      <q-toggle v-model="MQTTCmdSlave" label="CMD" left-label />
      <q-toggle v-model="MQTTColorSlave" label="Color" left-label />
    </q-card-section>
  </q-card>
</template>

<script>
import dataTable from "components/dataTable.vue";
import { ref } from "vue";
export default {
  components: {
    dataTable,
  },
  setup() {
    const useManualIPConfig = ref(false);
    const useMQTT = ref(false);
    const useMQTTAuth = ref(false);
    const MQTTClockMaster = ref(false);
    const MQTTClockSlave = ref(false);
    const MQTTCmdMaster = ref(false);
    const MQTTCmdSlave = ref(false);
    const MQTTColorMaster = ref(false);
    const MQTTColorSlave = ref(false);
    const connectionItems = [
      { label: "SSID:", value: "IoT" },
      { label: "IP-Address:", value: "192.168.29.186" },
      { label: "IP Netmask:", value: "255.255.255.0" },
      { label: "IP Gateway:", value: "192.168.29.1" },
      { label: "MAC Address:", value: "11:22:33:AA:BB:CC" },
    ];

    return {
      connectionItems,
      useManualIPConfig,
      useMQTT,
      useMQTTAuth,
      MQTTClockMaster,
      MQTTClockSlave,
      MQTTCmdMaster,
      MQTTCmdSlave,
      MQTTColorMaster,
      MQTTColorSlave,
    };
  },
};
</script>
