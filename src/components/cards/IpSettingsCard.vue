<template>
  <MyCard icon="settings_outlined" :title="$t('cards.ipSettings.title')">
    <q-card-section>
      <div>{{ $t("cards.ipSettings.description") }}</div>
      <div class="text-h7">
        <q-toggle
          v-model="dhcp"
          :label="$t('cards.ipSettings.useDhcp')"
          left-label
          @update:model-value="updateDhcp"
        />
      </div>
    </q-card-section>
    <q-card-section v-if="!dhcp">
      <div class="row">
        <div class="col-4">
          <q-input
            v-model="ip"
            :label="$t('cards.ipSettings.ipAddress')"
            @blur="validateGateway"
          />
        </div>
        <div class="col-4">
          <q-input
            v-model="netmask"
            :label="$t('cards.ipSettings.ipNetmask')"
            @blur="validateGateway"
          />
        </div>
        <div class="col-4">
          <q-input
            v-model="gateway"
            :label="$t('cards.ipSettings.ipGateway')"
            @blur="validateGateway"
          />
        </div>
      </div>
      <div v-if="gatewayError" class="text-negative">
        {{ $t("cards.ipSettings.gatewayRangeError") }}
      </div>
      <q-btn
        :label="$t('cards.ipSettings.applyAndRestart')"
        color="primary"
        class="q-mt-md"
        @click="applyAndRestart"
      />
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, watch } from "vue";
import { configDataStore } from "src/stores/configDataStore";
import MyCard from "components/myCard.vue";

export default {
  components: {
    MyCard,
  },
  setup() {
    const configData = configDataStore();

    const ip = ref(configData.data.network.connection.ip);
    const netmask = ref(configData.data.network.connection.netmask);
    const gateway = ref(configData.data.network.connection.gateway);
    const dhcp = ref(configData.data.network.connection.dhcp);
    const gatewayError = ref(false);

    const ipToInt = (ip) => {
      return (
        ip
          .split(".")
          .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
      );
    };

    const intToIp = (int) => {
      return (
        (int >>> 24) +
        "." +
        ((int >> 16) & 255) +
        "." +
        ((int >> 8) & 255) +
        "." +
        (int & 255)
      );
    };

    const validateGateway = () => {
      const ipInt = ipToInt(ip.value);
      const netmaskInt = ipToInt(netmask.value);
      const gatewayInt = ipToInt(gateway.value);

      const networkAddress = ipInt & netmaskInt;
      const gatewayNetwork = gatewayInt & netmaskInt;

      gatewayError.value = networkAddress !== gatewayNetwork;

      if (gateway.value === "" || gatewayError.value) {
        const defaultGateway = networkAddress | (~netmaskInt >>> 0);
        gateway.value = intToIp(defaultGateway);
        gatewayError.value = false;
      }
    };

    const updateDhcp = (newDhcp) => {
      if (newDhcp == true) {
        configData.updateData("network.connection.dhcp", newDhcp, true);
      }
    };

    const applyAndRestart = () => {
      const data = {
        ip: ip.value,
        netmask: netmask.value,
        gateway: gateway.value,
        dhcp: dhcp.value,
      };
      configData.updateData("network.connection", data, true);
    };

    watch(dhcp, (newDhcp) => {
      if (newDhcp) {
        updateDhcp(newDhcp);
      }
    });

    return {
      configData,
      ip,
      netmask,
      gateway,
      dhcp,
      gatewayError,
      applyAndRestart,
      validateGateway,
      updateDhcp,
    };
  },
};
</script>

<style scoped>
.icon {
  color: var(--icon-color);
  fill: var(--icon-color);
}
</style>
