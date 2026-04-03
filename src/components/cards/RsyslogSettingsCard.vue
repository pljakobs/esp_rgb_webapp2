<template>
  <MyCard icon="article" title="Rsyslog Settings">
    <q-card-section>
      <div>
        Configure UDP rsyslog forwarding for device logs. Changes apply after
        restart.
      </div>
      <div class="text-h7 q-mt-sm">
        <q-toggle
          v-model="enabled"
          label="enable rsyslog"
          left-label
          @update:model-value="updateEnabled"
        />
      </div>
    </q-card-section>

    <q-card-section v-if="enabled" class="q-pt-none">
      <q-separator class="q-mb-md" />
      <div class="text-h6 q-mb-md">Target</div>
      <div class="row q-gutter-md" style="max-width: 420px">
        <div style="width: 220px">
          <q-input v-model="host" label="Rsyslog Host" @blur="updateHost" />
        </div>
        <div style="width: 120px">
          <q-input
            v-model.number="port"
            type="number"
            label="Port"
            @blur="updatePort"
          />
        </div>
      </div>
      <div class="text-caption q-mt-sm">
        Auto-config is handled in Log Viewer. Edit manually here if needed.
      </div>
    </q-card-section>
  </MyCard>
</template>

<script>
import { configDataStore } from "src/stores/configDataStore";
import { useConfigBinding } from "src/composables/useConfigDataBindings";
import MyCard from "src/components/myCard.vue";

export default {
  name: "RsyslogSettingsCard",
  components: {
    MyCard,
  },
  setup() {
    const configData = configDataStore();

    const { model: enabled, save: updateEnabled } = useConfigBinding(
      configData,
      "network.rsyslog.enabled",
      {
        fallback: false,
        persist: true,
      },
    );

    const { model: host, save: updateHost } = useConfigBinding(
      configData,
      "network.rsyslog.host",
      {
        fallback: "",
        persist: true,
      },
    );

    const { model: port, save: updatePort } = useConfigBinding(
      configData,
      "network.rsyslog.port",
      {
        fallback: 514,
        persist: true,
        normalize: (value) => {
          const normalizedPort = Number.parseInt(value, 10);
          return Number.isFinite(normalizedPort) ? normalizedPort : 514;
        },
      },
    );

    return {
      enabled,
      host,
      port,
      updateEnabled,
      updateHost,
      updatePort,
    };
  },
};
</script>
