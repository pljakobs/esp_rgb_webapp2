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
      <span style="color: black">{{ label }}</span>
    </div>
    <q-slider
      :min="min"
      :max="max"
      track-size="5px"
      display-value="always"
      label
      v-model="internalValue"
      @update:model-value="updateModel"
      style="padding-left: 10px"
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
        <span style="color: black">{{ label }}</span>
      </div>
      <q-slider
        :min="min"
        :max="max"
        track-size="5px"
        display-value="always"
        label
        v-model="internalValue"
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
    labelOnTop: {
      type: Boolean,
      default: false,
    },
  },
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

<style scoped></style>
