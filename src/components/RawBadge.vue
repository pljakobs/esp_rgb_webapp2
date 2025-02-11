<template>
  <div class="color-badge" @click="$emit('click')">
    <div
      class="color-dot"
      :style="{ backgroundColor: `rgb(${color.raw.r}, 0, 0)` }"
    ></div>
    <div
      class="color-dot"
      :style="{ backgroundColor: `rgb(0, ${color.raw.g}, 0)` }"
    ></div>
    <div
      class="color-dot"
      :style="{ backgroundColor: `rgb(0, 0, ${color.raw.b})` }"
    ></div>
    <div
      class="color-dot"
      :style="{
        backgroundColor: `rgb(${color.raw.ww}, ${color.raw.ww}, 0)`,
      }"
    ></div>
    <div
      class="color-dot"
      :style="{
        backgroundColor: `rgb(${color.raw.cw}, ${color.raw.cw}, ${color.raw.cw})`,
      }"
    ></div>
  </div>
</template>

<script>
export default {
  name: "RawBadge",
  props: {
    color: {
      type: Object,
      required: true,
    },
  },
  emits: ["click"],
};
</script>

<style scoped>
.color-badge {
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 0px solid black;
  display: flex;
  justify-content: center;
  align-items: center;
}

.color-dot {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.color-dot:nth-child(1) {
  top: 2px;
  left: 2px;
}

.color-dot:nth-child(2) {
  top: 2px;
  right: 2px;
}

.color-dot:nth-child(3) {
  bottom: 2px;
  left: 2px;
}

.color-dot:nth-child(4) {
  bottom: 2px;
  right: 2px;
}

.color-dot:nth-child(5) {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
