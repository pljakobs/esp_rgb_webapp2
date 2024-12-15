<template>
  <MyCard icon="img:icons/tune_outlined.svg" title="Transition Mode">
    <q-card-section>
      <div class="text-h6 col-auto self-center q-gutter-md">
        <q-select
          v-model="transitionModel"
          :options="transitionOptions"
          label="Transition Mode"
          style="width: 200px"
          dropdown-icon="img:icons/arrow_drop_down.svg"
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
        :value="colorGain.value"
        :color="colorGain.color"
        @update:model="
          ($event) => {
            console.log('in function:', $event);
            updateColorSlider(colorGain.model, $event);
          }
        "
      />
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, watch, onMounted } from "vue";
import { configDataStore } from "src/stores/configDataStore";
import ColorSlider from "src/components/ColorSlider.vue";
import MyCard from "src/components/myCard.vue";

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

    const colorGains = ref([
      {
        label: "Red",
        model: "color.hsv.red",
        min: -30,
        max: 30,
        color: "red",
        value: configData.data.color.hsv.red,
      },
      {
        label: "Yellow",
        model: "color.hsv.yellow",
        min: -30,
        max: 30,
        color: "yellow",
        value: configData.data.color.hsv.yellow,
      },
      {
        label: "Green",
        model: "color.hsv.green",
        min: -30,
        max: 30,
        color: "green",
        value: configData.data.color.hsv.green,
      },
      {
        label: "Cyan",
        model: "color.hsv.cyan",
        min: -30,
        max: 30,
        color: "cyan",
        value: configData.data.color.hsv.cyan,
      },
      {
        label: "Blue",
        model: "color.hsv.blue",
        min: -30,
        max: 30,
        color: "blue",
        value: configData.data.color.hsv.blue,
      },
      {
        label: "Magenta",
        model: "color.hsv.magenta",
        min: -30,
        max: 30,
        color: "#ff0090",
        value: configData.data.color.hsv.magenta,
      },
    ]);

    const updateColorSlider = (model, value) => {
      console.log("update for", model);
      console.log("new value", value);
      configData.updateData(model, value);
    };

    const updateTransitionMode = (newTransitionModel) => {
      console.log(
        `from update trigger: \nTransition model changed to ${newTransitionModel}`,
      );
      const modelIndex = transitionOptions.indexOf(newTransitionModel);
      console.log(
        "old transition model:",
        configData.data.color.hsv.model,
        " new transition model: ",
        modelIndex,
      );
      configData.updateData("color.hsv.model", modelIndex);
    };

    watch(transitionModel, (newModel) => {
      console.log("transition model change to ", newModel);
      updateTransitionMode(newModel);
    });

    onMounted(() => {
      // Initialize transition model and color gains
      transitionModel.value =
        transitionOptions[configData.data.color.hsv.model];
      colorGains.value.forEach((gain) => {
        gain.value = configData.data.color.hsv[gain.model.split(".").pop()];
      });
    });

    return {
      transitionModel,
      transitionOptions,
      colorGains,
      updateColorSlider,
      updateTransitionMode,
    };
  },
};
</script>

<style scoped>
/* Add any necessary styles here */
</style>
