<template>
  <q-scroll-area style="height: 100%; width: 100%">
    <q-card-section class="q-pa-md">
      <!-- Favorite Presets Section -->
      <div v-if="favoritePresets.length > 0 || true">
        <div class="section-title">Favorite Colors</div>
        <div class="flex-container">
          <!-- Virtual Preset: Off -->
          <div class="color-swatch" @click="setOff()">
            <div class="swatch" :style="{ backgroundColor: 'rgb(0,0,0)' }">
              <svgIcon name="lightbulb-off" size="24px" class="q-mr-xs" />
              <div class="swatch-name">Off</div>
            </div>
          </div>
          <!-- Virtual Preset: On -->
          <div class="color-swatch" @click="setOn()">
            <div
              class="swatch"
              :style="{ backgroundColor: 'rgb(127,127,127)' }"
            >
              <svgIcon name="lightbulb-on" size="24px" class="q-mr-xs" />
              <div class="swatch-name">On</div>
            </div>
          </div>
          <!-- Real favorites -->
          <div
            v-for="preset in favoritePresets"
            :key="'preset-' + preset.name"
            class="color-swatch"
            @click="setColor(preset)"
          >
            <div
              v-if="preset.color.hsv"
              class="swatch"
              :style="{
                backgroundColor: hsvToRgbStyle(preset.color.hsv),
              }"
            >
              <div class="swatch-name">{{ preset.name }}</div>
            </div>
            <div
              v-else
              class="swatch"
              :style="{
                backgroundColor: `rgb(140,127,127)`,
              }"
            >
              <RawBadge :color="preset.color" class="raw-badge" />
              <div class="swatch-name">{{ preset.name }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Separator if both presets and scenes exist -->
      <q-separator
        v-if="favoritePresets.length > 0 && favoriteSceneGroups.length > 0"
        class="q-my-md"
      />

      <!-- Favorite Scenes Section -->
      <div
        v-for="(sceneGroup, groupName) in favoriteSceneGroups"
        :key="groupName"
        class="scene-group"
      >
        <div class="section-title">{{ groupName }}</div>
        <div class="flex-container">
          <div
            v-for="scene in sceneGroup"
            :key="'scene-' + scene.name"
            class="color-swatch scene-swatch"
            @click="activateScene(scene)"
          >
            <div class="swatch scene-swatch-bg">
              <svgIcon :name="getSceneIcon(scene)" class="scene-icon" />
              <div class="scene-colors">
                <div
                  v-for="(light, index) in getSceneLights(scene)"
                  :key="index"
                  class="scene-color-circle"
                  :style="{
                    backgroundColor: light.color,
                    animationDelay: index * 0.15 + 's',
                  }"
                ></div>
              </div>
              <div class="swatch-name">{{ scene.name }}</div>
            </div>
          </div>
        </div>
        <q-separator v-if="!isLastGroup(groupName)" class="q-my-md" />
      </div>

      <!-- Message when no favorites are set -->
      <div
        v-if="favoritePresets.length === 0 && favoriteSceneGroups.length === 0"
        class="no-favorites"
      >
        <svgIcon name="star_outlined" size="48px" class="q-mb-sm" />
        <div>No favorites set</div>
        <div class="text-caption">
          Mark colors or scenes as favorites to see them here
        </div>
      </div>
    </q-card-section>
  </q-scroll-area>
</template>

<script>
import { ref, computed } from "vue";
import { colors } from "quasar";
import { useAppDataStore } from "src/stores/appDataStore";
import RawBadge from "src/components/RawBadge.vue";
import { applyScene, getControllerInfo } from "src/services/tools.js";
import { setMapStoreSuffix } from "pinia";
import { useControllersStore } from "src/stores/controllersStore";
import { hsvToRgb, hsvToRgbStyle } from "src/services/colorUtils";

