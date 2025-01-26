<template>
  <MyCard icon="'palette_outlined'" title="Color">
    <q-card-section>
      <div class="text-h6 col-auto self-center q-gutter-md">
        <q-select
          v-model="colorModel"
          :options="colorOptions"
          label="Color Model"
          style="width: 200px"
          dropdown-icon="img:icons/arrow_drop_down.svg"
          @update:model-value="emitColorModel"
        >
          <template #dropdown-icon>
            <img
              src="/icons/arrow_drop_down.svg"
              alt="Dropdown Icon"
              style="width: 24px; height: 24px"
            />
          </template>
        </q-select>
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
</template>

<script>
import { ref, watch, computed, onMounted } from "vue";
import { configDataStore } from "src/stores/configDataStore";
import ColorSlider from "src/components/ColorSlider.vue";
import MyCard from "src/components/myCard.vue";

export default {
  components: {
    MyCard,
    ColorSlider,
  },
  emits: ["update:colorModel"],
  setup(props, { emit }) {
    const configData = configDataStore();

    const colorModel = ref("");
    const defaultColorOptions = ["RGB", "RGBWW", "RGBCW", "RGBWWCW"];
    const colorOptions = ref([]);

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

    const getColorSliderValue = (model) => {
      return model.split(".").reduce((o, i) => o[i], configData.data);
    };

    const updateColorSlider = (model, value) => {
      configData.updateData(model, value);
    };

    const emitColorModel = (newColorModel) => {
      const modelIndex = colorOptions.value.indexOf(newColorModel);
      configData.updateData("color.outputmode", modelIndex);
      colorModel.value = newColorModel; // Ensure the ref is updated
      emit("update:colorModel", modelIndex);
    };

    watch(colorModel, (newColorModel, oldColorModel) => {
      console.log(
        `Selected color model changed from ${oldColorModel} to ${newColorModel}`,
      );
      emitColorModel(newColorModel);
    });

    // Initialize values from configDataStore when the component is mounted
    onMounted(() => {
      // Initialize colorOptions and colorModel
      colorOptions.value =
        configData.data.general?.supported_color_models.length > 0
          ? configData.data.general.supported_color_models
          : defaultColorOptions;
      const colorModelIndex = configData.data.color.color_mode;
      if (colorModelIndex >= 0 && colorModelIndex < colorOptions.value.length) {
        colorModel.value = colorOptions.value[colorModelIndex];
      } else {
        console.error(`Invalid color.color_mode: ${colorModelIndex}`);
        colorModel.value = colorOptions.value[0]; // Default to the first option
      }
    });

    return {
      colorModel,
      colorOptions,
      colorSliders,
      getColorSliderValue,
      updateColorSlider,
      emitColorModel,
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
