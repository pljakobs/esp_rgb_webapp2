<template>
  <div>
    <q-banner v-if="presets.error" class="bg-negative text-white q-mb-sm">{{
      presets.error
    }}</q-banner>
    <div v-if="!favoritesOnly" class="row q-gutter-sm q-mb-md">
      <q-input
        v-model="name"
        label="Save current colour as"
        dense
        outlined
        :disable="presets.busy"
      />
      <q-btn
        label="Save swatch"
        :disable="presets.busy || !name.trim()"
        @click="save"
      />
    </div>
    <div class="text-caption q-mb-sm">
      Presets are shared on this controller. Stars select favourites for this
      light only.
    </div>
    <q-list separator>
      <q-item v-for="preset in shown" :key="preset.id">
        <q-item-section>
          <q-btn
            flat
            no-caps
            :label="preset.name"
            :disable="presets.busy || !compatible(preset)"
            @click="apply(preset.id)"
          >
            <span
              class="swatch q-mr-sm"
              :style="{ backgroundColor: swatch(preset) }"
            />
          </q-btn>
          <div v-if="!compatible(preset)" class="text-caption">
            Different RAW light profile
          </div>
        </q-item-section>
        <q-item-section side>
          <q-btn
            flat
            :label="favorite(preset) ? 'Unstar' : 'Star'"
            :disable="presets.busy"
            @click="toggle(preset)"
          >
            <svgIcon name="star_outlined" :isSelected="favorite(preset)" />
          </q-btn>
        </q-item-section>
      </q-item>
    </q-list>
    <div v-if="!shown.length" class="text-grey-7">
      No {{ favoritesOnly ? "favourite swatches" : "presets" }} yet.
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { colors, Notify } from "quasar";
import { useLightPresetsStore } from "src/stores/lightPresetsStore";
import { isLightFavorite, presetColor } from "src/services/lightPresets";

const props = defineProps({ favoritesOnly: Boolean });
const presets = useLightPresetsStore();
const name = ref("");
const shown = computed(() =>
  props.favoritesOnly ? presets.favorites : presets.presets,
);
const favorite = (preset) => isLightFavorite(preset, presets.light);
const compatible = (preset) => {
  try {
    presetColor(preset, presets.light);
    return true;
  } catch {
    return false;
  }
};
const swatch = (preset) => {
  if (!compatible(preset)) return "#aaa";
  const color = presetColor(preset, presets.light);
  if (color.hsv) {
    const { r, g, b } = colors.hsvToRgb(color.hsv);
    return `rgb(${r},${g},${b})`;
  }
  const raw = color.raw;
  if (Array.isArray(raw)) {
    const level = Math.round((Math.max(...raw) * 255) / 1023);
    return `rgb(${level},${level},${level})`;
  }
  const white = (((raw.ww ?? 0) + (raw.cw ?? 0)) * 255) / 1023;
  return `rgb(${["r", "g", "b"].map((channel) => Math.min(255, Math.round((raw[channel] * 255) / 1023 + white))).join(",")})`;
};
const perform = async (operation) => {
  try {
    await operation();
  } catch (error) {
    Notify.create({ type: "negative", message: error.message });
  }
};
const apply = (id) => perform(() => presets.apply(id));
const toggle = (preset) =>
  perform(() => presets.setFavorite(preset.id, !favorite(preset)));
const save = () =>
  perform(async () => {
    await presets.saveCurrent(name.value);
    name.value = "";
  });
</script>

<style scoped>
.swatch {
  display: inline-block;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid currentColor;
}
</style>
