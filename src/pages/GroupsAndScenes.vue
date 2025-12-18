<template>
  <scenesCard :collapsed="false" />
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
