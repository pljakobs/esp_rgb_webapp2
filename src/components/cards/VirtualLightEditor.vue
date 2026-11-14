<template>
  <q-card-section>
    <q-banner v-if="lights.error" class="bg-negative text-white q-mb-md">{{ lights.error }}</q-banner>
    <q-linear-progress v-if="lights.loading" indeterminate class="q-mb-md" />
    <template v-if="draft">
      <div class="row items-center q-gutter-sm q-mb-md">
        <mySelect v-model="selectedId" :options="lightOptions" emit-value map-options outlined dense label="Light" class="col" :disable="lights.saving" />
        <q-btn flat round :disable="lights.saving || !board || draft.lights.length >= 16" aria-label="Add light" @click="addLight">
          <svgIcon name="add" /><q-tooltip>Add light</q-tooltip>
        </q-btn>
        <q-btn flat round :disable="!selectedLight || lights.saving" aria-label="Delete light" @click="deleteLight">
          <svgIcon name="delete" /><q-tooltip>Delete light</q-tooltip>
        </q-btn>
      </div>
      <mySelect v-model="draft.board_id" :options="boardOptions" emit-value map-options outlined dense label="Board" class="q-mb-md" :disable="lights.saving" @update:model-value="changeBoard" />
      <q-banner v-if="!board" class="bg-warning text-black q-mb-md">
        Select a board profile before configuring PWM lights.
      </q-banner>
      <div v-if="selectedLight" class="q-gutter-y-md">
        <q-input v-model="selectedLight.name" outlined dense label="Light name" maxlength="64" :disable="lights.saving" />
        <mySelect :model-value="selectedLight.type" :options="Object.keys(LIGHT_CHANNELS)" outlined dense label="Color model" :disable="lights.saving" @update:model-value="changeModel" />
        <q-radio :model-value="defaultId" :val="selectedLight.id" label="Default light" :disable="lights.saving" @update:model-value="setDefault" />
        <div class="pin-grid">
          <div v-for="(channel, index) in channels" :key="channel">
            <mySelect v-model="selectedLight.pins[index]" :options="pinOptions(index)" emit-value map-options outlined dense :label="channel.toUpperCase() + ' GPIO'" :disable="lights.saving" />
          </div>
        </div>
      </div>
      <div v-else class="text-grey-7 q-my-md">No lights configured</div>
      <q-banner v-if="error || validationErrors.length" class="bg-negative text-white q-mt-md" style="white-space: pre-line">{{ error || validationErrors.join('\n') }}</q-banner>
      <div class="row justify-end q-gutter-sm q-mt-md">
        <q-btn flat label="Cancel" :disable="!dirty || lights.saving" @click="resetDraft" />
        <q-btn color="primary" label="Apply" :disable="!dirty || lights.loading" :loading="lights.saving" @click="apply" />
      </div>
    </template>
    <q-btn v-else-if="!lights.loading" flat label="Retry" @click="lights.load()" />
  </q-card-section>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { Dialog } from "quasar";
import { useVirtualLightsStore } from "src/stores/virtualLightsStore";
import { LIGHT_CHANNELS, createLight, validateLightConfiguration } from "src/services/virtualLights";

