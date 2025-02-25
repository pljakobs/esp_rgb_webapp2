<template>
  <groupsCard />
</template>

<script>
import groupsCard from "src/components/cards/groupsCard.vue";

export default {
  components: {
    groupsCard,
  },

  setup() {
    return {
      groupsCard,
    };
  },
};
</script>
