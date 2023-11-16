<template>
  <q-card class="my-card col-auto fit q-gutter-lg">
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
      <q-card-section style="width: 80%">
        <ColorGainSlider
          v-for="colorGain in colorGains"
          :key="colorGain.label"
          v-model="colorGain.model"
          :color="colorGain.color"
          :label="colorGain.label"
          @update:value="updateColorGain(colorGain)"
        />
      </q-card-section>
    </q-card-section>
  </q-card>
</template>

<script>
import { ref } from "vue";
import ColorGainSlider from "components/ColorGainSlider.vue";

export default {
  setup() {
    const updateColorGain = (colorGain) => {
      console.log("color gain update");
      colorGain.model = colorGain.internalValue;
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

    //pre-load the sliders
    colorGains.forEach((colorGain) => {
      updateColorGain(colorGain);
    });

    return {
      transitionModel,
      options,
      colorGains,
      updateColorGain,
    };
  },
  components: {
    ColorGainSlider,
  },
};
</script>
