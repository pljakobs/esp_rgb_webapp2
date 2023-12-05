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
import { defineComponent } from "vue";
import { colors } from 'quasar'
const { rgbToHsv,hexToRgb } = colors

export default defineComponent({
  name: "ColorPage",
  data() {
    return {
      color: '#000000',
    }
  },
  methods: {
    showValue() {
      console.log(this.color);
      console.log("hex: ", this.color);
      const rgb=colors.hexToRgb(this.color);
      const hsv = colors.rgbToHsv(rgb);
      console.log("hsv:",hsv);
    },
  },
  watch: {
    color(val) {
      console.log("color changed:", val);
      const rgb = colors.hexToRgb(val);
      const hsv = colors.rgbToHsv(rgb);
      console.log("hsv", hsv);
    },
  },
});
</script>
<style scoped>
.q-color__hue {
  width: 30px !important;
}
</style>
