<template>
  <q-dialog
    :model-value="auth.showLoginDialog"
    persistent
    @update:model-value="onDialogToggle"
  >
    <q-card class="login-card">
      <q-card-section>
        <div class="text-h6">{{ $t("auth.title") }}</div>
        <div class="text-caption text-grey-7">{{ $t("auth.subtitle") }}</div>
      </q-card-section>

      <q-form @submit.prevent="submit">
        <q-card-section class="q-gutter-md">
          <q-input
            v-model="password"
            :label="$t('auth.password')"
            :type="showPassword ? 'text' : 'password'"
            autofocus
            dense
            outlined
          >
            <template #append>
              <svgIcon
                :name="
                  showPassword
                    ? 'visibility_off_outlined'
                    : 'visibility-outlined-24'
                "
                class="cursor-pointer"
                size="20px"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>

          <div v-if="auth.authError" class="text-negative text-caption">
            {{ auth.authError }}
          </div>

          <q-checkbox
            v-model="remember"
            :label="$t('auth.rememberMe')"
            dense
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            flat
            :label="$t('auth.cancel')"
            color="primary"
            @click="cancel"
          />
          <q-btn
            unelevated
            type="submit"
            :label="$t('auth.login')"
            color="primary"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script>
import { ref, watch } from "vue";
import { useAuthStore } from "src/stores/authStore";

export default {
  name: "LoginDialog",
  setup() {
    const auth = useAuthStore();
    const password = ref(auth.password);
    const showPassword = ref(false);
    const remember = ref(auth.remember);

    // Prefill from stored credentials whenever the dialog is re-opened.
    watch(
      () => auth.showLoginDialog,
      (open) => {
        if (open) {
          password.value = auth.password;
          remember.value = auth.remember;
          showPassword.value = false;
        }
      },
    );

    const submit = () => {
      auth.submitLogin(password.value, remember.value);
    };

    const cancel = () => {
      auth.cancelLogin();
    };

    const onDialogToggle = (value) => {
      // Persistent dialog: only react to programmatic closes.
      if (!value && auth.showLoginDialog) {
        auth.cancelLogin();
      }
    };

    return {
      auth,
      password,
      showPassword,
      remember,
      submit,
      cancel,
      onDialogToggle,
    };
  },
};
</script>

<style scoped>
.login-card {
  min-width: 340px;
  max-width: 90vw;
}
</style>
