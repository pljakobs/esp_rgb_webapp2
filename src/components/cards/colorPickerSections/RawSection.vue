<template>
  <q-scroll-area style="height: 100%; width: 100%">
    <q-card-section>
      <ColorSlider
        v-for="colorSlider in colorSliders"
        :key="colorSlider.label"
        :min="colorSlider.min"
        :max="colorSlider.max"
        :label="colorSlider.label"
        :value="colorSlider.model"
        :color="colorSlider.color"
        label-on-top
        @update:model="($event) => updateColorSlider(colorSlider, $event)"
      />
    </q-card-section>
    <q-card-section>
      raw-r: {{ colorData.data.raw.r }}, raw-g: {{ colorData.data.raw.g }},
      raw-b: {{ colorData.data.raw.b }}, raw-ww: {{ colorData.data.raw.ww }},
      raw-cw: {{ colorData.data.raw.cw }}
    </q-card-section>
    <q-card-section class="flex justify-center">
      <q-btn @click="openDialog">
        <template v-slot:default>
          <svgIcon name="star_outlined" />
          <span>Add Preset</span>
        </template>
      </q-btn>
    </q-card-section>
  </q-scroll-area>
</template>

<script>
import { computed, ref } from "vue";
import { colors, Dialog } from "quasar";
import { colorDataStore } from "src/stores/colorDataStore";
import { useAppDataStore } from "src/stores/appDataStore";
import ColorSlider from "src/components/ColorSlider.vue";
import addPresetDialog from "src/components/Dialogs/addPresetDialog.vue";

export default {
  name: "RawSection",
  components: {
    ColorSlider,
    addPresetDialog,
  },
  props: {
    cardHeight: {
      type: String,
      default: "300px",
    },
  },

  setup() {
    const colorData = colorDataStore();
    const appData = useAppDataStore();

    const colorSliders = computed(() => [
      {
        label: "Red",
        model: colorData.data.raw.r,
        min: 0,
        max: 1023,
        color: "red",
      },
      {
        label: "Green",
        model: colorData.data.raw.g,
        min: 0,
        max: 1023,
        color: "green",
      },
      {
        label: "Blue",
        model: colorData.data.raw.b,
        min: 0,
        max: 1023,
        color: "blue",
      },
      {
        label: "Warm White",
        model: colorData.data.raw.ww,
        min: 0,
        max: 1023,
        color: "yellow",
      },
      {
        label: "Cold White",
        model: colorData.data.raw.cw,
        min: 0,
        max: 1023,
        color: "cyan",
      },
    ]);

    const updateColorSlider = (slider, value) => {
      const colorMap = {
        Red: "r",
        Green: "g",
        Blue: "b",
        "Warm White": "ww",
        "Cold White": "cw",
      };

      const rawColorKey = colorMap[slider.label];

      if (rawColorKey) {
        let raw = {};
        raw[rawColorKey] = value;
        colorData.updateData("raw", raw);
      }
    };

    const openDialog = () => {
      console.log("raw section openDialog");
      console.log("preset type:", "raw");
      console.log("colorData.data.raw", colorData.data.raw);
      Dialog.create({
        component: addPresetDialog,
        componentProps: {
          presetType: "raw",
          preset: colorData.data.raw,
        },
      })
        .onOk((preset) => {
          console.log("Dialog OK");
          console.log("raw save preset", preset);
          handleSave(preset);
        })
        .onCancel(() => {
          console.log("Dialog canceled");
        })
        .onDismiss(() => {
          console.log("Dialog dismissed");
        });
    };

    const handleSave = (preset) => {
      console.log("preset", JSON.stringify(preset));
      const newPreset = {
        name: preset.name,
        color: {
          raw: preset.data,
        },
        ts: Date.now(),
        favorite: false,
      };
      console.log("saving Preset:", JSON.stringify(newPreset));
      appData.addPreset(newPreset);
    };

    return {
      colorData,
      colorSliders,
      updateColorSlider,
      openDialog,
      handleSave,
    };
  },
};
</script>

<style scoped>
.icon {
  color: var(--icon-color);
  fill: var(--icon-color);
}
</style>
