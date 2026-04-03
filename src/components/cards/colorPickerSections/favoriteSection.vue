<template>
  <div class="favorite-section-root" :style="{ height: cardHeight || '100%' }">
    <q-card-section class="q-pa-md favorite-card-section">
      <div class="favorite-tabs-row q-mb-md">
        <button
          type="button"
          class="tabs-nav-btn tabs-nav-prev"
          aria-label="Scroll tabs left"
          @click="scrollTabs(-220)"
        >
          <svgIcon name="arrow_drop_down" class="tabs-nav-icon rotate-left" />
        </button>

        <q-tabs
          ref="tabsRef"
          v-model="activeTab"
          dense
          inline-label
          active-color="primary"
          indicator-color="primary"
          class="favorite-tabs"
        >
          <q-tab :id="tabDomId('quick')" name="quick" no-caps>
            <div class="tab-label-content">
              <svgIcon name="lightbulb_outlined" size="18px" />
              <span>Quick</span>
            </div>
          </q-tab>
          <q-tab
            v-for="sceneGroup in sceneGroupEntries"
            :key="sceneGroup.tabName"
            :id="tabDomId(sceneGroup.tabName)"
            :name="sceneGroup.tabName"
            no-caps
          >
            <div class="tab-label-content">
              <svgIcon name="scene" size="18px" />
              <span>{{ sceneGroup.name }}</span>
            </div>
          </q-tab>
        </q-tabs>

        <button
          type="button"
          class="tabs-nav-btn tabs-nav-next"
          aria-label="Scroll tabs right"
          @click="scrollTabs(220)"
        >
          <svgIcon name="arrow_drop_down" class="tabs-nav-icon rotate-right" />
        </button>
      </div>

      <div
        v-touch-swipe.mouse.horizontal="onPanelsSwipe"
        class="favorite-panels-touch"
      >
        <q-tab-panels
          v-model="activeTab"
          swipeable
          animated
          transition-prev="slide-right"
          transition-next="slide-left"
          keep-alive
          class="favorite-panels"
        >
        <q-tab-panel name="quick" class="q-pa-none">
          <div class="favorite-grid">
            <q-btn
              class="favorite-action-card power-off"
              unelevated
              no-caps
              @click="setOff"
            >
              <div class="card-content">
                <svgIcon name="lightbulb-off" size="22px" />
                <div class="card-title">Off</div>
              </div>
            </q-btn>

            <q-btn
              class="favorite-action-card power-on"
              unelevated
              no-caps
              @click="setOn"
            >
              <div class="card-content">
                <svgIcon name="lightbulb-on" size="22px" />
                <div class="card-title">On</div>
              </div>
            </q-btn>

            <q-btn
              v-for="preset in favoritePresets"
              :key="`preset-${preset.id || preset.name}`"
              class="favorite-action-card"
              unelevated
              no-caps
              @click="setColor(preset)"
            >
              <div class="card-content">
                <div v-if="preset.color?.hsv" class="preset-swatch">
                  <div
                    class="hsv-dot"
                    :style="{ backgroundColor: presetHsvColor(preset) }"
                  ></div>
                </div>
                <RawBadge v-else-if="preset.color?.raw" :color="preset.color" />
                <svgIcon v-else name="palette_outlined" size="20px" />
                <div class="card-title">{{ preset.name }}</div>
              </div>
            </q-btn>
          </div>

          <div
            v-if="favoritePresets.length === 0 && sceneGroupEntries.length === 0"
            class="no-favorites q-mt-md"
          >
            <svgIcon name="star_outlined" size="40px" class="q-mb-sm" />
            <div class="text-subtitle2">No favorites set</div>
            <div class="text-caption">
              Mark colors or scenes as favorites to see them here.
            </div>
          </div>
        </q-tab-panel>

        <q-tab-panel
          v-for="sceneGroup in sceneGroupEntries"
          :key="sceneGroup.tabName"
          :name="sceneGroup.tabName"
          class="q-pa-none"
        >
          <div class="favorite-grid">
            <q-btn
              v-for="scene in sceneGroup.scenes"
              :key="`scene-${scene.id || scene.name}`"
              class="favorite-action-card scene-card"
              unelevated
              no-caps
              @click="activateScene(scene)"
            >
              <div class="card-content scene-content">
                <div class="scene-header">
                  <svgIcon :name="getSceneIcon(scene)" size="18px" />
                  <div class="card-title">{{ scene.name }}</div>
                </div>
                <div class="scene-preview">
                  <div
                    v-for="(light, index) in getSceneLights(scene)"
                    :key="`${scene.id || scene.name}-light-${index}`"
                    class="scene-color-dot"
                    :style="{ backgroundColor: light.color }"
                  ></div>
                  <div
                    v-if="getSceneLights(scene).length === 0"
                    class="text-caption text-grey-6"
                  >
                    No preview colors
                  </div>
                </div>
              </div>
            </q-btn>
          </div>
        </q-tab-panel>
        </q-tab-panels>
      </div>
    </q-card-section>
  </div>
</template>

