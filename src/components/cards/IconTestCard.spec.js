import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sprite =
  '<svg><symbol id="settings"/><symbol id="_private"/><symbol id="add"/></svg>';
const options = {
  global: {
    stubs: {
      MyCard: { template: "<div><slot /></div>" },
      svgIcon: true,
    },
  },
};

describe("Composition API icon sprite browser", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    document.getElementById("svg-icon-sprite")?.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([false, true])(
    "loads sorted public icon IDs from the sprite (in DOM: %s)",
    async (inDom) => {
      if (inDom)
        document.body.insertAdjacentHTML(
          "afterbegin",
          sprite.replace("<svg>", '<svg id="svg-icon-sprite">'),
        );
      const fetch = vi
        .fn()
        .mockResolvedValue({ ok: true, text: async () => sprite });
      vi.stubGlobal("fetch", fetch);
      const { default: IconTestCard } = await import("./IconTestCard.vue");
      const wrapper = mount(IconTestCard, options);
      await flushPromises();
      expect(
        wrapper.findAll(".icon-grid__label").map((label) => label.text()),
      ).toEqual(["add", "settings"]);
      expect(fetch).toHaveBeenCalledTimes(inDom ? 0 : 1);
      expect(wrapper.text()).not.toContain("Loading icons...");
      wrapper.unmount();
    },
  );

  it("reports sprite fetch failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { default: IconTestCard } = await import("./IconTestCard.vue");
    const wrapper = mount(IconTestCard, options);
    await flushPromises();
    expect(wrapper.text()).toContain("Unable to load icon sprite.");
    expect(error).toHaveBeenCalledWith(
      "Failed to load icon sprite",
      expect.any(Error),
    );
    wrapper.unmount();
  });
});
