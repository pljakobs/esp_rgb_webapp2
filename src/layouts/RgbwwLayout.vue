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
          <!--
          Groups:
          <span
            v-if="groupsData.status === storeStatus.READY"
            class="text-success"
            >✔️</span
          >
          <q-spinner
            v-else-if="groupsData.status === storeStatus.LOADING"
            color="light-blue"
          />
          <span v-else class="text-danger">❌ {{ groupsData.error }}</span>
          -->
        </div>
      </div>
    </div>
  </div>
  <div v-else>
    <q-layout view="hHh lpR fFf">
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
              <img src="icons/favicon.ico" />
            </q-avatar>
          </q-btn>
          <q-toolbar-title> Lightinator Mini </q-toolbar-title>
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
          filled
          v-model="controllers.currentController"
          :options="controllers.data"
          option-label="hostname"
          option-value="ip_address"
          label="Select a controller"
          @input="handleControllerSelection"
          @popup-show="() => $nextTick(() => (isSelectOpen.value = true))"
          @popup-hide="() => $nextTick(() => (isSelectOpen.value = false))"
        />

        <q-list>
          <q-item-label header>main menu</q-item-label>

          <EssentialLink
            v-for="link in essentialLinks"
            :key="link.title"
            v-bind="link"
          />
        </q-list>
        Version:
      </q-drawer>
      <q-btn
        round
        :style="{ position: 'fixed', right: '20px', bottom: '20px' }"
        :color="buttonColor"
        :icon="buttonIcon"
      />
      <q-page-container>
        <div id="q-app" class="bg-blue-grey-2" style="min-height: 100vh">
          <div
            id="parent"
            class="fit row wrap justify-center items-start content-start"
          >
            <div
              class="col-xs-12 col-sm-6 col-md-7 col-lg-5 q-gutter-md"
              justify-center
            >
              <RouterView></RouterView>
            </div>
          </div>
        </div>
      </q-page-container>
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
import { colorDataStore } from "src/stores/colorDataStore";
import { presetDataStore } from "src/stores/presetDataStore";
import { infoDataStore } from "src/stores/infoDataStore";
import { controllersStore } from "src/stores/controllersStore";

import { storeStatus } from "src/stores/storeConstants";
import EssentialLink from "components/EssentialLink.vue";
import useWebSocket, { wsStatus } from "src/services/websocket.js";
import { useRouter } from "vue-router";

const linksList = [
  {
    title: "Color",
    caption: "Color",
    icon: "lightbulb",
    link: "/ColorPage",
  },
  {
    title: "Color Settings",
    caption: "Color Settings",
    icon: "settings",
    link: "/ColorSettings",
  },
  {
    title: "Network Settings",
    caption: "",
    icon: "wifi",
    link: "/NetworkSettings",
  },
  {
    title: "System Settings",
    caption: "",
    icon: "memory",
    link: "/SystemSettings",
  },
  {
    title: "Network Init",
    caption: "",
    icon: "wifi",
    link: "/NetworkInit",
  },
  {
    title: "test",
    caption: "",
    icon: "lightbulb",
    link: "/test",
  },
];
export default defineComponent({
  name: "MainLayout",

  components: {
    EssentialLink,
  },

  setup() {
    const leftDrawerOpen = ref(false);

    const controllers = controllersStore();
    const configData = configDataStore();
    const infoData = infoDataStore();
    const colorData = colorDataStore();
    //const groupsData = groupsDataStore();
    const intervalId = ref(null);
    const ws = useWebSocket();

    const isSelectOpen = ref(false);

    const router = useRouter();

    const isSmallScreen = ref(window.innerWidth <= 1024); // Change 600 to your small breakpoint

    const updateIsSmallScreen = () => {
      isSmallScreen.value = window.innerWidth <= 1024; // Change 600 to your small breakpoint
    };

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
          return "check";
        case wsStatus.DISCONNECTED:
          return "close";
        case wsStatus.CONNECTING:
          return "help";
        default:
          return "info";
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

    watch(
      () => isSelectOpen.value,
      (isSelectOpen) => {
        if (isSelectOpen) {
          controllers.fetchData(); //re-fetch neighbours when opening drawer
          // Start interval when drawer is opened
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

    const toggleLeftDrawer = () => {
      if (isSmallScreen.value) {
        leftDrawerOpen.value = !leftDrawerOpen.value;
      }
    };

    return {
      essentialLinks: linksList,
      leftDrawerOpen,
      configData,
      infoData,
      colorData,
      //groupsData,
      controllers,
      storeStatus,
      isSelectOpen,
      handleControllerSelection,
      toggleLeftDrawer,
      buttonColor,
      buttonIcon,
    };
  },
});
</script>
<style scoped>
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

.bg-orange {
  background-color: orange;
}
</style>
