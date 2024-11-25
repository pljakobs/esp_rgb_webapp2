<template>
  <q-scroll-area style="height: 100%; width: 100%">
    <q-card-section class="flex justify-center no-padding">
      <q-color
        :value="color"
        format-model="hex"
        no-header
        no-footer
        @input="updateColor"
      />
    </q-card-section>
    <q-card-section class="flex justify-center">
      <q-btn
        icon="img:icons/star_outlined.svg"
        label="Add Preset"
        @click="openDialog('hsv')"
      />
    </q-card-section>
  </q-scroll-area>
</template>

<script>
export default {
  name: "HsvSection",
  props: {
    color: {
      type: String,
      required: true,
    },
    cardHeight: {
      type: String,
      default: "300px",
    },
    openDialog: {
      type: Function,
      required: true,
    },
  },
  methods: {
    updateColor(newColor) {
      this.$emit("update:color", newColor);
    },
  },
};
</script>

<style scoped></style>
