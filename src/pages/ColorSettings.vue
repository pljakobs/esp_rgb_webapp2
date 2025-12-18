<template>
  <TransitionModeCard />
  <ColorModelCard @update:color-model="handleColorModelUpdate" />
  <WhiteBalanceCard v-if="colorMode === 3" />
</template>

<script>
import { ref, watch, onMounted } from "vue";
import { configDataStore } from "src/stores/configDataStore";
import TransitionModeCard from "src/components/cards/TransitionModeCard.vue";
import ColorModelCard from "src/components/cards/ColorModelCard.vue";
import WhiteBalanceCard from "src/components/cards/WhiteBalanceCard.vue";

export default {
  components: {
    TransitionModeCard,
    ColorModelCard,
    WhiteBalanceCard,
  },
  setup() {
    const configData = configDataStore();

    const colorMode = ref(configData.data.color.color_mode || 0);

    const handleColorModelUpdate = (newColorModel) => {
      console.log(
        "handleColorModelUpdate triggered: colorModel changed to ",
        newColorModel,
      );
      colorMode.value = newColorModel;
    };

    watch(
      () => configData.data.color.color_mode,
      (newMode) => {
        console.log("Watcher triggered: colorMode changed to ", newMode);
        colorMode.value = newMode;
        console.log(
          "%cChanged colorMode: " + colorMode.value,
          "color: red; font-weight: bold;",
        );
      },
      { deep: true },
    );

    onMounted(() => {
      // Initialize color mode
      colorMode.value = configData.data.color.color_mode || 0;
      console.log(
        "%cMounted ColorSettings with colorMode: " + colorMode.value,
        "color: green; font-weight: bold;",
      );
    });

    return {
      colorMode,
      TransitionModeCard,
      ColorModelCard,
      WhiteBalanceCard,
      handleColorModelUpdate,
    };
  },
};
</script>

<style scoped>
/* Add any necessary styles here */
</style>
