<template>
  <q-card class="full-width full-height no-gutter">
    <q-card-section class="row items-center">
      <svgIcon :name="icon" />
      <div class="text-h6">{{ title }}</div>
      <div
        class="q-ml-auto rotate-icon"
        :class="{ 'rotate-up': !collapsed, 'rotate-down': collapsed }"
        @click="toggleCollapse"
      >
        <svgIcon name="arrow_drop_down" />
      </div>
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
  computed: {
    iconColor() {
      return this.$q.dark.isActive ? "white" : "black";
    },
  },
  methods: {
    toggleCollapse() {
      this.collapsed = !this.collapsed;
    },
  },
  mounted() {
    console.log("Icon name passed to MyCard:", this.icon);
  },
  watch: {
    icon(newVal) {
      this.$emit("update: icon", newVal);
    },
  },
};
</script>

<style scoped>
.rotate-icon {
  transition: transform 0.3s ease;
  cursor: pointer;
  transform-origin: center center;
}
.rotate-up {
  transform: rotate(180deg);
}
.rotate-down {
  transform: rotate(0deg);
}
.no-gutter {
  padding: 0 !important;
  margin: 0 !important;
}
.icon {
  font-size: var(--icon-font-size) !important;
  width: var(--icon-font-size) !important;
  height: var(--icon-font-size) !important;
}
</style>
