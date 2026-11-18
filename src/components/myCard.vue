<template>
  <q-card class="my-card full-width no-gutter">
    <q-card-section class="row items-center" @click="toggleCollapse">
      <svgIcon :name="icon" />
      <div class="text-h6">{{ title }}</div>
      <div
        class="q-ml-auto rotate-icon"
        :class="{ 'rotate-up': !isCollapsed, 'rotate-down': isCollapsed }"
      >
        <svgIcon name="arrow_drop_down" />
      </div>
    </q-card-section>
    <template v-if="!isCollapsed">
      <q-separator />
      <q-card-section>
        <slot />
      </q-card-section>
    </template>
  </q-card>
</template>

<script>
import { ref, watch } from "vue";

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
  setup(props, { emit }) {
    const isCollapsed = ref(props.collapsed);

    watch(
      () => props.collapsed,
      (collapsed) => {
        isCollapsed.value = collapsed;
      },
    );

    function toggleCollapse() {
      isCollapsed.value = !isCollapsed.value;
      emit("update:collapsed", isCollapsed.value);
    }

    return { isCollapsed, toggleCollapse };
  },
};
</script>

<style scoped>
.my-card {
  transition: all 0.4s ease-in-out;
  border-width: 1px;
  border-radius: 10px;
}
.my-card:hover {
  transform: translateY(-3px); /* Slightly lifts the card for feedback */
  box-shadow: 0 4px 12px var(--accent-color); /* Creates the "lighting up" effect */
  filter: brightness(1.08); /* Boosts internal element brightness slightly */
}
.rotate-icon {
  transition: transform 0.4s ease;
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
