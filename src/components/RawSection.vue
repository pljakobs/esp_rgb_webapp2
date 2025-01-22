<!-- filepath: /home/pjakobs/devel/esp_rgb_webapp2/src/components/RawSection.vue -->
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
      <q-btn
        icon="img:icons/star_outlined.svg"
        label="Add Preset"
        @click="openDialog('raw')"
      />
    </q-card-section>
  </q-scroll-area>
  <AddPresetDialog
    :isOpen="isDialogOpen"
    presetType="raw"
    :presetData="presetData"
    @close="isDialogOpen = false"
  />
</template>

<script>
import { computed, ref } from "vue";
import { colorDataStore } from "src/stores/colorDataStore";
import ColorSlider from "src/components/ColorSlider.vue";
import AddPresetDialog from "src/components/AddPresetDialog.vue";

export default {
  name: "RawSection",
  components: {
    ColorSlider,
    AddPresetDialog,
  },
  props: {
    openDialog: {
      type: Function,
      required: true,
    },
  },
  setup() {
    const colorData = colorDataStore();
    const isDialogOpen = ref(false);

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

    const presetData = computed(() => {
      return {
        r: colorData.data.raw.r,
        g: colorData.data.raw.g,
        b: colorData.data.raw.b,
        ww: colorData.data.raw.ww,
        cw: colorData.data.raw.cw,
      };
    });

    const openDialog = () => {
      isDialogOpen.value = true;
    };

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

    return {
      colorData,
      colorSliders,
      updateColorSlider,
      isDialogOpen,
      openDialog,
      presetData,
    };
  },
};
</script>

<style scoped></style>
