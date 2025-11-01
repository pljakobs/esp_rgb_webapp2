<template>
  <q-scroll-area style="height: 100%; width: 100%">
    <q-card-section class="q-pa-md">
      <!-- Favorite Presets Section -->
      <div v-if="favoritePresets.length > 0 || true">
        <div class="section-title">Favorite Colors</div>
        <div class="flex-container">
          <!-- Preset Swatches (real presets only) -->
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
                backgroundColor: `rgb(${hsvToRgb(preset.color.hsv).r}, ${hsvToRgb(preset.color.hsv).g}, ${hsvToRgb(preset.color.hsv).b})`,
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

<script setup>
import { ref, computed } from "vue";
import { colors } from "quasar";
import { useAppDataStore } from "src/stores/appDataStore";
import RawBadge from "src/components/RawBadge.vue";
import { applyScene, getControllerInfo } from "src/services/tools.js";

const { hsvToRgb } = colors;
const presetData = useAppDataStore();
const favoritePresets = computed(() =>
  presetData.data.presets.filter((p) => p.favorite),
);

const favoriteSceneGroups = computed(() => {
  const favoriteScenes = presetData.data.scenes.filter(
    (scene) => scene.favorite,
  );
  const groups = {};
  const sceneGroups = presetData.data.groups || [];
  const groupNameMap = {};
  sceneGroups.forEach((group) => {
    groupNameMap[group.id] = group.name;
  });
  favoriteScenes.forEach((scene) => {
    const groupId = scene.group_id || "other";
    const displayName = groupNameMap[groupId] || groupId;
    if (!groups[displayName]) {
      groups[displayName] = [];
    }
    groups[displayName].push(scene);
  });
  return groups;
});

function getSceneLights(scene) {
  const lights = [];
  if (scene.steps && scene.steps.length > 0) {
    const firstStep = scene.steps[0];
    if (firstStep.colors) {
      Object.entries(firstStep.colors).forEach(([key, value]) => {
        if (value.hsv) {
          const rgb = hsvToRgb(value.hsv);
          lights.push({
            name: key,
            color: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
          });
        } else if (value.raw) {
          lights.push({ name: key, color: "#afafaf" });
        } else {
          lights.push({ name: key, color: "#ff00ff" });
        }
      });
    }
  }
  return lights.slice(0, 8);
}

function isLastGroup(groupName) {
  const groupNames = Object.keys(favoriteSceneGroups.value);
  return groupName === groupNames[groupNames.length - 1];
}

function setColor(preset) {
  // Only handle real presets now
  // emit("update:modelValue", { ...preset.color });
  // Use defineEmits for <script setup>
  emit("update:modelValue", { ...preset.color });
}

function activateScene(scene) {
  applyScene(scene);
  emit("activate-scene", scene);
}

function getSceneIcon(scene) {
  if (scene.settings && scene.settings.length > 0) {
    const firstSetting = scene.settings[0];
    const controllerId = firstSetting.controller_id;
    if (controllerId) {
      const controllerInfo = getControllerInfo(controllerId);
      return controllerInfo.icon || "scene";
    }
  }
  return "scene";
}

const emit = defineEmits(["update:modelValue", "activate-scene"]);
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
