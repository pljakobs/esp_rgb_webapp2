<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="img:icons/menu_outline.svg"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />
        <q-toolbar-title> Quasar App </q-toolbar-title>
        <div>Quasar v{{ $q.version }}</div>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above bordered>
      <q-list>
        <q-item-label header> Essential Links </q-item-label>
        <EssentialLink
          v-for="link in essentialLinks"
          :key="link.title"
          v-bind="link"
        />
      </q-list>
    </q-drawer>

    <q-page-container>
      <q-page class="q-pa-md no-gutter full-width full-height">
        <q-card class="no-gutter full-width full-height">
          <slot />
        </q-card>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script>
import { ref } from "vue";
import EssentialLink from "src/components/EssentialLink.vue";

export default {
  name: "MainLayout",
  components: {
    EssentialLink,
  },
  setup() {
    const leftDrawerOpen = ref(false);

    const toggleLeftDrawer = () => {
      leftDrawerOpen.value = !leftDrawerOpen.value;
    };

    return {
      leftDrawerOpen,
      toggleLeftDrawer,
      essentialLinks: [
        {
          title: "Quasar Docs",
          caption: "quasar.dev",
          icon: "school",
          link: "https://quasar.dev",
        },
        {
          title: "Quasar Awesome",
          caption: "Community Quasar projects",
          icon: "favorite",
          link: "https://awesome.quasar.dev",
        },
      ],
    };
  },
};
</script>

<style scoped>
.full-width {
  width: 100%;
}

.full-height {
  height: 100%;
}

.no-gutter {
  padding-left: 0 !important;
  padding-right: 0 !important;
}

@media (min-width: 1024px) {
  .q-drawer {
    display: block !important;
  }
}
</style>
