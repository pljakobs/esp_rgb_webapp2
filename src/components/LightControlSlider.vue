<template>
  <div class="light-control">
    <div class="light-control-header">
      <div>
        <div class="light-control-label">{{ label }}</div>
        <div class="light-control-value">{{ displayValue }}</div>
      </div>
      <slot name="action" />
    </div>
    <q-slider
      :model-value="modelValue"
      :aria-label="label"
      :min="min"
      :max="max"
      :step="step"
      :color="color"
      thumb-color="white"
      track-size="28px"
      :class="{ 'temperature-slider': temperature }"
      class="light-slider"
      @update:model-value="$emit('update:modelValue', $event)"
    />
    <div v-if="temperature" class="temperature-labels">
      <span>{{ $t("colorSliders.warmWhite") }}</span>
      <span>{{ $t("colorSliders.coldWhite") }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: Number, required: true },
  label: { type: String, required: true },
  displayValue: { type: String, required: true },
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  step: { type: Number, default: 1 },
  color: { type: String, default: "primary" },
  temperature: { type: Boolean, default: false },
});
defineEmits(["update:modelValue"]);
</script>

<style scoped>
.light-control {
  width: 100%;
  padding: 16px 24px;
}
.light-control-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.light-control-label {
  color: var(--label-color);
  font-size: 0.9rem;
}
.light-control-value {
  font-size: 1.35rem;
  font-weight: 600;
}
.light-slider {
  width: 100%;
}
.light-slider :deep(.q-slider__track),
.light-slider :deep(.q-slider__inner),
.light-slider :deep(.q-slider__selection) {
  border-radius: 14px;
}
.light-slider :deep(.q-slider__thumb) {
  color: white;
  filter: drop-shadow(0 1px 3px #0008);
}
.temperature-slider :deep(.q-slider__track) {
  background: linear-gradient(to right, #ffae46, #fff1d2, #c0dcff) !important;
}
.temperature-slider :deep(.q-slider__inner),
.temperature-slider :deep(.q-slider__selection) {
  background: transparent !important;
}
.temperature-labels {
  display: flex;
  justify-content: space-between;
  color: var(--label-color);
  font-size: 0.8rem;
}
</style>
