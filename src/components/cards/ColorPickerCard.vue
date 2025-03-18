<template>
  <MyCard :icon="'palette_outlined'" :title="title" :collapsed="false">
    <q-card-section class="row justify-center no-padding">
      <q-btn-group class="btn-group w-100">
        <q-btn
          v-if="hasFavorites"
          name="Favorites"
          :color="carouselPage === 'favorites' ? 'secondary' : 'primary'"
          class="equal-btn"
          no-caps
          @click="carouselPage = 'favorites'"
        >
          <template v-slot:default>
            <svgIcon name="palette_outlined" />
            <span>Favorites</span>
          </template>
        </q-btn>
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
        <q-carousel-slide v-if="hasFavorites" name="favorites">
          <favoriteSection
            :card-height="cardHeight"
            @update:model-value="handleColorChange"
          />
        </q-carousel-slide>
        <q-carousel-slide name="hsv">
          <HsvSection
            :card-height="cardHeight"
            :model-value="colorValue"
            @update:model-value="handleColorChange"
            @add-preset="openAddPresetDialog"
          />
        </q-carousel-slide>
        <q-carousel-slide name="raw">
          <RawSection
            :card-height="cardHeight"
            :model-value="colorValue"
            @update:model-value="handleColorChange"
            @add-preset="openAddPresetDialog"
          />
        </q-carousel-slide>
        <q-carousel-slide name="presets">
          <PresetSection @update:model-value="handleColorChange" />
        </q-carousel-slide>
      </q-carousel>
    </q-card-section>
    <q-btn
      label="Sync All Controllers"
      icon="sync"
      :loading="syncing"
      @click="startSync"
      color="primary"
    />
  </MyCard>
</template>

<script>
import { ref, watch, computed } from "vue";
import { useAppDataStore } from "src/stores/appDataStore";
import { storeStatus } from "src/stores/storeConstants";
import { useColorDataStore } from "src/stores/colorDataStore";
import { Dialog } from "quasar";
import favoriteSection from "src/components/cards/colorPickerSections/favoriteSection.vue";
import HsvSection from "src/components/cards/colorPickerSections/HsvSection.vue";
import RawSection from "src/components/cards/colorPickerSections/RawSection.vue";
import PresetSection from "src/components/cards/colorPickerSections/PresetSection.vue";
import MyCard from "src/components/myCard.vue";
import addPresetDialog from "src/components/Dialogs/addPresetDialog.vue";

