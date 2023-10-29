<template>
  <q-page class="q-pa-md">
    <div class="fit row wrap justify-center items-center content-stretch">
      <q-card bordered class="my-card shadow-1 col-auto">
        <q-card-section>
          <div class="text-h6 col-auto self-center q-gutter-md">
            chose your color
          </div>
        </q-card-section>
        <q-card-section>
          <div class="col-auto self-center q-gutter-md">
            <q-toggle v-model="gValue" color="green" label="On Right" />
            <div>{{ gValue }}</div>
            <q-toggle v-model="bValue" color="blue" label="On Right" />
            <div>{{ bValue }}</div>
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
            <div>History {{ recentColors }}</div>
            <div class="col-12">select {{ hslValue }}</div>
          </div>
          <q-btn @click="showValue">show color</q-btn>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script>
import { defineComponent, ref } from "vue";

import { Verte, useVerteStore } from "verte-vue3";
import "verte-vue3/dist/verte.css";

const { recentColors } = useVerteStore({
  recentColors: ["#000", "#fff", "#ff0000"],
});

export default defineComponent({
  name: "ColorPage",
  setup() {
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
