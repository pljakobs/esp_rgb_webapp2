<template>
  <div>
    <q-btn label="Send to Controllers" color="primary" @click="showDialog" />
  </div>
</template>

<script>
import { ref } from "vue";
import { Dialog } from "quasar";
import SendToControllersContent from "src/components/sendToControllersDialogContent.vue";

export default {
  name: "sendToControllers",
  setup(_, { emit }) {
    const selectedControllers = ref([]);

    const showDialog = () => {
      Dialog.create({
        component: SendToControllersContent,
        componentProps: {
          selectedControllers: selectedControllers.value,
        },
        onOk: () => {
          emit("confirm", selectedControllers.value);
        },
      });
    };

    return {
      showDialog,
    };
  },
};
</script>
