<template>
  <q-tooltip ref="tooltipRef" :no-parent-event="isTouch">
    <slot />
  </q-tooltip>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useQuasar } from "quasar";

// Informational tooltip following the Material Design "rich tooltip"
// interaction: on pointer devices it shows on hover (QTooltip default),
// on touch devices it toggles on tap instead of Quasar's hold-to-show.
// Tapping anywhere outside still dismisses it (QTooltip's built-in
// mobile click-outside handling stays active because no v-model is bound).

const $q = useQuasar();
const isTouch = $q.platform.is.mobile === true;
const tooltipRef = ref(null);
let anchorEl = null;

function onAnchorClick() {
  tooltipRef.value?.toggle();
}

onMounted(() => {
  if (!isTouch) return;
  // QTooltip anchors to its parent DOM element; do the same.
  const parent = tooltipRef.value?.$el?.parentNode;
  if (parent && parent.nodeType === Node.ELEMENT_NODE) {
    anchorEl = parent;
    anchorEl.addEventListener("click", onAnchorClick);
  }
});

onBeforeUnmount(() => {
  if (anchorEl !== null) {
    anchorEl.removeEventListener("click", onAnchorClick);
    anchorEl = null;
  }
});
</script>
