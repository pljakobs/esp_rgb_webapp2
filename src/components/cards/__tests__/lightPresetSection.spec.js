import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import { Notify } from "quasar";
import LightPresetSection from "../colorPickerSections/LightPresetSection.vue";

const mocks = vi.hoisted(() => ({ presets: {} }));
vi.mock("src/stores/lightPresetsStore", () => ({
  useLightPresetsStore: () => mocks.presets,
}));
vi.mock("quasar", async (original) => ({
  ...(await original()),
  Notify: { create: vi.fn() },
}));

describe("Per-light preset page", () => {
  const mountPage = (props = {}) =>
    mount(LightPresetSection, {
      props,
      global: {
        stubs: {
          QBanner: { template: "<div><slot /></div>" },
          QInput: {
            props: ["modelValue"],
            emits: ["update:modelValue"],
            template:
              '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
          QBtn: {
            props: ["label", "disable"],
            template:
              '<button :disabled="disable">{{ label }}<slot /></button>',
          },
          QList: { template: "<div><slot /></div>" },
          QItem: { template: "<div><slot /></div>" },
          QItemSection: { template: "<div><slot /></div>" },
          SvgIcon: true,
        },
      },
    });
  beforeEach(() => {
    vi.clearAllMocks();
    const preset = {
      id: "p",
      name: "Warm",
      color: { hsv: { h: 0, s: 0, v: 50, ct: 2700 } },
      light_favorites: [{ light_id: "one", favorite: true }],
    };
    mocks.presets = reactive({
      light: { id: "one", type: "WWCW" },
      busy: false,
      error: null,
      presets: [preset],
      favorites: [preset],
      apply: vi.fn(),
      setFavorite: vi.fn(),
      saveCurrent: vi.fn(),
    });
  });

  it("shows membership for the selected UUID, not a controller-wide star", async () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain("Unstar");
    mocks.presets.light = { id: "two", type: "WWCW" };
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).not.toContain("Unstar");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Star")
      .trigger("click");
    expect(mocks.presets.setFavorite).toHaveBeenCalledWith("p", true);
  });

  it("applies by ID and saves the current light's swatch", async () => {
    const wrapper = mountPage();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Warm")
      .trigger("click");
    expect(mocks.presets.apply).toHaveBeenCalledWith("p");
    await wrapper.find("input").setValue("Evening");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Save swatch")
      .trigger("click");
    await flushPromises();
    expect(mocks.presets.saveCurrent).toHaveBeenCalledWith("Evening");
    expect(wrapper.find("input").element.value).toBe("");
  });

  it("surfaces save failure and retains the draft name", async () => {
    mocks.presets.saveCurrent.mockRejectedValue(new Error("Readback mismatch"));
    const wrapper = mountPage();
    await wrapper.find("input").setValue("Evening");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Save swatch")
      .trigger("click");
    await flushPromises();
    expect(Notify.create).toHaveBeenCalledWith({
      type: "negative",
      message: "Readback mismatch",
    });
    expect(wrapper.find("input").element.value).toBe("Evening");
  });

  it("disables an indexed RAW preset on a different profile instead of applying a default color", () => {
    mocks.presets.presets = [
      {
        id: "raw",
        name: "RGB raw",
        raw_channels: [1, 2, 3],
        light_type: "RGB",
      },
    ];
    const wrapper = mountPage();
    expect(
      wrapper.findAll("button").find((button) => button.text() === "RGB raw")
        .element.disabled,
    ).toBe(true);
    expect(wrapper.text()).toContain("Different RAW light profile");
  });
});
