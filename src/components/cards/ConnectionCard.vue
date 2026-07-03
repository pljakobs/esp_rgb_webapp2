<template>
  <MyCard icon="wifi_outlined" :title="$t('cards.connection.title')">
    <q-card-section>
      <dataTable :items="connectionItems" />
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref, watchEffect } from "vue";
import { useI18n } from "vue-i18n";
import MyCard from "src/components/myCard.vue";
import dataTable from "src/components/dataTable.vue";
import { infoDataStore } from "src/stores/infoDataStore";
import { configDataStore } from "src/stores/configDataStore";
import { storeStatus } from "src/stores/storeConstants";

export default {
  components: {
    MyCard,
    dataTable,
  },
  setup() {
    const { t } = useI18n();
    const connectionItems = ref([]);

    const configData = configDataStore();
    const infoData = infoDataStore();

    watchEffect(() => {
      if (infoData.status === storeStatus.READY) {
        console.log("infoData.status", infoData.status);
        console.log("infoData.data", infoData.data);
        connectionItems.value = [
          {
            label: t("cards.connection.ssid"),
            value: infoData.data.connection.ssid,
          },
          {
            label: t("cards.connection.macAddress"),
            value: infoData.data.connection.mac,
          },
          {
            label: t("cards.connection.dhcp"),
            value: infoData.data.connection.dhcp
              ? t("common.yes")
              : t("common.no"),
          },
          {
            label: t("cards.connection.ipAddress"),
            value: infoData.data.connection.ip,
          },
          {
            label: t("cards.connection.ipNetmask"),
            value: infoData.data.connection.netmask,
          },
          {
            label: t("cards.connection.ipGateway"),
            value: infoData.data.connection.gateway,
          },
        ];
      }
    });

    return {
      connectionItems,
      infoData,
      configData,
      storeStatus,
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
