<template>
  <groupsCard />
  <scenesCard />
</template>

<script>
import groupsCard from "src/components/cards/groupsCard.vue";
import scenesCard from "src/components/cards/scenesCard.vue";

export default {
  components: {
    groupsCard,
    scenesCard,
  },

  setup() {
    return {
      groupsCard,
      scenesCard,
    };
  },
};
</script>
