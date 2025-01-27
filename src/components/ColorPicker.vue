<template>
  <MyCard :icon="'palette_outlined'" :title="title">
    <q-card-section class="row justify-center no-padding">
      <q-btn-group class="btn-group w-100">
        <q-btn
          name="hsv"
          :color="carouselPage === 'hsv' ? 'secondary' : 'primary'"
          class="equal-btn"
          no-caps
          @click="carouselPage = 'hsv'"
        >
          <template v-slot:default>
            <svgIcon name="palette_outlined" />
            <span>HSV</span>
          </template>
        </q-btn>
        <q-btn
          name="raw"
          :color="carouselPage === 'raw' ? 'secondary' : 'primary'"
          class="equal-btn"
          no-caps
          @click="carouselPage = 'raw'"
        >
          <template v-slot:default>
            <svgIcon name="palette_outlined" />
            <span>RAW</span>
          </template>
        </q-btn>
        <q-btn
          name="presets"
          :color="carouselPage === 'presets' ? 'secondary' : 'primary'"
          class="equal-btn"
          no-caps
          @click="carouselPage = 'presets'"
        >
          <template v-slot:default>
            <svgIcon name="star_outlined" />
            <span>Presets</span>
          </template>
        </q-btn>
      </q-btn-group>
    </q-card-section>
    <q-separator />
    <q-card-section :style="{ height: cardHeight }">
      <q-carousel v-model="carouselPage" animated :style="{ height: '100%' }">
        <q-carousel-slide name="hsv">
          <HsvSection :card-height="cardHeight" :open-dialog="openDialog" />
        </q-carousel-slide>
        <q-carousel-slide name="raw">
          <RawSection :card-height="cardHeight" :open-dialog="openDialog" />
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
import { presetDataStore } from "src/stores/presetDataStore";
import { storeStatus } from "src/stores/storeConstants";
import HsvSection from "src/components/HsvSection.vue";
import RawSection from "src/components/RawSection.vue";
import PresetSection from "src/components/PresetSection.vue";
import MyCard from "src/components/myCard.vue";

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
      default: "600px",
    },
  },
  setup() {
    const carouselPage = ref("hsv");
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

    const openDialog = (colorModel) => {
      presetColorModel.value = colorModel;
      showDialog.value = true;
    };

    return {
      carouselPage,
      openDialog,
      presetData,
      storeStatus,
      showDialog,
      presetColorModel,
    };
  },
};
</script>

<style scoped>
.icon {
  color: var(--icon-color);
  fill: var(--icon-color);
}

.equal-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-padding {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

.w-100 {
  width: 100%;
}
</style>
