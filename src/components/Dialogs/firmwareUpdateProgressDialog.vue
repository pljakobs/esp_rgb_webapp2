<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card class="shadow-4 q-pa-md" style="min-width: 340px; max-width: 420px">
      <q-card-section>
        <div class="row items-center no-wrap q-gutter-sm">
          <div
            class="status-chip"
            :class="
              !otaProgress.fallbackMode && otaProgress.step === 0 && otaProgress.message
                ? 'status-chip-negative'
                : !otaProgress.fallbackMode && otaProgress.step === 4
                  ? 'status-chip-positive'
                  : 'status-chip-primary'
            "
          >
            {{
              !otaProgress.fallbackMode && otaProgress.step === 0 && otaProgress.message
                ? 'ERR'
                : !otaProgress.fallbackMode && otaProgress.step === 4
                  ? 'OK'
                  : 'OTA'
            }}
          </div>
          <div class="text-h6">
            <template v-if="otaProgress.fallbackMode">Updating Firmware...</template>
            <template v-else-if="otaProgress.step === 0 && otaProgress.message">Update Failed</template>
            <template v-else-if="otaProgress.step === 4">Update Successful</template>
            <template v-else>Updating Firmware...</template>
          </div>
        </div>
      </q-card-section>

      <q-card-section>
        <q-linear-progress
          :indeterminate="!otaProgress.fallbackMode && otaProgress.step === 2"
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
        <div class="step-track q-mb-md">
          <span
            class="step-label"
            :class="displayStep === 1 ? 'step-active' : 'step-dim'"
            >Preparing</span
          >
          <span
            class="step-label"
            :class="displayStep === 2 ? 'step-active' : 'step-dim'"
            >Downloading</span
          >
          <span
            class="step-label"
            :class="displayStep === 3 ? 'step-active' : 'step-dim'"
            >Verifying</span
          >
          <span
            class="step-label"
            :class="displayStep === 4 ? 'step-active' : 'step-dim'"
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

      <!-- Status message history log -->
      <q-card-section
        v-if="!otaProgress.fallbackMode && otaProgress.statusHistory && otaProgress.statusHistory.length > 1"
        class="q-pt-none"
      >
        <div class="text-caption text-grey-5 q-mb-xs">Status log</div>
        <div class="ota-log">
          <div
            v-for="(msg, i) in otaProgress.statusHistory"
            :key="i"
            class="text-caption text-grey-6"
          >
            {{ msg }}
          </div>
        </div>
      </q-card-section>

      <!-- Success: countdown before reload -->
      <q-card-section
        v-if="otaProgress.step === 4"
        class="text-center text-caption text-grey-6"
      >
        Page will reload in {{ otaProgress.reloadCountdown }}s...
      </q-card-section>

      <!-- Error + device rebooting (watchdog): countdown before reload -->
      <q-card-section
        v-if="otaProgress.step === 0 && otaProgress.willReboot"
        class="text-center text-caption text-grey-6"
      >
        Device is rebooting... Page will reload in {{ otaProgress.reloadCountdown }}s
      </q-card-section>

      <!-- Error without reboot: show close button -->
      <q-card-section
        v-if="
          otaProgress.step === 0 &&
          otaProgress.message &&
          !otaProgress.fallbackMode &&
          !otaProgress.willReboot
        "
        class="text-center"
      >
        <q-btn flat label="Close" color="primary" @click="onDialogHide" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
import { computed } from "vue";
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
    const displayStep = computed(() => {
      if (!props.otaProgress?.fallbackMode) {
        return props.otaProgress?.step ?? 1;
      }

      const fraction = Number(props.otaProgress?.timeFraction || 0);
      if (fraction < 0.2) {
        return 1;
      }
      if (fraction < 0.75) {
        return 2;
      }
      if (fraction < 0.92) {
        return 3;
      }
      return 4;
    });

    return {
      dialogRef,
      onDialogHide,
      displayStep,
      // pass the ref through so template auto-unwraps it
      otaProgress: props.otaProgress,
    };
  },
};
</script>

<style scoped>
.step-active {
  color: #1e88e5;
  font-weight: 600;
}

.status-chip {
  min-width: 34px;
  height: 26px;
  padding: 0 8px;
  border-radius: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  color: white;
}

.status-chip-primary {
  background: #1e88e5;
}

.status-chip-positive {
  background: #21ba45;
}

.status-chip-negative {
  background: #c10015;
}

.step-dim {
  color: rgba(0, 0, 0, 0.45);
}

.step-track {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.step-label {
  display: block;
  text-align: center;
  font-size: 12px;
  line-height: 1.2;
}

.ota-log {
  max-height: 96px;
  overflow-y: auto;
  border-left: 2px solid rgba(255, 255, 255, 0.15);
  padding-left: 8px;
}
</style>
