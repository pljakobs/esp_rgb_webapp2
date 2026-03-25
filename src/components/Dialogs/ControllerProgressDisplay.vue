<template>
  <div class="text-center q-pa-lg">
    <div class="text-h6 q-mb-md">{{ title }}</div>
    <q-circular-progress
      v-if="progress.total === 0"
      indeterminate
      size="80px"
      :thickness="0.15"
      :color="color"
      class="q-mb-md"
    />
    <q-circular-progress
      v-else
      :value="(progress.completed / progress.total) * 100"
      size="80px"
      :thickness="0.15"
      :color="color"
      track-color="grey-3"
      class="q-mb-md"
    />
    <div class="text-subtitle2 q-mb-xs">
      <slot name="status">
        <span v-if="progress.total === 0">Preparing...</span>
        <span v-else
          >{{ progress.completed }} / {{ progress.total }} controllers
          updated</span
        >
      </slot>
    </div>
    <div v-if="$slots.detail || subtitle" class="text-caption text-grey-6">
      <slot name="detail">{{ subtitle }}</slot>
    </div>
  </div>
</template>

<script>
export default {
  name: "ControllerProgressDisplay",
  props: {
    title: {
      type: String,
      required: true,
    },
    progress: {
      type: Object,
      required: true,
    },
    color: {
      type: String,
      default: "primary",
    },
    subtitle: {
      type: String,
      default: null,
    },
  },
};
</script>
