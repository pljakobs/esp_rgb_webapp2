<template>
  <q-scroll-area style="height: 100%; width: 100%">
    <q-card-section class="flex justify-center no-padding">
      <q-color v-model="color" format-model="hex" no-header no-footer />
    </q-card-section>
    <q-card-section class="flex justify-center">
      <q-btn
        icon="img:icons/star_outlined.svg"
        label="Add Preset"
        @click="() => openDialog('hsv')"
      />
    </q-card-section>
  </q-scroll-area>
</template>

<script>
import { ref, watch } from "vue";
import { colors } from "quasar";
import { colorDataStore } from "src/stores/colorDataStore";

const { hexToRgb, rgbToHsv, rgbToHex, hsvToRgb } = colors;

export default {
  name: "HsvSection",
  props: {
    cardHeight: {
      type: String,
      default: "300px",
    },
    openDialog: {
      type: Function,
      required: true,
    },
  },
  setup() {
    const colorData = colorDataStore();
    const color = ref("#000000");

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
      //color is the q-color component
      console.log("color picker changed:", val);
      const rgb = hexToRgb(val);
      const hsv = rgbToHsv(rgb);
      console.log("hsv", hsv);

      colorData.change_by = "color picker";
      console.log(
        "colorPage picker watcher color store:",
        JSON.stringify(colorData.data),
      );
      colorData.updateData("hsv", hsv);
    });

    return {
      color,
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
</style>
