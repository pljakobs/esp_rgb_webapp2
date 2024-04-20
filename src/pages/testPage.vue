<template>
  <q-card>
    <q-card-section>
      <h2>Test Page</h2>
    </q-card-section>
    <q-card-section>
      <h2><q-icon :name="outlinedHome" /></h2>
    </q-card-section>
  </q-card>
</template>

<script>
import { ref, watch } from "vue";
import { outlinedHome } from "@quasar/extras/material-icons-outlined";

export default {
  setup() {
    const showDialog = ref(false);
    const doShowDialog = () => {
      showDialog.value = true;
      console.log("showDialog (showing)", showDialog.value);
    };

    const doHideDialog = () => {
      showDialog.value = false;
      console.log("showDialog (hiding)", showDialog.value);
    };

    watch(showDialog, (newVal) => {
      console.log("showDialog changed", newVal);
    });
    return { outlinedHome, doShowDialog, doHideDialog, showDialog };
  },
};
</script>
