<template>
  <router-view />
</template>

<script>
import { onMounted } from "vue";
import { defineStore } from "pinia";
import { configDataStore } from "src/store";

export default {
  name: "App",
  setup() {
    const store = configDataStore();

    onMounted(() => {
      store.fetchData();
    });
  },
};
</script>
