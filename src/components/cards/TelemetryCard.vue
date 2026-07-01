<template>
  <MyCard icon="telemetry" :title="$t('cards.telemetry.title')">
    <q-card-section>
      <div class="d-flex q-gutter-md">
        <div>
            {{ $t('cards.telemetry.statsIntro') }}<br/>
            {{ $t('cards.telemetry.statsStickyNote') }}
        </div>
        <div>
          <q-btn-toggle
            v-model="statsValue"
            :options="telemetryOptions"
            :label="$t('cards.telemetry.statsLabel')"
            @update:model-value="updateStats"
          />
        </div>
        <div class="flex-grow-1">
          <div>
            {{ $t('cards.telemetry.statsDescription') }}
          </div>
        </div>
      </div>
    </q-card-section>
    <q-card-section>
    <q-btn
      :label="detailsButtonLabel"
      @click="toggleDetails"
      flat
      color="primary"
    />
    <div v-if="showDetails">
      <div>
        {{ $t('cards.telemetry.dataNote') }}
        <q-scroll-area style="height: 300px;">
          <q-table
            :rows="telemetryDataRows"
            :columns="telemetryDataColumns"
            row-key="col1"
            flat
            bordered
            wrap-cells
            :hide-bottom="true"
            :pagination="{ rowsPerPage: telemetryDataRows.length, page: 1, sortBy: null, descending: false }"
          />
        </q-scroll-area>
      </div>
    </div>
    </q-card-section>
    <q-card-section>
      <div class="d-flex q-gutter-md">
        <div>
          <q-btn-toggle
            v-model="logValue"
            :options="telemetryOptions"
            :label="$t('cards.telemetry.logLabel')"
            @update:model-value="updateLog"
          />
        </div>
        <div class="flex-grow-1">
          <div>
            {{ $t('cards.telemetry.logDescription') }}
          </div>
        </div>
      </div>
    </q-card-section>
      <q-card-section>
      <div class="row q-gutter-md">
        <div class="col-12">
          <q-input
            v-model="urlValue"
            :label="$t('cards.telemetry.url')"
            @blur="updateUrl"
          />
        </div>
      </div>
      <div class="row q-gutter-md">
        <div class="col-6">
          <q-input
            v-model="userValue"
            :label="$t('cards.telemetry.user')"
            @blur="updateUser"
          />
        </div>
        <div class="col-6">
          <q-input
            v-model="passwordValue"
            :label="$t('cards.telemetry.password')"
            type="password"
            @blur="updatePassword"
          />
        </div>
      </div>
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { configDataStore } from "src/stores/configDataStore";
import { useConfigBinding } from "src/composables/useConfigDataBindings";
import MyCard from "components/myCard.vue";
import { getTelemetryData } from "src/stores/telemetryData.js";

export default {
  components: {
    MyCard,
  },
  setup() {
    const { t } = useI18n();
    const telemetryDataColumns = computed(
      () => getTelemetryData(t).telemetryDataColumns,
    );
    const telemetryDataRows = computed(() => getTelemetryData(t).telemetryDataRows);
    const configData = configDataStore();
    const coerceTelemetryEnabled = (value, fallback = false) => {
      if (typeof value === "boolean") {
        return value;
      }
      if (value === "ON") {
        return true;
      }
      if (value === "OFF") {
        return false;
      }
      return fallback;
    };

    const telemetryOptions = [
      { label: t("common.yes"), value: true },
      { label: t("common.no"), value: false },
    ];

    const statsValue = computed({
      get: () =>
        coerceTelemetryEnabled(configData.data?.network?.telemetry?.statsEnabled),
      set: (value) => {
        configData.updateData("network.telemetry.statsEnabled", Boolean(value));
      },
    });

    const logValue = computed({
      get: () =>
        coerceTelemetryEnabled(configData.data?.network?.telemetry?.logEnabled),
      set: (value) => {
        configData.updateData("network.telemetry.logEnabled", Boolean(value));
      },
    });

    const updateStats = (value) => {
      statsValue.value = value;
    };

    const updateLog = (value) => {
      logValue.value = value;
    };

    const { model: urlValue, save: updateUrl } = useConfigBinding(
      configData,
      "network.telemetry.url",
      {
        fallback: configData.data?.network?.telemetry?.url || "",
      },
    );

    const { model: userValue, save: updateUser } = useConfigBinding(
      configData,
      "network.telemetry.user",
      {
        fallback: configData.data?.network?.telemetry?.user || "",
      },
    );

    const { model: passwordValue, save: updatePassword } = useConfigBinding(
      configData,
      "network.telemetry.password",
      {
        fallback: configData.data?.network?.telemetry?.password || "",
      },
    );

    const showDetails = ref(false);

    const detailsButtonLabel = computed(() =>
      showDetails.value ? t("cards.telemetry.hideDetails") : t("cards.telemetry.showDetails"),
    );

    const toggleDetails = () => {
      showDetails.value = !showDetails.value;
    };

    return {
      configData,
      telemetryOptions,
      telemetryDataColumns,
      telemetryDataRows,
      statsValue,
      logValue,
      urlValue,
      userValue,
      passwordValue,
      showDetails,
      detailsButtonLabel,
      toggleDetails,
      updateStats,
      updateLog,
      updateUrl,
      updateUser,
      updatePassword,
    };
  },
};
</script>
