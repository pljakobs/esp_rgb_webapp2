<template>
  <q-dialog :model-value="isOpen" @update:model-value="updateIsOpen">
    <q-card class="adaptive-card">
      <q-card-section>
        <div class="text-h6">{{ title }}</div>
      </q-card-section>
      <q-card-section class="scroll-area-container">
        <q-scroll-area class="inset-scroll-area">
          <component :is="component" v-bind="componentProps" />
        </q-scroll-area>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="cancel" />
        <q-btn flat label="Confirm" color="primary" @click="confirm" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
export default {
  name: "GenericDialog",
  props: {
    isOpen: {
      type: Boolean,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    component: {
      type: [Object, Function, String],
      required: true,
    },
    componentProps: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ["update:isOpen", "confirm"],
  setup(props, { emit }) {
    const updateIsOpen = (value) => {
      emit("update:isOpen", value);
    };

    const cancel = () => {
      emit("update:isOpen", false);
    };

    const confirm = () => {
      emit("confirm");
      emit("update:isOpen", false);
    };

    return {
      updateIsOpen,
      cancel,
      confirm,
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
