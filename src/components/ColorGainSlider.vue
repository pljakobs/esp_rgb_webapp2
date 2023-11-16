<template>
  <div>
    <q-badge>{{ label }}</q-badge>
    <q-slider
      :min="-30"
      :max="30"
      :color="color"
      track-size="5px"
      display-value="always"
      label-always
      v-model="internalValue"
    />
  </div>
</template>

<script>
import { ref, watch } from "vue";

export default {
  props: {
    value: {
      type: Number,
      required: true,
    },
    color: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
  },
  setup(props, { emit }) {
    const internalValue = ref(props.value);

    watch(
      () => props.value,
      (newValue) => {
        internalValue.value = newValue;
      }
    );

    watch(
      () => internalValue.value,
      (newValue) => {
        emit("update:value", newValue);
      }
    );

    return {
      internalValue,
    };
  },
};
</script>

<style scoped>
.slider-value {
  position: absolute;
  margin-top: -1.5rem;
}
</style>
