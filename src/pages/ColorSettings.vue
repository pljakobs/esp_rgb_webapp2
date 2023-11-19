<template>
  <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md">
    <q-card-section>
      <div class="text-h6">
        <q-icon name="tune" />
        HSV Mixing
      </div>
    </q-card-section>

    <q-card-section>
      <div class="text-h6 col-auto self-center q-gutter-md">
        <q-select
          v-model="transitionModel"
          :options="options"
          label="Standard"
          style="width: 200px"
        />
      </div>
    </q-card-section>

    <q-card-section v-if="transitionModel !== 'Rainbow'" style="width: 80%">
      <ColorSlider
        v-for="colorGain in colorGains"
        :key="colorGain.label"
        :label="colorGain.label"
        :min="colorGain.min"
        :max="colorGain.max"
        :value="Number(colorGain.model)"
        :color="colorGain.color"
        trackSize="5px"
        displayValue="always"
        labelAlways
        @update:model="updateColorSlider(colorGain)"
      />
    </q-card-section>
  </q-card>
  <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md">
    <q-card-section>
      <div class="text-h6">
        <q-icon name="tune" />
        HSV Mixing
      </div>
    </q-card-section>

    <q-card-section>
      <div class="text-h6 col-auto self-center q-gutter-md">
        <q-select
          v-model="transitionModel"
          :options="options"
          label="Standard"
          style="width: 200px"
        />
      </div>
    </q-card-section>

    <q-card-section style="width: 80%">
      <ColorSlider
        key="Red"
        label="Red"
        value="100"
        min="0"
        max="100"
        @update:model="($event) => updateSlider('Red')"
      />
    </q-card-section>
  </q-card>
</template>

<script>
import { ref, watchEffect } from "vue";
import ColorSlider from "src/components/ColorSlider.vue";
import { RedirectHandler } from "undici-types";

export default {
  setup() {
    const updateColorSlider = (Slider, value) => {
      console.log("update for $Slider");
      Slider.model = value;
    };

    const transitionModel = ref("Normal");
    const options = ["Normal", "Spektrum", "Rainbow"];

    const colorGains = [
      { label: "Red", model: ref(0), min: -30, max: 30, color: "red" },
      { label: "Yellow", model: ref(0), min: -30, max: 30, color: "yellow" },
      { label: "Green", model: ref(0), min: -30, max: 30, color: "green" },
      { label: "Cyan", model: ref(0), min: -30, max: 30, color: "cyan" },
      { label: "Blue", model: ref(0), min: -30, max: 30, color: "blue" },
      { label: "Magenta", model: ref(0), min: -30, max: 30, color: "#ff0090" },
    ];

    // Watch for changes in colorGains and initialize sliders
    watchEffect(() => {
      colorGains.forEach((colorGain) => {
        updateColorSlider(colorGain, colorGain.model.value);
      });
    });

    return {
      colorGains,
      updateColorGain: updateColorSlider,
      transitionModel,
      options,
    };
  },
  components: {
    ColorSlider,
  },
};
</script>
