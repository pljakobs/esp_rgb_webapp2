<template>
  <q-page>
    <q-card>
      <q-card-section>
        <h2>Test Page</h2>
      </q-card-section>
      <q-card-section>
        free heap: {{ infoData.data.heap_free }}<br />
        <button @click="refreshData">Refresh Data</button>
      </q-card-section>
      <q-card-section>
        <q-toggle
          v-model="isDarkMode"
          label="Dark Mode"
          left-label
          @update:model-value="toggleDarkMode"
        />
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script>
import { ref, onMounted } from "vue";
import { Dark } from "quasar";
import { infoDataStore } from "src/stores/infoDataStore";

export default {
  setup() {
    const infoData = infoDataStore();
    const isDarkMode = ref(Dark.isActive);

    // Function to refresh data
    const refreshData = () => {
      infoData.fetchData();
    };

    // Function to toggle dark mode
    const toggleDarkMode = (value) => {
      Dark.set(value);
      localStorage.setItem("darkMode", value);
    };

    // Load user preference from local storage
    const savedDarkMode = localStorage.getItem("darkMode");
    if (savedDarkMode !== null) {
      Dark.set(savedDarkMode === "true");
      isDarkMode.value = savedDarkMode === "true";
    }

    // Fetch data when the component is mounted
    onMounted(() => {
      refreshData();
    });

    return {
      infoData,
      refreshData,
      isDarkMode,
      toggleDarkMode,
    };
  },
};
</script>

<style scoped>
/* Add any necessary styles here */
</style>
