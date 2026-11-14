import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import { lightProfile } from "src/services/virtualLights";

const mocks = vi.hoisted(() => ({
  color: { change_by: null },
  config: { data: { general: { supported_color_models: ["RGB", "RGBWW"] }, color: { color_mode: 0, brightness: { red: 100, green: 100, blue: 100, ww: 100 }, colortemp: { ww: 2700, cw: 6000 } }, hardware: { pwm: { timer: { frequency: 1000, resolution: 10 }, spreadSpectrum: { mode: "ON", width: 15, subsampling: 4 }, phaseShift: { mode: "ON" } } } }, updateData: vi.fn(), updateMultipleData: vi.fn() },
  lights: { enabled: false, loading: false, start: vi.fn() },
  presets: { favorites: [], presets: [] },
  restart: vi.fn(),
  fetchApi: vi.fn(),
  dialog: vi.fn(),
}));
vi.mock("src/stores/colorDataStore", () => ({ useColorDataStore: () => mocks.color }));
vi.mock("src/stores/configDataStore", () => ({ configDataStore: () => mocks.config }));
vi.mock("src/stores/virtualLightsStore", () => ({ useVirtualLightsStore: () => mocks.lights }));
vi.mock("src/stores/appDataStore", () => ({ useAppDataStore: () => ({ data: { presets: [], scenes: [] } }) }));
vi.mock("src/stores/lightPresetsStore", () => ({ useLightPresetsStore: () => mocks.presets }));
vi.mock("src/services/api", () => ({ apiService: { fetchApi: mocks.fetchApi } }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key) => key }) }));
vi.mock("src/stores/infoDataStore", () => ({ infoDataStore: () => ({ data: { device: { soc: "esp32c3" } } }) }));
vi.mock("src/services/systemCommands.js", () => ({ default: { restartController: mocks.restart } }));
vi.mock("quasar", async (importOriginal) => ({ ...(await importOriginal()), Dialog: { create: mocks.dialog }, useQuasar: () => ({ notify: vi.fn() }) }));
import RawSection from "../colorPickerSections/RawSection.vue";
import HsvSection from "../colorPickerSections/HsvSection.vue";
import ColorModelCard from "../ColorModelCard.vue";
import ControllerConfigCard from "../ControllerConfigCard.vue";
import VirtualLightEditor from "../VirtualLightEditor.vue";
import ColorPickerCard from "../ColorPickerCard.vue";
import ColorPickerDialog from "src/components/Dialogs/colorPickerDialog.vue";

const global = {
  config: { globalProperties: { $t: (key) => key } },
  stubs: {
    QScrollArea: { template: "<div><slot /></div>" },
    QCardSection: { template: "<div><slot /></div>" },
    MyCard: { props: ["title"], template: "<div><h2>{{ title }}</h2><slot /></div>" },
    ColorSlider: true, QSlider: true, QColor: true,
    SvgIcon: true, MySelect: true, VirtualLightEditor: true,
    QToggle: true, QSeparator: true, QInput: true,
    QExpansionItem: { template: "<div><slot /></div>" }, QTooltip: true,
    QBtnGroup: { template: "<div><slot /></div>" },
    QBtn: { template: "<button><slot /></button>" },
    QTabPanels: { template: "<div><slot /></div>" },
    QTabPanel: { template: "<div><slot /></div>" },
    HsvSection: true, RawSection: true, LightPresetSection: true,
    QDialog: { template: "<div><slot /></div>", methods: { hide() {}, show() {} } },
    QCard: { template: "<div><slot /></div>" },
    QToolbar: { template: "<div><slot /></div>" },
    QToolbarTitle: { template: "<div><slot /></div>" },
    QCardActions: { template: "<div><slot /></div>" },
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  mocks.lights = reactive({
    enabled: false,
    loading: false,
    deviceSoc: "esp32c3",
    get compatibleBoards() {
      return this.catalog?.boards ?? [];
    },
    start: vi.fn(),
  });
  mocks.presets = reactive({ favorites: [], presets: [] });
  vi.clearAllMocks();
  mocks.fetchApi.mockResolvedValue({ jsonData: { raw: [500] }, error: null });
});
afterEach(() => { vi.useRealTimers(); });

