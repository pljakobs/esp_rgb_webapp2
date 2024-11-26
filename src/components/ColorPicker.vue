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
          <HsvSection :card-height="cardHeight" :open-dialog="openDialog" />
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
      default: "300px",
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

.wider-btn-group {
  width: 100%;
}
</style>
