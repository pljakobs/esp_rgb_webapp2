<template>
  <q-card class="shadow-8 col-auto fit q-gutter-md q-ma-md">
    <q-card-section class="row items-center">
      <q-icon :name="icon" class="q-mr-sm" />
      <div class="text-h6">{{ title }}</div>
      <q-btn
        flat
        round
        dense
        icon="img:icons/arrow_drop_down.svg"
        class="q-ml-auto"
        @click="toggleCollapse"
      />
    </q-card-section>
    <q-separator />
    <q-card-section v-show="!collapsed">
      <slot />
    </q-card-section>
  </q-card>
</template>

<script>
export default {
  name: "MyCard",
  props: {
    icon: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      collapsed: false,
    };
  },
  methods: {
    toggleCollapse() {
      this.collapsed = !this.collapsed;
    },
  },
};
</script>

<style scoped>
.my-card {
}
</style>
