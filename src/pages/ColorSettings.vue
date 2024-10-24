<template>
  <MyCard>
    <q-card-section>
      <div class="text-h6">
        <q-icon :name="outlinedTune" />
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
        :value="getColorGainValue(colorGain.model)"
        :color="colorGain.color"
        @update:model="updateColorGain(colorGain.model, $event)"
      />
    </q-card-section>
  </MyCard>
  <MyCard>
    <q-card-section>
      <div class="text-h6">
        <q-icon :name="outlinedPalette" />
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
        :value="getColorSliderValue(colorSlider.model)"
        :color="colorSlider.color"
        @update:model="updateColorSlider(colorSlider.model, $event)"
      />
    </q-card-section>
  </MyCard>
  <MyCard v-if="colorModel === 'RGBWWCW'">
    <q-card-section>
      <div class="text-h6">
        <q-icon :name="outlinedExposure" />
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
        :value="getColorTemperatureValue(colorTemperature.model)"
        :color="colorTemperature.color"
        @update:model="updateColorTemperature(colorTemperature.model, $event)"
      />
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, watch, computed } from "vue";
import { configDataStore } from "src/stores/configDataStore";
import ColorSlider from "src/components/ColorSlider.vue";
import MyCard from "src/components/myCard.vue";
import {
  outlinedPalette,
  outlinedExposure,
  outlinedTune,
} from "@quasar/extras/material-icons-outlined";

export default {
  components: {
    MyCard,
    ColorSlider,
  },
  setup() {
    const configData = configDataStore();

    const transitionOptions = ["Normal", "Spektrum", "Rainbow"];
    const transitionModel = ref(
      transitionOptions[configData.data.color.hsv.model],
    );

    const colorGains = [
      {
        label: "Red",
        model: "color.hsv.red",
        min: -30,
        max: 30,
        color: "red",
      },
      {
        label: "Yellow",
        model: "color.hsv.yellow",
        min: -30,
        max: 30,
        color: "yellow",
      },
      {
        label: "Green",
        model: "color.hsv.green",
        min: -30,
        max: 30,
        color: "green",
      },
      {
        label: "Cyan",
        model: "color.hsv.cyan",
        min: -30,
        max: 30,
        color: "cyan",
      },
      {
        label: "Blue",
        model: "color.hsv.blue",
        min: -30,
        max: 30,
        color: "blue",
      },
      {
        label: "Magenta",
        model: "color.hsv.magenta",
        min: -30,
        max: 30,
        color: "#ff0090",
      },
    ];

    const defaultColorOptions = ["RGB", "RGBWW", "RGBCW", "RGBWWCW"];
    const colorOptions = ref(
      configData.data.general?.supported_color_models || defaultColorOptions,
    );
    const colorModel = ref(
      colorOptions.value[configData.data.color.outputmode],
    );

    const colorSliders = computed(() => {
      const sliders = [
        {
          label: "Red",
          model: "color.brightness.red",
          min: 0,
          max: 100,
          color: "red",
        },
        {
          label: "Green",
          model: "color.brightness.green",
          min: 0,
          max: 100,
          color: "green",
        },
        {
          label: "Blue",
          model: "color.brightness.blue",
          min: 0,
          max: 100,
          color: "blue",
        },
      ];

      if (colorModel.value === "RGBWW" || colorModel.value === "RGBWWCW") {
        sliders.push({
          label: "Warm White",
          model: "color.brightness.ww",
          min: 0,
          max: 100,
          color: "yellow",
        });
      }

      if (colorModel.value === "RGBCW" || colorModel.value === "RGBWWCW") {
        sliders.push({
          label: "Cold White",
          model: "color.brightness.cw",
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
        model: "color.colortemp.ww",
        min: 2500,
        max: 8000,
        color: "yellow",
      },
      {
        label: "cold white",
        model: "color.colortemp.cw",
        min: 2500,
        max: 8000,
        color: "cyan",
      },
    ];

    const getColorGainValue = (model) => {
      return model.split(".").reduce((o, i) => o[i], configData.data);
    };

    const updateColorGain = (model, value) => {
      configData.updateData(model, value);
    };

    const getColorSliderValue = (model) => {
      return model.split(".").reduce((o, i) => o[i], configData.data);
    };

    const updateColorSlider = (model, value) => {
      configData.updateData(model, value);
    };

    const getColorTemperatureValue = (model) => {
      return model.split(".").reduce((o, i) => o[i], configData.data);
    };

    const updateColorTemperature = (model, value) => {
      configData.updateData(model, value);
    };

    const updateTransitionMode = (newTransitionModel) => {
      const modelIndex = transitionOptions.indexOf(newTransitionModel);
      configData.updateData("color.hsv.model", modelIndex);
    };

    const updateColorModel = (newColorModel) => {
      const modelIndex = colorOptions.value.indexOf(newColorModel);
      configData.updateData("color.outputmode", modelIndex);
      colorModel.value = newColorModel; // Ensure the ref is updated
    };

    watch(transitionModel, (newTransitionModel) => {
      updateTransitionMode(newTransitionModel);
    });

    watch(colorModel, (newColorModel, oldColorModel) => {
      console.log(
        `Selected color model changed from ${oldColorModel} to ${newColorModel}`,
      );
      updateColorModel(newColorModel);
    });

    return {
      transitionModel,
      colorModel,
      transitionOptions,
      colorGains,
      colorSliders,
      colorOptions,
      colorTemperatures,
      getColorGainValue,
      updateColorGain,
      getColorSliderValue,
      updateColorSlider,
      getColorTemperatureValue,
      updateColorTemperature,
      updateTransitionMode,
      updateColorModel,
      configData,
      outlinedPalette,
      outlinedExposure,
      outlinedTune,
    };
  },
};
</script>
