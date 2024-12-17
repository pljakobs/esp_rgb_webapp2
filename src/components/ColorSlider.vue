<template>
  <div v-if="labelOnTop">
    <div style="margin-top: 10px">
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
      <span :style="{ color: 'var(--label-color)' }">{{ label }}</span>
    </div>
    <q-slider
      v-model="internalValue"
      :min="min"
      :max="max"
      track-size="5px"
      display-value="always"
      label
      style="padding-left: 10px"
      @update:model-value="updateModel"
    />
  </div>
  <div v-else>
    <div style="display: flex; align-items: center">
      <div
        style="
          display: flex;
          align-items: center;
          width: 180px;
          margin-right: 30px;
        "
      >
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
        <span :style="{ color: 'var(--label-color)' }">{{ label }}</span>
      </div>
      <q-slider
        v-model="internalValue"
        :min="min"
        :max="max"
        track-size="5px"
        display-value="always"
        label
        @update:model-value="updateModel"
      />
    </div>
  </div>
</template>

<script>
import { ref, watch } from "vue";

export default {
  props: {
    value: {
      type: Number,
      default: 0,
    },
    color: {
      type: String,
      default: "#000000", // Provide a default color value
    },
    label: {
      type: String,
      default: "Label", // Provide a default label value
    },
    min: {
      type: Number,
      default: -30,
    },
    max: {
      type: Number,
      default: 30,
    },
    labelOnTop: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:model"],
  setup(props, { emit }) {
    const internalValue = ref(props.value);

    const updateModel = () => {
      console.log("slider emitting update:model. value:", internalValue.value);
      emit("update:model", internalValue.value);
    };

    watch(
      () => props.value,
      (newValue) => {
        internalValue.value = newValue;
      },
    );

    return {
      internalValue,
      updateModel,
    };
  },
};
</script>

<style scoped>
.icon {
  color: var(--icon-color);
  fill: var(--icon-color);
}
</style>
