<template>
  <q-scroll-area style="height: 100%; width: 100%">
    <q-card-section>
      <ColorSlider
        v-for="colorSlider in colorSliders"
        :key="colorSlider.label"
        :min="colorSlider.min"
        :max="colorSlider.max"
        :label="colorSlider.label"
        :value="colorSlider.model"
        :color="colorSlider.color"
        label-on-top
        @update:model="($event) => updateColorSlider(colorSlider, $event)"
      />
    </q-card-section>
    <q-card-section>
      raw-r: {{ internalRaw.r }}, raw-g: {{ internalRaw.g }}, raw-b:
      {{ internalRaw.b }}, raw-ww: {{ internalRaw.ww }}, raw-cw:
      {{ internalRaw.cw }}
    </q-card-section>
    <q-card-section class="flex justify-center" v-if="!isDialog">
      <q-btn flat color="primary" @click="onAddPreset">
        <template v-slot:default>
          <svgIcon name="star_outlined" />
          <span>Add Preset</span>
        </template>
      </q-btn>
    </q-card-section>
  </q-scroll-area>
</template>

<script>
import { computed, ref, watch } from "vue";
import ColorSlider from "src/components/ColorSlider.vue";

export default {
  name: "RawSection",
  components: {
    ColorSlider,
  },
  props: {
    modelValue: {
      type: Object,
      default: () => ({ raw: { r: 0, g: 0, b: 0, ww: 0, cw: 0 } }),
    },
    isDialog: {
      type: Boolean,
      default: false,
    },
    cardHeight: {
      type: String,
      default: "300px",
    },
  },
  emits: ["update:modelValue", "add-preset"],

  setup(props, { emit }) {
    // Local state for raw values
    const internalRaw = ref({
      r: 0,
      g: 0,
      b: 0,
      ww: 0,
      cw: 0,
    });

    // Watch for changes from parent
    watch(
      () => props.modelValue,
      (newValue) => {
        if (newValue?.raw) {
          internalRaw.value = { ...newValue.raw };
        }
      },
      { immediate: true, deep: true },
    );

    const colorSliders = computed(() => [
      {
        label: "Red",
        model: internalRaw.value.r,
        min: 0,
        max: 1023,
        color: "red",
      },
      {
        label: "Green",
        model: internalRaw.value.g,
        min: 0,
        max: 1023,
        color: "green",
      },
      {
        label: "Blue",
        model: internalRaw.value.b,
        min: 0,
        max: 1023,
        color: "blue",
      },
      {
        label: "Warm White",
        model: internalRaw.value.ww,
        min: 0,
        max: 1023,
        color: "yellow",
      },
      {
        label: "Cold White",
        model: internalRaw.value.cw,
        min: 0,
        max: 1023,
        color: "cyan",
      },
    ]);

    const updateColorSlider = (slider, value) => {
      const colorMap = {
        Red: "r",
        Green: "g",
        Blue: "b",
        "Warm White": "ww",
        "Cold White": "cw",
      };

      const rawColorKey = colorMap[slider.label];
      if (rawColorKey) {
        internalRaw.value[rawColorKey] = value;
        emit("update:modelValue", { raw: { ...internalRaw.value } });
      }
    };

    const onAddPreset = () => {
      emit("add-preset", {
        type: "raw",
        value: { ...internalRaw.value },
      });
    };

    return {
      internalRaw,
      colorSliders,
      updateColorSlider,
      onAddPreset,
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
