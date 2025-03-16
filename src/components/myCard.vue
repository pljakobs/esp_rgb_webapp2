<template>
  <q-card class="full-width full-height no-gutter">
    <q-card-section class="row items-center">
      <svgIcon :name="icon" />
      <div class="text-h6">{{ title }}</div>
      <div
        class="q-ml-auto rotate-icon"
        :class="{ 'rotate-up': !isCollapsed, 'rotate-down': isCollapsed }"
        @click="toggleCollapse"
      >
        <svgIcon name="arrow_drop_down" />
      </div>
    </q-card-section>
    <q-separator />
    <q-card-section v-show="!isCollapsed">
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
    collapsed: {
      type: Boolean,
      default: true,
    },
  },
  emits: ["update:collapsed"],
  data() {
    return {
      isCollapsed: this.collapsed, // Initialize from prop
    };
  },
  watch: {
    collapsed(newVal) {
      // Update internal state when prop changes
      this.isCollapsed = newVal;
    },
  },
  computed: {
    iconColor() {
      return this.$q.dark.isActive ? "white" : "black";
    },
  },
  methods: {
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed;
      // Emit the change to parent
      this.$emit("update:collapsed", this.isCollapsed);
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
