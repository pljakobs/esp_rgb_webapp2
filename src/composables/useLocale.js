import { useI18n } from "vue-i18n";

/**
 * Composable to switch the active locale.
 * The English locale is bundled at boot time; all other locales are fetched
 * lazily from /locales/<lang>.json (served from LittleFS alongside the SPA).
 */
export function useLocale() {
  const { locale, availableLocales, setLocaleMessage } = useI18n();

  async function setLocale(lang) {
    if (!availableLocales.includes(lang)) {
      try {
        const res = await fetch(`/locales/${lang}.json`);
        if (!res.ok) {
          console.warn(`[i18n] Locale file for '${lang}' not found, falling back to 'en'`);
          return;
        }
        const messages = await res.json();
        setLocaleMessage(lang, messages);
      } catch (e) {
        console.warn(`[i18n] Failed to load locale '${lang}':`, e);
        return;
      }
    }
    locale.value = lang;
    localStorage.setItem("locale", lang);
  }

  return { locale, setLocale };
}
