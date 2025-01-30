<!-- filepath: /home/pjakobs/devel/esp_rgb_webapp2/src/components/HsvSection.vue -->
<template>
  <q-scroll-area style="height: 100%; width: 100%">
    <q-card-section class="flex justify-center no-padding">
      <q-color
        v-model="color"
        format-model="hex"
        no-header
        no-footer
        class="scaled-color"
      />
    </q-card-section>
    <q-card-section class="flex justify-center">
      <q-btn @click="handleAddPreset">
        <template v-slot:default>
          <svgIcon name="star_outlined" />
          <span>Add Preset</span>
        </template>
      </q-btn>
    </q-card-section>
  </q-scroll-area>
  <AddPresetDialog
    :isOpen="isDialogOpen"
    presetType="hsv"
    :presetData="presetData"
    @close="isDialogOpen = false"
  />
</template>

<script>
import { ref, watch, computed } from "vue";
import { colors } from "quasar";
import { colorDataStore } from "src/stores/colorDataStore";
import AddPresetDialog from "src/components/AddPresetDialog.vue";

const { hexToRgb, rgbToHsv, rgbToHex, hsvToRgb } = colors;

export default {
  name: "HsvSection",
  components: {
    AddPresetDialog,
  },
  props: {
    cardHeight: {
      type: String,
      default: "300px",
    },
    addPreset: {
      type: Function,
      required: true,
    },
  },
  setup(props) {
    const colorData = colorDataStore();
    const color = ref("#000000");
    const hsvColor = ref(null);

    // Watch for changes in the colorDataStore's hsv property
    watch(
      () => colorData.data.hsv,
      (val) => {
        if (val !== undefined) {
          const rgb = hsvToRgb(val);
          const hex = rgbToHex(rgb);
          color.value = hex;
        }
      },
      { immediate: true },
    );

    watch(color, (val) => {
      // color is the q-color component
      console.log("color picker changed:", val);
      const rgb = hexToRgb(val);
      const hsv = rgbToHsv(rgb);
      console.log("hsv", hsv);

      hsvColor.value = hsv; // Store the HSV value
      colorData.change_by = "color picker";
      console.log(
        "colorPage picker watcher color store:",
        JSON.stringify(colorData.data),
      );
      colorData.updateData("hsv", hsv);
    });

    const handleAddPreset = () => {
      console.log("handleAddPreset called");
      try {
        props.addPreset(hsvColor.value);
        console.log("Preset added with color:", hsvColor.value);
      } catch (error) {
        console.error("Error adding preset:", error);
      }
    };

    return {
      color,
      handleAddPreset,
    };
  },
};
</script>

<style scoped>
.no-padding {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}
.icon {
  color: var(--icon-color);
  fill: var(--icon-color);
}
.scaled-color {
  width: 150%;
  height: 150%;
}
</style>
