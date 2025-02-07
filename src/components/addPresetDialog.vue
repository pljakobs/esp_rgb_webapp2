<template>
  <q-dialog :model-value="isOpen" @update:model-value="updateIsOpen">
    <q-card>
      <q-card-section>
        <div class="text-h6">
          <q-badge
            :style="{
              backgroundColor: presetData.hsv
                ? `rgb(${hsvToRgb(presetData.hsv).r}, ${hsvToRgb(presetData.hsv).g}, ${hsvToRgb(presetData.hsv).b})`
                : `rgb(${presetData.r}, ${presetData.g}, ${presetData.b})`,
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              border: '1px solid black',
            }"
            round
          />
          Add Preset
        </div>
      </q-card-section>
      <q-card-section>
        <q-input v-model="presetName" label="Preset Name" filled autofocus />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="closeDialog" />
        <q-btn flat label="Save" color="primary" @click="verifyPresetName" />
      </q-card-actions>
    </q-card>
    <q-dialog v-model="overwriteDialogOpen">
      <q-card>
        <q-card-section>
          <div class="text-h6">Preset Name Conflict</div>
        </q-card-section>
        <q-card-section>
          A preset with this name already exists. Do you want to overwrite it?
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            flat
            label="Cancel"
            color="primary"
            @click="closeOverwriteDialog"
          />
          <q-btn
            flat
            label="Overwrite"
            color="primary"
            @click="overwritePreset"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-dialog>
</template>

<script>
import { ref } from "vue";
import { colors } from "quasar";
import { presetDataStore } from "src/stores/presetDataStore";

const { hsvToRgb } = colors;

export default {
  name: "addPresetDialog",
  props: {
    presetType: {
      type: String,
      required: true,
    },
    presetData: {
      type: Object,
      required: true,
    },
    isOpen: {
      type: Boolean,
      required: true,
    },
  },
  emits: ["close", "save", "update:isOpen"],
  setup(props, { emit }) {
    const presetName = ref("");
    const overwriteDialogOpen = ref(false);
    const presetData = presetDataStore();

    const closeDialog = () => {
      emit("close");
      emit("update:isOpen", false);
    };

    const closeOverwriteDialog = () => {
      overwriteDialogOpen.value = false;
    };

    const verifyPresetName = () => {
      const existingPreset = presetData.data.presets.find(
        (preset) => preset.name === presetName.value,
      );
      if (existingPreset) {
        overwriteDialogOpen.value = true;
      } else {
        savePreset();
      }
    };

    const savePreset = () => {
      const newPreset = {
        name: presetName.value,
        type: props.presetType,
        data: props.presetData,
      };
      emit("save", newPreset);
      closeDialog();
    };

    const overwritePreset = () => {
      const existingPreset = presetData.data.presets.find(
        (preset) => preset.name === presetName.value,
      );
      if (existingPreset) {
        presetData.deletePreset(existingPreset);
      }
      savePreset();
      closeOverwriteDialog();
    };

    const updateIsOpen = (value) => {
      emit("update:isOpen", value);
    };

    return {
      presetName,
      overwriteDialogOpen,
      closeDialog,
      closeOverwriteDialog,
      verifyPresetName,
      savePreset,
      overwritePreset,
      updateIsOpen,
      hsvToRgb,
    };
  },
};
</script>
