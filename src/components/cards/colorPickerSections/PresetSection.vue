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
            <div v-if="preset.color.hsv">
              <q-badge
                :style="{
                  backgroundColor: `rgb(${hsvToRgb(preset.color.hsv).r}, ${hsvToRgb(preset.color.hsv).g}, ${hsvToRgb(preset.color.hsv).b})`,
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: '1px solid black',
                }"
                round
                @click="handlePresetClick(preset)"
              />
            </div>
            <div v-else>
              <RawBadge
                :color="preset.color"
                @click="handlePresetClick(preset)"
              />
            </div>
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
        <div class="no-presets-container">
          <div class="no-presets-message">No presets available</div>
        </div>
      </template>
    </q-list>
  </q-scroll-area>
</template>

<script>
import { ref, computed, onMounted } from "vue";
import { colors, Dialog } from "quasar";
import { useAppDataStore } from "src/stores/appDataStore";
import { colorDataStore } from "src/stores/colorDataStore";
import { controllersStore } from "src/stores/controllersStore";
import RawBadge from "src/components/RawBadge.vue";
import addPresetDialog from "src/components/addPresetDialog.vue";
import sendToControllers from "src/components/sendToControllers.vue";

const { hsvToRgb } = colors;

export default {
  name: "PresetSection",
  components: {
    RawBadge,
    addPresetDialog,
    sendToControllers,
  },
  setup() {
    const appData = useAppDataStore();
    const colorData = colorDataStore();
    const controllers = controllersStore();
    const selectedPreset = ref(null);

    // Fetch presets data on component mount
    onMounted(() => {
      try {
        console.log("Fetching preset data...");
        appData.fetchData();
      } catch (error) {
        console.error("Error fetching preset data:", error);
      }
    });

    const activePresets = computed(() => {
      try {
        const presets = appData.data.presets;
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
        showSendDialog();
      } catch (error) {
        console.error("Error sending preset:", error);
      }
    };

    const showSendDialog = () => {
      Dialog.create({
        component: sendToControllers,
        onOk: handleSendPreset,
      });
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
              `http://${controller.ip_address}/data`,
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
        appData.toggleFavorite(preset);
      } catch (error) {
        console.error("Error toggling favorite:", error);
      }
    };

    const deletePreset = async (preset) => {
      try {
        await appData.deletePreset(preset);
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
.no-presets-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
}
.no-presets-message {
  background-color: #f0f0f0;
  padding: 20px;
  border-radius: 10px;
  text-align: center;
  color: #333;
}
</style>
