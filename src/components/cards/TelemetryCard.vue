<template>
  <MyCard icon="telemetry" title="Telemetry">
    <q-card-section>
      <div class="d-flex q-gutter-md">
        <div>
            Telemetry is enabled by default in debug builds and disabled by default in release builds.<br/>
            But: once it has been enabled here, an update to a release build will not reset that.
        </div>
        <div>
          <q-btn-toggle
            v-model="statsValue"
            :options="telemetryOptions"
            label="Telemetry Stats"
            @update:model-value="updateStats"
          />
        </div>
        <div class="flex-grow-1">
          <div>
            When enabled, telemetry stats will be sent to the configured URL.
            This data contains anonymized usage statistics to help improve the firmware.
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
        With this build, the following data is sent every 30s:
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
            label="Telemetry Log"
            @update:model-value="updateLog"
          />
        </div>
        <div class="flex-grow-1">
          <div>
            When enabled, telemetry logs will be sent to the configured URL.
            This data contains log information to help debug and improve the firmware.
          </div>
        </div>
      </div>
    </q-card-section>
      <q-card-section>
      <div class="row q-gutter-md">
        <div class="col-12">
          <q-input
            v-model="urlValue"
            label="Telemetry URL"
            @blur="updateUrl"
          />
        </div>
      </div>
      <div class="row q-gutter-md">
        <div class="col-6">
          <q-input
            v-model="userValue"
            label="Telemetry User"
            @blur="updateUser"
          />
        </div>
        <div class="col-6">
          <q-input
            v-model="passwordValue"
            label="Telemetry Password"
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
import { configDataStore } from "src/stores/configDataStore";
import { useConfigBinding } from "src/composables/useConfigDataBindings";
import MyCard from "components/myCard.vue";
import { telemetryDataColumns, telemetryDataRows } from "src/stores/telemetryData.js";

export default {
  components: {
    MyCard,
  },
  setup() {
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
      { label: "On", value: true },
      { label: "Off", value: false },
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

    const detailsButtonLabel = computed(() => showDetails.value ? 'Hide Details' : 'Show Details');

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
