<template>
  <MyCard icon="tune_outlined" :title="$t('cards.transitionMode.title')">
    <q-card-section>
      <div class="text-h6 col-auto self-center q-gutter-md">
        <mySelect
          v-model="transitionModel"
          :options="transitionOptions"
          :label="$t('cards.transitionMode.modeLabel')"
          style="width: 200px"
          @update:model-value="updateTransitionMode"
        >
        </mySelect>
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
import { useI18n } from "vue-i18n";
import { configDataStore } from "src/stores/configDataStore";
import ColorSlider from "src/components/ColorSlider.vue";
import MyCard from "src/components/myCard.vue";

export default {
  components: {
    MyCard,
    ColorSlider,
  },
  setup() {
    const { t } = useI18n();
    const configData = configDataStore();

    const transitionOptions = [
      { label: t("cards.transitionMode.options.normal"), value: "Normal" },
      { label: t("cards.transitionMode.options.spektrum"), value: "Spektrum" },
      { label: t("cards.transitionMode.options.rainbow"), value: "Rainbow" },
    ];
    const transitionModel = ref(
      transitionOptions[configData.data.color.hsv.model]?.value || "Normal",
    );

    const colorGains = ref([
      {
        label: t("cards.transitionMode.gains.red"),
        model: "color.hsv.red",
        min: -30,
        max: 30,
        color: "red",
        value: configData.data.color.hsv.red,
      },
      {
        label: t("cards.transitionMode.gains.yellow"),
        model: "color.hsv.yellow",
        min: -30,
        max: 30,
        color: "yellow",
        value: configData.data.color.hsv.yellow,
      },
      {
        label: t("cards.transitionMode.gains.green"),
        model: "color.hsv.green",
        min: -30,
        max: 30,
        color: "green",
        value: configData.data.color.hsv.green,
      },
      {
        label: t("cards.transitionMode.gains.cyan"),
        model: "color.hsv.cyan",
        min: -30,
        max: 30,
        color: "cyan",
        value: configData.data.color.hsv.cyan,
      },
      {
        label: t("cards.transitionMode.gains.blue"),
        model: "color.hsv.blue",
        min: -30,
        max: 30,
        color: "blue",
        value: configData.data.color.hsv.blue,
      },
      {
        label: t("cards.transitionMode.gains.magenta"),
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
      const modelIndex = transitionOptions.findIndex(
        (option) => option.value === newTransitionModel,
      );
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
        transitionOptions[configData.data.color.hsv.model]?.value || "Normal";
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
.icon {
  color: var(--icon-color);
  fill: var(--icon-color);
}
</style>
