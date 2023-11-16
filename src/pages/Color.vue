<template>
  <q-card bordered class="my-card shadow-4 col-auto fit q-gutter-md">
    <q-card-section>
      <div class="text-h6 col-auto self-center q-gutter-md">
        choose your color
      </div>
    </q-card-section>
    <q-card-section>
      <div class="q-pa-md row items-start q-gutter-md">
        <Verte
          v-model="hslValue"
          display="widget"
          width="100%"
          style="width: 100%"
        />
        <div>select {{ hslValue }}</div>
      </div>
      <q-btn @click="showValue">show color</q-btn>
    </q-card-section>
  </q-card>
</template>

<script>
import { defineComponent, ref } from "vue";

import { Verte, useVerteStore } from "verte-vue3";
import "verte-vue3/dist/verte.css";

const { recentColors } = useVerteStore({
  recentColors: ["#000000", "#ffffff", "#aaaaaa"],
});

export default defineComponent({
  name: "ColorPage",
  setup() {
    console.log("setting up color component");
    return {
      gValue: ref(true),
      bValue: ref(true),
      hslValue: ref("000"),
      other: ref(["#000"]),
    };
  },
  components: {
    Verte,
  },
  methods: {
    showValue() {
      console.log(this.hslValue);
    },
    showColorByEvent(e) {
      console.log(e);
    },
  },
});
</script>
<style lang="scss"></style>
