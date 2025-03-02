<template>
  <MyCard icon="scene" title="Scenes"> </MyCard>
</template>
<script>
import { ref, computed } from "vue";
import { useAppDataStore } from "src/stores/appDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import MyCard from "src/components/myCard.vue";

export default {
  name: "scenesCard",
  components: {
    MyCard,
  },
  setup() {
    const appData = useAppDataStore();
    const controllersStore = useControllersStore();

    const groups = computed(() => {
      return appData.data.groups;
    });

    const scenes = computed(() => {
      return appData.data.scenes;
    });

    const presets = computed(() => {
      return appData.data.presets;
    });

    const controllers = computed(() => {
      return controllersStore.data;
    });
  },
};
</script>
