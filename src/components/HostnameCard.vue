<template>
  <MyCard title="Hostname" icon="badge_outlined">
    <q-card-section>
      <q-input
        v-model="configData.data.general.device_name"
        label="Hostname"
        @blur="
          updateConfig(
            'general.device_name',
            configData.data.general.device_name,
          )
        "
      />
    </q-card-section>
  </MyCard>
</template>

<script>
import { configDataStore } from "src/stores/configDataStore";
import MyCard from "src/components/myCard.vue";

export default {
  components: {
    MyCard,
  },
  setup() {
    const configData = configDataStore();

    const updateConfig = (field, value) => {
      configData.updateData(field, value);
    };

    return {
      configData,
      updateConfig,
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
