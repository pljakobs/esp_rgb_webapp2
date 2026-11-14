<template>
  <MyCard
    icon="monitoring"
    :title="t('sensors.title')"
    :collapsed="collapsed"
    @update:collapsed="collapsed = $event"
  >
    <q-linear-progress v-if="loading" indeterminate />
    <q-tabs v-model="tab" dense align="left">
      <q-tab
        v-for="sensor in sensors"
        :key="sensor.id"
        :name="sensor.id"
        :label="t(`sensors.${sensor.name}`)"
      />
    </q-tabs>
    <q-tab-panels v-model="tab" animated>
      <q-tab-panel
        v-for="sensor in sensors"
        :key="sensor.id"
        :name="sensor.id"
        class="q-pa-none q-pt-md"
      >
        <q-banner
          v-if="sensor.supported === false"
          class="bg-warning text-black"
        >
          {{ t("sensors.unsupported") }}
        </q-banner>
        <q-banner
          v-else-if="sensor.actionError || sensor.error"
          class="bg-negative text-white"
          role="alert"
        >
          {{ sensor.actionError || sensor.error }}
        </q-banner>
        <template v-if="sensor.config">
          <div class="q-mb-sm">
            {{
              t(
                sensor.config.available
                  ? "sensors.available"
                  : "sensors.unavailable",
              )
            }}
          </div>
          <template v-if="sensor.reading?.valid">
            <template v-if="sensor.name === 'current'">
              <div class="text-h4" data-testid="current-value">
                {{ sensor.reading.current_a.toFixed(3) }} A
              </div>
              <div>
                {{ sensor.reading.voltage_v.toFixed(3) }} V /
                {{ sensor.reading.power_w.toFixed(3) }} W
              </div>
            </template>
            <template v-else>
              <div data-testid="brightness">
                {{ t("sensors.brightness") }}:
                {{ sensor.reading.data.clear_low }} /
                {{ sensor.reading.data.clear_high }}
                {{ t("sensors.counts") }}
              </div>
              <div>
                NIR: {{ sensor.reading.data.nir_low }} /
                {{ sensor.reading.data.nir_high }} {{ t("sensors.counts") }}
              </div>
            </template>
            <div class="text-caption">
              {{
                t("sensors.age", {
                  seconds: (sensor.reading.age_ms / 1000).toFixed(1),
                })
              }}
            </div>
          </template>
          <div v-else class="q-my-sm">
            {{
              t(
                sensor.reading?.state === "measuring"
                  ? "sensors.measuring"
                  : "sensors.noReading",
              )
            }}
          </div>
          <svg
            v-if="sensor.name === 'current' && currentGraph.path"
            class="sensor-graph"
            viewBox="0 0 600 210"
            role="img"
            :aria-label="t('sensors.currentGraph')"
          >
            <title>{{ t("sensors.currentGraph") }}</title>
            <path d="M52,25 V170 H572" class="axis" />
            <text x="52" y="18">{{ currentGraph.maxY.toFixed(3) }} A</text>
            <text x="2" y="174">{{ currentGraph.minY.toFixed(3) }}</text>
            <text x="52" y="198">{{ historyStart }}</text>
            <text x="572" y="198" text-anchor="end">{{ historyEnd }}</text>
            <path :d="currentGraph.path" class="reading-line" />
            <circle
              v-for="(point, i) in currentGraph.points"
              :key="i"
              :cx="point.x"
              :cy="point.y"
              r="2"
              class="reading-point"
            />
          </svg>
          <svg
            v-if="
              sensor.name === 'spectral' &&
              sensor.reading?.valid &&
              spectrumGraph.path
            "
            class="sensor-graph"
            viewBox="0 0 600 210"
            role="img"
            :aria-label="t('sensors.spectrumGraph')"
          >
            <title>{{ t("sensors.spectrumGraph") }}</title>
            <defs>
              <linearGradient :id="gradientId">
                <stop offset="0%" stop-color="#7f00ff" />
                <stop offset="25%" stop-color="#008bff" />
                <stop offset="50%" stop-color="#20b020" />
                <stop offset="72%" stop-color="#e0b000" />
                <stop offset="100%" stop-color="#e02020" />
              </linearGradient>
            </defs>
            <path d="M52,25 V170 H572" class="axis" />
            <text x="52" y="18">
              {{ spectrumGraph.maxY.toFixed(0) }} {{ t("sensors.counts") }}
            </text>
            <text x="24" y="174">0</text>
            <text
              v-for="(wavelength, i) in wavelengths"
              :key="wavelength"
              :x="spectralPoints[i]?.x"
              y="192"
              text-anchor="middle"
            >
              {{ wavelength }}
            </text>
            <text x="595" y="208" text-anchor="end">nm</text>
            <path
              :d="spectrumGraph.path"
              fill="none"
              :stroke="`url(#${gradientId})`"
              stroke-width="3"
            />
            <circle
              v-for="(point, i) in spectralPoints"
              :key="i"
              :cx="point.x"
              :cy="point.y"
              r="4"
              class="reading-point"
            >
              <title>
                F{{ i + 1 }}: {{ sensor.reading.data[`f${i + 1}`] }}
              </title>
            </circle>
          </svg>
          <div v-if="sensor.name === 'spectral'" class="text-caption q-mb-sm">
            {{ t("sensors.spectrumNote") }}
          </div>
          <q-btn
            v-if="sensor.name === 'spectral'"
            :label="t('sensors.measure')"
            :disable="
              !sensor.config.available ||
              sensor.saving ||
              sensor.reading?.state === 'measuring'
            "
            color="primary"
            @click="measure(sensor)"
          />
          <q-expansion-item :label="t('sensors.configuration')" class="q-mt-md">
            <q-form class="q-gutter-sm" @submit="save(sensor)">
              <q-toggle
                v-model="sensor.draft.enabled"
                :label="t('sensors.enabled')"
                :disable="sensor.saving"
              />
              <q-input
                v-for="field in sensor.fields"
                :key="field.key"
                v-model.number="sensor.draft[field.key]"
                type="number"
                :label="t(`sensors.fields.${field.key}`)"
                :min="field.min"
                :max="field.max"
                :step="field.step"
                :disable="sensor.saving"
                :rules="[
                  (value) => validField(value, field) || t('sensors.invalid'),
                ]"
              />
              <div v-if="sensor.name === 'spectral'" class="text-caption">
                {{ t("sensors.intervalNote") }}
              </div>
              <q-btn
                type="submit"
                :label="t('common.save')"
                color="primary"
                :loading="sensor.saving"
                :disable="
                  !validSettings(sensor, sensor.draft) ||
                  sensor.reading?.state === 'measuring'
                "
              />
            </q-form>
          </q-expansion-item>
        </template>
      </q-tab-panel>
    </q-tab-panels>
    <q-btn
      flat
      :label="t('sensors.refresh')"
      :disable="loading || sensors.some((sensor) => sensor.saving)"
      @click="reload"
    />
  </MyCard>
