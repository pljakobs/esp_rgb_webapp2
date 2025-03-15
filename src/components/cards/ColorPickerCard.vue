<template>
  <MyCard :icon="'palette_outlined'" :title="title">
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
  </MyCard>
</template>

<script>
import { ref, watch, computed } from "vue";
import { useAppDataStore } from "src/stores/appDataStore";
import { storeStatus } from "src/stores/storeConstants";
import { colorDataStore } from "src/stores/colorDataStore";
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
    const colorStore = colorDataStore();

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

      const dialog = Dialog.create({
        component: addPresetDialog,
        componentProps: {
          presetType: presetData.type,
          preset: presetData.value,
        },
        persistent: true, // Make sure the dialog can't be closed except through our code
      })
        .onOk((result) => {
          console.log("Dialog OK event with result:", result);

          // Check if abort was requested before proceeding
          if (abortRequested.value) {
            console.log("Abort was requested, not processing OK event");
            return;
          }

          if (!result || !result.name) {
            console.error("No preset data returned from dialog");
            return;
          }

          // Create a new preset or update existing one
          const newPreset = {
            name: result.name,
            color: {},
            ts: Date.now(),
            favorite: result.favorite || false,
          };

          // If overwriting an existing preset, preserve its ID
          if (!result.isNew && result.existingId) {
            newPreset.id = result.existingId;
          }

          // Set the color based on preset type
          if (presetData.type === "hsv") {
            newPreset.color.hsv = presetData.value;
          } else if (presetData.type === "raw") {
            newPreset.color.raw = presetData.value;
          }

          console.log("Saving preset:", newPreset);

          // Create a wrapper around the progress callback to handle dialog closing
          const progressWrapper = (completed, total) => {
            // Call the original callback to update the dialog UI
            if (typeof result.updateProgress === "function") {
              result.updateProgress(completed, total);
            }

            // When saving is complete, close the dialog after a short delay
            if (completed === total) {
              console.log(
                "Save operation complete, closing dialog after delay",
              );
              setTimeout(() => {
                try {
                  // Use the known working method
                  if (result.dialogRef && result.dialogRef._value) {
                    result.dialogRef._value.hide();
                  }
                } catch (err) {
                  console.error("Error trying to close dialog:", err);
                  // Fallback only if the known method fails
                  Dialog.closeAll();
                }
              }, 800);
            }
          };

          // Save the preset and update progress
          appData.savePreset(newPreset, progressWrapper);
        })
        .onCancel(() => {
          console.log("Add preset dialog canceled");
        });

      // Handle abort events from the dialog
      if (dialog.componentInstance && dialog.componentInstance.$on) {
        dialog.componentInstance.$on("abort", async (abortData) => {
          console.log("Abort event received:", abortData);
          abortRequested.value = true;

          // Notify appData store about abort request
          appData.abortSaveOperation = true;

          // Delete the preset from controllers that already received it
          const presetId = abortData.existingId || appData.latestPresetId;

          // Only attempt rollback if we have a preset ID
          if (presetId) {
            try {
              console.log(`Rolling back preset ${presetId} from controllers`);

              // Use the appData store's deletePreset method instead of direct API calls
              await appData.deletePreset(
                { id: presetId, name: abortData.name || "Aborted preset" },
                (completed, total) => {
                  console.log(
                    `Rollback progress: ${completed}/${total} controllers processed`,
                  );
                },
              );

              console.log("Rollback complete");
            } catch (error) {
              console.error("Error during rollback:", error);
            }
          } else {
            console.warn("No preset ID available for rollback");
          }
        });
      }
    };

    return {
      carouselPage,
      presetData: appData,
      storeStatus,
      hasFavorites,
      colorValue,
      handleColorChange,
      openAddPresetDialog,
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
