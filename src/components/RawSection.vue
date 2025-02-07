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
      raw-r: {{ colorData.data.raw.r }}, raw-g: {{ colorData.data.raw.g }},
      raw-b: {{ colorData.data.raw.b }}, raw-ww: {{ colorData.data.raw.ww }},
      raw-cw: {{ colorData.data.raw.cw }}
    </q-card-section>
    <q-card-section>
      <q-btn @click="() => openDialog('hsv')">
        <svgIcon name="star_outlined" />
        <span>add Preset</span>
      </q-btn>
    </q-card-section>
  </q-scroll-area>
</template>

<script>
import { computed } from "vue";
import { colorDataStore } from "src/stores/colorDataStore";
import ColorSlider from "src/components/ColorSlider.vue";

export default {
  name: "RawSection",
  components: {
    ColorSlider,
  },
  props: {
    openDialog: {
      type: Function,
      required: true,
    },
  },
  setup() {
    const colorData = colorDataStore();

    const colorSliders = computed(() => [
      {
        label: "Red",
        model: colorData.data.raw.r,
        min: 0,
        max: 1023,
        color: "red",
      },
      {
        label: "Green",
        model: colorData.data.raw.g,
        min: 0,
        max: 1023,
        color: "green",
      },
      {
        label: "Blue",
        model: colorData.data.raw.b,
        min: 0,
        max: 1023,
        color: "blue",
      },
      {
        label: "Warm White",
        model: colorData.data.raw.ww,
        min: 0,
        max: 1023,
        color: "yellow",
      },
      {
        label: "Cold White",
        model: colorData.data.raw.cw,
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
        let raw = {};
        raw[rawColorKey] = value;
        colorData.updateData("raw", raw);
      }
    };

    return {
      colorData,
      colorSliders,
      updateColorSlider,
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
