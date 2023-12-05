<template>
  <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md">
    <q-card-section>
      <div class="text-h6">
        <q-icon name="palette" />
        Color
      </div>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <q-color v-model="color" format-model="hex" no-header no-footer />
      <div class="q-pa-md q-gutter-md">selected {{ color }}</div>
      <q-btn @click="showValue">show color</q-btn>
    </q-card-section>
  </q-card>
</template>

<script>
import { ref, watch } from "vue";
import { colors } from 'quasar';
import { colorStore, createComputedProperties } from 'src/store'; // replace with the correct import paths

const { rgbToHsv, hexToRgb } = colors;

export default {
  setup() {
    const store = colorStore();
    const fields = ['raw.r', 'raw.g', 'raw.b', 'raw.ww', 'raw.cw', 'hsv.h', 'hsv.s', 'hsv.v', 'hsv.ct'];
    const computedProperties = createComputedProperties(store, fields);
    const color = computed(() => {
      return 'hsv(${hsv.h},${hsv.s},${hsv.v})';
    });


      watch(color, (val) => {
      console.log("color changed:", val);
      const rgb = hexToRgb(val);
      const hsv = rgbToHsv(rgb);
      console.log("hsv", hsv);
    });

    return {
      ...computedProperties,
      color,
    };
  },
};
</script>
