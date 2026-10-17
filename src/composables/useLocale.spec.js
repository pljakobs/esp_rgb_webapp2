import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useI18n } from "vue-i18n";
import bootI18n from "../boot/i18n.js";
import { useLocale } from "./useLocale.js";

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
      "de", "el", "en", "es", "fr", "it", "pt",
    ]);
    const { setLocale } = useLocale();
    for (const language of global.availableLocales) {
      expect(Object.keys(global.getLocaleMessage(language)).length).toBeGreaterThan(0);
      await setLocale(language);
      expect(global.locale.value).toBe(language);
      expect(localStorage.getItem("locale")).toBe(language);
    }
    expect(fetch).not.toHaveBeenCalled();
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