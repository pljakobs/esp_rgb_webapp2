<template>
  <q-card>
    <q-card-section>
      <h2>Test Page</h2>
    </q-card-section>
    <q-card-actions>
      <q-btn
        color="secondary"
        label="show dialog"
        @click="doShowDialog"
        style="margin-top: 16px"
      />
    </q-card-actions>
    <q-card-section>
      {{ showDialog }}
    </q-card-section>
  </q-card>
  <div v-if="showDialog === true">
    <q-card> das wäre ihr Dialog gewesen </q-card>
  </div>
  <q-dialog v-model="showDialog">
    <q-card>
      <div>
        <q-card-section>
          <h4>Connecting to network</h4>
          {{ showDialog }}
          <q-spinner />
        </q-card-section>
        <q-card-actions>
          <q-btn
            color="secondary"
            label="hide dialog"
            @click="doHideDialog"
            style="margin-top: 16px"
        /></q-card-actions>
      </div>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, watch } from "vue";

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
    return { doShowDialog, doHideDialog, showDialog };
  },
};
</script>
