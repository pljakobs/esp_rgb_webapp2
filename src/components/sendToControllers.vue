<!-- filepath: /home/pjakobs/devel/esp_rgb_webapp2/src/components/sendToControllers.vue -->
<template>
  <div>
    <q-btn label="Send to Controllers" color="primary" @click="showDialog" />
    <GenericDialog
      :isOpen="isDialogOpen"
      title="Select Controllers"
      :component="SendToControllersContent"
      :componentProps="{ selectedControllers }"
      @update:isOpen="isDialogOpen = $event"
      @confirm="confirmSelection"
      @update:selectedControllers="selectedControllers = $event"
    />
  </div>
</template>

<script>
import { ref } from "vue";
import GenericDialog from "src/components/GenericDialog.vue";
import SendToControllersContent from "src/components/sendToControllersDialogContent.vue";

export default {
  name: "sendToControllers",
  components: {
    GenericDialog,
    SendToControllersContent,
  },
  setup(_, { emit }) {
    const isDialogOpen = ref(false);
    const selectedControllers = ref([]);

    const showDialog = () => {
      isDialogOpen.value = true;
    };

    const confirmSelection = () => {
      emit("confirm", selectedControllers.value);
    };

    return {
      isDialogOpen,
      selectedControllers,
      showDialog,
      confirmSelection,
    };
  },
};
</script>
