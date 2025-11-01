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
import MyCard from "components/myCard.vue";

export default {
  components: {
    MyCard,
  },
  setup() {
    const configData = configDataStore();

    const telemetryOptions = [
      { label: "On", value: "ON" },
      { label: "Off", value: "OFF" },
    ];

    const telemetryDataColumns = [
      { name: 'col1', label: 'Field', field: 'col1', align: 'left' },
      { name: 'col2', label: 'Description', field: 'col2', align: 'left' },
      { name: 'col3', label: 'When', field: 'col3', align: 'left' }
    ];

    const telemetryDataRows = [
      { col1: 'time', col2: 'current time (if NTP is configured)', col3: 'always' },
      { col1: 'uptime', col2: 'current uptime in seconds', col3: 'always' },
      { col1: 'firmware', col2: 'currently running firmware version', col3: 'always' },
      { col1: 'reboot reason', col2: 'the reason for the last reboot', col3: 'after an unexpected reboot' },
      {col1: 'soc', col2: 'system on chip type', col3: 'always' },
      { col1: 'neighbours', col2: 'number of visible neighbouring devices', col3: 'always' },
      {col1: 'ip_address', col2: 'current IP address', col3: 'always' },
      { col1: 'reboot CPU info', col2: 'additional information about the CPU at reboot, PC, Registers etc', col3: 'after an unexpected reboot' },
      { col1: 'mDNS_received', col2: 'number of mDNS packages received', col3: 'always'},
      { col1: 'mDNS_replies',col2:'number of mDNS packages processed', col3:'always'}
    ];

    const statsValue = ref(configData.data?.telemetry?.statsEnabled === "ON" ? "ON" : "OFF");
    const logValue = ref(configData.data?.telemetry?.logEnabled === "ON" ? "ON" : "OFF");
    const urlValue = ref(configData.data?.telemetry?.url || configData.data?.debug?.server || "");
    const userValue = ref(configData.data?.telemetry?.user || configData.data?.network?.mqtt?.username || "");
    const passwordValue = ref(configData.data?.telemetry?.password || configData.data?.network?.mqtt?.password || "");

    const showDetails = ref(false);

    const detailsButtonLabel = computed(() => showDetails.value ? 'Hide Details' : 'Show Details');

    const toggleDetails = () => {
      showDetails.value = !showDetails.value;
    };

    const updateStats = (value) => {
      configData.updateData("telemetry.statsEnabled", value);
    };

    const updateLog = (value) => {
      configData.updateData("telemetry.logEnabled", value);
    };

    const updateUrl = () => {
      configData.updateData("telemetry.url", urlValue.value);
    };

    const updateUser = () => {
      configData.updateData("telemetry.user", userValue.value);
    };

    const updatePassword = () => {
      configData.updateData("telemetry.password", passwordValue.value);
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
