<template>
  <div
    v-if="
      infoData.status === storeStatus.LOADING ||
      configData.status === storeStatus.LOADING ||
      colorData.status === storeStatus.LOADING
    "
  >
    <div class="center-container bg-light-grey">
      <div class="flex flex-center">
        <div class="q-pa-md">
          <h1><q-spinner-radio color="light-blue" /></h1>
          loading from {{ controllers.currentController }}...
          <br />Configuration:
          <span
            v-if="configData.status === storeStatus.READY"
            class="text-success"
            >✔️</span
          >
          <q-spinner
            v-else-if="configData.status === storeStatus.LOADING"
            color="light-blue"
          />
          <span v-else class="text-danger">❌ {{ configData.error }} </span
          ><br />
          Information:
          <span
            v-if="infoData.status === storeStatus.READY"
            class="text-success"
            >✔️</span
          >
          <q-spinner
            v-else-if="infoData.status === storeStatus.LOADING"
            color="light-blue"
          />
          <span v-else class="text-danger">❌ {{ infoData.errro }}</span
          ><br />
          Colors:
          <span
            v-if="colorData.status === storeStatus.READY"
            class="text-success"
            >✔️</span
          >
          <q-spinner
            v-else-if="colorData.status === storeStatus.LOADING"
            color="light-blue"
          />
          <span v-else class="text-danger">❌ {{ colorData.error }}</span
          ><br />
          Presets and Scenes:
          <span v-if="appData.status === storeStatus.READY" class="text-success"
            >✔️</span
          >
          <q-spinner
            v-else-if="appData.status === storeStatus.LOADING"
            color="light-blue"
          />
          <span v-else class="text-danger">❌ {{ appData.error }}</span>
        </div>
      </div>
    </div>
  </div>
  <div v-else>
    <q-layout view="hHh lpR fFf" class="main-layout">
      <q-header elevated class="bg-primary text-white">
        <q-toolbar>
          <q-btn
            flat
            dense
            round
            color="secondary"
            aria-label="Menu"
            @click="toggleLeftDrawer"
          >
            <q-avatar>
              <img src="icons/menu_outlined_24.svg" class="icon" />
            </q-avatar>
          </q-btn>
          <q-toolbar-title> Lightinator 5 </q-toolbar-title>
        </q-toolbar>
      </q-header>
      <q-drawer
        ref="leftDrawer"
        v-model="leftDrawerOpen"
        :overlay="$q.screen.lt.sm"
        :persistent="$q.screen.gt.sm"
        show-if-above
        bordered
      >
        <q-select
          v-if="controllers.status === storeStatus.READY"
          v-model="controllers.currentController"
          filled
          :options="controllers.data"
          option-label="hostname"
          option-value="ip_address"
          label="Select a controller"
          dropdown-icon="img:icons/arrow_drop_down.svg"
          @input="handleControllerSelection"
          @popup-show="() => $nextTick(() => (isSelectOpen.value = true))"
          @popup-hide="() => $nextTick(() => (isSelectOpen.value = false))"
        >
          <template v-slot:option="scope">
            <q-item clickable @click="handleControllerSelection(scope.opt)">
              <q-item-section avatar>
                <svgIcon :name="getIconForController(scope.opt)" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ scope.opt.hostname }}</q-item-label>
                <q-item-label caption>{{ scope.opt.ip_address }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-select>

        <q-list>
          <q-item-label header>main menu</q-item-label>
          <q-item clickable tag="router-link" to="/ColorPage">
            <q-item-section class="icon-section"
              ><svgIcon name="lightbulb_outlined" class="icon" />
            </q-item-section>

            <q-item-section class="text-section">
              <q-item-label>Color</q-item-label>
              <q-item-label caption>Set the current output color</q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable tag="router-link" to="/GroupsAndScenes">
            <q-item-section class="icon-section"
              ><svgIcon name="light_group" class="icon" />
            </q-item-section>

            <q-item-section class="text-section">
              <q-item-label>Groups and Scenes</q-item-label>
              <q-item-label caption>
                configure groups of controlelrs and scenes
              </q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable tag="router-link" to="/ColorSettings">
            <q-item-section class="icon-section"
              ><svgIcon name="settings_outlined" class="icon" />
            </q-item-section>

            <q-item-section class="text-section">
              <q-item-label>Color settings</q-item-label>
              <q-item-label caption
                >confiure the color model and others</q-item-label
              >
            </q-item-section>
          </q-item>

          <q-item clickable tag="router-link" to="/NetworkSettings">
            <q-item-section class="icon-section"
              ><svgIcon name="wifi_outlined" class="icon" />
            </q-item-section>

            <q-item-section class="text-section">
              <q-item-label>Network settings</q-item-label>
              <q-item-label caption
                >Configure the network, mqtt and more</q-item-label
              >
            </q-item-section>
          </q-item>

          <q-item clickable tag="router-link" to="/SystemSettings">
            <q-item-section class="icon-section"
              ><svgIcon name="memory_outlined" class="icon" />
            </q-item-section>

            <q-item-section class="text-section">
              <q-item-label>System settings</q-item-label>
              <q-item-label caption
                >configure pins, upgrade firmware, backup and restore settings
              </q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable tag="router-link" to="/NetworkInit">
            <q-item-section class="icon-section"
              ><svgIcon name="wifi_outlined" class="icon" />
            </q-item-section>

            <q-item-section class="text-section">
              <q-item-label>Network init</q-item-label>
              <q-item-label caption>join or leave a wifi network</q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable tag="router-link" to="/test">
            <q-item-section class="icon-section"
              ><svgIcon name="lightbulb_outlined" class="icon" />
            </q-item-section>

            <q-item-section class="text-section">
              <q-item-label>test</q-item-label>
              <q-item-label caption>developer's playground</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <q-separator />
        <q-item>
          <q-item-section>
            <q-toggle
              v-model="isDarkMode"
              label="Dark Mode"
              left-label
              @update:model-value="toggleDarkMode"
            />
          </q-item-section>
        </q-item>
      </q-drawer>
      <q-page-container class="page-container">
        <div id="q-app" class="full-width full-height no-gutter">
          <div
            id="parent"
            class="fit row wrap justify-center items-start content-start no-gutter with-bottom-padding"
          >
            <div
              class="col-xs-12 col-sm-6 col-md-7 col-lg-5 no-gutter"
              justify-center
            >
              <RouterView></RouterView>
            </div>
          </div>
        </div>
      </q-page-container>
      <q-footer class="bg-primary text-white">
        <q-toolbar>
          <q-btn
            round
            class="ws-status-btn"
            :color="buttonColor"
            :icon="buttonIcon"
          />
        </q-toolbar>
      </q-footer>
    </q-layout>
  </div>
</template>

<script>
import {
  defineComponent,
  ref,
  watch,
  onMounted,
  onUnmounted,
  computed,
} from "vue";
import { configDataStore } from "src/stores/configDataStore";
import { useColorDataStore } from "src/stores/colorDataStore";
import { useAppDataStore } from "src/stores/appDataStore";
import { infoDataStore } from "src/stores/infoDataStore";
import { useControllersStore } from "src/stores/controllersStore";

import { storeStatus } from "src/stores/storeConstants";
import useWebSocket, { wsStatus } from "src/services/websocket.js";
import { useRouter } from "vue-router";
import { Dark } from "quasar";

export default defineComponent({
  name: "MainLayout",

  setup() {
    console.log("RgbwwLayout.vue setup start");
    const isDarkMode = ref(Dark.isActive);

    try {
      const leftDrawerOpen = ref(false);

      console.log("RgbwwLayout.vue setup define stores");
      const controllers = useControllersStore();
      const configData = configDataStore();
      const infoData = infoDataStore();
      const colorData = useColorDataStore();
      const appData = useAppDataStore();
      const intervalId = ref(null);

      console.log("RgbwwLayout.vue setup useWebSocket");
      const ws = useWebSocket();

      const isSelectOpen = ref(false);

      const router = useRouter();

      const isSmallScreen = ref(window.innerWidth <= 1024);

      const updateIsSmallScreen = () => {
        isSmallScreen.value = window.innerWidth <= 1024;
      };

      const toggleDarkMode = (value) => {
        Dark.set(value);
        console.log("setting dark mode to", value ? "true" : "false");
        localStorage.setItem("darkMode", value);
        configData.updateData("general.UI.dark_mode", value, true);
        document.documentElement.setAttribute(
          "data-theme",
          value ? "dark" : "light",
        );
      };

      // Load user preference from local storage
      const savedDarkMode = localStorage.getItem("darkMode");
      if (savedDarkMode !== null) {
        const isDark = savedDarkMode === "true";
        Dark.set(isDark);
        isDarkMode.value = isDark;
        document.documentElement.setAttribute(
          "data-theme",
          isDark ? "dark" : "light",
        );
      }

      const buttonColor = computed(() => {
        console.log("=> websocket ws.status.value", ws.status.value);
        switch (ws.status.value) {
          case wsStatus.CONNECTED:
            return "green";
          case wsStatus.DISCONNECTED:
            return "red";
          case wsStatus.CONNECTING:
            return "yellow";
          default:
            return "grey";
        }
      });

      const buttonIcon = computed(() => {
        switch (ws.status.value) {
          case wsStatus.CONNECTED:
            return "img:icons/check_outlined.svg";
          case wsStatus.DISCONNECTED:
            return "img:icons/close_outlined.svg";
          case wsStatus.CONNECTING:
            return "img:icons/help_outlined.svg";
          default:
            return "img:icons/info_outlined.svg";
        }
      });

      onMounted(() => {
        window.addEventListener("resize", updateIsSmallScreen);
      });

      onUnmounted(() => {
        window.removeEventListener("resize", updateIsSmallScreen);
      });

      const handleControllerSelection = (event) => {
        console.log(
          "===============================\nhandleControllerSelection",
          event,
        );
        controllers.selectController(event);
      };

      const checkControllerConfigured = () => {
        console.log("infoData.status changed to", infoData.status);
        console.log("check if this is an unconfigured controller");
        console.log(
          "connected:",
          infoData.data.connection.connected ? "true" : "false",
        );
        console.log("ssid:", infoData.data.connection.ssid);

        if (
          !infoData.data.connection.connected &&
          infoData.data.connection.ssid === ""
        ) {
          // the controller has no configured ssid wsand is not connected to a wifi network
          // we are therefore talking to a controller in AP mode, trigger the controler config
          // section
          console.log("new controller, redirecting to /networkinit");
          router.push("/networkinit");
        } else {
          console.log("controller is configured, not redirecting");
        }
      };

      // close the left drawer when the current controller changes
      // that should only ever happen by selecting a controller from
      // the controllers dropdown list *in* the left drawer.
      watch(
        () => infoData.status === storeStatus.READY,
        () => {
          checkControllerConfigured();
        },
      );

      if (infoData.status === storeStatus.READY) {
        checkControllerConfigured();
      }

      watch(
        () => controllers.currentController,
        () => {
          toggleLeftDrawer();
        },
      );
      /*
      watch(
        () => isSelectOpen.value,
        (isSelectOpen) => {
          if (isSelectOpen) {
            controllers.fetchData(); //re-fetch neighbours when opening drawer
            // Start interval when drawer is opened
            console.log("controllers: ", JSON.stringify(controllers.data));
            intervalId.value = setInterval(() => {
              //console.log("re-feching controllers");
              controllers.fetchData();
            }, 15000);
          } else {
            // Clear interval when drawer is closed
            if (intervalId.value) {
              clearInterval(intervalId.value);
              intervalId.value = null;
            }
          }
        },
        { immediate: true },
      );
      */

      const toggleLeftDrawer = () => {
        if (isSmallScreen.value) {
          leftDrawerOpen.value = !leftDrawerOpen.value;
        }
      };

      const getIconForController = (controller) => {
        // Logic to determine the icon based on the controller properties
        console.log("getIconForController", controller.hostname);
        if (controller.ip_address === controllers.homeController.ip_address) {
          console.log("home icon for ", controller.ip_address);
          return "home";
        } else if (
          controller.ip_address === controllers.currentController.ip_address
        ) {
          console.log("api icon for", controller.ip_address);
          return "api";
        } else {
          console.log("no icon for ", controller.ip_address);
          return "";
        }
        //return "controller_default_icon"; // Replace with your default icon
      };

      return {
        leftDrawerOpen,
        configData,
        infoData,
        colorData,
        appData,
        controllers,
        storeStatus,
        isSelectOpen,
        handleControllerSelection,
        toggleLeftDrawer,
        buttonColor,
        buttonIcon,
        isDarkMode,
        toggleDarkMode,
        getIconForController,
      };
    } catch (error) {
      console.error("Error in setup function:", error);
    }
  },
});
</script>

<style scoped>
.q-icon {
  font-size: 2.5em;
}
.center-container {
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.bg-red {
  background-color: red;
}
.icon-section {
  flex: 0.2; /* Adjust this value to control the width */
  min-width: 0;
}
.text-section {
  flex: 0.8;
  min-width: 0;
}
.bg-orange {
  background-color: orange;
}
.no-gutter {
  padding-left: 0 !important;
  padding-right: 0 !important;
}
.with-bottom-padding {
  padding-bottom: 60px; /* Adjust this value to ensure enough space for the buttonIcon */
}
.full-width {
  width: 100%;
}
.full-height {
  height: 100%;
}
.ws-status-btn {
  margin-left: auto;
}
.main-layout {
  background-color: var(--background-color);
  box-shadow: 0 4px 8px 0 var(--shadow-color);
  animation: pulsate 2s infinite;
}

.page-container {
  background-color: var(--background-color);
}

.icon {
  color: var(--icon-color);
}

@keyframes pulsate {
  0% {
    box-shadow: 0 4px 8px 0 var(--shadow-color);
  }
  50% {
    box-shadow: 0 4px 16px 0 var(--shadow-color);
  }
  100% {
    box-shadow: 0 4px 8px 0 var(--shadow-color);
  }
}
</style>
