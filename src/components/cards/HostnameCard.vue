<template>
  <MyCard title="Hostname and Icon" icon="badge_outlined">
    <q-card-section>
      <q-input
        v-model="configData.data.general.device_name"
        label="Hostname"
        @blur="
          updateConfig(
            'general.device_name',
            configData.data.general.device_name,
          )
        "
        class="q-mb-md"
      />

      <div class="icon-selector-section">
        <div class="text-subtitle2 q-mb-sm">Controller Icon</div>

        <!-- Debug info -->
        <div class="q-mb-sm text-caption">
          Debug: selectedIcon = "{{ selectedIcon }}", options count =
          {{ iconOptions.length }}
        </div>

        <!-- Current selection display with change button -->
        <div class="current-icon-display q-mb-md">
          <div class="row items-center q-gutter-md">
            <div class="col-auto">
              <svgIcon
                v-if="selectedIcon"
                :name="`lights/${selectedIcon}`"
                size="32px"
              />
            </div>
            <div class="col">
              <div class="text-body2">
                <strong>{{
                  selectedIcon
                    ? getIconDisplayName(selectedIcon)
                    : "No icon selected"
                }}</strong>
              </div>
            </div>
            <div class="col-auto">
              <q-btn flat color="primary" @click="showIconGrid = !showIconGrid">
                <template v-slot:default>
                  <span class="q-mr-sm">Change Icon</span>
                  <svgIcon
                    name="drop_down_icon"
                    size="16px"
                    :style="{
                      transform: showIconGrid
                        ? 'rotate(180deg)'
                        : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }"
                  />
                </template>
              </q-btn>
            </div>
          </div>
        </div>

        <!-- Collapsible Icon grid selector -->
        <q-slide-transition>
          <div v-show="showIconGrid" class="icon-grid-container q-mb-md">
            <div class="icon-grid">
              <div
                v-for="icon in lightIcons"
                :key="icon.value"
                class="icon-grid-item"
                :class="{ selected: selectedIcon === icon.value }"
                @click="selectIcon(icon.value)"
              >
                <svgIcon :name="`lights/${icon.value}`" size="24px" />
                <q-tooltip>{{ icon.label }}</q-tooltip>
              </div>
            </div>
          </div>
        </q-slide-transition>
      </div>
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, computed, onMounted, watch } from "vue";
import { configDataStore } from "src/stores/configDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import { useAppDataStore } from "src/stores/appDataStore";
import MyCard from "src/components/myCard.vue";
import mySelect from "src/components/mySelect.vue";

