<template>
  <q-page class="q-pa-md">
    <div class="fit row wrap justify-center items-center content-stretch">
      <div class="q-pa-md">
        <q-card bordered class="my-card shadow-1 col-auto fit">
          <q-card-section>
            <div class="text-h6 col-auto self-center q-gutter-md">
              Color configuration
            </div>
          </q-card-section>
          <q-card-section>
            bordered class="my-card shadow-1 col-auto fit" >
            <div class="q-pa-md">
              <q-badge color="red">
                red gain: {{ rvalue }} (0 to 1023)
              </q-badge>

              <q-slider
                v-model="rvalue"
                :min="0"
                :max="1023"
                label
                color="red"
              />
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
              />
            </div>
            <div class="q-pa-md">
              <q-badge color="light-blue">
                blue gain: {{ bvalue }} (0 to 1023)
              </q-badge>

              <q-slider v-model="bvalue" :min="0" :max="1023" color="green" />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
