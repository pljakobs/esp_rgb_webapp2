<template>
  <router-view />
</template>

<script>
import { onMounted, ref } from 'vue';
import { useStore } from 'vuex';

export default {
  name: 'App',
  setup() {
    const store = useStore();

    const fetchData = async () => {
      try {
        await store.dispatch('config/fetchConfigData');
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    const updateData = async (partialData) => {
      try {
        await store.dispatch('config/updateConfigData', partialData);
        await fetchData(); // Fetch updated data after a successful update
      } catch (error) {
        console.error('Error updating data:', error);
      }
    };

    onMounted(() => {
      fetchData();
    });

    return {
      fetchData,
      updateData,
    };
  },
};
</script>

