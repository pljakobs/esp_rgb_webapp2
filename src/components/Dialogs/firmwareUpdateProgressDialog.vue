<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card class="shadow-4 q-pa-md" style="min-width: 340px; max-width: 420px">
      <q-card-section>
        <div class="text-h6">Updating Firmware...</div>
      </q-card-section>

      <q-card-section>
        <q-linear-progress
          :value="
            otaProgress.fallbackMode
              ? otaProgress.timeFraction
              : otaProgress.step / 4
          "
          :color="
            otaProgress.step === 0 && !otaProgress.fallbackMode
              ? 'negative'
              : otaProgress.step === 4
                ? 'positive'
                : 'primary'
          "
          size="14px"
          rounded
          class="q-mb-sm"
        />
        <div
          v-if="!otaProgress.fallbackMode"
          class="row justify-between text-caption q-mb-md"
        >
          <span :class="otaProgress.step === 1 ? 'step-active' : 'step-dim'"
            >Preparing</span
          >
          <span :class="otaProgress.step === 2 ? 'step-active' : 'step-dim'"
            >Downloading</span
          >
          <span :class="otaProgress.step === 3 ? 'step-active' : 'step-dim'"
            >Verifying</span
          >
          <span :class="otaProgress.step === 4 ? 'step-active' : 'step-dim'"
            >Rebooting</span
          >
        </div>
        <div
          class="text-body2 text-weight-medium"
          :class="
            otaProgress.fallbackMode
              ? 'text-primary'
              : otaProgress.step === 0
                ? 'text-negative'
                : otaProgress.step === 4
                  ? 'text-positive'
                  : 'text-primary'
          "
        >
          {{ otaProgress.message || "Starting..." }}
        </div>
      </q-card-section>

      <q-card-section
        v-if="otaProgress.step === 4"
        class="text-center text-caption text-grey-6"
      >
        Page will reload in {{ otaProgress.reloadCountdown }}s...
      </q-card-section>

      <q-card-section
        v-if="
          otaProgress.step === 0 &&
          otaProgress.message &&
          !otaProgress.fallbackMode
        "
        class="text-center"
      >
        <q-btn flat label="Close" color="primary" @click="onDialogHide" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
import { useDialogPluginComponent } from "quasar";

export default {
  name: "FirmwareUpdateProgressDialog",
  emits: [...useDialogPluginComponent.emits],

  props: {
    otaProgress: {
      type: Object,
      required: true,
    },
  },

  setup(props) {
    const { dialogRef, onDialogHide } = useDialogPluginComponent();

    return {
      dialogRef,
      onDialogHide,
      // pass the ref through so template auto-unwraps it
      otaProgress: props.otaProgress,
    };
  },
};
</script>

<style scoped>
.step-active {
  color: white;
  font-weight: 600;
}

.step-dim {
  color: rgba(255, 255, 255, 0.35);
}
</style>
