<template>
  <MyCard title="Hostname" icon="badge_outlined">
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

        <!-- Icon dropdown - icons in options, proper selection -->
        <mySelect
          v-model="selectedIcon"
          :options="iconOptions"
          label="Select Icon"
          @update:model-value="updateIcon"
          emit-value
          map-options
          outlined
          class="icon-select q-mb-md"
        >
          <template v-slot:option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section avatar>
                <svgIcon :name="`lights/${scope.opt.value}`" size="20px" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ scope.opt.label }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </mySelect>

        <!-- Current selection display -->
        <div v-if="selectedIcon" class="q-mt-sm">
          <strong>Selected:</strong> {{ getIconDisplayName(selectedIcon) }}
          <br />
          <svgIcon
            :name="`lights/${selectedIcon}`"
            size="24px"
            class="q-mt-xs"
          />
        </div>
      </div>
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, computed, onMounted } from "vue";
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

    // Define the available light icons with user-friendly names
    const lightIcons = [
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

    onMounted(() => {
      loadCurrentIcon();
    });

    return {
      configData,
      selectedIcon,
      iconOptions,
      updateConfig,
      updateHostname,
      updateIcon,
      getIconDisplayName,
    };
  },
};
</script>

<style scoped>
.icon-selector-section {
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  padding-top: 16px;
}

.icon-select {
  max-width: 100%;
}

.icon {
  color: var(--icon-color);
  fill: var(--icon-color);
}
</style>
