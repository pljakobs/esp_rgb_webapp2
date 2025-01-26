<template>
  <MyCard icon="'exposure_outlined'" title="White balance">
    <q-card-section>
      select color temperature
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
import { ref, onMounted } from "vue";
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

    const colorTemperatures = ref([
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
    ]);

    const getColorTemperatureValue = (model) => {
      return model.split(".").reduce((o, i) => o[i], configData.data);
    };

    const updateColorTemperature = (model, value) => {
      configData.updateData(model, value);
    };

    onMounted(() => {
      console.log("Mounted WhiteBalanceCard");
    });

    return {
      colorTemperatures,
      getColorTemperatureValue,
      updateColorTemperature,
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
