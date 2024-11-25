<template>
  <MyCard :icon="icon" :title="title">
    <q-card-section class="row justify-center no-padding">
      <q-btn-group class="btn-group no-padding">
        <q-btn
          name="hsv"
          label="HSV"
          icon="img:icons/palette_outlined.svg"
          :color="carouselPage === 'hsv' ? 'secondary' : 'primary'"
          class="equal-btn"
          no-caps
          @click="carouselPage = 'hsv'"
        />
        <q-btn
          name="raw"
          label="Raw"
          icon="img:icons/palette_outlined.svg"
          :color="carouselPage === 'raw' ? 'secondary' : 'primary'"
          class="equal-btn"
          no-caps
          @click="carouselPage = 'raw'"
        />
        <q-btn
          name="presets"
          label="Presets"
          icon="img:icons/star_outlined.svg"
          :color="carouselPage === 'presets' ? 'secondary' : 'primary'"
          class="equal-btn"
          no-caps
          @click="carouselPage = 'presets'"
        />
      </q-btn-group>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <q-carousel v-model="carouselPage" animated>
        <q-carousel-slide name="hsv">
          <HsvSection
            :color="color"
            :card-height="cardHeight"
            :open-dialog="openDialog"
            @update:color="updateColor"
          />
        </q-carousel-slide>
        <q-carousel-slide name="raw">
          <RawSection :open-dialog="openDialog" />
        </q-carousel-slide>
        <q-carousel-slide name="presets">
          <PresetSection />
        </q-carousel-slide>
      </q-carousel>
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, watch } from "vue";
import { colors } from "quasar";
import { colorDataStore } from "src/stores/colorDataStore";
import { presetDataStore } from "src/stores/presetDataStore";
import { storeStatus } from "src/stores/storeConstants";
import HsvSection from "src/components/HsvSection.vue";
import RawSection from "src/components/RawSection.vue";
import PresetSection from "src/components/PresetSection.vue";
import MyCard from "src/components/myCard.vue";

const { hsvToRgb, hexToRgb, rgbToHsv, rgbToHex } = colors;

export default {
  name: "ColorPicker",
  components: {
    MyCard,
    HsvSection,
    RawSection,
    PresetSection,
  },
  props: {
    icon: {
      type: String,
      default: "img:icons/palette_outlined.svg",
    },
    title: {
      type: String,
      default: "Color Picker",
    },
    cardHeight: {
      type: String,
      default: "300px",
    },
  },
  setup() {
    const carouselPage = ref("hsv");
    const color = ref("#000000");
    const colorData = colorDataStore();
    const presetData = presetDataStore();
    const showDialog = ref(false);
    const presetColorModel = ref("");

    watch(
      () => carouselPage.value,
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

    const openDialog = (colorModel) => {
      presetColorModel.value = colorModel;
      showDialog.value = true;
    };

    const updateColor = (newColor) => {
      color.value = newColor;
    };

    return {
      carouselPage,
      color,
      openDialog,
      colorData,
      storeStatus,
      showDialog,
      presetColorModel,
      updateColor,
    };
  },
};
</script>

<style scoped>
.equal-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wider-btn-group {
  width: 110%;
}
</style>
