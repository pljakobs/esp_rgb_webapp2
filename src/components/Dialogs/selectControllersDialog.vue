<template>
  <q-dialog ref="dialog" @hide="onDialogHide">
    <q-card class="q-dialog-plugin">
      <q-toolbar class="bg-primary text-white">
        <q-toolbar-title>Select Controllers</q-toolbar-title>
      </q-toolbar>
      <q-card-section>
        <q-scroll-area class="inset-scroll-area">
          <q-list style="overflow-y: auto; height: 100%">
            <q-item
              v-for="controller in controllersList"
              :key="controller.id"
              clickable
              v-ripple
            >
              <q-item-section avatar>
                <q-checkbox
                  :model-value="
                    internalSelectedControllers.includes(controller.id)
                  "
                  @update:model-value="
                    updateSelectedControllers(controller.id, $event)
                  "
                />
              </q-item-section>
              <q-item-section>
                {{ controller.name }}
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="primary" label="OK" @click="onOKClick" />
        <q-btn color="primary" label="Cancel" @click="onCancelClick" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref } from "vue";

export default {
  props: {
    controllersList: {
      type: Array,
      required: true,
    },
    selectedControllers: {
      type: Array,
      required: true,
    },
  },
  emits: ["ok", "hide"],
  setup(props, { emit }) {
    const dialog = ref(null);
    const internalSelectedControllers = ref([...props.selectedControllers]);

    const updateSelectedControllers = (controllerId, isSelected) => {
      const updatedControllers = isSelected
        ? [...internalSelectedControllers.value, controllerId]
        : internalSelectedControllers.value.filter((id) => id !== controllerId);
      internalSelectedControllers.value = updatedControllers;
    };

    const onOKClick = () => {
      emit("ok", internalSelectedControllers.value);
      hide();
    };

    const onCancelClick = () => {
      hide();
    };

    const show = () => {
      dialog.value.show();
    };

    const hide = () => {
      dialog.value.hide();
    };

    const onDialogHide = () => {
      emit("hide");
    };

    return {
      dialog,
      internalSelectedControllers,
      updateSelectedControllers,
      onOKClick,
      onCancelClick,
      show,
      hide,
      onDialogHide,
    };
  },
};
</script>

<style scoped>
.adaptive-card {
  min-width: 400px;
  max-width: 80vw;
  max-height: 80vh;
  overflow: auto;
}

.scroll-area-container {
  margin: 10px;
  margin-right: 20px;
}

.inset-scroll-area {
  height: 300px;
  width: 100%;
  max-width: 400px;
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.1);
  margin: 10px;
}
</style>
