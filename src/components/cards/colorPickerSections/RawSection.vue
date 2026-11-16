<template>
  <component :is="scrollContainer" :style="scrollStyle">
    <q-card-section class="q-pa-none">
      <LightControlSlider
        v-for="(colorSlider, index) in colorSliders"
        :key="colorSlider.key"
        :min="colorSlider.min"
        :max="colorSlider.max"
        :label="colorSlider.label"
        :model-value="colorSlider.model"
        :display-value="String(Math.round(colorSlider.model))"
        :color="colorSlider.color"
        @update:model-value="($event) => updateColorSlider(colorSlider, $event)"
      >
        <template #action>
          <q-toggle
            v-if="showPower && index === 0"
            :model-value="powerOn"
            :disable="powerBusy || powerOn === null"
            :aria-label="$t('color.power')"
            @update:model-value="$emit('update:power', $event)"
          />
        </template>
      </LightControlSlider>
    </q-card-section>

    <q-card-section class="flex justify-center" v-if="!isDialog && !profile">
      <q-btn flat color="primary" @click="onAddPreset">
        <template v-slot:default>
          <svgIcon name="star_outlined" />
          <span>Add Preset</span>
        </template>
      </q-btn>
    </q-card-section>
  </component>
</template>

<script>
import { computed, ref, watch } from "vue";
import { QScrollArea } from "quasar";
import { useI18n } from "vue-i18n";
import LightControlSlider from "src/components/LightControlSlider.vue";
import { useColorDataStore } from "src/stores/colorDataStore";

export default {
  components: {
    LightControlSlider,
  },
  props: {
    profile: { type: Object, default: null },
    showPower: { type: Boolean, default: false },
    powerOn: { type: Boolean, default: null },
    powerBusy: { type: Boolean, default: false },
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
  emits: ["update:modelValue", "update:power", "add-preset"],

  setup(props, { emit }) {
    const { t } = useI18n();
    const colorStore = useColorDataStore();
    const scrollContainer = computed(() => !props.isDialog && props.cardHeight === "auto" ? "div" : QScrollArea);
    const scrollStyle = computed(() => scrollContainer.value === "div" ? undefined : { height: props.isDialog ? props.dialogHeight : props.cardHeight });

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

          internalRaw.value = Array.isArray(newValue.raw) ? [...newValue.raw] : { ...newValue.raw };

          // Reset flag after DOM update
          setTimeout(() => {
            updatingFromProps.value = false;
          }, 0);
        }
      },
      { immediate: true, deep: true },
    );

    const colorSliders = computed(() => {
      if (props.profile && !props.profile.rgb) {
        return props.profile.channels.map((channel, index) => ({
          key: index,
          label: channel === "ww" ? t("colorSliders.warmWhite") : channel === "cw" ? t("colorSliders.coldWhite") : t("color.brightness"),
          model: internalRaw.value[index] ?? 0,
          min: 0, max: 1023, color: channel === "ww" ? "yellow" : channel === "cw" ? "cyan" : "grey",
        }));
      }
      return [
      {
        key: "r",
        label: t("colorSliders.red"),
        model: internalRaw.value.r ?? 0,
        min: 0,
        max: 1023,
        color: "red",
      },
      {
        key: "g",
        label: t("colorSliders.green"),
        model: internalRaw.value.g ?? 0,
        min: 0,
        max: 1023,
        color: "green",
      },
      {
        key: "b",
        label: t("colorSliders.blue"),
        model: internalRaw.value.b ?? 0,
        min: 0,
        max: 1023,
        color: "blue",
      },
      {
        key: "ww",
        label: t("colorSliders.warmWhite"),
        model: internalRaw.value.ww ?? 0,
        min: 0,
        max: 1023,
        color: "yellow",
      },
      {
        key: "cw",
        label: t("colorSliders.coldWhite"),
        model: internalRaw.value.cw ?? 0,
        min: 0,
        max: 1023,
        color: "cyan",
      },
      ].filter((slider) => !props.profile || props.profile.channels.includes(slider.key));
    });

    const updateColorSlider = (slider, value) => {
      // Only process updates if not updating from props and not from websocket
      if (!updatingFromProps.value && colorStore.change_by !== "websocket") {
        const rawColorKey = slider.key;
        if (rawColorKey !== undefined) {
          if (props.profile && !props.profile.rgb && !Array.isArray(internalRaw.value)) {
            internalRaw.value = props.profile.channels.map(() => null);
          }
          internalRaw.value[rawColorKey] = value;
          emit("update:modelValue", { raw: Array.isArray(internalRaw.value) ? [...internalRaw.value] : { ...internalRaw.value } });
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
      scrollContainer,
      scrollStyle,
    };
  },
};
</script>
