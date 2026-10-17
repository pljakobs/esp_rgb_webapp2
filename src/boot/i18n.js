import { createI18n } from "vue-i18n";
import en from "src/i18n/en.json";

const localeModules = import.meta.glob("../../public/locales/*.json", {
  eager: true,
  import: "default",
});
const messages = { en };
for (const [localePath, translations] of Object.entries(localeModules)) {
  const language = localePath.split("/").pop().replace(/\.json$/, "");
  messages[language] = translations;
}

export default ({ app }) => {
  const savedLocale = localStorage.getItem("locale") || "en";
  const i18n = createI18n({
    locale: Object.hasOwn(messages, savedLocale) ? savedLocale : "en",
    fallbackLocale: "en",
    legacy: false,
    messages,
  });

  app.use(i18n);
};