const lights = useVirtualLightsStore();
const draft = ref(null);
const selectedId = ref(null);
const error = ref(null);
const validationAttempted = ref(false);
const usedIndexes = new Set();
const resetDraft = () => {
  draft.value = lights.configuration ? JSON.parse(JSON.stringify(lights.configuration)) : null;
  for (const light of draft.value?.lights ?? []) usedIndexes.add(light.index);
  if (!draft.value?.lights.some((light) => light.id === selectedId.value)) {
    selectedId.value = draft.value?.lights.find((light) => light.is_default)?.id ?? null;
  }
  error.value = null;
  validationAttempted.value = false;
};
watch(() => lights.configuration, resetDraft, { immediate: true });
watch(() => lights.controllerIp, () => { usedIndexes.clear(); resetDraft(); });
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(lights.configuration));
const selectedLight = computed(() => draft.value?.lights.find((light) => light.id === selectedId.value));
const defaultId = computed(() => draft.value?.lights.find((light) => light.is_default)?.id);
const lightOptions = computed(() => draft.value?.lights.map((light) => ({ label: light.name || light.id, value: light.id })) ?? []);
const boardOptions = computed(() => (lights.compatibleBoards ?? []).map((entry) => ({ label: `${entry.name} (rev ${entry.revision})`, value: entry.id })));
const board = computed(() => {
  const saved = draft.value?.board_profile;
  return saved?.id === draft.value?.board_id && saved?.revision === draft.value?.board_revision
    ? saved
    : lights.compatibleBoards?.find((entry) => entry.id === draft.value?.board_id && entry.revision === draft.value?.board_revision);
});
const validationErrors = computed(() => validationAttempted.value && draft.value ? validateLightConfiguration(draft.value, board.value) : []);
const channels = computed(() => LIGHT_CHANNELS[selectedLight.value?.type] ?? []);
const pinOptions = (index) => {
  const otherLights = draft.value.lights.filter((light) => light.id !== selectedId.value).flatMap((light) => light.pins);
  const reservations = [
    ...(board.value?.reserved_gpios ?? []),
    ...(draft.value.buttons ?? []).map((button) => button.pin),
    ...(draft.value.buses ?? []).flatMap((bus) => [bus.sda, bus.scl]),
    ...(draft.value.system?.clear_config_enabled ? [draft.value.system.clear_config_pin] : []),
    ...selectedLight.value.pins.filter((pin, position) => position !== index),
    ...otherLights,
  ];
  return (board.value?.implemented_pins ?? []).filter((pin) => pin.allowed_functions?.includes("light.pwm")).map((pin) => ({ label: `${pin.label || pin.id} (GPIO ${pin.gpio})`, value: pin.gpio, disable: reservations.includes(pin.gpio) }));
};
const changeBoard = (id) => {
  const entry = lights.compatibleBoards?.find((entry) => entry.id === id);
  draft.value.board_id = id ?? "";
  draft.value.board_revision = entry?.revision ?? 0;
  draft.value.soc = lights.deviceSoc;
  draft.value.board_profile = entry ? JSON.parse(JSON.stringify(entry))
    : { id: "", revision: 1, name: "", soc: lights.deviceSoc, implemented_pins: [], reserved_gpios: [] };
};
const addLight = () => {
  try {
    const light = createLight([...usedIndexes].map((index) => ({ index })));
    light.is_default = draft.value.lights.length === 0;
    usedIndexes.add(light.index);
    draft.value.lights.push(light);
    selectedId.value = light.id;
  } catch (failure) { error.value = failure.message; }
};
const setDefault = (id) => { for (const light of draft.value.lights) light.is_default = light.id === id; };
const deleteLight = () => {
  const target = selectedLight.value;
  const token = lights.loadToken;
  Dialog.create({ title: "Delete light", message: target.name || target.id, cancel: true }).onOk(() => {
    if (token !== lights.loadToken) return;
    draft.value.lights = draft.value.lights.filter((light) => light.id !== target.id);
    selectedId.value = draft.value.lights[0]?.id ?? null;
  });
};
const changeModel = (type) => {
  const target = selectedLight.value;
  const previous = LIGHT_CHANNELS[target.type];
  target.pins = LIGHT_CHANNELS[type].map((channel) => target.pins[previous.indexOf(channel)] ?? null);
  target.type = type;
};
const setPin = (index, value) => { selectedLight.value.pins[index] = value === "" || value === null ? null : Number(value); };
const apply = () => {
  validationAttempted.value = true;
  error.value = null;
  if (validationErrors.value.length) return;
  const candidate = JSON.parse(JSON.stringify(draft.value));
  const ip = lights.controllerIp;
  const baseline = JSON.stringify(lights.configuration);
  Dialog.create({ title: "Apply light configuration", message: "Apply changes to lighting outputs?", cancel: true }).onOk(async () => {
    try {
      if (ip !== lights.controllerIp || baseline !== JSON.stringify(lights.configuration)) throw new Error("Controller or configuration changed. Review the new configuration.");
      await lights.apply(candidate);
      resetDraft();
    } catch (failure) { if (ip === lights.controllerIp) error.value = failure.message; }
  });
};
</script>

<style scoped>
.pin-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
</style>