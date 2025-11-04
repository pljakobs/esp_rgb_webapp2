<template>
  <svgIcon
    :name="name"
    :is-selected="isSelected"
    :size="size"
    :color="color"
    :fallback-icon="fallbackIcon"
    :is-in-stepper="isInStepper"
    v-bind="$attrs"
  />
</template>

<script>
import svgIcon from "./svgIcon.vue";

export default {
  name: "SvgIconLegacy",
  components: {
    svgIcon,
  },
  inheritAttrs: false,
  props: {
    name: {
      type: String,
      required: true,
    },
    isSelected: {
      type: Boolean,
      default: false,
    },
    size: {
      type: String,
      default: null,
    },
    color: {
      type: String,
      default: null,
    },
    fallbackIcon: {
      type: String,
      default: "lightbulb_outlined",
    },
    isInStepper: {
      type: Boolean,
      default: false,
    },
  },
};
</script>

<style scoped>
/* Legacy wrapper retains compatibility but delegates rendering to svgIcon */
</style>