<script>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { colors } from "quasar";
import { useAppDataStore } from "src/stores/appDataStore";
import RawBadge from "src/components/RawBadge.vue";
import { applyScene, getControllerInfo } from "src/services/tools.js";
import { useControllersStore } from "src/stores/controllersStore";

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
    const controllers = useControllersStore();
    const activeTab = ref("quick");
    const tabsRef = ref(null);

    const favoritePresets = computed(() =>
      (presetData.data?.presets || []).filter((preset) => preset.favorite),
    );

    const normalizeKey = (value) => String(value ?? "").trim();

    const resolveSceneGroupMeta = (scene, groups) => {
      const groupById = new Map(
        groups.map((group) => [normalizeKey(group.id), group]),
      );

      const idCandidates = [scene.group_id, scene.groupId, scene.group?.id]
        .map(normalizeKey)
        .filter(Boolean);

      for (const candidateId of idCandidates) {
        const group = groupById.get(candidateId);
        if (group?.name) {
          return {
            key: normalizeKey(group.id) || candidateId,
            name: group.name,
          };
        }
      }

      const explicitName =
        scene.group_name || scene.groupName || scene.group?.name || "";
      if (explicitName) {
        return {
          key: normalizeKey(idCandidates[0] || explicitName),
          name: explicitName,
        };
      }

      const sceneControllerIds = new Set(
        (scene.settings || [])
          .map((setting) => normalizeKey(setting.controller_id))
          .filter(Boolean),
      );

      if (sceneControllerIds.size > 0) {
        const matchedGroup = groups.find((group) => {
          const groupControllerIds = new Set(
            (group.controller_ids || [])
              .map((controllerId) => normalizeKey(controllerId))
              .filter(Boolean),
          );

          if (groupControllerIds.size === 0) {
            return false;
          }

          return Array.from(sceneControllerIds).every((controllerId) =>
            groupControllerIds.has(controllerId),
          );
        });

        if (matchedGroup?.name) {
          return {
            key: normalizeKey(matchedGroup.id) || matchedGroup.name,
            name: matchedGroup.name,
          };
        }
      }

      return {
        key: normalizeKey(idCandidates[0] || "ungrouped"),
        name: "Ungrouped",
      };
    };

    const sceneGroupEntries = computed(() => {
      const favoriteScenes = (presetData.data?.scenes || []).filter(
        (scene) => scene.favorite,
      );
      const groups = presetData.data?.groups || [];
      const groupedScenes = {};

      favoriteScenes.forEach((scene) => {
        const groupMeta = resolveSceneGroupMeta(scene, groups);
        const bucketKey = groupMeta.key || groupMeta.name;

        if (!groupedScenes[bucketKey]) {
          groupedScenes[bucketKey] = {
            name: groupMeta.name,
            scenes: [],
          };
        }

        groupedScenes[bucketKey].scenes.push(scene);
      });

      return Object.entries(groupedScenes)
        .filter(([, groupInfo]) => groupInfo.scenes.length > 0)
        .map(([groupKey, groupInfo]) => ({
          name: groupInfo.name,
          scenes: groupInfo.scenes,
          tabName: `group-${groupKey}`,
        }));
    });

    const orderedTabs = computed(() => [
      "quick",
      ...sceneGroupEntries.value.map((group) => group.tabName),
    ]);

    watch(sceneGroupEntries, (nextGroups) => {
      const allowedTabs = ["quick", ...nextGroups.map((group) => group.tabName)];
      if (!allowedTabs.includes(activeTab.value)) {
        activeTab.value = "quick";
      }
      centerActiveTab();
    });

    const tabDomId = (tabName) =>
      `favorite-tab-${String(tabName).replace(/[^a-zA-Z0-9_-]/g, "-")}`;

    const centerActiveTab = async () => {
      await nextTick();

      const activeElement = document.getElementById(tabDomId(activeTab.value));
      if (!activeElement || typeof activeElement.scrollIntoView !== "function") {
        return;
      }

      activeElement.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    };

    const getTabsScroller = () => {
      const tabsElement = tabsRef.value?.$el;
      if (!tabsElement) {
        return null;
      }

      return tabsElement.querySelector(".q-tabs__content");
    };

    const scrollTabs = (delta) => {
      const scroller = getTabsScroller();
      if (!scroller || typeof scroller.scrollBy !== "function") {
        return;
      }

      scroller.scrollBy({
        left: delta,
        behavior: "smooth",
      });
    };

    const switchTabByOffset = (offset) => {
      const tabs = orderedTabs.value;
      const currentIndex = tabs.indexOf(activeTab.value);
      if (currentIndex === -1) {
        return;
      }

      const nextIndex = currentIndex + offset;
      if (nextIndex < 0 || nextIndex >= tabs.length) {
        return;
      }

      activeTab.value = tabs[nextIndex];
    };

    const onPanelsSwipe = ({ direction }) => {
      if (direction === "left") {
        switchTabByOffset(1);
      } else if (direction === "right") {
        switchTabByOffset(-1);
      }
    };

    watch(activeTab, () => {
      centerActiveTab();
    });

    onMounted(() => {
      centerActiveTab();
    });

    const presetHsvColor = (preset) => {
      const rgb = hsvToRgb(preset.color.hsv);
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    };

    const getSceneLights = (scene) => {
      const lights = [];

      if (scene.steps && scene.steps.length > 0) {
        const firstStep = scene.steps[0];
        if (firstStep.colors) {
          Object.values(firstStep.colors).forEach((value) => {
            if (value.hsv) {
              const rgb = hsvToRgb(value.hsv);
              lights.push({ color: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` });
            } else if (value.raw) {
              lights.push({ color: "#afafaf" });
            }
          });
        }
      }

      return lights.slice(0, 8);
    };

    const setColor = (preset) => {
      emit("update:modelValue", { ...preset.color });
    };

    const activateScene = (scene) => {
      applyScene(scene);
      emit("activate-scene", scene);
    };

    const getSceneIcon = (scene) => {
      if (scene.settings && scene.settings.length > 0) {
        const controllerId = scene.settings[0].controller_id;
        if (controllerId) {
          const controllerInfo = getControllerInfo(controllerId);
          return controllerInfo.icon || "scene";
        }
      }

      return "scene";
    };

    const sendPowerCommand = async (command) => {
      const ip = controllers.currentController?.ip_address;
      if (!ip) {
        return;
      }

      try {
        await fetch(`http://${ip}/${command}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "{}",
        });
      } catch {
        // Ignore command errors here to keep favorite interaction lightweight.
      }
    };

    const setOn = async () => sendPowerCommand("on");
    const setOff = async () => sendPowerCommand("off");

    return {
      activeTab,
      tabsRef,
      tabDomId,
      scrollTabs,
      onPanelsSwipe,
      favoritePresets,
      sceneGroupEntries,
      setColor,
      setOn,
      setOff,
      activateScene,
      presetHsvColor,
      getSceneLights,
      getSceneIcon,
    };
  },
};
</script>

<style scoped>
.favorite-section-root {
  width: 100%;
  max-width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.favorite-card-section {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.favorite-tabs-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.favorite-tabs {
  flex: 1;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.favorite-tabs :deep(.q-tabs__content) {
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: thin;
}

.favorite-tabs :deep(.q-tabs__arrow) {
  display: none !important;
}

.tabs-nav-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.tabs-nav-icon {
  width: 18px;
  height: 18px;
}

.rotate-left {
  transform: rotate(90deg);
}

.rotate-right {
  transform: rotate(-90deg);
}

.favorite-tabs :deep(.q-tab) {
  border-radius: 8px;
  min-height: 36px;
}

.favorite-tabs :deep(.q-tab--active) {
  background: rgba(25, 118, 210, 0.12);
  font-weight: 600;
}

.body--dark .favorite-tabs :deep(.q-tab--active) {
  background: rgba(110, 168, 255, 0.2);
}

.tab-label-content {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.favorite-panels {
  flex: 1;
  width: 100%;
  height: 100%;
  max-width: 100%;
  min-height: 100%;
  background: transparent;
}

.favorite-panels-touch {
  flex: 1;
  width: 100%;
  min-height: 0;
  max-width: 100%;
}

.favorite-panels :deep(.q-panel) {
  width: 100%;
  max-width: 100%;
  min-height: 100%;
}

.favorite-panels :deep(.q-tab-panel) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

.favorite-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(136px, 100%), 1fr));
  gap: 10px;
}

.favorite-action-card {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 92px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  background: linear-gradient(180deg, #ffffff 0%, #f6f6f6 100%);
  text-align: left;
  padding: 10px;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.favorite-action-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.12);
}

.favorite-action-card:active {
  transform: translateY(0);
}

.power-off {
  background: linear-gradient(180deg, #2d2d2d 0%, #121212 100%);
  color: #f7f7f7;
}

.power-on {
  background: linear-gradient(180deg, #f1f7ff 0%, #dae9ff 100%);
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
}

.card-title {
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.2;
  text-align: left;
  word-break: break-word;
}

.preset-swatch {
  display: flex;
  align-items: center;
}

.hsv-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.2);
}

.scene-card {
  background: linear-gradient(180deg, #fffdf8 0%, #f2efe7 100%);
}

.scene-content {
  gap: 10px;
}

.scene-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.scene-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 22px;
}

.scene-color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.15);
}

.no-favorites {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

@media (max-width: 600px) {
  .favorite-card-section {
    padding-left: 0 !important;
    padding-right: 0 !important;
  }

  .favorite-tabs-row {
    padding-left: 8px;
    padding-right: 8px;
  }

  .favorite-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
}
  height: 180px;
  text-align: center;
  color: rgba(0, 0, 0, 0.55);
}

.body--dark .favorite-action-card {
  border-color: rgba(255, 255, 255, 0.15);
  background: linear-gradient(180deg, #20242c 0%, #141920 100%);
  color: #f2f4f8;
}

.body--dark .power-on {
  background: linear-gradient(180deg, #2d3f5a 0%, #1c2c45 100%);
}

.body--dark .power-off {
  background: linear-gradient(180deg, #1c1c1c 0%, #101010 100%);
}

.body--dark .scene-card {
  background: linear-gradient(180deg, #2b2926 0%, #1f1d1a 100%);
}
</style>
