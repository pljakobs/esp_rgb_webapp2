<template>
  <div class="interaction-page">
    <scenesCard :collapsed="false" />
  </div>
</template>

<script>
import scenesCard from "src/components/cards/scenesCard.vue";

export default {
  components: {
    scenesCard,
  },

  setup() {
    return {
      scenesCard,
    };
  },
};
</script>

<style scoped>
.interaction-page {
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
}

.interaction-page :deep(.inset-scroll-area) {
  height: 80vh;
}
</style>
