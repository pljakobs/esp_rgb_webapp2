<template>
  <div>
    <h6 :style="{ backgroundColor: 'transparent', color: color }">
      {{ label }}
    </h6>
    <q-slider
      :min="-30"
      :max="30"
      :color="color"
      :track-size="trackSize"
      :display-value="displayValue"
      :label-always="labelAlways"
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
<style scoped>
.slider-value {
  position: absolute;
  margin-top: -1.5rem;
}
</style>
