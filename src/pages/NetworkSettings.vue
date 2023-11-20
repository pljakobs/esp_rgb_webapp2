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
    const connectionItems = [
      { label: "SSID:", value: "IoT" },
      { label: "IP-Address:", value: "192.168.29.186" },
      { label: "MAC Address:", value: "11:22:33:AA:BB:CC" },
    ];

    return {
      connectionItems,
      useManualIPConfig,
    };
  },
};
</script>