</template>

<script setup>
import { computed, ref, useId } from "vue";
import { useI18n } from "vue-i18n";
import MyCard from "src/components/myCard.vue";
import { useSensors } from "src/composables/useSensors";
import {
  wavelengths,
  graphGeometry,
  spectralCurve,
  validSettings,
} from "src/services/sensors";

const props = defineProps({
  initiallyCollapsed: { type: Boolean, default: false },
});
const { t } = useI18n();
const collapsed = ref(props.initiallyCollapsed);
const expanded = computed(() => !collapsed.value);
const tab = ref("current-1");
const { sensors, loading, reload, save, measure } = useSensors(expanded);
const gradientId = `spectrum-${useId().replace(/:/g, "")}`;
const currentGraph = computed(() => graphGeometry(sensors[0].history));
const spectrumGraph = computed(() =>
  graphGeometry(
    spectralCurve(sensors[1].reading?.valid ? sensors[1].reading.data : null),
    { minX: 415, maxX: 680 },
  ),
);
const spectralPoints = computed(() => {
  if (!spectrumGraph.value.path) return [];
  const curve = spectralCurve(sensors[1].reading.data);
  return graphGeometry(
    curve.filter((_, i) => i % 16 === 0),
    { minX: 415, maxX: 680 },
  ).points;
});
const historyStart = computed(() => historyTime(sensors[0].history[0]?.x));
const historyEnd = computed(() => historyTime(sensors[0].history.at(-1)?.x));
function historyTime(value) {
  return value === undefined ? "" : new Date(value).toLocaleTimeString();
}
function validField(value, { min, max, step }) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (step !== 1 || Number.isInteger(value))
  );
}
</script>

<style scoped>
.sensor-graph {
  width: 100%;
  max-height: 280px;
}
.sensor-graph text {
  fill: currentColor;
  font-size: 12px;
}
.axis {
  fill: none;
  stroke: currentColor;
  opacity: 0.5;
}
.reading-line {
  fill: none;
  stroke: var(--q-primary);
  stroke-width: 2;
}
.reading-point {
  fill: var(--q-primary);
}
</style>
