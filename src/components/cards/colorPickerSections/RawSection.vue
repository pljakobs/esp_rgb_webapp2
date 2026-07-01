<template>
  <q-scroll-area :style="{ height: isDialog ? dialogHeight : cardHeight }">
    <q-card-section>
      <ColorSlider
        v-for="colorSlider in colorSliders"
        :key="colorSlider.label"
        :min="colorSlider.min"
        :max="colorSlider.max"
        :label="colorSlider.label"
        :value="colorSlider.model"
        :color="colorSlider.color"
        label-on-top
        @update:model="($event) => updateColorSlider(colorSlider, $event)"
      />
    </q-card-section>

    <q-card-section class="flex justify-center" v-if="!isDialog">
      <q-btn flat color="primary" @click="onAddPreset">
        <template v-slot:default>
          <svgIcon name="star_outlined" />
          <span>Add Preset</span>
        </template>
      </q-btn>
    </q-card-section>
  </q-scroll-area>
</template>

<script>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import ColorSlider from "src/components/ColorSlider.vue";
import { useColorDataStore } from "src/stores/colorDataStore";

export default {
  components: {
    ColorSlider,
  },
  props: {
    modelValue: {
      type: Object,
      default: () => ({ raw: { r: 0, g: 0, b: 0, ww: 0, cw: 0 } }),
    },
    isDialog: {
      type: Boolean,
      default: false,
    },
    cardHeight: {
      type: String,
      default: "300px",
    },
    dialogHeight: {
      type: String,
      default: "280px",
    },
  },
  emits: ["update:modelValue", "add-preset"],

  setup(props, { emit }) {
    const { t } = useI18n();
    const colorStore = useColorDataStore();

    // Local state for raw values
    const internalRaw = ref({
      r: 0,
      g: 0,
      b: 0,
      ww: 0,
      cw: 0,
    });

    // Flag to prevent emitting during prop updates from websocket events
    const updatingFromProps = ref(false);

    // Watch for changes from parent
    watch(
      () => props.modelValue,
      (newValue) => {
        if (newValue?.raw) {
          // Set flag to prevent emitting
          updatingFromProps.value = true;

          internalRaw.value = { ...newValue.raw };

          // Reset flag after DOM update
          setTimeout(() => {
            updatingFromProps.value = false;
          }, 0);
        }
      },
      { immediate: true, deep: true },
    );

    const colorSliders = computed(() => [
      {
        key: "r",
        label: t("colorSliders.red"),
        model: internalRaw.value.r,
        min: 0,
        max: 1023,
        color: "red",
      },
      {
        key: "g",
        label: t("colorSliders.green"),
        model: internalRaw.value.g,
        min: 0,
        max: 1023,
        color: "green",
      },
      {
        key: "b",
        label: t("colorSliders.blue"),
        model: internalRaw.value.b,
        min: 0,
        max: 1023,
        color: "blue",
      },
      {
        key: "ww",
        label: t("colorSliders.warmWhite"),
        model: internalRaw.value.ww,
        min: 0,
        max: 1023,
        color: "yellow",
      },
      {
        key: "cw",
        label: t("colorSliders.coldWhite"),
        model: internalRaw.value.cw,
        min: 0,
        max: 1023,
        color: "cyan",
      },
    ]);

    const updateColorSlider = (slider, value) => {
      // Only process updates if not updating from props and not from websocket
      if (!updatingFromProps.value && colorStore.change_by !== "websocket") {
        const rawColorKey = slider.key;
        if (rawColorKey) {
          internalRaw.value[rawColorKey] = value;
          emit("update:modelValue", { raw: { ...internalRaw.value } });
        }
      }
    };

    const onAddPreset = () => {
      emit("add-preset", {
        type: "raw",
        value: { ...internalRaw.value },
      });
    };

    return {
      internalRaw,
      colorSliders,
      updateColorSlider,
      onAddPreset,
    };
  },
};
</script>

<style scoped>
.icon {
  color: var(--icon-color);
  fill: var(--icon-color);
}

.raw-section {
  display: flex;
  flex-direction: column;
}
/* Compact styling for dialog mode */
:deep(.q-slider) {
  height: 20px;
}
</style>
