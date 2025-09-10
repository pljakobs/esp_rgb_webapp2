<template>
  <div>
    <ColorPicker />
    <q-dialog v-model="showDialog">
      <q-card
        class="shadow-4 col-auto fit q-gutter-md q-pa-md"
        style="max-width: 400px; max-height: 300px"
      >
        <q-card-section>
          <div class="text-h6">Save as {{ presetColorModel }} preset</div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="presetName" label="Preset name" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="showDialog = false" />
          <q-btn
            label="Save"
            @click="() => savePreset(presetName, presetColorModel)"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import { ref } from "vue";
import ColorPicker from "src/components/cards/ColorPickerCard.vue";

export default {
  components: {
    ColorPicker,
  },
  setup() {
    const showDialog = ref(false);
    const presetName = ref("");
    const presetColorModel = ref("");

    const savePreset = (presetName, colorModel) => {
      // Logic to save preset
      console.log(`Saving preset: ${presetName} with model: ${colorModel}`);
      showDialog.value = false;
    };

    return {
      showDialog,
      presetName,
      presetColorModel,
      savePreset,
    };
  },
};
</script>

<style scoped></style>
