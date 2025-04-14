<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card class="shadow-4 q-pa-md" style="max-width: 300px">
      <q-card-section>
        <div class="text-h6">Updating Firmware...</div>
      </q-card-section>

      <q-card-section class="row items-center">
        <q-linear-progress
          :value="progress"
          color="primary"
          class="full-width"
        />
      </q-card-section>

      <q-card-section class="text-center">
        <div>Reloading in {{ Math.floor(progress * 30) }} seconds...</div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useDialogPluginComponent } from "quasar";

export default {
  name: "FirmwareUpdateProgressDialog",
  emits: [...useDialogPluginComponent.emits],

  setup() {
    const { dialogRef, onDialogHide } = useDialogPluginComponent();
    const progress = ref(1); // Start at 100%
    let interval = null;

    onMounted(() => {
      // Create a countdown that decreases progress over 30 seconds
      interval = setInterval(() => {
        progress.value -= 1 / 30;
        if (progress.value <= 0) {
          clearInterval(interval);
          // Reload the page when countdown completes
          location.reload(true);
        }
      }, 1000);
    });

    onBeforeUnmount(() => {
      if (interval) {
        clearInterval(interval);
      }
    });

    return {
      dialogRef,
      onDialogHide,
      progress,
    };
  },
};
</script>

<style scoped>
.full-width {
  width: 100%;
}
</style>
