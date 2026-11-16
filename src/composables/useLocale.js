import { useI18n } from "vue-i18n";
import { isDemoMode } from "src/services/demoMode";

export function useLocale() {
  const { locale, availableLocales } = useI18n();

  async function setLocale(lang) {
    if (!lang) {
      return;
    }

    if (!availableLocales.includes(lang)) {
      console.warn(
        `[i18n] Locale '${lang}' not available, falling back to 'en'`,
      );
      lang = "en";
    }

    locale.value = lang;
    if (!isDemoMode()) localStorage.setItem("locale", lang);
  }

  return { locale, setLocale };
}
