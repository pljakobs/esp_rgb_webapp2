<template>
  <q-card>
    <q-card-section>
      <h2>Test Page</h2>
    </q-card-section>
    <q-card-section> free heap: {{ infoData.data.heap_free }} </q-card-section>
  </q-card>
</template>

<script>
import { ref, watch } from "vue";
import { outlinedHome } from "@quasar/extras/material-icons-outlined";
import { infoDataStore } from "src/stores/infoDataStore";

export default {
  setup() {
    const infoData = infoDataStore();

    return {
      infoData,
    };
  },
};
</script>
