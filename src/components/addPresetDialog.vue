<template>
  <q-dialog v-model="localIsOpen">
    <q-card>
      <q-card-section>
        <div class="text-h6">
          <q-badge
            :style="{
              backgroundColor: presetData.hsv
                ? `rgb(${hsvToRgb(presetData.hsv).r}, ${hsvToRgb(presetData.hsv).g}, ${hsvToRgb(presetData.hsv).b})`
                : `rgb(${presetData.raw.r}, ${presetData.raw.g}, ${presetData.raw.b})`,
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
        <q-btn flat label="Save" color="primary" @click="savePreset" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref } from "vue";
import { presetDataStore } from "src/stores/presetDataStore";
import { hsvToRgb } from "quasar";

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
  },
  emits: ["close", "save"],
  setup(props, { emit }) {
    const presetName = ref("");
    const presetsStore = presetDataStore();
    const localIsOpen = ref(false);

    const openDialog = () => {
      presetName.value = ""; // Reset the preset name when dialog opens
      localIsOpen.value = true;
    };

    const closeDialog = () => {
      emit("close");
      localIsOpen.value = false;
    };

    const savePreset = async () => {
      try {
        const existingPreset = presetsStore.data.presets.find(
          (preset) => preset.name === presetName.value,
        );
        if (existingPreset) {
          alert("Preset name must be unique. Please choose another name.");
          return;
        }
        const newPreset = {
          name: presetName.value,
          type: props.presetType,
          data: props.presetData,
        };
        await presetsStore.addPreset(newPreset);
        emit("save", newPreset);
        closeDialog();
      } catch (error) {
        console.error("Error saving preset:", error);
      }
    };

    return {
      presetName,
      localIsOpen,
      openDialog,
      closeDialog,
      savePreset,
      hsvToRgb,
    };
  },
};
</script>
