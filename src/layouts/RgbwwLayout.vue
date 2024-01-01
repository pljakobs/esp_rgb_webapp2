<template>
  <div
    v-if="
      infoData.status === storeStatus.LOADING ||
      configData.status === storeStatus.LOADING ||
      colorData.status === storeStatus.LOADING ||
      presetData.status === storeStatus.LOADING ||
      groupsData.status === storeStatus.LOADING
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
          Presets:
          <span
            v-if="presetData.status === storeStatus.READY"
            class="text-success"
            >✔️</span
          >
          <q-spinner
            v-else-if="presetData.status === storeStatus.LOADING"
            color="light-blue"
          />
          <span v-else class="text-danger">❌ {{ presetData.error }}</span
          ><br />
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
          @input="controllers.selectController($event)"
        />
        <q-list>
          <q-item-label header>main menu</q-item-label>

          <EssentialLink
            v-for="link in essentialLinks"
            :key="link.title"
            v-bind="link"
          />
        </q-list>
      </q-drawer>
      <q-page-container>
        <div id="q-app" class="bg-blue-grey-2" style="min-eight: 100vh">
          <div
            id="parent"
            class="fit row wrap justify-center items-start content-start"
          >
            <div
              class="col-xs-12 col-sm-5 col-md-5 col-lg-4 q-gutter-md"
              justify-center
            >
              <RouterView></RouterView>
            </div>
          </div>
          <!--
      <q-page-container>
        screen width: {{ $q.screen.width }}
        <div id="q-app" class="bg-blue-grey-2" style="min-height: 100vh">
          <div class="flex flex-center column">
            <div
              class="row"
              style="min-height: 400px; width: 100%; padding: 24px"
            >
              <div
                id="parent"
                class="fit row wrap justify-center items-start content-start"
              >
                <div class="col-xs-12 col-sm-8 col-md-10 col-lg-6 q-gutter-md">
                  <RouterView></RouterView>
                </div>
              </div>
            </div>
          </div>
        </div>
      </q-page-container>
    -->
        </div>
      </q-page-container>
    </q-layout>
  </div>
</template>
<script>
import { defineComponent, onBeforeMount, ref } from "vue";
import EssentialLink from "components/EssentialLink.vue";
import {
  configDataStore,
  infoDataStore,
  colorDataStore,
  presetDataStore,
  groupsDataStore,
  storeStatus,
  controllersStore,
} from "src/store";
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
    const presetData = presetDataStore();
    const groupsData = groupsDataStore();
    console.log("MainLayout setup");
    console.log("controllers.data:", JSON.stringify(controllers.data));
    return {
      essentialLinks: linksList,
      leftDrawerOpen,
      configData,
      infoData,
      colorData,
      presetData,
      groupsData,
      controllers,
      storeStatus,
      toggleLeftDrawer() {
        leftDrawerOpen.value = !leftDrawerOpen.value;
      },
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
</style>
