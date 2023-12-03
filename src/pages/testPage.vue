<template>
  <div>
    <div v-if="isLoading">
      <q-spinner> </q-spinner>
      -&gt;{{ isLoading }}&lt;-
    </div>
    <div v-else>
      <q-toggle
        v-model="sync_color_master_enabled"
        label="Color Master"
        left-label
      />
    </div>
  </div>
</template>

<script>
import { computed } from "vue";
import { configDataStore } from "src/store";

export default {
  setup() {
    const store = configDataStore();

    const sync_color_master_enabled = computed({
      get: () => store.data.sync.color_master_enabled,
      set: (value) =>
        store.updateConfigData("sync.color_master_enabled", value),
    });

    const network_connection_dhcp = computed({
      get: () => store.data.network.connection.dhcp,
      set: (value) => store.updateConfigData("network.connection.dhcp", value),
    });

    // Create more computed properties as needed...

    return {
      sync_color_master_enabled,
      network_connection_dhcp,
      // Include other computed properties...
      isLoading: computed(() => store.isLoading),
    };
  },
};
</script>
