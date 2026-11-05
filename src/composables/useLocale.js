import { useI18n } from "vue-i18n";

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
    localStorage.setItem("locale", lang);
  }

  return { locale, setLocale };
}
