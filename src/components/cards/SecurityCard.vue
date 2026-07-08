<template>
  <MyCard icon="lock_outlined" :title="$t('cards.security.title')">
    <q-card-section>
      <div>{{ $t("cards.security.description") }}</div>
      <div class="text-h7">
        <q-toggle
          v-model="apiSecured"
          :label="$t('cards.security.enable')"
          left-label
          @update:model-value="updateApiSecured"
        />
      </div>
    </q-card-section>

    <q-card-section v-if="apiSecured" class="q-pt-none">
      <q-separator class="q-mb-md" />
      <div class="row q-gutter-md" style="max-width: 500px">
        <div style="width: 200px">
          <q-input
            v-model="newPassword"
            filled
            :type="isPwd ? 'password' : 'text'"
            :label="$t('cards.security.password')"
            :hint="$t('cards.security.passwordHint')"
            @keyup.enter="savePassword"
          >
            <template #append>
              <svgIcon
                :name="
                  isPwd ? 'visibility_off_outlined' : 'visibility-outlined-24'
                "
                class="cursor-pointer"
                size="20px"
                @click="isPwd = !isPwd"
              />
            </template>
          </q-input>
        </div>
      </div>

      <div class="row q-gutter-sm q-mt-md">
        <q-btn
          color="primary"
          unelevated
          :disable="newPassword.length === 0"
          :label="$t('cards.security.setPassword')"
          @click="savePassword"
        />
        <q-btn
          color="negative"
          flat
          :label="$t('cards.security.clearPassword')"
          @click="clearPassword"
        />
      </div>
    </q-card-section>
  </MyCard>
</template>

<script>
import { ref } from "vue";
import { configDataStore } from "src/stores/configDataStore";
import { useConfigBinding } from "src/composables/useConfigDataBindings";
import { useAuthStore } from "src/stores/authStore";
import MyCard from "src/components/myCard.vue";

export default {
  components: {
    MyCard,
  },
  setup() {
    const configData = configDataStore();
    const authStore = useAuthStore();
    const isPwd = ref(true);
    const newPassword = ref("");

    const { model: apiSecured, save: saveApiSecured } = useConfigBinding(
      configData,
      "security.api_secured",
      {
        fallback: false,
        persist: true,
      },
    );

    const { model: apiPassword } = useConfigBinding(
      configData,
      "security.api_password",
      {
        fallback: "",
        persist: true,
      },
    );

    const updateApiSecured = (value) => {
      if (value) {
        // Only actually enable protection if a password is already stored.
        // Otherwise keep the toggle on to reveal the password field, but do
        // NOT persist api_secured=true yet - that would lock out the API with
        // no password set. Protection is enabled by savePassword instead.
        if ((apiPassword.value || "").length > 0) {
          saveApiSecured(true);
        }
      } else {
        // Disabling protection: persist and drop the local session credentials.
        saveApiSecured(false);
        authStore.clear();
      }
    };

    const savePassword = async () => {
      if (newPassword.value.length === 0) {
        return;
      }
      // Persist the password and enable protection in a single atomic config
      // update. Sending them as two separate requests races on the ESP8266
      // (limited connections) and one can be dropped.
      await configData.updateMultipleData({
        "security.api_password": newPassword.value,
        "security.api_secured": true,
      });
      // Store the credentials locally so this session stays authenticated.
      authStore.setCredentials(newPassword.value);
      apiSecured.value = true;
      newPassword.value = "";
    };

    const clearPassword = async () => {
      // Clear the password and disable protection in a single atomic config
      // update, otherwise the two requests race and api_secured can survive.
      await configData.updateMultipleData({
        "security.api_password": "",
        "security.api_secured": false,
      });
      apiSecured.value = false;
      newPassword.value = "";
      authStore.clear();
    };

    return {
      isPwd,
      apiSecured,
      newPassword,
      updateApiSecured,
      savePassword,
      clearPassword,
    };
  },
};
</script>

<style scoped></style>
