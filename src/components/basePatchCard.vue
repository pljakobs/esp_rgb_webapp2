<template>
  <q-card
    flat
    bordered
    class="patch-card q-ma-sm cursor-pointer"
    :class="{ 'patch-card--selected': active }"
    @click="$emit('click')"
  >
    <q-card-section horizontal class="q-pa-sm items-center full-width">
      <!-- Left Section: Status & Icons -->
      <div class="col-auto q-pr-sm row items-center no-wrap">
        <slot name="avatar" />
      </div>

      <!-- Center Section: Labeling text -->
      <div class="col">
        <slot name="content" />
      </div>

      <!-- Right Section: Actions or Selection Indicators -->
      <div class="col-auto row items-center q-gutter-xs">
        <slot name="actions" />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
defineProps({
  active: {
    type: Boolean,
    default: false,
  },
});
defineEmits(["click"]);
</script>

<style lang="scss" scoped>
.patch-card {
  transition: all 0.4s ease-in-out;
  border-width: 1px;
  border-radius: 5px;

  /* Use your system's active theme tokens instead of Quasar's generic variables */
  background-color: var(--table-bg);
  color: var(--field-value-color);
  border-color: rgba(128, 128, 128, 0.2);

  /* Force child slot text to use your theme variables */
  :deep(.text-subtitle2) {
    color: var(--field-value-color);
  }
  :deep(.text-caption) {
    color: var(--label-color);
  }

  &--selected {
    border-color: var(
      --primary
    ); /* Using the SCSS variable $primary directly */
    border-width: 2px;
    background-color: var(--table-item-bg);
    box-shadow: 0 2px 8px var(--shadow-color);
  }

  &:hover:not(.patch-card--selected) {
    transform: translateY(
      -2px
    ); /* Slightly reduced to minimize clipping risks */

    /* Swap from an outward shadow to an intense inner shadow glow */
    box-shadow: inset 0 0 8px rgba(156, 39, 176, 0.2);

    /* Make the card frame explicitly glow with your new accent variable */
    border-color: var(--accent-color);
    border-width: 1px;

    filter: brightness(
      1.12
    ); /* Slightly higher boost to make the white background pop */
  }
}
</style>
