<template>
  <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md">
    <q-card-section>
      <div class="text-h6">
        <q-icon name="tune" />
        HSV
      </div>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <div class="text-h6 col-auto self-center q-gutter-md">
        <q-select
          v-model="transitionModel"
          :options="transitionOptions"
          label="Transition Mode"
          style="width: 200px"
          @update:model-value="updateTransitionMode"
        />
      </div>
    </q-card-section>

    <q-card-section v-if="transitionModel !== 'Rainbow'" style="width: 80%">
      <ColorSlider
        v-for="colorGain in colorGains"
        :key="colorGain.label"
        :min="colorGain.min"
        :max="colorGain.max"
        :label="colorGain.label"
        :value="colorGain.model.value"
        :color="colorGain.color"
        @update:model="updateColorSlider(colorGain)"
      />
    </q-card-section>
  </q-card>
  <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md">
    <q-card-section>
      <div class="text-h6">
        <q-icon name="palette" />
        Color
      </div>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <div class="text-h6 col-auto self-center q-gutter-md">
        <q-select
          v-model="colorModel"
          :options="colorOptions"
          label="Color Model"
          style="width: 200px"
        />
      </div>
    </q-card-section>
    <q-card-section style="width: 80%">
      <ColorSlider
        v-for="colorSlider in colorSliders"
        :key="colorSlider.label"
        :min="colorSlider.min"
        :max="colorSlider.max"
        :label="colorSlider.label"
        :value="colorSlider.model.value"
        :color="colorSlider.color"
        @update:model="updateColorSlider(colorSlider)"
      />
    </q-card-section>
  </q-card>
  <q-card
    bordered
    class="my-card shadow-4 col-auto fit q-gutter-md"
    v-if="colorModel === 'RGBWWCW'"
    ><q-card-section>
      <div class="text-h6">
        <q-icon name="exposure" />
        White balance
      </div>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <ColorSlider
        v-for="colorTemperature in colorTemperatures"
        :key="colorTemperature.label"
        :min="colorTemperature.min"
        :max="colorTemperature.max"
        :label="colorTemperature.label"
        :value="colorTemperature.model.value"
        :color="colorTemperature.color"
        @update:model="($event) => updateColorSlider(colorTemperature)"
      />
    </q-card-section>
  </q-card>
</template>
<script>
import { ref, watch, computed } from "vue";
import ColorSlider from "src/components/ColorSlider.vue";
import { useStore } from "vuex";

export default {
  setup() {
    const store = useStore();

    const configData = computed(() => store.state.config.configData);

    const transitionOptions = ["Normal", "Spektrum", "Rainbow"];
    const transitionModel = ref(
      transitionOptions[configData.value.color.hsv.model]
    );

    const colorGains = [
      { label: "Red", model: ref(0), min: -30, max: 30, color: "red" },
      { label: "Yellow", model: ref(0), min: -30, max: 30, color: "yellow" },
      { label: "Green", model: ref(0), min: -30, max: 30, color: "green" },
      { label: "Cyan", model: ref(0), min: -30, max: 30, color: "cyan" },
      { label: "Blue", model: ref(0), min: -30, max: 30, color: "blue" },
      { label: "Magenta", model: ref(0), min: -30, max: 30, color: "#ff0090" },
    ];

    const colorModel = ref("RGB");
    const colorOptions = ["RGB", "RGBWW", "RGBCW", "RGBWWCW"];
    const colorSliders = computed(() => {
      // Define the sliders based on the selected model
      const sliders = [
        { label: "Red", model: ref(100), min: 0, max: 100, color: "red" },
        { label: "Green", model: ref(100), min: 0, max: 100, color: "green" },
        { label: "Blue", model: ref(100), min: 0, max: 100, color: "blue" },
      ];

      if (colorModel.value === "RGBWW" || colorModel.value === "RGBWWCW") {
        sliders.push({
          label: "Warm White",
          model: ref(100),
          min: 0,
          max: 100,
          color: "yellow",
        });
      }

      if (colorModel.value === "RGBCW" || colorModel.value === "RGBWWCW") {
        sliders.push({
          label: "Cold White",
          model: ref(100),
          min: 0,
          max: 100,
          color: "cyan",
        });
      }

      return sliders;
    });

    const colorTemperatures = [
      {
        label: "warm white",
        model: ref(2800),
        min: 2500,
        max: 8000,
        color: "yellow",
      },
      {
        label: "cold white",
        model: ref(5000),
        min: 2500,
        max: 8000,
        color: "cyan",
      },
    ];

    const updateColorSlider = (slider, value) => {
      console.log("update for $slider");
      slider.model = value;
    };

    const updateTransitionMode = (newTransitionModel) => {
      console.log(
        `from update trigger: \nTransition model changed to ${newTransitionModel}`
      );
      configData.value.color.hsv.model =
        transitionOptions.indexOf(newTransitionModel);
      // Add more logic if needed
    };

    watch(
      () => transitionModel.value,
      (newTransitionMode, oldTransitionMode) => {
        console.log(
          `from watcher: \nupdated transition model from ${oldTransitionMode} to ${newTransitionMode}`
        );
      }
    );
    watch(
      () => colorModel.value,
      (oldColorModel, newColorModel) => {
        // Triggered when selectedModel changes
        // You can update the colorSliders array here if needed
        console.log(
          "Selected color model changed:, from ${oldColorModel} to ${newColorModel}"
        );
      }
    );

    return {
      configData,
      transitionModel,
      colorModel,
      transitionOptions,
      colorGains,
      colorSliders,
      colorOptions,
      colorTemperatures,
      updateColorSlider,
      updateTransitionMode,
    };
  },
  components: {
    ColorSlider,
  },
};
</script>
