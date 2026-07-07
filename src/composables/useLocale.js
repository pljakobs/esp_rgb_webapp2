import { useI18n } from "vue-i18n";

const pendingLoads = new Map();

async function fetchLocaleMessages(lang) {
  const candidates = [`/locales/${lang}.json`, `/locales/${lang}.json.gz`];

  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        continue;
      }

      const raw = await res.text();
      return JSON.parse(raw);
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

/**
 * Composable to switch the active locale.
 * The English locale is bundled at boot time; all other locales are fetched
 * lazily from /locales/<lang>.json (served from LittleFS alongside the SPA).
 */
export function useLocale() {
  const { locale, availableLocales, setLocaleMessage } = useI18n();

  async function setLocale(lang) {
    if (!lang) {
      return;
    }

    if (!availableLocales.includes(lang)) {
      if (!pendingLoads.has(lang)) {
        pendingLoads.set(lang, fetchLocaleMessages(lang));
      }

      const messages = await pendingLoads.get(lang);
      pendingLoads.delete(lang);

      if (!messages) {
        console.warn(
          `[i18n] Locale file for '${lang}' not found or invalid, falling back to 'en'`,
        );
        locale.value = "en";
        localStorage.setItem("locale", "en");
        return;
      }

      setLocaleMessage(lang, messages);
    }

    locale.value = lang;
    localStorage.setItem("locale", lang);
  }

  // If a non-English locale is stored, load it immediately so the app
  // does not remain on fallback English until the user manually reselects.
  const savedLocale = localStorage.getItem("locale");
  if (
    savedLocale &&
    savedLocale !== "en" &&
    !availableLocales.includes(savedLocale)
  ) {
    setLocale(savedLocale);
  }

  return { locale, setLocale };
}
