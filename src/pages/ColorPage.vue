<template>
  <div class="interaction-page">
    <ColorPicker card-height="80vh" />
    <q-dialog v-model="showDialog">
      <q-card
        class="shadow-4 col-auto fit q-gutter-md q-pa-md"
        style="max-width: 400px; max-height: 300px"
      >
        <q-card-section>
          <div class="text-h6">
            {{ $t("color.saveAs", { model: presetColorModel }) }}
          </div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="presetName" :label="$t('color.presetName')" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            flat
            :label="$t('common.cancel')"
            @click="showDialog = false"
          />
          <q-btn
            :label="$t('common.save')"
            @click="() => savePreset(presetName, presetColorModel)"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import ColorPicker from "src/components/cards/ColorPickerCard.vue";

export default {
  components: {
    ColorPicker,
  },
  setup() {
    const { t } = useI18n();
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

<style scoped>
.interaction-page {
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
}
</style>
