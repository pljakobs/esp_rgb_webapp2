<template>
  <q-card elevated class="my-card col-auto fit q-gutter-lg">
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
      <ColorGainSlider
        v-for="colorGain in colorGains"
        :key="colorGain.label"
        :label="colorGain.label"
        :value="Number(colorGain.model)"
        :color="colorGain.color"
        trackSize="5px"
        displayValue="always"
        labelAlways
        @update:model="updateColorGain(colorGain)"
      />
    </q-card-section>
  </q-card>
  <q-card>
    another card here
  </q-card>
</template>

<script>
import { ref, watchEffect } from "vue";
import ColorGainSlider from "components/ColorGainSlider.vue";

export default {
  setup() {
    const updateColorGain = (colorGain, value) => {
      console.log("color gain update");
      colorGain.model = value;
    };

    const transitionModel = ref("Normal");
    const options = ["Normal", "Spektrum", "Rainbow"];

    const colorGains = [
      { label: "Red", model: ref(0), color: "red" },
      { label: "Yellow", model: ref(0), color: "yellow" },
      { label: "Green", model: ref(0), color: "green" },
      { label: "Cyan", model: ref(0), color: "cyan" },
      { label: "Blue", model: ref(0), color: "blue" },
      { label: "Magenta", model: ref(0), color: "#ff0090" },
    ];

    // Watch for changes in colorGains and initialize sliders
    watchEffect(() => {
      colorGains.forEach((colorGain) => {
        updateColorGain(colorGain, colorGain.model.value);
      });
    });

    return {
      colorGains,
      updateColorGain,
      transitionModel,
      options,
    };
  },
  components: {
    ColorGainSlider,
  },
};
</script>
