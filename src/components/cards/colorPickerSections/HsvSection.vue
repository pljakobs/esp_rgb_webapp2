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
      <q-btn @click="openDialog">
        <template v-slot:default>
          <svgIcon name="star_outlined" />
          <span>Add Preset</span>
        </template>
      </q-btn>
    </q-card-section>
    <addPresetDialog
      :presetType="'hsv'"
      :presetData="colorData.data.hsv"
      :isOpen="isDialogOpen"
      @close="handleClose"
      @save="handleSave"
    />
  </q-scroll-area>
</template>

<script>
import { ref, watch } from "vue";
import { colors } from "quasar";
import { colorDataStore } from "src/stores/colorDataStore";
import { useAppDataStore } from "src/stores/appDataStore";
import addPresetDialog from "src/components/addPresetDialog.vue";

const { hexToRgb, rgbToHsv, rgbToHex, hsvToRgb } = colors;

export default {
  name: "HsvSection",
  components: {
    addPresetDialog,
  },
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
    const presetData = useAppDataStore();
    const color = ref("#000000");
    const isDialogOpen = ref(false);

    // Watch for changes in the colorDataStore's hsv property
    watch(
      () => colorData.data.hsv,
      (val) => {
        try {
          if (val !== undefined) {
            const rgb = hsvToRgb(val);
            const hex = rgbToHex(rgb);
            color.value = hex;
          }
        } catch (error) {
          console.log("error in hsv section watcher", error);
        }
      },
      { immediate: true },
    );

    watch(color, (val) => {
      //color is the q-color component
      try {
        console.log("color picker changed:", val);
        const rgb = hexToRgb(val);
        let hsv = rgbToHsv(rgb);
        hsv = {
          h: Math.round(hsv.h * 100) / 100,
          s: Math.round(hsv.s * 100) / 100,
          v: Math.round(hsv.v * 100) / 100,
        };
        console.log("calculated hsv", JSON.stringify(hsv));

        colorData.change_by = "color picker";
        console.log(
          "colorPage picker watcher color store:",
          JSON.stringify(colorData.data),
        );
        colorData.updateData("hsv", hsv);
      } catch (error) {
        console.log("error in color picker watcher", error);
      }
    });

    const openDialog = () => {
      console.log("hsv section openDialog");
      isDialogOpen.value = true;
    };

    const handleClose = () => {
      isDialogOpen.value = false;
    };

    const handleSave = (preset) => {
      console.log("preset", JSON.stringify(preset));
      const newPreset = {
        name: preset.name,
        color: {
          hsv: {
            h: preset.data.h,
            s: preset.data.s,
            v: preset.data.v,
          },
        },
        ts: Date.now(),
        favorite: false,
      };
      console.log("saving Preset:", JSON.stringify(newPreset));
      presetData.addPreset(newPreset);
      // Handle saving the preset here
      isDialogOpen.value = false;
    };

    return {
      color,
      isDialogOpen,
      colorData,
      openDialog,
      handleClose,
      handleSave,
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
