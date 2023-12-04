<template>
  <div>
    <div v-if="isLoading">
      <q-spinner> </q-spinner>
      -&gt;{{ isLoading }}&lt;-
    </div>
    <div v-else>
      <q-toggle
        v-model="sync.color_master_enabled.value"
        label="Color Master"
        left-label
      />
      <q-toggle
        v-model="network.connection.dhcp.value"
        label="dhcp"
        left-label
      />
    </div>
  </div>
</template>

<script>
import { computed } from "vue";
import { configDataStore, createComputedProperties } from "src/store";

export default {
  setup() {
    const store = configDataStore();

    const fields = ["sync.color_master_enabled", "network.connection.dhcp"];
    const computedProperties = createComputedProperties(store, fields);

    return {
      ...computedProperties, // Spread the computed properties into the returned object
      isLoading: computed(() => store.isLoading),
    };
  },
};
</script>
