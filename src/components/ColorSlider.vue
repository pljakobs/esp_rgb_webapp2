<template>
  <div>
    <span
      :style="{
        backgroundColor: color,
        width: '15px',
        height: '15px',
        borderRadius: '50%',
        display: 'inline-block',
        marginRight: '5px',
      }"
    ></span>
    <span style="color: black">{{ label }}</span>
    <q-slider
      :min="min"
      :max="max"
      track-size="5px"
      display-value="always"
      label
      v-model="internalValue"
      @input="updateModel"
    />
  </div>
</template>

<script>
import { ref, defineProps } from "vue";

export default {
  props: {
    value: {
      type: Number,
      default: 0,
    },
    color: String,
    label: String,
    min: {
      type: Number,
      default: -30,
    },
    max: {
      type: Number,
      default: 30,
    },
  },
  setup(props, { emit }) {
    const internalValue = ref(props.value);

    const updateModel = () => {
      emit("update:model", internalValue.value);
    };

    return {
      internalValue,
      updateModel,
    };
  },
};
</script>

<style scoped></style>
