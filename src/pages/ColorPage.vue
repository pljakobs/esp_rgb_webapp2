<template>
  <div>
    <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md">
      <div class="row justify-center">
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
          <q-card ref="colorPickerCard">
            <q-card-section>
              <div class="text-h6">
                <q-icon name="palette" />
                HSV
              </div>
            </q-card-section>
            <q-separator />
            <q-card-section class="flex justify-center"
              ><q-color
                :style="{ height: '$(cardWidth)px' }"
                v-model="color"
                format-model="hex"
                no-header
                no-footer
              />
            </q-card-section>
          </q-card>
        </q-carousel-slide>

        <q-carousel-slide name="raw">
          <q-card>
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
          <q-card>
            <q-list>
              <q-item
                v-for="preset in presetData.data['presets']"
                :key="preset.name"
                class="q-my-sm"
              >
                <q-item-section avatar>
                  <q-badge
                    :style="{
                      backgroundColor: preset.raw
                        ? `rgb(${preset.raw.r}, ${preset.raw.g}, ${preset.raw.b})`
                        : `rgb(${hsvToRgb(preset.hsv).r}, ${
                            hsvToRgb(preset.hsv).g
                          }, ${hsvToRgb(preset.hsv).b})`,
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      border: '1px solid black',
                    }"
                    round
                  />
                </q-item-section>
                <q-item-section avatar>
                  <q-badge
                    style="
                      background-color: black;
                      color: white;
                      font-size: 0.8em;
                    "
                    round
                  >
                    {{ preset.raw ? "RAW" : "HSV" }}
                  </q-badge>
                </q-item-section>
                <q-item-section>
                  {{ preset.name }}
                </q-item-section>
                <q-item-section>
                  <q-icon
                    name="star"
                    :class="{ 'text-yellow': preset.favorite }"
                    style="font-size: 1.5em"
                  />
                </q-item-section>

                <!--
              <q-item-section>
                <div v-if="preset.hsv">{{ hsvToRgb(preset.hsv) }}</div>
                <div v-else>
                  {{ preset.raw.r }}, {{ preset.raw.g }}, {{ preset.raw.b }}
                </div>
              </q-item-section>
              -->
              </q-item>
            </q-list>
          </q-card>
        </q-carousel-slide>
      </q-carousel>
    </q-card>
  </div>
</template>
<script>
import { ref, watch, computed, onMounted } from "vue";
import { colors } from "quasar";
import { colorDataStore, storeStatus, presetDataStore } from "src/store"; // replace with the correct import paths
import ColorSlider from "src/components/ColorSlider.vue";

const { rgbToHsv, hexToRgb, hsvToRgb } = colors;

export default {
  setup() {
    const isLoading = ref(true);
    const carouselPage = ref("hsv");

    const colorData = colorDataStore();
    const presetData = presetDataStore();

    const color = ref("#000000");
    const colorSliders = computed(() => {
      // Define the sliders based on the selected model
      const sliders = [
        {
          label: "Red",
          model: colorData.raw.r,
          min: 0,
          max: 1023,
          color: "red",
        },
        {
          label: "Green",
          model: colorData.raw.g,
          min: 0,
          max: 1023,
          color: "green",
        },
        {
          label: "Blue",
          model: colorData.raw.b,
          min: 0,
          max: 1023,
          color: "blue",
        },
        {
          label: "Warm White",
          model: colorData.raw.ww,
          min: 0,
          max: 1023,
          color: "yellow",
        },
        {
          label: "Cold White",
          model: colorData.raw.cw,
          min: 0,
          max: 1023,
          color: "cyan",
        },
      ];
      return sliders;
    });

    const hsv_c = computed(() => ({
      h: colorData.hsv.h,
      s: colorData.hsv.s,
      v: colorData.hsv.v,
      ct: colorData.hsv.ct,
    }));

    const raw_c = computed(() => ({
      r: colorData.raw.r,
      g: colorData.raw.g,
      b: colorData.raw.b,
      ww: colorData.raw.ww,
      cw: colorData.raw.cw,
    }));

    watch(colorData.hsv, (val) => {
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
      colorData.updateData("hsv", hsv);
    });

    const updateColorSlider = (slider, value) => {
      console.log("update for", slider);
      console.log("new value", value);
    };

    /*
     * This is a workaround for the fact that the q-color component does not have a width property.
     */
    const colorPickerCard = ref(null);
    const cardWidth = computed(() => {
      console.log("colorPickerCard", colorPickerCard.value.$el.offsetWidth);
      return colorPickerCard.value ? colorPickerCard.value.$el.offsetWidth : 0;
    });

    return {
      color,
      carouselPage,
      colorSliders,
      updateColorSlider,
      colorData,
      storeStatus,
      presetData,
      hsvToRgb,
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
.q-card {
  height: 100%;
}
.q-color-picker {
  max-width: 400px;
  min-width: 240px;
}

:deep(.q-slider) {
  height: 20px;
}
:deep(.q-slider__track) {
  height: 32px;
}
:deep(.q-slider__thumb) {
  width: 40px;
  height: 40px;
}
</style>
den