describe("Profile-specific color controls", () => {
  const setLight = (type) => {
    const light = { id: type, type, name: type };
    Object.assign(mocks.lights, {
      enabled: true, lights: [light], selectedLight: light, selectedId: light.id,
      profile: lightProfile(light), color: { hsv: { h: 0, s: 0, v: 50, ct: 2700 } },
    });
  };

  it("uses content-sized controls in the card while retaining scrolling for dialogs", () => {
    setLight("WWCW");
    const card = mount(ColorPickerCard, { global });
    expect(card.findComponent(HsvSection).props("cardHeight")).toBe("auto");
    expect(card.findComponent(RawSection).props("cardHeight")).toBe("auto");
    const controls = mount(HsvSection, { global, props: { profile: lightProfile({ type: "WWCW" }), cardHeight: "auto" } });
    expect(controls.vm.scrollContainer).toBe("div");
    const dialog = mount(HsvSection, { global, props: { profile: lightProfile({ type: "WWCW" }), isDialog: true, cardHeight: "auto", dialogHeight: "280px" } });
    expect(dialog.vm.scrollContainer).not.toBe("div");
    expect(dialog.vm.scrollStyle).toEqual({ height: "280px" });
    card.unmount();
    controls.unmount();
    dialog.unmount();
  });

  it("shows brightness, temperature and an accessible selected-light power control", async () => {
    const wrapper = mount(HsvSection, {
      global,
      props: {
        profile: lightProfile({ type: "WWCW" }),
        modelValue: { hsv: { h: 0, s: 0, v: 24.5, ct: 4000 } },
        showPower: true,
        powerOn: true,
      },
    });
    expect(wrapper.text()).toContain("25%");
    expect(wrapper.text()).toContain("4000 K");
    expect(wrapper.text()).toContain("colorSliders.warmWhite");
    expect(wrapper.text()).toContain("colorSliders.coldWhite");
    const toggle = wrapper.findComponent({ name: "QToggle" });
    expect(toggle.attributes("aria-label")).toBe("color.power");
    toggle.vm.$emit("update:modelValue", false);
    expect(wrapper.emitted("update:power")).toEqual([[false]]);
    wrapper.unmount();
  });

  it("keeps the existing temperature when changing brightness and sends temperature changes", async () => {
    const wrapper = mount(HsvSection, {
      global,
      props: {
        profile: lightProfile({ type: "WWCW" }),
        modelValue: { hsv: { h: 0, s: 0, v: 50, ct: 4000 } },
      },
    });
    await vi.runAllTimersAsync();
    const sliders = wrapper.findAllComponents({ name: "QSlider" });
    sliders[0].vm.$emit("update:modelValue", 60);
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("update:modelValue").at(-1)).toEqual([
      { hsv: { h: 0, s: 0, v: 60 }, ct: 4000 },
    ]);
    sliders[1].vm.$emit("update:modelValue", 5000);
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("update:modelValue").at(-1)).toEqual([
      { hsv: { h: 0, s: 0, v: 60 }, ct: 5000 },
    ]);
    wrapper.unmount();
  });

  it("keeps the preset page open when starring and falls back there after the last unstar", async () => {
    setLight("WWCW");
    const wrapper = mount(ColorPickerCard, { global });
    wrapper.vm.carouselPage = "presets";
    mocks.presets.favorites = [{ id: "p" }];
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.carouselPage).toBe("presets");
    wrapper.vm.carouselPage = "favorites";
    mocks.presets.favorites = [];
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.carouselPage).toBe("presets");
    wrapper.unmount();
  });

  it.each(["SINGLE", "WW", "CW"])("keeps presets but hides RAW for %s and resets a previous RAW selection", async (type) => {
    setLight("RGB");
    const wrapper = mount(ColorPickerCard, { global });
    wrapper.vm.carouselPage = "raw";
    setLight(type);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("Presets");
    expect(wrapper.findComponent(RawSection).exists()).toBe(false);
    expect(wrapper.findComponent(HsvSection).exists()).toBe(true);
    expect(wrapper.vm.carouselPage).toBe("hsv");
    expect(wrapper.find("h2").text()).toBe("cards.colorModel.title");
    wrapper.unmount();
  });

  it.each(["WWCW", "RGB", "RGBWW", "RGBCW", "RGBWWCW"])("keeps RAW and uses the appropriate primary heading for %s", (type) => {
    setLight(type);
    const wrapper = mount(ColorPickerCard, { global });
    expect(wrapper.text()).toContain(type === "WWCW" ? "color.tunableWhite" : "HSV");
    expect(wrapper.text()).toContain("RAW");
    expect(wrapper.findComponent(RawSection).exists()).toBe(true);
    expect(wrapper.find('[aria-label="Open light picker dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("uses a single brightness control when a RAW dialog switches to a single-channel light", async () => {
    const wrapper = mount(ColorPickerDialog, {
      global,
      props: {
        type: "RAW", controller: { ip_address: "device" }, firmwareVersion: "V5.1.0",
        lights: [{ id: "rgb", index: 1, type: "RGB" }, { id: "pink", index: 0, type: "SINGLE" }],
        initialLightId: "rgb",
      },
    });
    await flushPromises();
    expect(wrapper.findComponent(RawSection).exists()).toBe(true);
    wrapper.vm.selectedLightId = "pink";
    await flushPromises();
    expect(wrapper.findComponent(HsvSection).exists()).toBe(true);
    expect(wrapper.findComponent(RawSection).exists()).toBe(false);
    expect(wrapper.vm.dialogTitle).toBe("color.brightness");
    wrapper.vm.updateColorValue({ raw: [0] });
    wrapper.vm.onOkClick();
    expect(wrapper.emitted("ok")[0]).toEqual([{ raw: [0], light_id: "pink" }]);
    wrapper.unmount();
  });

  it("labels the TW dialog and preserves brightness and CT", async () => {
    mocks.fetchApi.mockResolvedValue({ jsonData: { hsv: { v: 50, ct: 3000 } }, error: null });
    const wrapper = mount(ColorPickerDialog, {
      global,
      props: {
        type: "HSV", controller: { ip_address: "device" }, firmwareVersion: "V5.1.0",
        lights: [{ id: "tw", index: 2, type: "WWCW" }], initialLightId: "tw",
      },
    });
    await flushPromises();
    expect(wrapper.vm.dialogTitle).toBe("color.tunableWhite");
    wrapper.vm.updateColorValue({ hsv: { h: 0, s: 0, v: 70 }, ct: 4000 });
    wrapper.vm.onOkClick();
    expect(wrapper.emitted("ok")[0]).toEqual([{ hsv: { h: 0, s: 0, v: 70, ct: 4000 }, light_id: "tw" }]);
    wrapper.unmount();
  });

  it("updates validation errors while filling board GPIOs and clears them when valid", async () => {
    mocks.lights.configuration = {
      soc: "esp32c3", board_id: "mini", board_revision: 1,
      lights: [{ id: "desk", index: 0, name: "RGBWW", type: "RGBWW", pins: [null, 1, 0, null], is_default: true }],
    };
    mocks.lights.catalog = { boards: [{ id: "mini", revision: 1, implemented_pins: [4, 1, 0, 3].map((gpio) => ({ gpio, allowed_functions: ["light.pwm"] })) }] };
    const wrapper = mount(VirtualLightEditor, { global: { ...global, stubs: { ...global.stubs, QRadio: true, QBanner: { template: "<div><slot /></div>" } } } });
    await wrapper.find('button[label="Apply"]').trigger("click");
    expect(wrapper.text()).toContain("select a GPIO");
    const pinSelect = (label) => wrapper.findAllComponents({ name: "MySelect" }).find((select) => select.attributes("label") === label);
    pinSelect("R GPIO").vm.$emit("update:modelValue", 4);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("select a GPIO");
    pinSelect("WW GPIO").vm.$emit("update:modelValue", 3);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).not.toContain("select a GPIO");
    expect(wrapper.text()).not.toContain("GPIO null");
    pinSelect("R GPIO").vm.$emit("update:modelValue", 1);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("already assigned");
    expect(mocks.lights.configuration.lights[0].pins).toEqual([null, 1, 0, null]);
    wrapper.unmount();
    delete mocks.lights.configuration;
    delete mocks.lights.catalog;
  });

  it("explains occupied Deca outputs and allows reuse after deleting their lights", async () => {
    const gpios = [27, 26, 25, 23, 22, 21, 19, 18, 17, 14, 13, 12, 5, 4, 2];
    mocks.lights.configuration = {
      soc: "esp32", board_id: "deca", board_revision: 1,
      lights: gpios.map((gpio, index) => ({
        id: `led-${index + 1}`, index, name: `LED ${index + 1}`,
        type: "SINGLE", pins: [gpio], is_default: index === 0,
      })),
    };
    mocks.lights.catalog = { boards: [{ id: "deca", revision: 1, implemented_pins: gpios.map((gpio, index) => ({
      id: `L${index + 1}`, gpio, allowed_functions: ["light.pwm"],
    })) }] };
    mocks.lights.apply = vi.fn().mockResolvedValue();
    mocks.dialog.mockImplementation(() => ({ onOk: (callback) => callback() }));
    const wrapper = mount(VirtualLightEditor, { global: { ...global, stubs: { ...global.stubs, QRadio: true, QBanner: { template: "<div><slot /></div>" } } } });
    const select = (label) => wrapper.findAllComponents({ name: "MySelect" }).find((item) => item.attributes("label") === label);
    select("Color model").vm.$emit("update:modelValue", "RGBWW");
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("GPIOs assigned to other lights are unavailable");
    expect(wrapper.vm.pinOptions(0).find((option) => option.value === 26)).toMatchObject({ disable: true, label: "L2 (GPIO 26) - assigned to LED 2" });
    for (const id of ["led-2", "led-3", "led-4"]) {
      select("Light").vm.$emit("update:modelValue", id);
      await wrapper.vm.$nextTick();
      await wrapper.find('button[aria-label="Delete light"]').trigger("click");
    }
    select("Light").vm.$emit("update:modelValue", "led-1");
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.pinOptions(1).find((option) => option.value === 26).disable).toBe(false);
    for (const [label, gpio] of [["R GPIO", 27], ["G GPIO", 26], ["B GPIO", 25], ["WW GPIO", 23]]) {
      select(label).vm.$emit("update:modelValue", gpio);
      await wrapper.vm.$nextTick();
    }
    await wrapper.find('button[label="Apply"]').trigger("click");
    await flushPromises();
    expect(mocks.lights.apply).toHaveBeenCalledWith(expect.objectContaining({
      lights: expect.arrayContaining([expect.objectContaining({ id: "led-1", type: "RGBWW", pins: [27, 26, 25, 23] })]),
    }));
    expect(mocks.lights.configuration.lights).toHaveLength(15);
    wrapper.unmount();
  });

  it("keeps legacy RAW controls when no profile is supplied", () => {
    const wrapper = mount(RawSection, { global });
    expect(wrapper.vm.colorSliders.map((slider) => slider.key)).toEqual(["r", "g", "b", "ww", "cw"]);
    wrapper.unmount();
  });
  it("shows only RGB channels for RGB lights", () => {
    const wrapper = mount(RawSection, { global, props: { profile: lightProfile({ type: "RGB" }), modelValue: { raw: { r: 100, g: 200, b: 300 } } } });
    expect(wrapper.vm.colorSliders.map((slider) => slider.key)).toEqual(["r", "g", "b"]);
    expect(wrapper.vm.colorSliders[0].model).toBe(100);
    wrapper.unmount();
  });
  it("emits ordered arrays and preserves zero and null for white channels", async () => {
    const wrapper = mount(RawSection, { global, props: { profile: lightProfile({ type: "WWCW" }), modelValue: { raw: [100, null] } } });
    await vi.runAllTimersAsync();
    wrapper.vm.updateColorSlider(wrapper.vm.colorSliders[0], 0);
    expect(wrapper.emitted("update:modelValue")[0]).toEqual([{ raw: [0, null] }]);
    expect(wrapper.vm.colorSliders.map((slider) => slider.label)).toEqual(["colorSliders.warmWhite", "colorSliders.coldWhite"]);
    wrapper.vm.updateColorSlider(wrapper.vm.colorSliders[1], 500);
    expect(wrapper.emitted("update:modelValue")[1]).toEqual([{ raw: [0, 500] }]);
    wrapper.unmount();
  });
  it("uses per-light CT limits instead of global settings", () => {
    const wrapper = mount(HsvSection, { global, props: { profile: lightProfile({ type: "WWCW", color: { colortemp: { ww: 2200, cw: 5000 } } }) } });
    expect(wrapper.vm.supportsColorTemp).toBe(true);
    expect(wrapper.vm.minCt).toBe(2200);
    expect(wrapper.vm.maxCt).toBe(5000);
    expect(wrapper.findComponent({ name: "QColor" }).exists()).toBe(false);
    expect(wrapper.findAllComponents({ name: "QSlider" })).toHaveLength(2);
    wrapper.unmount();
  });
  it.each(["SINGLE", "WW", "CW"])("shows one brightness slider for %s and preserves RAW output mode", async (type) => {
    const wrapper = mount(HsvSection, { global, props: { profile: lightProfile({ type }), modelValue: { raw: [1023] } } });
    expect(wrapper.findAllComponents({ name: "QSlider" })).toHaveLength(1);
    expect(wrapper.findComponent({ name: "QColor" }).exists()).toBe(false);
    expect(wrapper.vm.brightness).toBe(100);
    await vi.runAllTimersAsync();
    wrapper.findComponent({ name: "QSlider" }).vm.$emit("update:modelValue", 0);
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("update:modelValue")[0]).toEqual([{ raw: [0] }]);
    wrapper.unmount();
  });
  it.each(["RGB", "RGBWW", "RGBCW", "RGBWWCW"])("shows the shared brightness control and preserves RGB hue for %s", async (type) => {
    const wrapper = mount(HsvSection, {
      global,
      props: {
        profile: lightProfile({ type }),
        modelValue: { hsv: { h: 120, s: 80, v: 50, ct: 4000 } },
        showPower: true,
        powerOn: true,
      },
    });
    await vi.runAllTimersAsync();
    const sliders = wrapper.findAllComponents({ name: "QSlider" });
    expect(sliders).toHaveLength(type === "RGBWWCW" ? 2 : 1);
    expect(wrapper.findComponent({ name: "QToggle" }).exists()).toBe(true);
    sliders[0].vm.$emit("update:modelValue", 0);
    expect(wrapper.emitted("update:modelValue").at(-1)).toEqual([
      { hsv: { h: 120, s: 80, v: 0 }, ct: 4000 },
    ]);
    sliders[0].vm.$emit("update:modelValue", 60);
    expect(wrapper.emitted("update:modelValue").at(-1)).toEqual([
      { hsv: { h: 120, s: 80, v: 60 }, ct: 4000 },
    ]);
    wrapper.unmount();
  });
  it.each(["WWCW", "RGB", "RGBWW", "RGBCW", "RGBWWCW"])("uses shared value-first sliders for %s RAW channels", (type) => {
    const profile = lightProfile({ type });
    const raw = profile.rgb ? { r: 12, g: 34, b: 56, ww: 78, cw: 90 } : [12, 34];
    const wrapper = mount(RawSection, { global, props: { profile, modelValue: { raw } } });
    const sliders = wrapper.findAllComponents({ name: "QSlider" });
    expect(sliders).toHaveLength(profile.channels.length);
    expect(wrapper.text()).toContain("12");
    expect(sliders[0].attributes("aria-label")).toBe(
      profile.rgb ? "colorSliders.red" : "colorSliders.warmWhite",
    );
    expect(sliders[0].attributes("track-size")).toBe("28px");
    wrapper.unmount();
  });
  it("shows a single selected-light power switch on the RAW page", () => {
    const wrapper = mount(RawSection, {
      global,
      props: {
        profile: lightProfile({ type: "RGBWWCW" }),
        modelValue: { raw: { r: 12, g: 34, b: 56, ww: 78, cw: 90 } },
        showPower: true,
        powerOn: true,
      },
    });
    const switches = wrapper.findAllComponents({ name: "QToggle" });
    expect(switches).toHaveLength(1);
    switches[0].vm.$emit("update:modelValue", false);
    expect(wrapper.emitted("update:power")).toEqual([[false]]);
    wrapper.unmount();
  });
  it("does not write legacy color mode during card initialization", () => {
    const wrapper = mount(ColorModelCard, { global });
    expect(mocks.config.updateData).not.toHaveBeenCalled();
    wrapper.vm.emitColorModel("RGBWW");
    expect(mocks.config.updateData).toHaveBeenCalledWith("color.outputmode", 1);
    wrapper.unmount();
  });
  it("blocks legacy model writes in virtual-light mode", () => {
    mocks.lights.enabled = true;
    const wrapper = mount(ColorModelCard, { global });
    wrapper.vm.emitColorModel("RGBWW");
    expect(mocks.config.updateData).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it("keeps PWM global and skips the legacy pin catalogue in PWM-only mode", async () => {
    const wrapper = mount(ControllerConfigCard, { global, props: { pwmOnly: true } });
    expect(wrapper.text()).not.toContain("Pin Configuration");
    expect(mocks.config.updateData).not.toHaveBeenCalled();
    wrapper.vm.pwmFrequency = 2000;
    wrapper.vm.pwmResolution = 12;
    wrapper.vm.pwmSpreadSpectrumMode = "OFF";
    wrapper.vm.pwmPhaseShiftMode = "OFF";
    await wrapper.vm.applyAllAndRestart();
    expect(mocks.config.updateMultipleData).toHaveBeenCalledWith({
      "hardware.pwm.timer.frequency": 2000,
      "hardware.pwm.timer.resolution": 12,
      "hardware.pwm.spreadSpectrum.mode": "OFF",
      "hardware.pwm.phaseShift.mode": "OFF",
    }, true);
    expect(mocks.restart).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
});