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
        :value="colorGain.model"
        :color="colorGain.color"
        @update:model="
          ($event) => {
            console.log('in function:', $event);
            updateColorSlider(colorGains, $event);
          }
        "
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
        :value="colorSlider.model"
        :color="colorSlider.color"
        @update:model="
          ($event) => {
            console.log('in function:', $event);
            updateColorSlider(colorSlider, $event);
          }
        "
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
        :value="colorTemperature.model"
        :color="colorTemperature.color"
        @update:model="
          ($event) => {
            console.log('in function:', $event);
            updateColorSlider(colorTemperature, $event);
          }
        "
      />
    </q-card-section>
  </q-card>
</template>
<script>
import { ref, watch, computed } from "vue";
import { configDataStore } from "src/store";
import ColorSlider from "src/components/ColorSlider.vue";

export default {
  setup() {
    const configData = configDataStore();
    onMounted(async () => {
      await colorData.fetchData();
      console.log(colorData.state);
      isLoading.value = false;
    });
    const transitionOptions = ["Normal", "Spektrum", "Rainbow"];
    const transitionModel = ref(
      transitionOptions[configData.color.hsv.model.value],
    );
    console.log("transition mode:", configData.color.hsv.model.value);

    const colorGains = [
      {
        label: "Red",
        model: configData.color.hsv.red.value,
        min: -30,
        max: 30,
        color: "red",
      },
      {
        label: "Yellow",
        model: configData.color.hsv.yellow.value,
        min: -30,
        max: 30,
        color: "yellow",
      },
      {
        label: "Green",
        model: configData.color.hsv.green.value,
        min: -30,
        max: 30,
        color: "green",
      },
      {
        label: "Cyan",
        model: configData.color.hsv.cyan.value,
        min: -30,
        max: 30,
        color: "cyan",
      },
      {
        label: "Blue",
        model: configData.color.hsv.blue.value,
        min: -30,
        max: 30,
        color: "blue",
      },
      {
        label: "Magenta",
        model: configData.color.hsv.magenta.value,
        min: -30,
        max: 30,
        color: "#ff0090",
      },
    ];

    const colorModel = ref("RGB");
    const colorOptions = ["RGB", "RGBWW", "RGBCW", "RGBWWCW"];
    const colorSliders = computed(() => {
      // Define the sliders based on the selected model
      const sliders = [
        {
          label: "Red",
          model: configData.color.brightness.red.value,
          min: 0,
          max: 100,
          color: "red",
        },
        {
          label: "Green",
          model: configData.color.brightness.green.value,
          min: 0,
          max: 100,
          color: "green",
        },
        {
          label: "Blue",
          model: configData.color.brightness.blue.value,
          min: 0,
          max: 100,
          color: "blue",
        },
      ];

      if (colorModel.value === "RGBWW" || colorModel.value === "RGBWWCW") {
        sliders.push({
          label: "Warm White",
          model: configData.color.brightness.ww.value,
          min: 0,
          max: 100,
          color: "yellow",
        });
      }

      if (colorModel.value === "RGBCW" || colorModel.value === "RGBWWCW") {
        sliders.push({
          label: "Cold White",
          model: configData.color.brightness.cw.value,
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
        model: configData.color.colortemp.ww.value,
        min: 2500,
        max: 8000,
        color: "yellow",
      },
      {
        label: "cold white",
        model: configData.color.colortemp.cw.value,
        min: 2500,
        max: 8000,
        color: "cyan",
      },
    ];

    const updateColorSlider = (slider, value) => {
      console.log("update for", slider);
      console.log("new value", value);
      store.updateConfigData(slider.label.toLowerCase(), value);
      //store.dispatch('config/updateConfigData',''
    };

    const updateTransitionMode = (newTransitionModel) => {
      console.log(
        `from update trigger: \nTransition model changed to ${newTransitionModel}`,
      );
      configData.color.hsv.model.value =
        transitionOptions.indexOf(newTransitionModel);
    };

    watch(
      () => colorModel.value,
      (oldColorModel, newColorModel) => {
        // Triggered when selectedModel changes
        // You can update the colorSliders array here if needed
        console.log(
          "Selected color model changed:, from ${oldColorModel} to ${newColorModel}",
        );
      },
    );

    return {
      transitionModel,
      colorModel,
      transitionOptions,
      colorGains,
      colorSliders,
      colorOptions,
      colorTemperatures,
      updateColorSlider,
      updateTransitionMode,
      configData,
      infoData,
    };
  },
  components: {
    ColorSlider,
  },
};
</script>
