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

        <!-- Current selection display with change button -->
        <div class="current-icon-display q-mb-md">
          <div class="row items-center q-gutter-md">
            <div class="col-auto">
              <svgIcon
                v-if="selectedIcon"
                :name="selectedIcon"
                :fallbackIcon="defaultWebIcon"
                size="32px"
              />
            </div>

            <div class="col-auto">
              <q-btn
                color="primary"
                @click="showMaterialBrowser = true"
                label="change Icon"
              >
                <svgIcon name="search" size="24px" style="margin-left: 8px" />
                <q-tooltip>Browse Material Design Icons</q-tooltip>
              </q-btn>

              <!-- Test Web Icon -->
              <div
                class="q-ml-md"
                style="display: flex; align-items: center; gap: 8px"
              ></div>
            </div>
          </div>
        </div>

        <!-- Material Icons Browser -->
        <MaterialIconBrowser
          v-model="showMaterialBrowser"
          @icon-selected="onMaterialIconSelected"
        />
      </div>
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, onMounted, watch } from "vue";
import { configDataStore } from "src/stores/configDataStore";
import { useControllersStore } from "src/stores/controllersStore";
import { useAppDataStore } from "src/stores/appDataStore";
import MyCard from "src/components/myCard.vue";
import MaterialIconBrowser from "src/components/MaterialIconBrowser.vue";
import svgIcon from "src/components/svgIcon.vue";

export default {
  components: {
    MyCard,
    MaterialIconBrowser,
    svgIcon,
  },
  setup() {
    const configData = configDataStore();
    const controllersStore = useControllersStore();
    const appDataStore = useAppDataStore();

    const selectedIcon = ref("");
    const showMaterialBrowser = ref(false);

    // Default web icon fallback
    const defaultWebIcon =
      "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/lightbulb/default/24px.svg";

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
          // Check if it's a corrupted web icon URL and fix it
          if (controllerMetadata.icon.includes("[object Object]")) {
            console.warn(
              "Found corrupted icon URL, using default:",
              controllerMetadata.icon,
            );
            selectedIcon.value = defaultWebIcon;
            // Automatically fix the corrupted URL in the database
            updateIcon(defaultWebIcon);
            return;
          }

          // Check if it's a web icon URL or local icon
          if (isWebIcon(controllerMetadata.icon)) {
            // Use web icon URL directly
            selectedIcon.value = controllerMetadata.icon;
            console.log(
              "Set selectedIcon from appDataStore to web icon:",
              controllerMetadata.icon,
            );
          } else {
            // For legacy local icons, convert to web equivalent or use default
            selectedIcon.value = defaultWebIcon;
            console.log(
              "Legacy local icon found, using default web icon:",
              defaultWebIcon,
            );
          }
        } else {
          selectedIcon.value = defaultWebIcon; // Default icon
          console.log(
            "No icon found in appDataStore, set selectedIcon to default:",
            defaultWebIcon,
          );
        }
      } else {
        selectedIcon.value = defaultWebIcon; // Default fallback
        console.log(
          "No controller metadata available, using default icon:",
          defaultWebIcon,
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

        // Prepare metadata with correct property names
        const metadata = {
          id: currentController.id,
          name: newHostname, // Use the new hostname as the name
          "ip-address": currentController.ip_address, // Use 'ip-address' to match database schema
          icon: existingMetadata?.icon || defaultWebIcon, // Preserve existing icon or use default
        };

        console.log(
          "DEBUG: Hostname metadata to save:",
          JSON.stringify(metadata, null, 2),
        );

        // Save using the new appDataStore method
        const success = await appDataStore.saveControllerMetadata(
          currentController.id,
          metadata,
        );

        console.log("DEBUG: Save operation result:", success);

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
        // Web icons are stored directly, no prefix needed
        const iconValue = newIconValue;

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
          icon: iconValue,
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
      // Check if it's a web icon URL
      if (isWebIcon(iconValue)) {
        return getWebIconName(iconValue);
      }

      // Fallback for any local icon names
      return iconValue || "Default Icon";
    };

    const isWebIcon = (iconValue) => {
      return (
        iconValue &&
        (iconValue.startsWith("http") || iconValue.includes("gstatic.com"))
      );
    };

    const getWebIconName = (iconUrl) => {
      if (!iconUrl || !iconUrl.includes("/")) return iconUrl;

      // Extract icon name from Material Design URL
      const parts = iconUrl.split("/");
      const iconNamePart = parts.find(
        (part) =>
          part && part !== "materialsymbols" && !part.includes("px.svg"),
      );

      if (
        iconNamePart &&
        iconNamePart !== "default" &&
        iconNamePart !== "24px.svg"
      ) {
        return iconNamePart
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
      }

      return iconUrl;
    };

    const onMaterialIconSelected = (iconData) => {
      console.log("Material icon selected:", iconData);
      selectedIcon.value = iconData.url;
      showMaterialBrowser.value = false;
      // Save the selected web icon URL to the backend
      updateIcon(iconData.url);
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
      showMaterialBrowser,
      defaultWebIcon,
      updateConfig,
      updateHostname,
      updateIcon,
      getIconDisplayName,
      loadCurrentControllerData,
      isWebIcon,
      getWebIconName,
      onMaterialIconSelected,
    };
  },
};
</script>

<style scoped>
.icon-selector-section {
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  padding-top: 16px;
}

.current-icon-display {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.02);
}
</style>
