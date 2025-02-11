<template>
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
                backgroundColor: preset.color.raw
                  ? `rgb(${preset.color.raw.r}, ${preset.color.raw.g}, ${preset.color.raw.b})`
                  : `rgb(${hsvToRgb(preset.color.hsv).r}, ${hsvToRgb(preset.color.hsv).g}, ${hsvToRgb(preset.color.hsv).b})`,
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
              style="background-color: black; color: white; font-size: 0.8em"
              round
              @click="handlePresetClick(preset)"
            >
              {{ preset.color.raw ? "RAW" : "HSV" }}
            </q-badge>
          </q-item-section>
          <q-item-section @click="handlePresetClick(preset)">
            {{ preset.name }}
          </q-item-section>
          <q-item-section side>
            <svgIcon name="arrow_forward" @click="sendPreset(preset)" />
            <q-tooltip>Send Preset to other controllers</q-tooltip>
          </q-item-section>
          <q-item-section side>
            <svgIcon
              name="star_outlined"
              :isSelected="preset.favorite"
              @click="toggleFavorite(preset)"
            />
            <q-tooltip>{{
              preset.favorite ? "Remove from favorites" : "Add to favorites"
            }}</q-tooltip>
          </q-item-section>
          <q-item-section side>
            <div class="icon-wrapper" @click="deletePreset(preset)">
              <svgIcon name="delete" />
            </div>
            <q-tooltip>Delete Preset</q-tooltip>
          </q-item-section>
        </q-item>
      </template>
      <template v-else>
        <q-item>
          <q-item-section>
            <div class="text-center q-pa-md">No presets available</div>
          </q-item-section>
        </q-item>
      </template>
    </q-list>
  </q-scroll-area>
  <send-to-controllers
    :dialog="showSendDialog"
    @update:dialog="showSendDialog = $event"
    @confirm="handleSendPreset"
  />
</template>

<script>
import { ref, computed, onMounted } from "vue";
import { colors } from "quasar";
import { presetDataStore } from "src/stores/presetDataStore";
import { colorDataStore } from "src/stores/colorDataStore";
import { controllersStore } from "src/stores/controllersStore";
import sendToControllers from "src/components/sendToControllers.vue";

const { hsvToRgb } = colors;

export default {
  name: "PresetSection",
  components: {
    sendToControllers,
  },
  setup() {
    const presetData = presetDataStore();
    const colorData = colorDataStore();
    const controllers = controllersStore();
    const showSendDialog = ref(false);
    const selectedPreset = ref(null);

    // Fetch presets data on component mount
    onMounted(() => {
      try {
        console.log("Fetching preset data...");
        presetData.fetchData();
      } catch (error) {
        console.error("Error fetching preset data:", error);
      }
    });

    const activePresets = computed(() => {
      try {
        const presets = presetData.data.presets;
        if (!presets) {
          return [];
        }
        console.log("activePresets", JSON.stringify(presets));
        return presets;
      } catch (error) {
        console.error("Error computing activePresets:", error);
        return [];
      }
    });

    const handlePresetClick = (preset) => {
      try {
        console.log("preset selected", preset);

        if (preset.color.raw) {
          colorData.change_by = "preset";
          colorData.updateData("raw", preset.color.raw);
        } else {
          colorData.change_by = "preset";
          colorData.updateData("hsv", preset.color.hsv);
        }
      } catch (error) {
        console.error("Error handling preset click:", error);
      }
    };

    const sendPreset = (preset) => {
      try {
        console.log("sendPreset called with preset:", preset);
        selectedPreset.value = preset;
        showSendDialog.value = true;
      } catch (error) {
        console.error("Error sending preset:", error);
      }
    };

    const handleSendPreset = async (selectedControllers) => {
      let payload = { "presets[]": [selectedPreset.value] };
      try {
        for (const controllerId of selectedControllers) {
          console.log("finding controller with id", controllerId);

          const controller = controllers.data.find(
            (controller) => String(controller.id) === String(controllerId),
          );
          if (controller) {
            console.log(
              `Sending preset ${selectedPreset.value.name} to controller ${controller.hostname} at IP ${controller.ip_address}`,
            );
            const response = await fetch(
              `http://${controller.ip_address}/presets`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              },
            );
            if (!response.ok) {
              console.error(
                `Failed to send preset to controller ${controller.hostname}`,
              );
            }
          } else {
            console.error(`Controller with ID ${controllerId} not found`);
          }
        }
      } catch (error) {
        console.error("Error handling send preset:", error);
      }
    };

    const toggleFavorite = async (preset) => {
      try {
        presetData.toggleFavorite(preset);
      } catch (error) {
        console.error("Error toggling favorite:", error);
      }
    };

    const deletePreset = async (preset) => {
      try {
        await presetData.deletePreset(preset);
        console.log("deleted preset", preset);
      } catch (error) {
        console.error("Error deleting preset:", error);
      }
    };

    return {
      activePresets,
      handlePresetClick,
      toggleFavorite,
      deletePreset,
      hsvToRgb,
      showSendDialog,
      selectedPreset,
      sendPreset,
      handleSendPreset,
    };
  },
};
</script>

<style scoped>
.icon {
  color: var(--icon-color);
  fill: var(--icon-color);
}
.text-yellow {
  color: yellow;
}
</style>
