<template>
  <div>
    <MyCard>
      <div class="row justify-center">
        <q-btn-group>
          <q-btn
            name="hsv"
            label="HSV"
            icon="img:icons/palette-outlined-24.svg"
            :color="carouselPage === 'hsv' ? 'secondary' : 'primary'"
            @click="carouselPage = 'hsv'"
          />
          <q-btn
            name="raw"
            label="Raw"
            icon="img:icons/palette-outlined-24.svg"
            :color="carouselPage === 'raw' ? 'secondary' : 'primary'"
            @click="carouselPage = 'raw'"
          />
          <q-btn
            name="presets"
            label="Presets"
            icon="img:icons/star-outlined-24.svg"
            :color="carouselPage === 'presets' ? 'secondary' : 'primary'"
            @click="carouselPage = 'presets'"
          />
        </q-btn-group>
      </div>

      <q-carousel v-model="carouselPage" animated>
        <q-carousel-slide name="hsv">
          <q-scroll-area style="height: 100%; width: 100%">
            <q-card-section>
              <div class="text-h6">
                <q-icon name="img:icons/palette-outlined-24.svg" />
                HSV
              </div>
            </q-card-section>
            <q-separator />
            <q-card-section class="flex justify-center">
              <q-color
                v-model="color"
                :style="{ height: '$(cardWidth)px' }"
                format-model="hex"
                no-header
                no-footer
              />
            </q-card-section>
            <q-card-section class="flex justify-center">
              <q-btn
                icon="img:icons/star-outlined-24.svg"
                label="add preset"
                @click="() => openDialog('hsv')"
              />
            </q-card-section>
          </q-scroll-area>
        </q-carousel-slide>

        <q-carousel-slide name="raw">
          <q-scroll-area style="height: 100%; width: 100%">
            <q-card-section>
              <div class="text-h6">
                <q-icon name="img:icons/palette-outlined-24.svg" />
                RAW
              </div>
            </q-card-section>
            <q-separator />
            <q-card-section>
              raw-r: {{ colorData.data.raw.r }}, raw-g:
              {{ colorData.data.raw.g }}, raw-b: {{ colorData.data.raw.b }},
              raw-ww: {{ colorData.data.raw.ww }}, raw-cw:
              {{ colorData.data.raw.cw }}</q-card-section
            >
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
                label-on-top
                @update:model="
                  ($event) => {
                    console.log('in function:', $event);
                    updateColorSlider(colorSlider, $event);
                  }
                "
              />
            </q-card-section>
            <q-card-section class="flex justify-center">
              <q-btn
                icon="img:icons/star-outlined-24.svg"
                label="add preset"
                @click="() => openDialog('raw')"
              />
            </q-card-section>
          </q-scroll-area>
        </q-carousel-slide>

        <q-carousel-slide name="presets">
          <q-card-section>
            <div class="text-h6">
              <q-icon name="img:icons/star-outlined-24.svg" />
              Presets
            </div>
          </q-card-section>
          <q-separator />

          <q-card-section>
            <div v-if="activePresets && activePresets.length > 0">
              <q-scroll-area style="height: 100%; width: 100%">
                <q-list separator style="overflow-y: auto; height: 100%">
                  <template v-if="activePresets.length != 0">
                    <q-item
                      v-for="preset in activePresets"
                      :key="preset.name"
                      class="q-my-sm"
                    >
                      <q-item-section avatar>
                        <q-badge
                          :style="{
                            backgroundColor: preset.raw
                              ? `rgb(${preset.raw.r}, ${preset.raw.g}, ${preset.raw.b})`
                              : `rgb(${hsvToRgb(preset.hsv).r}, ${hsvToRgb(preset.hsv).g}, ${hsvToRgb(preset.hsv).b})`,
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            border: '1px solid black',
                          }"
                          round
                          @click="handlePresetClick(preset)"
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
                          @click="handlePresetClick(preset)"
                        >
                          {{ preset.raw ? "RAW" : "HSV" }}
                        </q-badge>
                      </q-item-section>
                      <q-item-section @click="handlePresetClick(preset)">
                        {{ preset.name }}
                      </q-item-section>
                      <q-item-section side>
                        <q-icon
                          name="img:icons/star-outlined-24.svg"
                          size="2em"
                          :class="{ 'text-yellow': preset.favorite }"
                          @click="toggleFavorite(preset)"
                        />
                      </q-item-section>
                      <q-item-section side>
                        <q-icon
                          name="img:icons/delete-outlined-24.svg"
                          size="2em"
                          @click="deletePreset(preset)"
                        />
                      </q-item-section>
                    </q-item>
                  </template>
                  <template v-else>
                    <q-item>
                      <q-item-section>
                        <div class="text-center q-pa-md">
                          No presets available
                        </div>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-list>
              </q-scroll-area>
            </div>
            <div v-else>no presets available</div>
          </q-card-section>
        </q-carousel-slide>
      </q-carousel>
    </MyCard>
  </div>
  <q-dialog v-model="showDialog">
    <q-card
      class="shadow-4 col-auto fit q-gutter-md q-pa-md"
      style="max-width: 400px; max-height: 300px"
    >
      <q-card-section>
        <div class="text-h6">Save as {{ presetColorModel }} preset</div>
      </q-card-section>
      <q-card-section>
        <q-input v-model="presetName" label="Preset name" />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Cancel" @click="showDialog = false" />
        <q-btn
          label="Save"
          @click="() => savePreset(presetName, presetColorModel)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, watch, computed } from "vue";
