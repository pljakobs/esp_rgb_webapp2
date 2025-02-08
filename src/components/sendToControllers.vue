<template>
  <q-dialog :model-value="dialog" @update:model-value="updateDialog">
    <q-card>
      <q-card-section>
        <div class="text-h6">Select Controllers</div>
      </q-card-section>

      <q-card-section>
        <q-select
          v-model="selectedControllers"
          :options="controllerOptions"
          label="Controllers"
          multiple
          emit-value
          map-options
          option-value="id"
          option-label="name"
          use-chips
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="cancelSelection" />
        <q-btn
          flat
          label="Send Preset"
          color="primary"
          @click="confirmSelection"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed } from "vue";
import { useControllersStore } from "src/stores/controllersStore";

export default {
  name: "sendToControllers",
  props: {
    dialog: {
      type: Boolean,
      required: true,
    },
  },
  setup(props, { emit }) {
    const controllersStore = useControllersStore();
    const selectedControllers = ref([]);

    const controllerOptions = computed(() => {
      return controllersStore.controllers.map((controller) => ({
        id: controller.id,
        name: controller.name,
      }));
    });

    const updateDialog = (value) => {
      emit("update:dialog", value);
    };

    const cancelSelection = () => {
      emit("update:dialog", false);
    };

    const confirmSelection = () => {
      emit("update:dialog", false);
      emit("confirm", selectedControllers.value);
    };

    return {
      selectedControllers,
      controllerOptions,
      confirmSelection,
      updateDialog,
      cancelSelection,
    };
  },
};
</script>

<style scoped>
/* Add any necessary styles here */
</style>
