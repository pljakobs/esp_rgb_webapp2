<template>
  <MyCard
    title="Debug Functions"
    icon="img:icons/systemsecurityupdate_outlined.svg"
  >
    <q-card-section>
      <q-btn-group>
        <q-btn
          label="Switch ROM"
          color="primary"
          class="q-mt-md"
          @click="switchRom"
        />
        Current ROM: {{ infoData.data.current_rom }}
        <q-btn
          label="Restart Controller"
          color="primary"
          class="q-mt-md"
          @click="restartController"
        />
      </q-btn-group>
      <q-toggle
        v-model="debugEnabled"
        label="Debug Logging"
        color="primary"
        class="q-mt-md"
        @update:model-value="toggleDebug"
      />
    </q-card-section>
  </MyCard>
</template>

<script>
import MyCard from "src/components/myCard.vue";
import systemCommand from "src/services/systemCommands.js";
import { infoDataStore } from "src/stores/infoDataStore";
import { configDataStore } from "src/stores/configDataStore";
import { ref, watch } from "vue";

export default {
  components: {
    MyCard,
  },
  setup() {
    const infoData = infoDataStore();
    const configData = configDataStore();
    const debugEnabled = ref(configData.data.general.debug);

    const switchRom = () => {
      systemCommand.switchRom();
    };

    const toggleDebug = () => {
      console.log("switching debug mode to: ", debugEnabled.value);
      systemCommand.debug(debugEnabled.value);
    };

    const restartController = () => {
      systemCommand.restartController();
    };

    // Watch for changes in configData to update debugEnabled
    watch(
      () => configData.data.general.debug,
      (newVal) => {
        debugEnabled.value = newVal;
      },
    );

    return {
      switchRom,
      toggleDebug,
      restartController,
      infoData,
      debugEnabled,
    };
  },
};
</script>

<style scoped>
.q-mt-md {
  margin-top: 16px;
}
</style>
