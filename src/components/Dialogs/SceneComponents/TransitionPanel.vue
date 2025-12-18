<template>
  <div>
    <!-- Transition section with default indicator -->
    <div class="row items-center justify-between q-mb-xs">
      <div class="text-caption">
        <span v-if="!hasTransition">
          {{
            isDefaultTransition
              ? "Default Transition: None"
              : "Transition: Default"
          }}
        </span>
        <span v-else>
          {{
            isDefaultTransition
              ? "Default Transition: Custom"
              : "Transition: Custom"
          }}
        </span>
      </div>

      <q-btn
        flat
        dense
        round
        :color="hasTransition ? 'primary' : 'grey'"
        @click="toggleTransition"
      >
        <svgIcon name="timer" />
        <q-tooltip>{{
          hasTransition ? "Edit transition" : "Add transition"
        }}</q-tooltip>
      </q-btn>
    </div>

    <!-- Transition settings section, shown when transition is enabled -->
    <q-slide-transition>
      <div v-if="hasTransition" class="transition-params q-pa-sm q-mb-md">
        <div class="text-caption q-mb-xs text-primary">
          Transition Parameters
        </div>

        <div class="row q-col-gutter-sm">
          <!-- Direction dropdown -->
          <div class="col-6 col-sm-4">
            <mySelect
              v-model="transitionObject.d"
              :options="directionOptions"
              label="Direction"
              dense
              outlined
              emit-value
              map-options
            />
          </div>

          <!-- Fade type switch between time and speed -->
          <div class="col-6 col-sm-4">
            <mySelect
              v-model="fadeType"
              :options="[
                { label: 'Speed', value: 'speed' },
                { label: 'Time', value: 'time' },
              ]"
              label="Fade by"
              dense
              outlined
              emit-value
              map-options
              @update:model-value="onFadeTypeChange"
            />
          </div>

          <!-- Speed/Time input -->
          <div class="col-12 col-sm-4">
            <q-input
              v-if="fadeType === 'speed'"
              v-model.number="transitionObject.s"
              type="number"
              label="Speed"
              dense
              outlined
              :min="1"
              :max="100"
            />
            <q-input
              v-else
              v-model.number="transitionObject.t"
              type="number"
              label="Time (ms)"
              dense
              outlined
              :min="1"
              :max="10000"
              :step="100"
            />
          </div>
        </div>

        <!-- Requeue checkbox (replaces queue policy dropdown) -->
        <div class="row q-col-gutter-sm q-mt-sm">
          <div class="col-12">
            <q-checkbox v-model="transitionObject.r" label="Requeue" dense>
              <q-tooltip
                >requeue this transition to the end of the queue once
                finished</q-tooltip
              >
            </q-checkbox>
          </div>
        </div>
      </div>
    </q-slide-transition>
  </div>
</template>

<script>
import { computed, watch } from "vue";
import mySelect from "src/components/mySelect.vue";

export default {
  name: "TransitionPanel",
  components: {
    mySelect,
  },
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
    isDefaultTransition: {
      type: Boolean,
      default: false,
    },
    directionOptions: {
      type: Array,
      default: () => [
        { label: "Forward", value: 0 },
        { label: "Reverse", value: 1 },
      ],
    },
  },
  emits: ["update-queue-settings"],
  setup(props, { emit }) {
    // Helper to get the correct transition object based on isDefaultTransition
    const transitionObject = computed(() => {
      const propName = props.isDefaultTransition
        ? "defaultTransition"
        : "transition";
      return props.modelValue[propName] || {};
    });

    // Computed property for fadeType - determines whether we're using speed or time
    const fadeType = computed({
      get: () => {
        const transition = props.isDefaultTransition
          ? props.modelValue.defaultTransition
          : props.modelValue.transition;

        if (!transition) return "speed";

        // If s exists and is greater than 0, it's a speed-based transition
        if (transition.s > 0) {
          return "speed";
        }

        // Otherwise it's time-based
        return "time";
      },
      set: (value) => {
        // This is handled by onFadeTypeChange
      },
    });

    // Computed property to determine if transition is enabled
    const hasTransition = computed(() => {
      const transition = props.isDefaultTransition
        ? props.modelValue.defaultTransition
        : props.modelValue.transition;

      return transition && transition.cmd === "fade";
    });

    // Watch the appropriate transition object to ensure proper initialization
    watch(
      () =>
        props.isDefaultTransition
          ? props.modelValue.defaultTransition
          : props.modelValue.transition,
      (newTransition) => {
        if (newTransition) {
          // Ensure command is set
          if (newTransition.cmd === undefined) {
            newTransition.cmd = "fade";
          }

          // Ensure direction is set
          if (newTransition.d === undefined) {
            newTransition.d = 0;
          }

          // Make sure either s or t is defined, but not both
          if (newTransition.s === undefined && newTransition.t === undefined) {
            // Default to speed-based transition
            newTransition.s = 10;
          } else if (newTransition.s !== undefined && newTransition.s > 0) {
            // If speed is valid and set, remove time
            delete newTransition.t;
          } else if (newTransition.t !== undefined) {
            // If time is set, remove speed
            delete newTransition.s;
          }

          // Remove queue property if it exists (we handle this at the scene level now)
          if (newTransition.q !== undefined) {
            delete newTransition.q;
          }

          // Ensure requeue is initialized as a boolean (defaulting to false)
          if (newTransition.r === undefined) {
            newTransition.r = false;
          } else {
            // Force convert to boolean if it's not already
            newTransition.r = Boolean(newTransition.r);

            // Additional check for string values like "true"/"false"
            if (typeof newTransition.r === "string") {
              newTransition.r = newTransition.r.toLowerCase() === "true";
            }
          }
        }
      },
      { deep: true, immediate: true },
    );

    // Toggle transition on/off
    const toggleTransition = () => {
      const propName = props.isDefaultTransition
        ? "defaultTransition"
        : "transition";

      if (hasTransition.value) {
        // Remove transition parameters
        delete props.modelValue[propName];
      } else {
        // Add default transition parameters
        if (!props.modelValue[propName]) {
          props.modelValue[propName] = {};
        }
        props.modelValue[propName].d = 0;
        props.modelValue[propName].s = 10; // Default to speed-based
        props.modelValue[propName].cmd = "fade";
        props.modelValue[propName].r = false; // Default to no requeue
      }

      // Notify parent to update queue settings
      emit("update-queue-settings");
    };

    // Handle when user changes fade type between speed and time
    const onFadeTypeChange = (type) => {
      const propName = props.isDefaultTransition
        ? "defaultTransition"
        : "transition";

      if (!props.modelValue[propName]) {
        props.modelValue[propName] = { cmd: "fade", d: 0 };
      }

      if (type === "speed") {
        // For speed, set s to a positive value and remove t
        props.modelValue[propName].s = 10; // Default speed
        delete props.modelValue[propName].t;
      } else {
        // For time, set t to a value and remove s
        props.modelValue[propName].t = 1000; // Default time in ms
        delete props.modelValue[propName].s;
      }

      emit("update-queue-settings");
    };

    return {
      fadeType,
      hasTransition,
      toggleTransition,
      onFadeTypeChange,
      transitionObject,
    };
  },
};
</script>

<style scoped>
.transition-params {
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
  border: 1px dashed rgba(0, 0, 0, 0.2);
}
</style>
