<template>
  <q-scroll-area style="height: 100%; width: 100%">
    <q-card-section class="q-pa-md">
      <!-- Favorite Presets Section -->
      <div v-if="favoritePresets.length > 0">
        <div class="section-title">Favorite Colors</div>
        <div class="flex-container">
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
                backgroundColor: `rgb(${hsvToRgb(preset.color.hsv).r}, ${
                  hsvToRgb(preset.color.hsv).g
                }, ${hsvToRgb(preset.color.hsv).b})`,
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
              <svgIcon name="auto_awesome" class="scene-icon" />
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
        <svgIcon name="star_border" size="48px" class="q-mb-sm" />
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
import { applyScene } from "src/services/tools.js";

const { hsvToRgb } = colors;

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

    // Helper to check if a group is the last one (to avoid extra dividers)
    const isLastGroup = (groupName) => {
      const groupNames = Object.keys(favoriteSceneGroups.value);
      return groupName === groupNames[groupNames.length - 1];
    };

    const setColor = (preset) => {
      // Emit the selected color
      emit("update:modelValue", { ...preset.color });
    };

    const activateScene = (scene) => {
      // Apply the scene directly
      applyScene(scene);

      // Also emit the event for backward compatibility
      emit("activate-scene", scene);
    };

    return {
      favoritePresets,
      favoriteSceneGroups,
      cols,
      setColor,
      activateScene,
      isLastGroup,
      hsvToRgb,
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

.scene-swatch-bg {
  background: linear-gradient(135deg, #8e2de2, #4a00e0);
}

.scene-icon {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 20px;
  opacity: 0.8;
}

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
