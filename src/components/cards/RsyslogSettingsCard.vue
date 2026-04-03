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
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, watch } from "vue";
import { configDataStore } from "src/stores/configDataStore";
import MyCard from "src/components/myCard.vue";

export default {
  name: "RsyslogSettingsCard",
  components: {
    MyCard,
  },
  setup() {
    const configData = configDataStore();

    const enabled = ref(configData.data?.network?.rsyslog?.enabled ?? false);
    const host = ref(configData.data?.network?.rsyslog?.host ?? "");
    const port = ref(configData.data?.network?.rsyslog?.port ?? 514);

    watch(
      () => configData.data?.network?.rsyslog,
      (newValue) => {
        enabled.value = newValue?.enabled ?? false;
        host.value = newValue?.host ?? "";
        port.value = newValue?.port ?? 514;
      },
      { deep: true },
    );

    const updateEnabled = (value) => {
      configData.updateData("network.rsyslog.enabled", value, true);
    };

    const updateHost = () => {
      configData.updateData("network.rsyslog.host", host.value, true);
    };

    const updatePort = () => {
      const normalizedPort = Number.parseInt(port.value, 10);
      port.value = Number.isFinite(normalizedPort) ? normalizedPort : 514;
      configData.updateData("network.rsyslog.port", port.value, true);
    };

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