export default {
  components: {
    MyCard,
    mySelect,
  },
  setup() {
    const configData = configDataStore();
    const controllersStore = useControllersStore();
    const appDataStore = useAppDataStore();

    const selectedIcon = ref("");
    const availableIcons = ref([]);
    const showIconGrid = ref(false);

    // Define the available light hardware icons
    const lightHardwareIcons = [
      { value: "alarm-light-outline", label: "Alarm Light" },
      { value: "bulkhead-light", label: "Bulkhead Light" },
      { value: "ceiling-fan-light", label: "Ceiling Fan Light" },
      {
        value: "ceiling-light-multiple-outline",
        label: "Multiple Ceiling Lights (Outline)",
      },
      { value: "ceiling-light-multiple", label: "Multiple Ceiling Lights" },
      { value: "ceiling-light-outline", label: "Ceiling Light (Outline)" },
      { value: "ceiling-light", label: "Ceiling Light" },
      { value: "chandelier", label: "Chandelier" },
      { value: "coach-lamp-variant", label: "Coach Lamp (Variant)" },
      { value: "coach-lamp", label: "Coach Lamp" },
      { value: "dome-light", label: "Dome Light" },
      { value: "floor-lamp-dual-outline", label: "Dual Floor Lamp (Outline)" },
      { value: "floor-lamp-dual", label: "Dual Floor Lamp" },
      { value: "floor-lamp-outline", label: "Floor Lamp (Outline)" },
      {
        value: "floor-lamp-torchiere-variant-outline",
        label: "Torchiere Floor Lamp (Variant Outline)",
      },
      {
        value: "floor-lamp-torchiere-variant",
        label: "Torchiere Floor Lamp (Variant)",
      },
      { value: "floor-lamp-torchiere", label: "Torchiere Floor Lamp" },
      { value: "floor-lamp", label: "Floor Lamp" },
      { value: "globe-light-outline", label: "Globe Light (Outline)" },
      { value: "led-strip-variant", label: "LED Strip (Variant)" },
      { value: "led-strip", label: "LED Strip" },
      { value: "light-flood-down", label: "Flood Light (Down)" },
      { value: "light-flood-up", label: "Flood Light (Up)" },
      { value: "light-recessed", label: "Recessed Light" },
      { value: "light_group", label: "Light Group" },
      { value: "lightbulb_outlined", label: "Light Bulb (Outlined)" },
      { value: "outdoor-lamp", label: "Outdoor Lamp" },
      { value: "post-lamp", label: "Post Lamp" },
      { value: "track-light", label: "Track Light" },
      { value: "vanity-light", label: "Vanity Light" },
      {
        value: "wall-sconce-flat-variant",
        label: "Wall Sconce (Flat Variant)",
      },
      { value: "wall-sconce-flat", label: "Wall Sconce (Flat)" },
      {
        value: "wall-sconce-round-variant",
        label: "Wall Sconce (Round Variant)",
      },
      { value: "wall-sconce-round", label: "Wall Sconce (Round)" },
    ];

    // Define room and location icons
    const roomLocationIcons = [
      // Bedrooms
      { value: "bed", label: "Bedroom" },
      { value: "bedroom_baby", label: "Baby's Room" },
      { value: "bedroom_child", label: "Child's Room" },
      { value: "bedroom_parent", label: "Master Bedroom" },
      { value: "single_bed", label: "Guest Room" },
      { value: "king_bed", label: "King Bedroom" },
      { value: "crib", label: "Nursery" },

      // Living Areas
      { value: "living", label: "Living Room" },
      { value: "chair", label: "Seating Area" },
      { value: "deck", label: "Deck" },
      { value: "balcony", label: "Balcony" },

      // Kitchen & Dining
      { value: "kitchen", label: "Kitchen" },
      { value: "dining", label: "Dining Room" },
      { value: "brunch_dining", label: "Brunch Area" },
      { value: "local_dining", label: "Casual Dining" },
      { value: "dinner_dining", label: "Formal Dining" },
      { value: "restaurant", label: "Restaurant Style" },
      { value: "coffee_maker", label: "Coffee Station" },

      // Bathrooms
      { value: "bathroom", label: "Bathroom" },
      { value: "bathtub", label: "Bath" },
      { value: "shower", label: "Shower" },
      { value: "hot_tub", label: "Spa Bath" },

      // Utility & Storage
      { value: "garage", label: "Garage" },
      { value: "door_front", label: "Front Door" },
      { value: "door_back", label: "Back Door" },
      { value: "door_sliding", label: "Patio Door" },
      { value: "stairs", label: "Stairway" },
      { value: "elevator", label: "Elevator" },
      { value: "escalator", label: "Escalator" },

      // Outdoor Areas
      { value: "outdoor_grill", label: "BBQ Area" },
      { value: "pool", label: "Pool" },
      { value: "spa", label: "Spa" },
      { value: "cabin", label: "Cabin" },
      { value: "cottage", label: "Cottage" },
      { value: "bungalow", label: "Bungalow" },

      // Office & Study
      { value: "desk", label: "Home Office" },
      { value: "computer", label: "Computer Room" },

      // Special Areas
      { value: "meeting_room", label: "Conference Room" },
      { value: "family_restroom", label: "Family Room" },
      { value: "camera_indoor", label: "Security (Indoor)" },
      { value: "camera_outdoor", label: "Security (Outdoor)" },

      // Building Types
      { value: "apartment", label: "Apartment" },
      { value: "house", label: "House" },
      { value: "house_siding", label: "House (Siding)" },
      { value: "home_work", label: "Home Office" },

      // Interior Features
      { value: "room_preferences", label: "Room Settings" },
      { value: "fireplace", label: "Fireplace" },
      { value: "countertops", label: "Countertops" },
      { value: "curtains", label: "Curtains" },

      // Security & Access
      { value: "sensor_door", label: "Door Sensor" },
      { value: "sensor_window", label: "Window Sensor" },
    ];

    // Office & Workspace specific icons
    const officeWorkspaceIcons = [
      { value: "corporate_fare", label: "Corporate Office" },
      { value: "business", label: "Business Space" },
      { value: "store", label: "Store/Retail" },
      { value: "storefront", label: "Storefront" },
      { value: "local_convenience_store", label: "Convenience Store" },
      { value: "warehouse", label: "Warehouse" },
      { value: "work", label: "Work Area" },
    ];

    // Kitchen & Appliance specific icons
    const kitchenApplianceIcons = [
      { value: "dishwasher", label: "Dishwasher" },
      { value: "oven", label: "Oven" },
      { value: "range_hood", label: "Range Hood" },
      { value: "kettle", label: "Kettle Area" },
      { value: "flatware", label: "Flatware/Utensils" },
      { value: "local_bar", label: "Bar Area" },
      { value: "local_cafe", label: "Cafe Area" },
      { value: "bakery_dining", label: "Bakery Area" },
    ];

    // Street & Outdoor Lighting specific icons
    const streetOutdoorIcons = [
      { value: "light_mode", label: "Light Mode" },
      { value: "flashlight_on", label: "Flashlight On" },
      { value: "highlight", label: "Highlight Area" },
      { value: "garage_door", label: "Garage Door" },
      { value: "gate", label: "Gate/Entry" },
      { value: "fence", label: "Fence Area" },
    ];

    // Garden & Outdoor Space specific icons
    const gardenOutdoorIcons = [
      { value: "yard", label: "Yard" },
      { value: "grass", label: "Grass Area" },
      { value: "nature", label: "Nature Area" },
      { value: "park", label: "Park" },
      { value: "forest", label: "Forest Area" },
      { value: "local_florist", label: "Flower Area" },
      { value: "outdoor_garden", label: "Outdoor Garden" },
      { value: "potted_plant", label: "Potted Plants" },
      { value: "landscape", label: "Landscape" },
    ];

    // Entertainment & Recreation icons
    const entertainmentIcons = [
      { value: "tv", label: "TV Area" },
      { value: "speaker", label: "Speaker/Audio" },
      { value: "theaters", label: "Theater" },
      { value: "movie", label: "Movie Area" },
      { value: "music_note", label: "Music Area" },
      { value: "piano", label: "Piano/Music" },
    ];

    // Utility & Technical icons
    const utilityTechnicalIcons = [
      { value: "power", label: "Power/Electrical" },
      { value: "construction", label: "Construction Area" },
      { value: "build", label: "Build/Construction" },
      { value: "water_heater", label: "Water Heater" },
      { value: "propane_tank", label: "Propane Tank" },
      { value: "wash", label: "Wash Area" },
      { value: "local_laundry_service", label: "Laundry Service" },
      { value: "shelves", label: "Shelves/Storage" },
      { value: "markunread_mailbox", label: "Mailbox" },
    ];

    // Health & Wellness icons
    const healthWellnessIcons = [
      { value: "fitness_center", label: "Fitness Center" },
      { value: "sauna", label: "Sauna" },
      { value: "self_improvement", label: "Self Improvement" },
      { value: "local_hospital", label: "Hospital/Medical" },
      { value: "favorite", label: "Favorite/Heart" },
      { value: "pets", label: "Pets" },
    ];

    // Transportation & Access icons
    const transportationIcons = [
      { value: "car_repair", label: "Car Repair" },
      { value: "directions_car", label: "Car/Vehicle" },
      { value: "motorcycle", label: "Motorcycle" },
      { value: "accessible", label: "Accessible" },
    ];

    // Special Effects & Modes
    const specialEffectsIcons = [
      { value: "scene", label: "Scene Mode" },
      { value: "whatshot", label: "Hot/Fire Effect" },
    ];

    // Combine all icons
    const lightIcons = [
      ...lightHardwareIcons,
      ...roomLocationIcons,
      ...officeWorkspaceIcons,
      ...kitchenApplianceIcons,
      ...streetOutdoorIcons,
      ...gardenOutdoorIcons,
      ...entertainmentIcons,
      ...utilityTechnicalIcons,
      ...healthWellnessIcons,
      ...transportationIcons,
      ...specialEffectsIcons,
    ];

    const iconOptions = computed(() => {
      const options = lightIcons.map((icon) => ({
        label: icon.label,
        value: icon.value,
      }));
      console.log("iconOptions computed:", options.length, "options");
      return options;
    });

    const getCurrentController = () => {
      return controllersStore.currentController;
    };

    const loadCurrentIcon = () => {
      console.log("loadCurrentIcon called");
      const currentController = getCurrentController();
      console.log("Current controller:", currentController);

      if (
        currentController &&
        currentController.id &&
        appDataStore.data &&
        appDataStore.data.controllers
      ) {
        // Look for the controller metadata in appDataStore
        const controllerMetadata = appDataStore.data.controllers.find(
          (c) => c.id === currentController.id,
        );

        if (controllerMetadata && controllerMetadata.icon) {
          // Remove the 'lights/' prefix if it exists for display
          const iconName = controllerMetadata.icon.replace("lights/", "");
          selectedIcon.value = iconName;
          console.log("Set selectedIcon from appDataStore to:", iconName);
        } else {
          selectedIcon.value = "led-strip-variant"; // Default icon
          console.log(
            "No icon found in appDataStore, set selectedIcon to default: led-strip-variant",
          );
        }
      } else {
        selectedIcon.value = "led-strip-variant"; // Default icon
        console.log(
          "No current controller or appDataStore, set selectedIcon to default: led-strip-variant",
        );
      }
    };

    const loadCurrentControllerData = () => {
      console.log("loadCurrentControllerData called");
      const currentController = getCurrentController();
      console.log("Current controller:", currentController);

      if (currentController) {
        // Update hostname field from controller metadata or controller data
        if (appDataStore.data && appDataStore.data.controllers) {
          const controllerMetadata = appDataStore.data.controllers.find(
            (c) => c.id === currentController.id,
          );

          if (controllerMetadata && controllerMetadata.name) {
            // Use the name from metadata
            configData.data.general.device_name = controllerMetadata.name;
            console.log(
              "Set hostname from appDataStore metadata:",
              controllerMetadata.name,
            );
          } else if (currentController.hostname) {
            // Fallback to hostname from controller data
            configData.data.general.device_name = currentController.hostname;
            console.log(
              "Set hostname from controller data:",
              currentController.hostname,
            );
          }
        } else if (currentController.hostname) {
          // No metadata available, use controller hostname
          configData.data.general.device_name = currentController.hostname;
          console.log(
            "Set hostname from controller data (no metadata):",
            currentController.hostname,
          );
        }

        // Update icon
        loadCurrentIcon();
      } else {
        console.log("No current controller available");
      }
    };

    const updateConfig = (field, value) => {
      configData.updateData(field, value);

      // Also update the controller metadata if this is a hostname change
      if (field === "general.device_name") {
        updateHostname(value);
      }
    };

    const updateHostname = async (newHostname) => {
      const currentController = getCurrentController();
      if (!currentController) {
        console.error("No current controller found");
        return;
      }

      if (!currentController.id) {
        console.error("ERROR: Controller has no ID, cannot save metadata");
        return;
      }

      try {
        // Get current controller metadata to preserve existing values
        const existingMetadata = appDataStore.data.controllers.find(
          (c) => c.id === currentController.id,
        );

        // Prepare metadata with correct property names (using 'name' instead of 'hostname')
        const metadata = {
          id: currentController.id,
          name: newHostname, // Use 'name' to match database schema
          "ip-address": currentController.ip_address, // Use 'ip-address' to match database schema
          icon: existingMetadata?.icon || "lights/led-strip-variant", // Preserve existing icon or use default
        };

        console.log(
          "DEBUG: Hostname metadata to save:",
          JSON.stringify(metadata, null, 2),
        );

        // Save the hostname using the new appDataStore method
        const success = await appDataStore.saveControllerMetadata(
          currentController.id,
          metadata,
        );

        if (success) {
          console.log(`Successfully persisted controller hostname to backend`);
        } else {
          console.warn(`Failed to persist controller hostname to backend`);
        }
      } catch (error) {
        console.error("Error updating controller hostname:", error);
      }
    };

    const updateIcon = async (newIconValue) => {
      const currentController = getCurrentController();
      if (!currentController) {
        console.error("No current controller found");
        return;
      }

      console.log(
        "DEBUG: Current controller object:",
        JSON.stringify(currentController, null, 2),
      );

      if (!currentController.id) {
        console.error("ERROR: Controller has no ID, cannot save metadata");
        return;
      }

      try {
        const iconWithPrefix = `lights/${newIconValue}`;

        // Get current controller metadata to preserve existing values
        const existingMetadata = appDataStore.data.controllers.find(
          (c) => c.id === currentController.id,
        );

        // Prepare metadata with correct property names (using 'name' instead of 'hostname')
        const metadata = {
          id: currentController.id,
          name:
            existingMetadata?.name ||
            currentController.hostname ||
            configData.data.general.device_name, // Use existing name or fallback
          "ip-address": currentController.ip_address, // Use 'ip-address' to match database schema
          icon: iconWithPrefix,
        };

        console.log(
          "DEBUG: Icon metadata to save:",
          JSON.stringify(metadata, null, 2),
        );

        // Save the icon using the new appDataStore method
        const success = await appDataStore.saveControllerMetadata(
          currentController.id,
          metadata,
        );

        console.log("DEBUG: Save operation result:", success);

        if (success) {
          console.log(`Successfully persisted controller icon to backend`);
        } else {
          console.warn(`Failed to persist controller icon to backend`);
        }
      } catch (error) {
        console.error("Error updating controller icon:", error);
      }
    };

    const getIconDisplayName = (iconValue) => {
      const icon = lightIcons.find((icon) => icon.value === iconValue);
      return icon ? icon.label : iconValue;
    };

    const selectIcon = (iconName) => {
      selectedIcon.value = iconName;
      showIconGrid.value = false;
      // Save the selected icon to the backend
      updateIcon(iconName);
    };

    onMounted(() => {
      loadCurrentControllerData();
    });

    // Watch for changes in the current controller
    watch(
      () => controllersStore.currentController,
      (newController, oldController) => {
        console.log("Current controller changed:", {
          old: oldController?.hostname,
          new: newController?.hostname,
        });
        if (newController && newController !== oldController) {
          loadCurrentControllerData();
        }
      },
      { deep: true },
    );

    // Watch for changes in appDataStore controllers metadata
    watch(
      () => appDataStore.data.controllers,
      (newControllers) => {
        console.log("AppDataStore controllers metadata changed");
        const currentController = getCurrentController();
        if (currentController) {
          // Only update if the current controller's metadata might have changed
          const controllerMetadata = newControllers?.find(
            (c) => c.id === currentController.id,
          );
          if (controllerMetadata) {
            console.log(
              "Found updated metadata for current controller, reloading data",
            );
            loadCurrentControllerData();
          }
        }
      },
      { deep: true },
    );

    return {
      configData,
      selectedIcon,
      iconOptions,
      lightIcons,
      showIconGrid,
      updateConfig,
      updateHostname,
      updateIcon,
      getIconDisplayName,
      selectIcon,
      loadCurrentControllerData,
    };
  },
};
</script>

<style scoped>
.icon-selector-section {
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  padding-top: 16px;
}

.icon-grid-container {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  padding: 8px;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 8px;
  align-items: center;
  justify-items: center;
}

.icon-grid-item {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: rgba(0, 0, 0, 0.02);
}

.icon-grid-item:hover {
  background-color: rgba(25, 118, 210, 0.1);
  border-color: rgba(25, 118, 210, 0.3);
  transform: scale(1.05);
}

.icon-grid-item.selected {
  background-color: rgba(25, 118, 210, 0.15);
  border-color: #1976d2;
  box-shadow: 0 2px 4px rgba(25, 118, 210, 0.3);
}

.icon-grid-item.selected:hover {
  background-color: rgba(25, 118, 210, 0.2);
}

.icon {
  color: var(--icon-color);
  fill: var(--icon-color);
}
</style>
