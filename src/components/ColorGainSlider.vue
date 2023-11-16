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
      :min="-30"
      :max="30"
      :track-size="trackSize"
      :display-value="displayValue"
    v-model="internalValue"
      @input="updateModel"
    />
  </div>
</template>

<script>
import { ref, defineProps } from "vue";

export default {
  props: {
    value: Number, // Change this to 'value'
    color: String,
    label: String,
    trackSize: String,
    displayValue: String,
    labelAlways: Boolean,
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
