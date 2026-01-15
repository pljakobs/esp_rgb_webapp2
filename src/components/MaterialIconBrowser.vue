<template>
  <q-dialog v-model="showDialog">
    <q-card
      class="q-dialog-plugin material-icon-browser"
      style="width: 90vw; max-width: 600px; max-height: 80vh"
    >
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Icon Browser</div>
        <q-space />
        <q-btn flat round dense v-close-popup>
          <svgIcon name="close" size="18px" />
        </q-btn>
      </q-card-section>

      <q-card-section
        class="q-pt-sm icon-browser-content"
        style="flex: 1; display: flex; flex-direction: column; overflow: hidden"
      >
        <!-- Tabs & Search -->
        <div class="column q-gutter-y-sm q-mb-md">
          <q-tabs
            v-model="activeTab"
            dense
            class="text-grey"
            active-color="primary"
            indicator-color="primary"
            align="justify"
            narrow-indicator
          >
            <q-tab name="material" label="Material Symbols" />
            <q-tab name="fontawesome" label="FontAwesome" />
            <!-- <q-tab name="icomoon" label="IcoMoon" /> -->
          </q-tabs>

          <q-input
            v-model="searchQuery"
            dense
            outlined
            placeholder="Search icons..."
            debounce="300"
          >
            <template v-slot:append>
              <svgIcon
                v-if="searchQuery"
                name="close"
                size="20px"
                class="cursor-pointer q-mr-sm"
                @click="searchQuery = ''"
              />
              <svgIcon name="search" size="20px" color="#757575" />
            </template>
          </q-input>
        </div>

        <!-- Results grid - shows all icons in category -->
        <div class="icon-results">
          <div class="results-header q-mb-md">
            <span class="text-body2"> {{ totalResults }} icons found </span>
          </div>

          <div class="icon-grid-container" ref="gridContainer">
            <q-infinite-scroll
              @load="onLoad"
              :offset="250"
              :scroll-target="gridContainer"
              ref="infiniteScroll"
            >
              <div class="icon-grid">
                <div
                  v-for="icon in displayedIcons"
                  :key="icon.name"
                  class="icon-item"
                  :class="{ selected: selectedIcon === icon.name }"
                  @click="selectIcon(icon)"
                >
                  <div class="icon-preview">
                    <svgIcon :name="icon.url" size="40px" color="black" />
                  </div>
                  <div class="icon-name" :title="icon.name">
                    {{ icon.name }}
                  </div>
                </div>
              </div>
              <template v-slot:loading>
                <div class="row justify-center q-my-md full-width">
                  <q-spinner-dots color="primary" size="40px" />
                </div>
              </template>
            </q-infinite-scroll>
          </div>
        </div>

        <!-- Loading indicator -->
        <div v-if="isLoading" class="text-center q-mt-md">
          <q-spinner size="md" />
          <div class="q-mt-sm text-body2">Loading icons...</div>
        </div>

        <!-- Icon not found message -->
        <div
          v-if="totalResults === 0 && !isLoading"
          class="text-center q-mt-md text-body2 text-grey-6"
        >
          No icons found.
        </div>
      </q-card-section>

      <q-card-actions align="right" v-if="selectedIcon">
        <q-btn label="Cancel" color="grey" @click="showDialog = false" />
        <q-btn label="Select" color="primary" @click="confirmSelection" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, computed, watch } from "vue";
import svgIcon from "src/components/svgIcon.vue";
import materialIconsRaw from "@quasar/extras/material-symbols-outlined/icons.json";
import fontAwesomeIconsRaw from "@quasar/extras/fontawesome-v6/icons.json";

