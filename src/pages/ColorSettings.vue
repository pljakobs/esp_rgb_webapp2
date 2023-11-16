<template>
  <q-card bordered class="my-card col-auto fit q-gutter-lg">
    <q-card-section>
      <div class="text-h6">
        <q-icon name="tune" />
        HSV Mixing
      </div>
    </q-card-section>

    <q-card-section>
      <div class="text-h6 col-auto self-center q-gutter-md">
        <q-select
          v-model="transitionModel"
          :options="options"
          label="Standard"
        />
      </div>
    </q-card-section>

    <q-card-section>
      <div bordered class="my-card shadow-1 col-auto fit">
        <div class="q-pa-md">
          <q-badge color="red"> red gain: {{ rvalue }} (0 to 100) </q-badge>

          <q-slider
            v-model="rvalue"
            :min="0"
            :max="100"
            label
            color="red"
            display-value="always"
            label-always
            track-size="10px"
            thumb-color="black"
          />
          <!--<div class="slider-value">{{ rvalue }}</div>-->
        </div>
      </div>
      <div class="q-pa-md">
        <q-badge color="light-green">
          green gain: {{ gvalue }} (0 to 1023)
        </q-badge>

        <q-slider
          v-model="gvalue"
          :min="0"
          :max="1023"
          label
          color="green"
          display-value="always"
          label-always
          track-size="10px"
          thumb-color="black"
        />
      </div>
      <div class="q-pa-md">
        <q-badge color="light-blue">
          blue gain: {{ bvalue }} (0 to 1023)
        </q-badge>

        <q-slider
          v-model="bvalue"
          :min="0"
          :max="1023"
          color="green"
          display-value="always"
          label-always
          track-size="10px"
          thumb-color="black"
        />
      </div>
    </q-card-section>
  </q-card>
</template>
<script>
import { ref } from "vue";

export default {
  setup() {
    return {
      transitionModel: ref("Normal"),
      options: ["Normal", "Spektrum", "Rainbow"],
    };
  },
};
</script>
