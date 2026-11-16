<template>
  <MyCard :title="$t('cards.firmwareUpdate.title')" icon="systemsecurityupdate_outlined">
    <q-card-section>
      <div>{{ $t("demo.firmwareDescription") }}</div>
      <div class="q-mt-sm">{{ $t("demo.firmwareCurrent", { version: infoData.data.app?.git_version }) }}</div>
      <div v-if="checked" class="q-mt-sm">{{ $t(installed ? "demo.firmwareInstalled" : "demo.firmwareAvailable") }}</div>
    </q-card-section>
    <q-card-actions>
      <q-btn color="primary" :label="$t('demo.checkFirmware')" @click="checked = true" />
      <q-btn v-if="checked && !installed" color="secondary" :label="$t('demo.installFirmware')" :loading="updating" @click="install" />
    </q-card-actions>
  </MyCard>
</template>

<script setup>
import { ref } from "vue";
import { Notify } from "quasar";
import { useI18n } from "vue-i18n";
import { apiService } from "src/services/api";
import { infoDataStore } from "src/stores/infoDataStore";
import MyCard from "src/components/myCard.vue";

const { t } = useI18n();
const infoData = infoDataStore();
const checked = ref(false);
const installed = ref(false);
const updating = ref(false);

async function install() {
  updating.value = true;
  try {
    const result = await apiService.systemCommand({ cmd: "demo_update_firmware" });
    if (result.error || result.jsonData?.success !== true) {
      throw new Error(result.error?.message || result.jsonData?.error || "Update failed");
    }
    await infoData.fetchData();
    installed.value = true;
    Notify.create({ type: "positive", message: t("demo.firmwareInstalled") });
  } catch (error) {
    Notify.create({ type: "negative", message: error.message });
  } finally {
    updating.value = false;
  }
}
</script>
