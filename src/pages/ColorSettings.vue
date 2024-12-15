<template>
  <TransitionModeCard />
  <ColorModelCard />
  <WhiteBalanceCard v-if="colorMode.value === 3" />
</template>

<script>
import { ref, watch, onMounted } from "vue";
import { configDataStore } from "src/stores/configDataStore";
import TransitionModeCard from "src/components/TransitionModeCard.vue";
import ColorModelCard from "src/components/ColorModelCard.vue";
import WhiteBalanceCard from "src/components/WhiteBalanceCard.vue";

export default {
  components: {
    TransitionModeCard,
    ColorModelCard,
    WhiteBalanceCard,
  },
  setup() {
    const configData = configDataStore();

    const colorMode = ref(configData.data.color.color_mode || 0);

    watch(
      () => configData.data.color.color_mode,
      (newMode) => {
        console.log("Watcher triggered: colorMode changed to ", newMode);
        colorMode.value = newMode;
      },
      { deep: true },
    );

    onMounted(() => {
      // Initialize color mode
      colorMode.value = configData.data.color.color_mode || 0;
      console.log("Mounted ColorSettings with colorMode:", colorMode.value);
    });

    return {
      colorMode,
      TransitionModeCard,
      ColorModelCard,
      WhiteBalanceCard,
    };
  },
};
</script>

<style scoped>
/* Add any necessary styles here */
</style>
