<template>
  <q-dialog v-model="showDialog">
    <q-card
      class="q-dialog-plugin material-icon-browser"
      style="width: 90vw; max-width: 600px; max-height: 80vh"
    >
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Google Material Icons Browser</div>
        <q-space />
        <q-btn flat round dense v-close-popup>
          <svgIcon name="close" size="18px" />
        </q-btn>
      </q-card-section>

      <q-card-section
        class="q-pt-sm icon-browser-content"
        style="flex: 1; display: flex; flex-direction: column; overflow: hidden"
      >
        <!-- Category and Variant selectors at top -->
        <div class="row q-gutter-md q-mb-md">
          <div class="col-6">
            <mySelect
              v-model="selectedCategory"
              :options="categoryOptions"
              option-value="value"
              option-label="label"
              outlined
              dense
              label="Category"
              emit-value
              map-options
              @update:model-value="loadCategoryIcons"
            />
          </div>
          <div class="col-6">
            <mySelect
              v-model="selectedVariant"
              :options="variantOptions"
              option-value="value"
              option-label="label"
              outlined
              dense
              label="Variant"
              emit-value
              map-options
              @update:model-value="loadCategoryIcons"
            />
          </div>
        </div>

        <!-- Results grid - shows all icons in category -->
        <div v-if="categoryIcons.length > 0" class="icon-results">
          <div class="results-header q-mb-md">
            <span class="text-body2">
              {{ categoryIcons.length }} icons in {{ getCategoryLabel() }}
            </span>
          </div>

          <div class="icon-grid-container">
            <div class="icon-grid">
              <div
                v-for="icon in displayedIcons"
                :key="icon.name"
                class="icon-item"
                :class="{ selected: selectedIcon === icon.name }"
                @click="selectIcon(icon)"
              >
                <div class="icon-preview">
                  <svgIcon :name="icon.url" size="56px" color="black" />
                </div>
                <div class="icon-name">{{ icon.name }}</div>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="pagination-controls q-mt-md">
            <q-pagination
              v-model="currentPage"
              :max="totalPages"
              direction-links
              boundary-numbers
              @update:model-value="updatePage"
            />
          </div>
        </div>

        <!-- Loading indicator -->
        <div v-if="isLoading" class="text-center q-mt-md">
          <q-spinner size="md" />
          <div class="q-mt-sm text-body2">Loading icons...</div>
        </div>

        <!-- Icon not found message -->
        <div
          v-if="categoryIcons.length === 0 && !isLoading"
          class="text-center q-mt-md text-body2 text-grey-6"
        >
          No icons found for this category.
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
import { ref, computed, onMounted, watch } from "vue";
import svgIcon from "src/components/svgIcon.vue";
import mySelect from "src/components/mySelect.vue";

