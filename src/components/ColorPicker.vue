<!-- filepath: /home/pjakobs/devel/esp_rgb_webapp2/src/components/ColorPicker.vue -->
<!-- filepath: /home/pjakobs/devel/esp_rgb_webapp2/src/components/ColorPicker.vue -->
<template>
  <MyCard :icon="icon" :title="title">
    <q-card-section class="row justify-center no-padding">
      <q-btn-group class="btn-group w-100">
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
    <q-card-section :style="{ height: cardHeight }">
      <q-carousel v-model="carouselPage" animated :style="{ height: '100%' }">
        <q-carousel-slide name="hsv">
          <HsvSection :card-height="cardHeight" :add-preset="addPreset" />
          <HsvSection :card-height="cardHeight" :add-preset="addPreset" />
        </q-carousel-slide>
        <q-carousel-slide name="raw">
          <RawSection :card-height="cardHeight" :add-preset="addPreset" />
          <RawSection :card-height="cardHeight" :add-preset="addPreset" />
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
import { Dialog } from "quasar";
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

    const addPreset = async (color) => {
      console.log("addPreset called with color:", color);
      try {
        const { value: name } = await Dialog.create({
          title: "Add Preset",
          message: "Enter a name for the new preset:",
          prompt: {
            model: "",
            type: "text",
          },
          cancel: true,
          persistent: true,
        });

        if (name) {
          console.log("Preset name entered:", name);
          const existingPreset = presetData.data.presets.find(
            (p) => p.name === name,
          );
          if (existingPreset) {
            console.log("Preset with this name already exists:", name);
            Dialog.create({
              title: "Error",
              message: "A preset with this name already exists.",
              ok: true,
              persistent: true,
            });
          } else {
            const newPreset = {
              name,
              color,
              favorite: false,
            };
            console.log("Adding new preset:", newPreset);
            await presetData.addPreset(newPreset);
            console.log("Preset added successfully:", newPreset);
            Dialog.create({
              title: "Success",
              message: "Preset added successfully.",
              ok: true,
              persistent: true,
            });
          }
        }
      } catch (error) {
        console.error("Error adding preset:", error);
      }
    };

    return {
      carouselPage,
      addPreset,
      addPreset,
      presetData,
      storeStatus,
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
