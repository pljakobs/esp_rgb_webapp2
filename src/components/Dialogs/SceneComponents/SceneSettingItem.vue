<template>
  <q-item class="setting-item q-my-sm">
    <q-item-section avatar class="drag-handle q-pr-sm cursor-move">
      <svgIcon name="drag_indicator" />
    </q-item-section>

    <q-item-section>
      <!-- Transition component -->
      <transition-panel
        :model-value="sceneSetting"
        :direction-options="directionOptions"
        :queue-options="queueOptions"
        @update-queue-settings="$emit('update-queue-settings')"
      />

      <!-- Color selection with delete button inline -->
      <div class="row items-center q-gutter-sm">
        <mySelect
          :model-value="colorType"
          @update:model-value="onColorTypeChange"
          :options="colorTypeOptions"
          emit-value
          map-options
          :display-value="displayValue"
          class="col"
          dense
          filled
        />

        <q-btn
          v-if="colorType"
          flat
          dense
          round
          @click="$emit('edit-selection')"
        >
          <svgIcon name="edit" />
          <q-tooltip>Edit current selection</q-tooltip>
        </q-btn>

        <!-- Delete button moved here to be inline with color selection -->
        <q-btn
          flat
          dense
          round
          color="negative"
          @click="$emit('remove-setting')"
        >
          <svgIcon name="delete" />
          <q-tooltip>Remove</q-tooltip>
        </q-btn>
      </div>
    </q-item-section>
  </q-item>
</template>

<script>
import { computed } from "vue";
import mySelect from "src/components/mySelect.vue";
import TransitionPanel from "./TransitionPanel.vue";
import { useAppDataStore } from "src/stores/appDataStore";

export default {
  name: "SceneSettingItem",
  components: {
    mySelect,
    TransitionPanel,
  },
  props: {
    sceneSetting: {
      type: Object,
      required: true,
    },
    colorTypeOptions: {
      type: Array,
      required: true,
    },
    directionOptions: {
      type: Array,
      required: true,
    },
    queueOptions: {
      type: Array,
      required: true,
    },
  },
  emits: [
    "update-queue-settings",
    "color-type-change",
    "edit-selection",
    "remove-setting",
  ],
  setup(props, { emit }) {
    const appData = useAppDataStore();

    // Get the type of color currently set
    const colorType = computed(() => {
      if (!props.sceneSetting.color) return null;
      if (props.sceneSetting.color.hsv) return "hsv";
      if (props.sceneSetting.color.raw) return "raw";
      if (props.sceneSetting.color.Preset) return "preset";
      return null;
    });

    // Get a display value for the current color selection
    const displayValue = computed(() => {
      if (!props.sceneSetting || !props.sceneSetting.color) return "No Color";

      if (props.sceneSetting.color.hsv) {
        const { h, s, v } = props.sceneSetting.color.hsv;
        return `HSV (${h}°, ${s}%, ${v}%)`;
      }

      if (props.sceneSetting.color.raw) {
        const { r, g, b } = props.sceneSetting.color.raw;
        return `RGB (${r}, ${g}, ${b})`;
      }

      if (props.sceneSetting.color.Preset) {
        const presetId = props.sceneSetting.color.Preset.id;
        const preset = appData.data.presets.find((p) => p.id === presetId);
        return `Preset: ${preset ? preset.name : "Unknown"}`;
      }

      return "No Color";
    });

    const onColorTypeChange = (type) => {
      // When changing type, emit event instead of directly modifying
      emit("color-type-change", type);
    };

    const ensureValidColor = (color) => {
      if (!color) return { hsv: { h: 0, s: 100, v: 100 } };

      if (color.hsv) {
        return {
          hsv: {
            h: color.hsv.h ?? 0,
            s: color.hsv.s ?? 100,
            v: color.hsv.v ?? 100,
          },
        };
      }

      if (color.raw) {
        return {
          raw: {
            r: color.raw.r ?? 255,
            g: color.raw.g ?? 0,
            b: color.raw.b ?? 0,
          },
        };
      }

      if (color.Preset?.id) {
        return color; // Preset with ID is valid
      }

      // Default fallback
      return { hsv: { h: 0, s: 100, v: 100 } };
    };

    return {
      colorType,
      displayValue,
      onColorTypeChange,
    };
  },
};
</script>

<style scoped>
.setting-item {
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.02);
}

.drag-handle {
  cursor: move;
}
</style>
