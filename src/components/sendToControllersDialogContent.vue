<template>
  <q-list>
    <q-item
      v-for="controller in controllersList"
      :key="controller.id"
      clickable
      v-ripple
    >
      <q-item-section avatar>
        <q-checkbox
          :model-value="selectedControllers.includes(controller.id)"
          @update:model-value="updateSelectedControllers(controller.id, $event)"
        />
      </q-item-section>
      <q-item-section>
        {{ controller.name }}
      </q-item-section>
    </q-item>
  </q-list>
</template>

<script>
import { computed } from "vue";
import { useControllersStore } from "src/stores/controllersStore";
import { infoDataStore } from "src/stores/infoDataStore";

export default {
  name: "SendToControllersContent",
  props: {
    selectedControllers: {
      type: Array,
      required: true,
    },
  },
  emits: ["update:selectedControllers"],
  setup(props, { emit }) {
    const store = useControllersStore();
    const infoData = infoDataStore();

    const controllersList = computed(() => {
      try {
        const controllers = store.data;
        const localDeviceId = infoData.data.deviceid;
        if (!controllers) {
          return [];
        }
        const options = controllers
          .filter((controller) => {
            return (
              controller.id !== undefined &&
              String(controller.id) !== localDeviceId
            );
          })
          .map((controller) => ({
            address: controller.ip_address,
            name: controller.hostname,
            id: controller.id,
          }));
        return options;
      } catch (error) {
        console.error("Error computing controllersList:", error);
        return [];
      }
    });

    const updateSelectedControllers = (controllerId, isSelected) => {
      const updatedControllers = isSelected
        ? [...props.selectedControllers, controllerId]
        : props.selectedControllers.filter((id) => id !== controllerId);
      emit("update:selectedControllers", updatedControllers);
    };

    return {
      controllersList,
      updateSelectedControllers,
    };
  },
};
</script>
