import { createI18n } from "vue-i18n";
import en from "src/i18n/en.json";

export default ({ app }) => {
  const i18n = createI18n({
    locale: localStorage.getItem("locale") || "en",
    fallbackLocale: "en",
    legacy: false,
    messages: { en },
  });

  app.use(i18n);
};
