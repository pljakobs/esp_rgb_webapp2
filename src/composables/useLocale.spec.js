import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useI18n } from "vue-i18n";
import bootI18n from "../boot/i18n.js";
import { useLocale } from "./useLocale.js";

const localeMessages = import.meta.glob("../i18n/*.json", {
  eager: true,
  import: "default",
});

vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal()),
  useI18n: vi.fn(),
}));

function boot() {
  const app = { use: vi.fn() };
  bootI18n({ app });
  const i18n = app.use.mock.calls[0][0];
  useI18n.mockReturnValue(i18n.global);
  return i18n.global;
}

function flattenMessages(messages, prefix = "") {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object"
      ? flattenMessages(value, path)
      : [[path, value]];
  });
}

describe("bundled locales", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("registers every supported language at boot without downloads", async () => {
    const global = boot();
    expect(global.availableLocales).toEqual([
      "de",
      "el",
      "en",
      "es",
      "fr",
      "it",
      "nl",
      "pt",
    ]);
    const { setLocale } = useLocale();
    for (const language of global.availableLocales) {
      expect(
        Object.keys(global.getLocaleMessage(language)).length,
      ).toBeGreaterThan(0);
      await setLocale(language);
      expect(global.locale.value).toBe(language);
      expect(localStorage.getItem("locale")).toBe(language);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps every locale's keys and interpolation placeholders aligned", () => {
    const english = Object.fromEntries(
      flattenMessages(localeMessages["../i18n/en.json"]),
    );
    const expectedKeys = Object.keys(english).sort();
    const placeholders = (value) =>
      [...value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();

    for (const [localePath, messages] of Object.entries(localeMessages)) {
      const translations = Object.fromEntries(flattenMessages(messages));
      expect(Object.keys(translations).sort(), localePath).toEqual(
        expectedKeys,
      );
      for (const key of expectedKeys) {
        expect(translations[key].trim(), `${localePath}: ${key}`).not.toBe("");
        expect(
          placeholders(translations[key]),
          `${localePath}: ${key}`,
        ).toEqual(placeholders(english[key]));
      }
    }
  });

  it("restores a saved language at boot", () => {
    localStorage.setItem("locale", "de");
    expect(boot().locale.value).toBe("de");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to English for unsupported languages", async () => {
    localStorage.setItem("locale", "unknown");
    const global = boot();
    expect(global.locale.value).toBe("en");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await useLocale().setLocale("unknown");
    expect(global.locale.value).toBe("en");
    expect(localStorage.getItem("locale")).toBe("en");
    expect(fetch).not.toHaveBeenCalled();
  });
});
