<template>
  <MyCard :icon="'palette_outlined'" :title="title || $t('cards.colorModel.title')" :collapsed="false">
    <q-card-section v-if="lights.loading && !lights.firmwareVersion"><q-linear-progress indeterminate /></q-card-section>
    <q-card-section v-if="lights.enabled">
      <mySelect :model-value="lights.selectedId" :options="lightOptions" emit-value map-options outlined dense label="Light" :disable="lights.loading || lights.saving" @update:model-value="lights.selectLight($event)" />
      <q-linear-progress v-if="lights.loading || lights.colorLoading" indeterminate class="q-mt-sm" />
      <q-banner v-if="lights.error" class="bg-negative text-white q-mt-sm">{{ lights.error }}</q-banner>
      <div v-if="!lights.loading && !lights.lights.length" class="text-grey-7 q-mt-sm">No lights configured</div>
    </q-card-section>
    <template v-if="!lights.loading && (!lights.enabled || lights.selectedLight)">
    <q-card-section v-if="!singleChannel" class="row justify-center no-padding">
      <q-btn-group class="btn-group w-100">
        <q-btn
          v-if="hasFavorites && !lights.enabled"
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
            <span>{{ tunableWhite ? $t('color.tunableWhite') : 'HSV' }}</span>
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
          v-if="!lights.enabled"
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
    <q-separator v-if="!singleChannel" />
    <q-card-section class="color-picker-body" :style="{ height: cardHeight, pointerEvents: lights.colorLoading || lights.saving || lights.error ? 'none' : undefined, opacity: lights.colorLoading || lights.saving ? 0.5 : 1 }">
      <q-carousel v-model="carouselPage" animated :style="{ height: '100%' }">
        <q-carousel-slide v-if="hasFavorites && !lights.enabled" name="favorites">
          <favoriteSection
            :card-height="cardHeight"
            @update:model-value="handleColorChange"
          />
        </q-carousel-slide>
        <q-carousel-slide name="hsv">
          <HsvSection
            :key="lights.enabled ? lights.selectedId + lights.selectedLight.type : 'legacy-hsv'"
            :profile="lights.enabled ? lights.profile : null"
            :card-height="cardHeight"
            :model-value="colorValue"
            @update:model-value="handleColorChange"
            @add-preset="openAddPresetDialog"
          />
        </q-carousel-slide>
        <q-carousel-slide v-if="!singleChannel" name="raw">
          <RawSection
            :key="lights.enabled ? lights.selectedId + lights.selectedLight.type : 'legacy-raw'"
            :profile="lights.enabled ? lights.profile : null"
            :card-height="cardHeight"
            :model-value="colorValue"
            @update:model-value="handleColorChange"
            @add-preset="openAddPresetDialog"
          />
        </q-carousel-slide>
        <q-carousel-slide v-if="!lights.enabled" name="presets">
          <PresetSection @update:model-value="handleColorChange" />
        </q-carousel-slide>
      </q-carousel>
    </q-card-section>
    </template>
  </MyCard>
</template>

<script>
import { ref, watch, computed, onMounted } from "vue";
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
import deleteItemDialog from "src/components/Dialogs/deleteItemDialog.vue";
import { useVirtualLightsStore } from "src/stores/virtualLightsStore";

import { savePreset, deletePreset } from "src/services/saveDelete";

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
      default: "palette_outlined",
    },
    title: {
      type: String,
      default: "",
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
    const lights = useVirtualLightsStore();
    lights.start();
    const singleChannel = computed(() => lights.enabled && lights.profile.channels.length === 1);
    const tunableWhite = computed(() => lights.enabled && !lights.profile.rgb && lights.profile.ct);
    watch(singleChannel, (single) => { if (single) carouselPage.value = "hsv"; });
    const lightOptions = computed(() => lights.lights.map((light) => ({ label: light.name || light.id, value: light.id })));
    watch(() => lights.enabled, () => { carouselPage.value = "hsv"; });

    // Load preset/scene data on component mount
    onMounted(() => {
      if (appData.status === storeStatus.IDLE) {
        appData.fetchData();
      }
    });

    // Local state to track the current color
    const colorValue = ref({});

    // Watch for changes in the colorDataStore
    watch(
      () => lights.enabled ? lights.color : colorStore.data,
      (newValue) => {
        if (lights.enabled) {
          colorValue.value = JSON.parse(JSON.stringify(newValue));
          return;
        }
        if (newValue.hsv) {
          colorValue.value = { hsv: { ...newValue.hsv } };
        } else if (newValue.raw) {
          colorValue.value = { raw: Array.isArray(newValue.raw) ? [...newValue.raw] : { ...newValue.raw } };
        } else {
          colorValue.value = {};
        }
      },
      { deep: true, immediate: true },
    );

    const hasFavorites = computed(
      () =>
        appData.data.presets.some((preset) => preset.favorite) ||
        appData.data.scenes.some((scene) => scene.favorite),
    );

    watch(
      () => hasFavorites.value,
      (newVal) => {
        if (newVal && !lights.enabled) {
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
      if (lights.loading) return;
      if (lights.enabled) {
        const payload = newColor.hsv ? { hsv: { ...newColor.hsv, ...(lights.profile.ct && newColor.ct !== undefined ? { ct: newColor.ct } : {}) } } : { raw: newColor.raw };
        lights.sendColor(payload);
        return;
      }
      colorValue.value = newColor;

      // Update the global store
      if (newColor.hsv) {
        colorStore.change_by = "component";
        if (newColor.ct !== undefined) {
           // We have to add ct to the payload
           colorStore.updateData("hsv", { ...newColor.hsv, ct: newColor.ct});
        }else {
          console.warn("handleColorChange: hsv update without ct");
          colorStore.updateData("hsv", newColor.hsv);
        }
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

            // Use the utility function with the store
            await deletePreset(
              appData,
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

          // Use the utility function with the store
          savePreset(
            appData,
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
      lights,
      singleChannel,
      tunableWhite,
      lightOptions,
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

@media (max-width: 600px) {
  .color-picker-body {
    padding: 0 !important;
  }

  .color-picker-body :deep(.q-carousel__slide) {
    padding: 0 !important;
  }
}
</style>
