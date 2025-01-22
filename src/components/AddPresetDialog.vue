<!-- filepath: /home/pjakobs/devel/esp_rgb_webapp2/src/components/AddPresetDialog.vue -->
<template>
  <q-dialog v-model="localIsOpen">
    <q-card>
      <q-card-section>
        <div class="text-h6">Add Preset</div>
      </q-card-section>

      <q-card-section>
        <q-input v-model="presetName" label="Preset Name" filled autofocus />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="closeDialog" />
        <q-btn flat label="Save" color="primary" @click="savePreset" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, watch } from "vue";
import { presetDataStore } from "src/stores/presetDataStore";

export default {
  name: "AddPresetDialog",
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    presetType: {
      type: String,
      required: true,
    },
    presetData: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:modelValue", "close"],
  setup(props, { emit }) {
    const presetName = ref("");
    const presetsStore = presetDataStore();
    const localIsOpen = ref(props.modelValue);

    watch(
      () => props.modelValue,
      (newVal) => {
        localIsOpen.value = newVal;
      },
    );

    watch(
      () => localIsOpen.value,
      (newVal) => {
        emit("update:modelValue", newVal);
      },
    );

    const closeDialog = () => {
      emit("close");
      localIsOpen.value = false;
    };

    const savePreset = async () => {
      const existingPreset = presetsStore.data.presets.find(
        (preset) => preset.name === presetName.value,
      );

      if (existingPreset) {
        const overwrite = confirm(
          `Preset "${presetName.value}" already exists. Do you want to overwrite it?`,
        );
        if (!overwrite) {
          return;
        }
      }

      const newPreset = {
        name: presetName.value,
        type: props.presetType,
        data: props.presetData,
      };

      await presetsStore.addPreset(newPreset);
      closeDialog();
    };

    return {
      presetName,
      localIsOpen,
      closeDialog,
      savePreset,
    };
  },
};
</script>
