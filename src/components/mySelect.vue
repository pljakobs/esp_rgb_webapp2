<template>
  <q-select
    v-bind="$attrs"
    dropdown-icon=""
    @popup-show="isDropdownOpen = true"
    @popup-hide="isDropdownOpen = false"
  >
    <!-- Forward all other slots -->
    <template v-for="(_, slot) in $slots" #[slot]="scope">
      <slot :name="slot" v-bind="scope" />
    </template>

    <!-- Custom append slot with rotating arrow -->
    <template #append>
      <slot name="append">
        <svgIcon
          name="arrow_drop_down"
          :class="{ 'rotate-icon': !isDropdownOpen }"
        />
      </slot>
    </template>
  </q-select>
</template>

<script>
import { ref } from "vue";
import svgIcon from "./svgIcon.vue";

export default {
  name: "MySelect",
  components: {
    svgIcon,
  },
  inheritAttrs: false,
  setup() {
    const isDropdownOpen = ref(false);
    return { isDropdownOpen };
  },
};
</script>

<style scoped>
.rotate-icon {
  transform: rotate(-90deg);
  transition: transform 0.3s ease;
}
</style>
