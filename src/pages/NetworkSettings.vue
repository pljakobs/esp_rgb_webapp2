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
          v-model="!configData.value.network.connection.dhcp"
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
      <!--
        "sync":{
          "clock_master_enabled":false,
          "clock_master_interval":30,
          "clock_slave_enabled":false,
          "clock_slave_topic":"home/led1/clock",
          "cmd_master_enabled":false,
          "cmd_slave_enabled":false,
          "cmd_slave_topic":"home/led1/command",
          "color_master_enabled":false,
          "color_master_interval_ms":0,
          "color_slave_enabled":false,
          "color_slave_topic":"home/led1/color"
        },"events":{"color_interval_ms":500,"color_mininterval_ms":500,"server_enabled":true,"transfin_interval_ms":1000}
      -->
      <div>Controller is primary for</div>
      <q-toggle
        v-model="configData.value.sync.clock_master_enabled"
        label="Clock"
        left-label
      />
      <q-toggle
        v-model="configData.value.sync.cmd_master_enabled"
        label="CMD"
        left-label
      />
      <q-toggle
        v-model="configData.value.sync.color_master_enabled"
        label="Color"
        left-label
      />
      <q-separator />
      <div>Controller is secondary for</div>
      <q-toggle
        v-model="configData.value.sync.clock_slave_enabled"
        label="Clock"
        left-label
      />
      <q-toggle
        v-model="configData.value.sync.cmd_slave_enabled"
        label="CMD"
        left-label
      />
      <q-toggle
        v-model="configData.value.sync.color_slave_enabled"
        label="Color"
        left-label
      />
    </q-card-section>
  </q-card>
</template>

<script>
import dataTable from "components/dataTable.vue";
import { ref, watch, computed, onMounted, watchEffect } from "vue";
import { useStore } from "vuex"; // Import useStore from vuex

export default {
  components: {
    dataTable,
  },
  setup() {
    const store = useStore(); // Access the store using useStore

    const configData = ref(store.state.config.configData);

    const useManualIPConfig = ref(false);
    const useMQTT = ref(false);
    const useMQTTAuth = ref(false);
    const MQTTServer = ref("");
    const MQTTPort = ref("8181");
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

    console.log("sync setting:", JSON.stringify(configData.value.sync));
    watchEffect(() => {
      configData.value = store.state.config.configData;
      console.log("configData changed:", configData.value);
    });

    watch(
      () => useMQTT.value,
      (newValue, oldValue) => {
        // Fetch data when the useMQTT variable changes
        if (newValue) {
          //fetchData();
        }
      }
    );
    /*
    async function fetchData() {
      try {
        // Dispatch the fetchConfigData action from the 'config' module
        await store.dispatch("config/fetchConfigData");
        console.log("Fetched Config Data:", store.state.config.configData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    }

    onMounted(() => {
      // Fetch data when the component is mounted
      fetchData();
    });
*/

    return {
      connectionItems,
      useManualIPConfig,
      useMQTT,
      useMQTTAuth,
      MQTTServer,
      MQTTPort,
      configData,
    };
  },
};
</script>
