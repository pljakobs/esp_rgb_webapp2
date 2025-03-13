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
    <q-card-section class="flex justify-center" v-if="isDialog !== true">
      <q-btn flat color="primary" @click="openDialog">
        <template v-slot:default>
          <svgIcon name="star_outlined" />
          <span>Add Preset</span>
        </template>
      </q-btn>
    </q-card-section>
  </q-scroll-area>
</template>

<script>
import { ref, watch } from "vue";
import { colors, Dialog } from "quasar";
import { colorDataStore } from "src/stores/colorDataStore";
import { useAppDataStore } from "src/stores/appDataStore";
import addPresetDialog from "src/components/Dialogs/addPresetDialog.vue";

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
    isDialog: {
      type: Boolean,
      default: false,
    },
  },
  setup() {
    const colorData = colorDataStore();
    const presetData = useAppDataStore();
    const color = ref("#000000");

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
      console.log("preset type:", "hsv");
      console.log("colorData.data.hsv", colorData.data.hsv);
      Dialog.create({
        component: addPresetDialog,
        componentProps: {
          presetType: "hsv",
          preset: colorData.data.hsv,
        },
      })
        .onOk((preset) => {
          console.log("Dialog OK");
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
      console.log("returned from saving preset");
    };

    return {
      color,
      colorData,
      openDialog,
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