export default {
  name: "MaterialIconBrowser",
  components: {
    svgIcon,
    mySelect,
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
    const selectedVariant = ref("outlined");
    const selectedCategory = ref("lighting");
    const isLoading = ref(false);
    const currentPage = ref(1);
    const selectedIcon = ref("");
    const selectedIconData = ref({});
    const categoryIcons = ref([]);
    const iconsPerPage = 50;

    // Options for dropdowns
    const variantOptions = [
      { label: "Outlined", value: "outlined" },
      { label: "Rounded", value: "rounded" },
      { label: "Sharp", value: "sharp" },
    ];

    const categoryOptions = [
      { label: "Rooms", value: "rooms" },
      { label: "Furniture", value: "furniture" },
      { label: "Lighting", value: "lighting" },
      { label: "Devices", value: "devices" },
      { label: "Places", value: "places" },
    ];

    // Icon categories with their icons
    const iconCategories = {
      rooms: [
        "bathroom",
        "bedroom_baby",
        "bedroom_child",
        "bedroom_parent",
        "dining",
        "hallway",
        "living",
        "deck",
      ],
      furniture: [
        "chair",
        "chair_fireplace",
        "fireplace",
        "table_bar",
        "table_large",
        "table_restaurant",
        "bed",
        "king_bed",
        "single_bed",
        "desk",
        "kitchen",
        "dine_lamp",
        "dresser",
        "weekend",
        "event_seat",
        "table_large",
        "countertops",
        "chair_counter",
        "chair_umbrella",
        "high_chair",
      ],
      lighting: [
        "lightbulb",
        "dine_lamp",
        "light",
        "scene",
        "highlight",
        "home_iot_device",
        "lightbulb_2",
        "table_lamp",
        "wall_lamp",
        "floor_lamp",
        "light_group",
        "fluorescent",
        "wb_incandescent",
        "wb_iridescent",
        "candle",
        "nest_cam_floodlight",
        "wand_shine",
        "dine_lamp",
        "light_group",
      ],

      devices: [
        "computer",
        "smartphone",
        "tablet",
        "watch",
        "tv",
        "speaker",
        "camera",
        "videocam",
        "keyboard",
        "mouse",
      ],
      places: [
        "place",
        "home",
        "work",
        "school",
        "store",
        "restaurant",
        "hotel",
        "park",
      ],
    };

    // Computed properties
    const displayedIcons = computed(() => {
      const start = (currentPage.value - 1) * iconsPerPage;
      const end = start + iconsPerPage;
      return categoryIcons.value.slice(start, end);
    });

    const totalResults = computed(() => categoryIcons.value.length);
    const totalPages = computed(() =>
      Math.ceil(totalResults.value / iconsPerPage),
    );

    // Methods
    const getCategoryLabel = () => {
      const category = categoryOptions.find(
        (cat) => cat.value === selectedCategory.value,
      );
      return category ? category.label : selectedCategory.value;
    };

    const loadCategoryIcons = () => {
      isLoading.value = true;
      const categoryName = selectedCategory.value;

      // Handle "all" category case with fallback to popular icons
      if (categoryName === "all") {
        const popularIcons = [
          "lightbulb",
          "home",
          "settings",
          "search",
          "favorite",
        ];
        categoryIcons.value = popularIcons.map((name) => ({
          name,
          url: `https://fonts.gstatic.com/s/i/short-term/release/materialsymbols${selectedVariant.value}/${name}/default/24px.svg`,
        }));
      } else {
        const icons = iconCategories[categoryName] || [];
        categoryIcons.value = icons.map((name) => ({
          name,
          url: `https://fonts.gstatic.com/s/i/short-term/release/materialsymbols${selectedVariant.value}/${name}/default/24px.svg`,
        }));
      }

      // Reset pagination
      currentPage.value = 1;
      isLoading.value = false;
    };

    const selectIcon = (icon) => {
      selectedIcon.value = icon.name;
      selectedIconData.value = icon;
    };

    const confirmSelection = () => {
      if (selectedIcon.value) {
        emit("icon-selected", {
          name: selectedIconData.value.name,
          url: selectedIconData.value.url,
        });
        showDialog.value = false;
      }
    };

    const updatePage = (page) => {
      currentPage.value = page;
    };

    onMounted(() => {
      // Load the default category (lighting) when component mounts
      loadCategoryIcons();
    });

    return {
      showDialog,
      selectedVariant,
      selectedCategory,
      isLoading,
      currentPage,
      selectedIcon,
      selectedIconData,
      categoryIcons,
      displayedIcons,
      totalResults,
      totalPages,
      variantOptions,
      categoryOptions,
      getCategoryLabel,
      loadCategoryIcons,
      selectIcon,
      confirmSelection,
      updatePage,
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
}

.icon-grid-container {
  flex: 1;
  overflow: hidden;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  overflow-y: auto;
  padding-right: 8px; /* Space for scrollbar */
}

.icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
  height: fit-content;
}

.icon-item:hover {
  border-color: #1976d2;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.2);
  transform: translateY(-1px);
}

.icon-item.selected {
  border-color: #1976d2;
  background: #e3f2fd;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
}

.icon-name {
  margin-top: 8px;
  font-size: 11px;
  text-align: center;
  word-break: break-word;
  color: #666;
  font-weight: 500;
}

.icon-item.selected .icon-name {
  color: #1976d2;
  font-weight: 600;
}

.pagination-controls {
  display: flex;
  justify-content: center;
  padding: 8px;
  flex-shrink: 0; /* Prevent pagination from shrinking */
}

.icon-preview {
  width: 36px;
  height: 36px;
}
</style>
