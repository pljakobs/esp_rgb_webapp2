<template>
  <q-card>
    <q-card-section>
      <h2>Test Page</h2>
    </q-card-section>
    <q-card-section>
      free heap: {{ infoData.data.heap_free }}<br />
      <button @click="refreshData">Refresh Data</button>
    </q-card-section>
  </q-card>
</template>

<script>
import { onMounted } from "vue";
import { infoDataStore } from "src/stores/infoDataStore";

export default {
  setup() {
    const infoData = infoDataStore();

    // Function to refresh data
    const refreshData = () => {
      infoData.fetchData();
    };

    // Fetch data when the component is mounted
    onMounted(() => {
      refreshData();
    });

    return {
      infoData,
      refreshData,
    };
  },
};
</script>
