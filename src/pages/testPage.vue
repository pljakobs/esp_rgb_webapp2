<template>
  <div>
    <div v-if="isLoading">
      <q-spinner> </q-spinner>
      -&gt;{{ isLoading }}&lt;-
    </div>
    <div v-else>
      <q-toggle
        v-model="configData.sync.color_master_enabled.value"
        label="Color Master"
        left-label
      />
      <q-toggle
        v-model="configData.network.connection.dhcp.value"
        label="dhcp"
        left-label
      />
    </div>
  </div>
</template>

<script>
import { computed } from "vue";

export default {
  setup() {
    const configData = configDataStore();
    onMounted(async () => {
      await colorData.fetchData();
      console.log(colorData.state);
      isLoading.value = false;
    });
    return {
      isLoading: computed(() => configData.isLoading),
    };
  },
};
</script>
