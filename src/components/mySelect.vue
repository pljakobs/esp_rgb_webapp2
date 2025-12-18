<template>
  <q-select
    v-bind="$attrs"
    dropdown-icon="none"
    :class="'my-select-component'"
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
        <div class="dropdown-icon-container">
          <svgIcon
            name="arrow_drop_down"
            :class="{ 'rotate-icon': !isDropdownOpen }"
          />
        </div>
      </slot>
    </template>
  </q-select>
</template>

<script>
import { ref } from "vue";

export default {
  name: "MySelect",

  inheritAttrs: false,
  setup() {
    const isDropdownOpen = ref(false);
    return { isDropdownOpen };
  },
};
</script>

<style scoped>
.my-select-component {
  position: relative;
}

.dropdown-icon-container {
  position: absolute;
  right: 0px;
  top: 50%;
  transform: translateY(-50%);
}

.rotate-icon {
  transform: rotate(-90deg);
  transition: transform 0.3s ease;
}

/* Ensure enough space for the text */
:deep(.q-field__native) {
  padding-right: 5px !important;
}
</style>
