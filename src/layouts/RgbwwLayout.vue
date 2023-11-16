<template>
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
    <q-drawer v-model="leftDrawerOpen" mini overlay show-if-above bordered>
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
      <div id="q-app" class="bg-blue-grey-2" style="min-height: 100vh">
        <div class="flex flex-center column">
          <div class="row" style="min-height: 400px; width: 80%; padding: 24px">
            <div
              id="parent"
              class="fit row wrap justify-center items-start content-start"
              style="overflow: hidden"
            >
              <div
                class="col-4 col-xs-12 col-sm-8 col-md-6 col-lg-6 q-gutter-md"
                style="overflow: auto"
              >
                <RouterView></RouterView>
              </div>
            </div>
          </div>
        </div>
      </div>
    </q-page-container>
  </q-layout>
</template>
<script>
import { defineComponent, ref } from "vue";
import EssentialLink from "components/EssentialLink.vue";

const linksList = [
  {
    title: "Color",
    caption: "Color",
    icon: "lightbulb",
    link: "/Color",
  },
  {
    title: "Color Settings",
    caption: "Color Settings",
    icon: "settings",
    link: "/ColorSettings",
  },
  {
    title: "Grid Test",
    caption: "",
    icon: "code",
    link: "/gridTest",
  },
];
export default defineComponent({
  name: "MainLayout",

  components: {
    EssentialLink,
  },

  setup() {
    const leftDrawerOpen = ref(false);

    return {
      essentialLinks: linksList,
      leftDrawerOpen,
      toggleLeftDrawer() {
        leftDrawerOpen.value = !leftDrawerOpen.value;
      },
    };
  },
});
</script>
