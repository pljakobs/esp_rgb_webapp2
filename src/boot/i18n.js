import { createI18n } from "vue-i18n";

const localeModules = import.meta.glob("../i18n/*.json", {
  eager: true,
  import: "default",
});
const messages = {};
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
