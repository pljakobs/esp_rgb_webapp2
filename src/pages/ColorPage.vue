<template>
  <div class="card-container">
    <div class="row">
      <q-btn-group>
        <q-btn
          name="hsv"
          label="HSV"
          icon="palette"
          color="primary"
          @click="carouselPage = 'hsv'"
        />
        <q-btn
          name="raw"
          label="Raw"
          icon="palette"
          color="primary"
          @click="carouselPage = 'raw'"
        />
        <q-btn
          name="presets"
          label="Presets"
          icon="palette"
          color="primary"
          @click="carouselPage = 'presets'"
        />
      </q-btn-group>
    </div>
    <q-carousel v-model="carouselPage" animated>
      <q-carousel-slide name="hsv">
        <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md">
          <q-card-section>
            <div class="text-h6">
              <q-icon name="palette" />
              HSV
            </div>
          </q-card-section>
          <q-separator />
          <q-card-section
            ><q-color v-model="color" format-model="hex" no-header no-footer />
          </q-card-section>
        </q-card>
      </q-carousel-slide>

      <q-carousel-slide name="raw">
        <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md">
          <q-card-section>
            <div class="text-h6">
              <q-icon name="palette" />
              RAW
            </div>
          </q-card-section>
          <q-separator />
          <q-card-section>
            raw sliders
            <ColorSlider
              v-for="colorSlider in colorSliders"
              :key="colorSlider.label"
              :min="colorSlider.min"
              :max="colorSlider.max"
              :label="colorSlider.label"
              :value="colorSlider.model"
              :color="colorSlider.color"
              @update:model="
                ($event) => {
                  console.log('in function:', $event);
                  updateColorSlider(colorSlider, $event);
                }
              "
            />
          </q-card-section>
        </q-card>
      </q-carousel-slide>

      <q-carousel-slide name="presets">
        <q-card class="my-card shadow-4 col-auto q-gutter-md">
          this will contain the presets
        </q-card>
      </q-carousel-slide>
    </q-carousel>
  </div>
</template>
<script>
import { ref, watch, computed, onMounted } from "vue";
import { colors } from "quasar";
import { colorDataStore, createComputedProperties } from "src/store"; // replace with the correct import paths
import ColorSlider from "src/components/ColorSlider.vue";

const { rgbToHsv, hexToRgb } = colors;

export default {
  setup() {
    const carouselPage = ref("hsv");
    const colorStore = colorDataStore;
    console.log(colorStore.state);

    const color = ref("#000000");
    const fields = [
      "raw.r",
      "raw.g",
      "raw.b",
      "raw.ww",
      "raw.cw",
      "hsv.h",
      "hsv.s",
      "hsv.v",
      "hsv.ct",
    ];
    const computedProperties = createComputedProperties(colorStore, fields);
    console.log("computedProperties", computedProperties);

    const colorSliders = computed(() => {
      // Define the sliders based on the selected model
      const sliders = [
        {
          label: "Red",
          model: computedProperties.raw.r,
          min: 0,
          max: 1023,
          color: "red",
        },
        {
          label: "Green",
          model: computedProperties.raw.g,
          min: 0,
          max: 1023,
          color: "green",
        },
        {
          label: "Blue",
          model: computedProperties.raw.b,
          min: 0,
          max: 1023,
          color: "blue",
        },
        {
          label: "Warm White",
          model: computedProperties.raw.ww,
          min: 0,
          max: 1023,
          color: "yellow",
        },
        {
          label: "Cold White",
          model: computedProperties.raw.cw,
          min: 0,
          max: 1023,
          color: "cyan",
        },
      ];
      return sliders;
    });

    const hsv_c = computed(() => ({
      h: computedProperties.hsv.h,
      s: computedProperties.hsv.s,
      v: computedProperties.hsv.v,
      ct: computedProperties.hsv.ct,
    }));

    const raw_c = computed(() => ({
      r: computedProperties.raw.r,
      g: computedProperties.raw.g,
      b: computedProperties.raw.b,
      ww: computedProperties.raw.ww,
      cw: computedProperties.raw.cw,
    }));

    watch(computedProperties.hsv, (val) => {
      console.log("hsv changed:", val);
      const rgb = hsvToRgb(val);
      const hex = rgbToHex(rgb);
      console.log("hex", hex);
      color.value = hex;
    });

    watch(color, (val) => {
      color.value - console.log("color changed:", val);
      console.log("color changed:", val);
      const rgb = hexToRgb(val);
      const hsv = rgbToHsv(rgb);
      console.log("hsv", hsv);
      colorStore.updateData("hsv", hsv);
    });

    const updateColorSlider = (slider, value) => {
      console.log("update for", slider);
      console.log("new value", value);
      //store.updateConfigData(slider.label.toLowerCase(), value);
      //store.dispatch('config/updateConfigData',''
    };

    onMounted(async () => {
      await colorStore.fetchData();
      console.log("color store in ColorPage.vue", colorStore.state);
    });

    return {
      ...computedProperties,
      color,
      carouselPage,
      colorSliders,
      updateColorSlider,
    };
  },

  components: {
    ColorSlider,
  },
};
</script>
<style scoped>
.card-container {
  position: relative;
  width: 420px;
}
.q-carousel {
  height: 80vh;
}
</style>