export default {
  name: "MaterialIconBrowser",
  components: {
    svgIcon,
  },
  emits: ["iconSelected", "update:modelValue"],
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, { emit }) {
    const showDialog = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });

    // Reactive data
    const activeTab = ref("material");
    const searchQuery = ref("");
    const isLoading = ref(false);
    const selectedIcon = ref("");
    const selectedIconData = ref({});
    const iconsPerPage = 100;
    const displayLimit = ref(iconsPerPage);
    const gridContainer = ref(null);
    const infiniteScroll = ref(null);

    const materialList = materialIconsRaw.map((name) => {
      const cleanName = name.replace(/^symOutlined/, "");
      const snake = cleanName
        .replace(/([a-z])([A-Z])/g, "$1_$2") // camelCase -> snake_case
        .replace(/([0-9])([A-Z])/g, "$1_$2") // 3dRotation -> 3d_rotation
        .replace(/([a-z])([0-9])/g, "$1_$2") // brightness5 -> brightness_5
        .toLowerCase();

      return {
        name: snake,
        url: `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/${snake}/default/24px.svg`,
      };
    });

    const fontAwesomeList = fontAwesomeIconsRaw
      .filter((name) => name.startsWith("fas"))
      .map((name) => {
        const cleanName = name.replace(/^fas/, "");

        let snake = cleanName
          .replace(/([a-z])([A-Z])/g, "$1-$2") // camelCase -> kebab-case
          .replace(/([0-9])([A-Z])/g, "$1-$2") // Number -> Cap
          .replace(/([a-z])([0-9])/g, "$1-$2") // Lower -> Number (User1 -> user-1)
          .toLowerCase();

        // Refined manual patches for sort icons where separators were lost
        snake = snake.replace(/-19$/, "-1-9");
        snake = snake.replace(/-91$/, "-9-1");
        snake = snake.replace(/-az$/, "-a-z");
        snake = snake.replace(/-za$/, "-z-a");
        snake = snake.replace(/^19$/, "1-9");
        snake = snake.replace(/^91$/, "9-1");

        return {
          name: snake,
          url: `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6/svgs/solid/${snake}.svg`,
        };
      });

    // Computed properties
    const currentList = computed(() => {
      if (activeTab.value === "material") return materialList;
      if (activeTab.value === "fontawesome") return fontAwesomeList;
      return [];
    });

    const filteredIcons = computed(() => {
      const query = searchQuery.value.toLowerCase().trim();
      if (!query) return currentList.value;
      return currentList.value.filter((icon) =>
        icon.name.toLowerCase().includes(query),
      );
    });

    const displayedIcons = computed(() => {
      return filteredIcons.value.slice(0, displayLimit.value);
    });

    const totalResults = computed(() => filteredIcons.value.length);

    // Watchers
    watch([activeTab, searchQuery], () => {
      displayLimit.value = iconsPerPage;
      selectedIcon.value = "";
      if (gridContainer.value) {
        gridContainer.value.scrollTop = 0;
      }
      if (infiniteScroll.value) {
        infiniteScroll.value.resume();
      }
    });

    const onLoad = (index, done) => {
      if (displayLimit.value >= filteredIcons.value.length) {
        done(true); // Stop
        return;
      }
      setTimeout(() => {
        displayLimit.value += iconsPerPage;
        done();
      }, 100);
    };

    const selectIcon = (icon) => {
      selectedIcon.value = icon.name;
      selectedIconData.value = icon;
    };

    const confirmSelection = () => {
      if (selectedIcon.value) {
        emit("iconSelected", {
          name: selectedIconData.value.name,
          url: selectedIconData.value.url,
        });
        showDialog.value = false;
      }
    };

    return {
      showDialog,
      activeTab,
      searchQuery,
      isLoading,
      gridContainer,
      infiniteScroll,
      onLoad,
      selectedIcon,
      displayedIcons,
      totalResults,
      selectIcon,
      confirmSelection,
    };
  },
};
</script>

<style scoped>
.material-icon-browser {
  height: 80vh;
  display: flex;
  flex-direction: column;
}

.icon-browser-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.icon-results {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.icon-grid-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fafafa;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
}

.icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  background: white;
  transition: all 0.2s;
  min-height: 80px;
}

.icon-item:hover {
  background-color: #f5f5f5;
  border-color: #bdbdbd;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.icon-item.selected {
  background-color: #e3f2fd;
  border-color: #2196f3;
  box-shadow: 0 0 0 1px #2196f3;
}

.icon-name {
  margin-top: 8px;
  font-size: 10px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  color: #616161;
}

/* Ensure infinite scroll loading indicator takes full width */
.icon-grid-container :deep(.q-infinite-scroll__loading) {
  width: 100%;
}
</style>