export default {
  name: "ColorPicker",
  components: {
    MyCard,
    favoriteSection,
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
    const appData = useAppDataStore();
    const colorStore = useColorDataStore();

    // Local state to track the current color
    const colorValue = ref({});

    // Watch for changes in the colorDataStore
    watch(
      () => colorStore.data,
      (newValue) => {
        if (newValue.hsv) {
          colorValue.value = { hsv: { ...newValue.hsv } };
        } else if (newValue.raw) {
          colorValue.value = { raw: { ...newValue.raw } };
        }
      },
      { deep: true, immediate: true },
    );

    const hasFavorites = computed(() =>
      appData.data.presets.some((preset) => preset.favorite),
    );

    watch(
      () => hasFavorites.value,
      (newVal) => {
        if (newVal) {
          carouselPage.value = "favorites";
        } else {
          carouselPage.value = "hsv";
        }
      },
      { immediate: true },
    );

    watch(
      () => carouselPage.value,
      (val) => {
        if (val === "presets" && appData.storeStatus === storeStatus.LOADING) {
          appData.fetchData();
        }
      },
    );

    // Handle color changes from any section
    const handleColorChange = (newColor) => {
      colorValue.value = newColor;

      // Update the global store
      if (newColor.hsv) {
        colorStore.change_by = "component";
        colorStore.updateData("hsv", newColor.hsv);
      } else if (newColor.raw) {
        colorStore.change_by = "component";
        colorStore.updateData("raw", newColor.raw);
      }
    };

    const openAddPresetDialog = (presetData) => {
      console.log("Opening add preset dialog with:", presetData);

      // Create a reference to track if an abort was requested
      const abortRequested = ref(false);

      // Create functions that will be passed as props to the dialog component
      const handleAbort = async (abortData) => {
        console.log("Abort event received:", abortData);
        abortRequested.value = true;

        // Notify appData store about abort request
        appData.abortSaveOperation = true;

        let presetId = abortData.existingId;

        // If it's a new preset, search for it by name in the store
        if (!presetId && abortData.name) {
          const foundPreset = appData.data.presets.find(
            (p) => p.name === abortData.name,
          );
          if (foundPreset) {
            presetId = foundPreset.id;
            console.log(
              `Found preset ID ${presetId} for name "${abortData.name}"`,
            );
          }
        }

        // Only attempt rollback if we have a preset ID
        if (presetId) {
          try {
            console.log(`Rolling back preset ${presetId} from controllers`);

            // Use the appData store's deletePreset method
            await appData.deletePreset(
              { id: presetId, name: abortData.name || "Aborted preset" },
              abortData.updateProgress ||
                ((completed, total) => {
                  console.log(
                    `Rollback progress: ${completed}/${total} controllers processed`,
                  );
                }),
            );

            console.log("Rollback complete");
          } catch (error) {
            console.error("Error during rollback:", error);
          }
        } else {
          console.warn("No preset ID available for rollback");

          // Notify the dialog that no rollback will occur
          if (abortData.updateProgress) {
            abortData.updateProgress(-1, -1, null, {
              noPresetId: true,
              message:
                "No preset ID found for rollback. The save operation was aborted, but no controllers needed to be updated.",
            });
          }
        }
      };

      const dialog = Dialog.create({
        component: addPresetDialog,
        componentProps: {
          presetType: presetData.type,
          preset: presetData.value,
          onAbort: handleAbort, // Pass the abort handler as a prop
        },
        persistent: true,
      })
        .onOk((result) => {
          // Don't proceed if an abort was requested
          if (abortRequested.value) {
            console.log("Save operation was aborted, not processing OK event");
            return;
          }

          console.log("Dialog OK with result:", result);

          if (!result || !result.name) {
            console.error("Invalid result from dialog");
            return;
          }

          // Create a new preset object
          const newPreset = {
            name: result.name,
            color: {},
            ts: Date.now(),
            favorite: result.favorite || false,
          };

          // If this is overwriting an existing preset, preserve its ID
          if (!result.isNew && result.existingId) {
            newPreset.id = result.existingId;
          }

          // Set the color data based on preset type
          if (presetData.type === "hsv") {
            newPreset.color.hsv = presetData.value;
          } else if (presetData.type === "raw") {
            newPreset.color.raw = presetData.value;
          }

          console.log("Saving preset:", newPreset);

          // Call the store's savePreset method with the progress callback
          appData.savePreset(
            newPreset,
            result.updateProgress ||
              ((completed, total) => {
                console.log(`Save progress: ${completed}/${total} controllers`);
              }),
          );
        })
        .onCancel(() => {
          console.log("Add preset dialog canceled");
        });
    };

    const syncing = ref(false);
    const progress = ref(0);

    async function startSync() {
      syncing.value = true;
      progress.value = 0;

      try {
        console.log("starting sync function");
        await appData.synchronizeAllData((completed, total) => {
          progress.value = (completed / total) * 100;
        });
        // Show success notification
        console.log("success");
        Notify.create({
          type: "positive",
          message: "All controllers synchronized successfully",
        });
      } catch (error) {
        // Show error notification
        console.error("Error synchronizing controllers:", error);
        Notify.create({
          type: "negative",
          message: "Error synchronizing controllers",
        });
      } finally {
        syncing.value = false;
      }
    }

    return {
      carouselPage,
      presetData: appData,
      storeStatus,
      hasFavorites,
      colorValue,
      handleColorChange,
      openAddPresetDialog,
      startSync,
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
