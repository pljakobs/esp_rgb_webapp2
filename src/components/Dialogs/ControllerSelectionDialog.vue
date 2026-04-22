<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card style="min-width: 300px; max-width: 500px; width: 90vw">
      <q-card-section>
        <div class="text-h6">Select Controllers to Update</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div class="text-subtitle2 q-mb-sm">
          Select which controllers to update:
        </div>

        <q-banner v-if="resolvedLoading" class="bg-blue-1 text-primary q-mb-md">
          {{ resolvedLoadingMessage || "Scanning controllers..." }}
        </q-banner>

        <div
          v-if="resolvedSummaryHtml"
          class="q-mb-md"
          v-html="resolvedSummaryHtml"
        />

        <!-- Select All checkbox -->
        <q-checkbox
          v-model="selectAll"
          label="Select All"
          @update:model-value="toggleSelectAll"
          :disable="resolvedLoading || controllerOptions.length === 0"
          class="q-mb-md text-weight-bold"
        />

        <q-separator class="q-mb-md" />

        <!-- Controller list with checkboxes -->
        <div style="max-height: 400px; overflow-y: auto">
          <div
            v-for="option in controllerOptions"
            :key="option.value.id"
            class="q-mb-sm"
          >
            <q-checkbox
              v-model="selectedControllers"
              :val="option.value"
              color="primary"
              :disable="resolvedLoading || option.disabled"
              class="full-width"
            >
              <div
                class="ellipsis"
                :class="option.disabled ? 'text-grey-6' : ''"
                style="max-width: calc(100% - 40px)"
              >
                {{ option.label }}
                <span v-if="option.disabled" class="text-caption q-ml-xs">
                  (temporarily unavailable)
                </span>
              </div>
            </q-checkbox>
          </div>
        </div>

        <div class="q-mt-md text-caption text-grey-7">
          {{ selectedControllers.length }} of
          {{ selectableControllers.length }} selectable controllers selected
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="onCancelClick" />
        <q-btn
          flat
          label="Update Selected"
          color="primary"
          :disable="resolvedLoading || selectedControllers.length === 0"
          @click="onOKClick"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { computed, ref, watch } from "vue";
import { useDialogPluginComponent } from "quasar";

export default {
  name: "ControllerSelectionDialog",

  props: {
    controllers: {
      type: Array,
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
    loadingMessage: {
      type: String,
      default: "",
    },
    summaryHtml: {
      type: String,
      default: "",
    },
    scanState: {
      type: Object,
      default: null,
    },
  },

  emits: [...useDialogPluginComponent.emits],

  setup(props) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
      useDialogPluginComponent();

    const resolvedControllers = computed(
      () => props.scanState?.controllers ?? props.controllers,
    );
    const resolvedLoading = computed(
      () => props.scanState?.loading ?? props.loading,
    );
    const resolvedLoadingMessage = computed(
      () => props.scanState?.loadingMessage ?? props.loadingMessage,
    );
    const resolvedSummaryHtml = computed(
      () => props.scanState?.summaryHtml ?? props.summaryHtml,
    );

    const mapControllerOptions = (controllers) =>
      controllers.map((c) => ({
        label: `${c.hostname} (${c.ip_address})`,
        value: c,
            disabled: c.selectable === false,
      }));

        const selectableControllers = computed(() =>
          resolvedControllers.value.filter((c) => c.selectable !== false),
        );

    const controllerOptions = ref(mapControllerOptions(resolvedControllers.value));

    // Initially select all controllers
    const selectedControllers = ref([...resolvedControllers.value]);
    const selectAll = ref(resolvedControllers.value.length > 0);

    const toggleSelectAll = (value) => {
      if (value) {
        selectedControllers.value = [...selectableControllers.value];
      } else {
        selectedControllers.value = [];
      }
    };

    // Watch for manual changes to update "Select All" state
    watch(
      selectedControllers,
      (newVal) => {
        selectAll.value =
          selectableControllers.value.length > 0 &&
          newVal.length === selectableControllers.value.length;
      },
      { deep: true },
    );

    watch(
      resolvedControllers,
      (controllers) => {
        controllerOptions.value = mapControllerOptions(controllers || []);
        selectedControllers.value = (controllers || []).filter(
          (c) => c.selectable !== false,
        );
        selectAll.value = selectedControllers.value.length > 0;
      },
      { deep: true },
    );

    const onOKClick = () => {
      onDialogOK(selectedControllers.value);
    };

    const onCancelClick = () => {
      onDialogCancel();
    };

    return {
      dialogRef,
      onDialogHide,
      controllerOptions,
      selectedControllers,
      selectAll,
      resolvedLoading,
      resolvedLoadingMessage,
      resolvedSummaryHtml,
      selectableControllers,
      toggleSelectAll,
      onOKClick,
      onCancelClick,
    };
  },
};
</script>
