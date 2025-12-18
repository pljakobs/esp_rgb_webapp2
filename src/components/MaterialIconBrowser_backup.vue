<template>
  <q-dialog v-model="showDialog">
    <q-card
      class="q-dialog-plugin material-icon-browser"
      style="
        width: 90vw;
        max-width: 1200px;
        max-height: 80vh;
        background: red;
        z-index: 9999;
      "
    >
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Google Material Icons Browser</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section
        class="q-pt-sm"
        style="max-height: calc(80vh - 200px); overflow-y: auto"
      >
        <!-- DEBUG: Simple test content -->
        <div>Debug: Dialog content is rendering!</div>
        <div>Test content here</div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed, onMounted, watch } from "vue";

export default {
  name: "MaterialIconBrowser",
  emits: ["iconSelected", "update:modelValue"],
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, { emit }) {
    console.log("🚀 MaterialIconBrowser setup() called!");

    const showDialog = computed({
      get: () => {
        console.log("MaterialIconBrowser showDialog get:", props.modelValue);
        return props.modelValue;
      },
      set: (val) => {
        console.log("MaterialIconBrowser showDialog set:", val);
        emit("update:modelValue", val);
      },
    });

    // Watch for prop changes
    watch(
      () => props.modelValue,
      (newValue, oldValue) => {
        console.log(
          "MaterialIconBrowser modelValue changed from",
          oldValue,
          "to",
          newValue,
        );
      },
    );

    // Debug: Log the current state
    watch(showDialog, (newValue) => {
      console.log(
        "MaterialIconBrowser showDialog computed changed to:",
        newValue,
      );
    });

    onMounted(() => {
      console.log("MaterialIconBrowser mounted, loading default category");
    });

    return {
      showDialog,
    };
  },
};
</script>

<style scoped>
.material-icon-browser {
  background: white;
}
</style>
