import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configDataStore } from "src/stores/configDataStore";
import svgIcon from "./svgIcon.vue";

vi.mock("src/stores/configDataStore", () => ({
  configDataStore: vi.fn(() => ({ data: {} })),
}));

describe("local SVG icons", () => {
  beforeEach(() => {
    localStorage.clear();
    configDataStore.mockReturnValue({ data: {} });
  });

  afterEach(() => {
    document.getElementById("svg-icon-sprite")?.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads the sprite on mount, renders its paths and reacts to name changes", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<symbol id="arrow_drop_down" viewBox="0 0 24 24"><path d="M7 10l5 5l5-5H7z"/></symbol>' +
        '<symbol id="settings" viewBox="0 0 48 48"><path d="M0 0h48v48z"/></symbol>' +
        "</svg>",
    });
    vi.stubGlobal("fetch", fetch);
    const wrapper = mount(svgIcon, { props: { name: "arrow_drop_down" } });
    await flushPromises();

    expect(fetch).toHaveBeenCalledExactlyOnceWith("icons/iconsSprite.svg", {
      cache: "default",
    });
    expect(wrapper.find("svg").attributes("fill")).toBe("currentColor");
    expect(wrapper.find("path").attributes("d")).toBe("M7 10l5 5l5-5H7z");

    await wrapper.setProps({ name: "settings" });
    await flushPromises();
    expect(wrapper.find("svg").attributes("viewBox")).toBe("0 0 48 48");
    expect(wrapper.find("path").attributes("d")).toBe("M0 0h48v48z");
    expect(fetch).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("uses cached web icons and keeps size, color and stepper styles reactive", async () => {
    const url =
      "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/home/default/24px.svg";
    localStorage.setItem(
      "svg-cache-md-outlined-home",
      JSON.stringify({
        content: '<svg viewBox="0 0 24 24"><path d="M1 1h10v10z"/></svg>',
        timestamp: Date.now(),
      }),
    );
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const wrapper = mount(svgIcon, {
      props: { name: url, size: "36px", color: "red" },
    });
    await flushPromises();
    expect(wrapper.find("path").exists()).toBe(true);
    expect(wrapper.attributes("style")).toContain("width: 36px");
    expect(wrapper.attributes("style")).toContain("color: red");
    expect(fetch).not.toHaveBeenCalled();

    await wrapper.setProps({ isInStepper: true, color: "blue" });
    expect(wrapper.classes()).toContain("q-icon");
    expect(wrapper.attributes("style")).toContain("width: 1em");
    expect(wrapper.attributes("style")).toContain("font-size: 36px");
    expect(wrapper.attributes("style")).toContain("color: blue");
    await wrapper.setProps({ name: "" });
    expect(wrapper.find(".svg-icon").exists()).toBe(false);
    wrapper.unmount();
  });

  it("fetches and caches web icons", async () => {
    const url =
      "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/home/default/24px.svg";
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<svg><path d="M1 1h10v10z"/></svg>',
    });
    vi.stubGlobal("fetch", fetch);
    const wrapper = mount(svgIcon, { props: { name: url } });
    await flushPromises();
    expect(fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ mode: "cors" }),
    );
    expect(wrapper.find("path").exists()).toBe(true);
    expect(
      JSON.parse(localStorage.getItem("svg-cache-md-outlined-home")).content,
    ).toContain("<path");
    wrapper.unmount();
  });

  it.each([false, true])(
    "uses local fallback when web icons are disabled or fail (allowed: %s)",
    async (allowed) => {
      document.body.insertAdjacentHTML(
        "afterbegin",
        '<svg id="svg-icon-sprite"><symbol id="lightbulb_outlined" viewBox="0 0 24 24"><path d="M2 2h8v8z"/></symbol></svg>',
      );
      configDataStore.mockReturnValue({
        data: { general: { allow_web_icons: allowed } },
      });
      const fetch = vi.fn().mockRejectedValue(new Error("Network unavailable"));
      vi.stubGlobal("fetch", fetch);
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const wrapper = mount(svgIcon, {
        props: { name: "https://example.com/icon.svg" },
      });
      await flushPromises();
      expect(wrapper.find("path").attributes("d")).toBe("M2 2h8v8z");
      expect(wrapper.vm.hasError).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(allowed ? 1 : 0);
      expect(error).toHaveBeenCalledTimes(allowed ? 1 : 0);
      wrapper.unmount();
    },
  );
});