export default {
  name: "favoriteSection",
  components: {
    RawBadge,
  },
  props: {
    isDialog: {
      type: Boolean,
      default: false,
    },
    cardHeight: {
      type: String,
      default: "300px",
    },
  },
  emits: ["update:modelValue", "activate-scene"],
  setup(props, { emit }) {
    const presetData = useAppDataStore();
    const controllers = useControllersStore();

    const cols = ref(3);

    const favoritePresets = computed(() =>
      presetData.data.presets.filter((preset) => preset.favorite),
    );

    // Get favorite scenes and organize them by group
    const favoriteSceneGroups = computed(() => {
      const favoriteScenes = presetData.data.scenes.filter(
        (scene) => scene.favorite,
      );
      const groups = {};

      // Get all available scene groups from the correct source
      const sceneGroups = presetData.data.groups || [];

      // Create a map of group_id to group name
      const groupNameMap = {};
      sceneGroups.forEach((group) => {
        groupNameMap[group.id] = group.name;
      });

      favoriteScenes.forEach((scene) => {
        // Use group_id for grouping
        const groupId = scene.group_id || "other";

        // Get the display name from the map, or use the ID if no name is found
        const displayName = groupNameMap[groupId] || groupId;

        if (!groups[displayName]) {
          groups[displayName] = [];
        }
        groups[displayName].push(scene);
      });

      return groups;
    });

    const getSceneLights = (scene) => {
      const lights = [];

      // Add console logging for debugging
      console.log("Processing scene:", scene.name);

      // Check if scene has steps (animations)
      if (scene.steps && scene.steps.length > 0) {
        // Get colors from the first step
        const firstStep = scene.steps[0];
        console.log("First step has colors:", !!firstStep.colors);

        if (firstStep.colors) {
          // Convert each color to a display format
          Object.entries(firstStep.colors).forEach(([key, value]) => {
            console.log(`Processing color: ${key}`, value);

            if (value.hsv) {
              const rgb = hsvToRgb(value.hsv);
              lights.push({
                name: key,
                color: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
              });
            } else if (value.raw) {
              // For raw values, use a neutral color
              lights.push({
                name: key,
                color: "#afafaf",
              });
            } else {
              // Fallback if the color format is unknown
              lights.push({
                name: key,
                color: "#ff00ff", // Bright magenta to easily spot issues
              });
            }
          });
        }
      }

      console.log(`Found ${lights.length} lights for scene ${scene.name}`);
      // Limit to 8 colors
      return lights.slice(0, 8);
    };
    // Helper to check if a group is the last one (to avoid extra dividers)
    const isLastGroup = (groupName) => {
      const groupNames = Object.keys(favoriteSceneGroups.value);
      return groupName === groupNames[groupNames.length - 1];
    };

    const setColor = (preset) => {
      emit("update:modelValue", { ...preset.color });
    };

    const activateScene = (scene) => {
      applyScene(scene);

      emit("activate-scene", scene);
    };

    const getSceneIcon = (scene) => {
      // If the scene has settings, use the icon from the first controller
      if (scene.settings && scene.settings.length > 0) {
        const firstSetting = scene.settings[0];
        const controllerId = firstSetting.controller_id;

        if (controllerId) {
          // Get controller info using the existing function from tools.js
          const controllerInfo = getControllerInfo(controllerId);

          // Return the controller's icon or fall back to "scene"
          return controllerInfo.icon || "scene";
        }
      }

      // Fallback to the default scene icon
      return "scene";
    };

    async function setOn() {
      try {
        console.log("Setting light ON");
        console.log(
          "using controller:",
          controllers.currentController.ip_address,
        );
        const response = await fetch(
          `http://${controllers.currentController.ip_address}/on`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: "{}",
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("Command result:", result);
        return result;
      } catch (error) {
        console.error("Error executing system command:", error);
        throw error;
      }
    }

    async function setOff() {
      try {
        console.log("Setting light OFF");
        console.log(
          "using controller:",
          controllers.currentController.ip_address,
        );
        const response = await fetch(
          `http://${controllers.currentController.ip_address}/off`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: "{}",
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("Command result:", result);
        return result;
      } catch (error) {
        console.error("Error executing system command:", error);
        throw error;
      }
    }

    return {
      favoritePresets,
      favoriteSceneGroups,
      cols,
      setColor,
      setOff,
      setOn,
      activateScene,
      isLastGroup,
      hsvToRgb,
      hsvToRgbStyle,
      getSceneLights,
      getSceneIcon,
    };
  },
};
</script>

<style scoped>
.flex-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.color-swatch {
  cursor: pointer;
  flex: 1 1 100%;
  box-sizing: border-box;
}

@media (min-width: 400px) {
  .color-swatch {
    flex: 1 1 calc(50% - 10px);
  }
}

.swatch {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  border-radius: 8px;
  color: white;
  text-shadow: 1px 1px 2px black;
}

/* Update scene swatch styles */
.scene-swatch-bg {
  background-color: #f0eeed; /* Warm grey background instead of gradient */
  position: relative;
  overflow: hidden;
}

/* Add styles for scene color circles */
.scene-color-circle {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.7); /* Stronger border */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  margin: 2px;
  display: inline-block; /* Ensure proper display */
  opacity: 1; /* Start visible instead of using animation */
  /* animation: fadeIn 0.5s ease forwards; */ /* Temporarily disable animation */
}

.scene-colors {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  position: absolute;
  top: 25px;
  left: 10px;
  right: 10px;
  min-height: 30px; /* Ensure visibility even without content */
  padding: 5px;
  background-color: rgba(255, 255, 255, 0.1); /* Slightly highlight the area */
}

/* Make the scene swatch background more distinct */
.scene-swatch-bg {
  background-color: #e5e0db; /* Slightly darker warm grey */
  position: relative;
  overflow: visible; /* Allow content to be visible if needed */
  border: 1px solid #ccc; /* Add border to make more distinct */
}

.scene-icon {
  position: absolute;
  top: 5px;
  right: 5px;
  font-size: 10px; /* Reduced size by 50% */
  opacity: 0.9;
  color: #8e2de2;
  background-color: rgba(255, 255, 255, 0.7); /* Add background for clarity */
  padding: 4px;
  border-radius: 4px;
  z-index: 2; /* Ensure it's above other elements */
}

/* Update swatch name for scenes */
.scene-swatch .swatch-name {
  position: absolute;
  bottom: 8px;
  left: 0;
  right: 0;
  text-align: center;
  font-weight: bold;
  color: #333; /* Darker text color */
  text-shadow: none;
  background-color: rgba(255, 255, 255, 0.7);
  padding: 2px 0;
  border-radius: 0 0 8px 8px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Hover effects */
.scene-swatch:hover .scene-color-circle {
  transform: scale(1.05);
  transition: transform 0.2s ease;
}

.scene-swatch:hover .scene-swatch-bg {
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.2s ease;
}

/* Keep your existing styles below */
.raw-badge {
  position: absolute;
  top: 35%;
  left: 5%;
}

.swatch-name {
  text-align: center;
  font-weight: bold;
}

.section-title {
  font-weight: bold;
  margin-bottom: 10px;
  font-size: 1.1rem;
}

.no-favorites {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: rgba(0, 0, 0, 0.5);
  text-align: center;
}

.scene-group {
  margin-bottom: 10px;
}
</style>