import { colors } from "quasar";
import { storeStatus } from "src/stores/storeConstants";
import { colorDataStore } from "src/stores/colorDataStore";
import { presetDataStore } from "src/stores/presetDataStore";
import ColorSlider from "src/components/ColorSlider.vue";
import MyCard from "src/components/myCard.vue";

const { rgbToHsv, hexToRgb, hsvToRgb, rgbToHex } = colors;

export default {
  components: {
    ColorSlider,
    MyCard,
  },
  setup() {
    const carouselPage = ref("hsv");

    const colorData = colorDataStore();
    const presetData = presetDataStore();

    const color = ref("#000000");

    const showDialog = ref(false);
    const presetName = ref("");
    const presetColorModel = ref("");

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

    watch(
      () => carouselPage,
      (val) => {
        if (
          val === "presets" &&
          presetData.storeStatus === storeStatus.LOADING
        ) {
          presetData.fetchData();
        }
      },
    );

    watch(
      () => colorData.data.hsv,
      (val) => {
        if (val !== undefined) {
          //goes undefined when raw has changed
          //colorData is the store
          console.log("colorPage watcher Color Store hsv changed:", val);
          console.log("color store:", JSON.stringify(colorData.data));
          const rgb = hsvToRgb(val);
          const hex = rgbToHex(rgb);
          console.log("updated color, hex", hex);
          color.value = hex;
        }
      },
    );

    // ...
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

    watch(
      () => colorData.$state,
      (newState) => {
        if ("hsv" in newState) {
          console.warn(
            "hsv property added to root of store:",
            JSON.stringify(newState.hsv),
          );
        }
      },
      { deep: true },
    );

    const updateColorSlider = (slider, value) => {
      console.log("update for", slider);
      console.log("new value", value);
      const colorMap = {
        Red: "r",
        Green: "g",
        Blue: "b",
        "Warm White": "ww",
        "Cold White": "cw",
      };

      // Get the raw color key
      const rawColorKey = colorMap[slider.label];

      if (rawColorKey) {
        let raw = {};
        raw[rawColorKey] = value;

        // Convert the object to a JSON string
        //const raw = JSON.stringify(finalObject);
        console.log("raw:", raw);
        colorData.change_by = "raw slider";
        colorData.updateData("raw", raw);
      }
    };

    const savePreset = (presetName, colorModel) => {
      let settings;
      if (colorModel === "raw") {
        // Calculate the raw settings...
        settings = { ...colorData.data.raw };
      } else if (colorModel === "hsv") {
        console.log("save preset, color", color.value);
        const rgb = hexToRgb(color.value);
        const hsv = rgbToHsv(rgb);
        console.log(
          "saving hsv preset ",
          presetName,
          "colorModel ",
          colorModel,
          "value",
          hsv,
        );
        settings = hsv; // Set the settings to the HSV value
      } else {
        console.error("Unknown color model");
        return; // Exit the function if color model is unknown
      }

      // Insert the new preset into the presetDataStore
      console.log(
        "adding preset with name",
        presetName,
        "model",
        colorModel,
        "value",
        settings,
      );
      if (colorModel === "hsv") {
        presetData
          .addPreset({
            //id: "",
            name: presetName,
            color: {
              hsv: settings,
            },
            favorite: false,
          })
          .catch((error) => {
            console.error("Error adding preset:", error);
          });
      } else {
        presetData
          .addPreset({
            // id: "",
            name: presetName,
            color: {
              raw: settings,
            },
            favorite: false,
          })
          .catch((error) => {
            console.error("Error adding preset:", error);
          });
      }
      showDialog.value = false;
      console.log(
        `Preset "${presetName.value}" with color model "${colorModel}" has been added.`,
      );
    };

    const toggleFavorite = (preset) => {
      preset.favorite = !preset.favorite;
      presetData.updatePreset(preset);
    };

    const deletePreset = (preset) => {
      // Remove the preset from presetData.data['presets']
      presetData.deletePreset(preset);
    };

    const openDialog = (colorModel) => {
      presetColorModel.value = colorModel;
      showDialog.value = true;
    };
    const handlePresetClick = (preset) => {
      console.log("preset selected", preset);

      if (preset.raw) {
        colorData.change_by = "preset";
        colorData.updateData("raw", preset.raw);
      } else {
        colorData.change_by = "preset";
        colorData.updateData("hsv", preset.hsv);
      }
    };

    return {
      color,
      carouselPage,
      colorSliders,
      updateColorSlider,
      colorData,
      storeStatus,
      presetData,
      hsvToRgb,
      handlePresetClick,
      showDialog,
      presetName,
      savePreset,
      openDialog,
      presetColorModel,
      toggleFavorite,
      deletePreset,
    };
  },
  computed: {
    activePresets() {
      const presets = this.presetData.data["presets"];
      if (!presets) {
        return [];
      }
      return presets.filter((preset) => !preset.deleted);
    },
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
