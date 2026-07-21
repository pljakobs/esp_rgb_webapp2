<template>
  <!-- Reuse the base LightCard structure -->
  <LightCard
    :light="light"
    :selected-id="selectedId"
    @select="$emit('select', $event)"
    @delete="$emit('delete', $event)"
  >
    <!-- Inject HSV-specific quick controls into the default slot -->
    <div class="row q-gutter-xs justify-center q-pa-xs">
      <q-btn
        v-for="color in quickColors"
        :key="color.hex"
        round
        dense
        flat
        size="xs"
        :style="{ backgroundColor: color.hex }"
        class="swatch-btn"
        @click.stop="$emit('set-color', { id: light.id, color: color.hsv })"
      >
        <q-tooltip>{{ color.name }}</q-tooltip>
      </q-btn>
    </div>
  </LightCard>
</template>

<script setup>
import LightCard from "./LightCard.vue";

defineProps({
  light: {
    type: Object,
    required: true,
  },
  selectedId: {
    type: [Number, String],
    default: null,
  },
});

defineEmits(["select", "delete", "set-color"]);

// Example quick colors (HSV values would match your controller's API)
const quickColors = [
  { name: "Rot", hex: "#FF0000", hsv: { h: 0, s: 100, v: 100 } },
  { name: "Grün", hex: "#00FF00", hsv: { h: 120, s: 100, v: 100 } },
  { name: "Blau", hex: "#0000FF", hsv: { h: 240, s: 100, v: 100 } },
  { name: "Warmweiß", hex: "#FFD700", hsv: { h: 45, s: 50, v: 100 } }, // Approx
];
</script>

<style lang="scss" scoped>
.swatch-btn {
  border: 1px solid rgba(0, 0, 0, 0.1);
  width: 20px;
  height: 20px;
}
</style>
