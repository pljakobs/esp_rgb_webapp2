import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import { lightProfile } from "src/services/virtualLights";

const mocks = vi.hoisted(() => ({
  color: { change_by: null },
  config: { data: { general: { supported_color_models: ["RGB", "RGBWW"] }, color: { color_mode: 0, brightness: { red: 100, green: 100, blue: 100, ww: 100 }, colortemp: { ww: 2700, cw: 6000 } }, hardware: { pwm: { timer: { frequency: 1000, resolution: 10 }, spreadSpectrum: { mode: "ON", width: 15, subsampling: 4 }, phaseShift: { mode: "ON" } } } }, updateData: vi.fn(), updateMultipleData: vi.fn() },
  lights: { enabled: false, loading: false, start: vi.fn() },
  restart: vi.fn(),
  fetchApi: vi.fn(),
}));
vi.mock("src/stores/colorDataStore", () => ({ useColorDataStore: () => mocks.color }));
vi.mock("src/stores/configDataStore", () => ({ configDataStore: () => mocks.config }));
vi.mock("src/stores/virtualLightsStore", () => ({ useVirtualLightsStore: () => mocks.lights }));
vi.mock("src/stores/appDataStore", () => ({ useAppDataStore: () => ({ data: { presets: [], scenes: [] } }) }));
vi.mock("src/services/api", () => ({ apiService: { fetchApi: mocks.fetchApi } }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key) => key }) }));
vi.mock("src/stores/infoDataStore", () => ({ infoDataStore: () => ({ data: { device: { soc: "esp32c3" } } }) }));
vi.mock("src/services/systemCommands.js", () => ({ default: { restartController: mocks.restart } }));
vi.mock("quasar", async (importOriginal) => ({ ...(await importOriginal()), useQuasar: () => ({ notify: vi.fn() }) }));
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
    QCarousel: { template: "<div><slot /></div>" },
    QCarouselSlide: { template: "<div><slot /></div>" },
    HsvSection: true, RawSection: true,
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

  it.each(["SINGLE", "WW", "CW"])("hides mode tabs and RAW for %s and resets a previous RAW selection", async (type) => {
    setLight("RGB");
    const wrapper = mount(ColorPickerCard, { global });
    wrapper.vm.carouselPage = "raw";
    setLight(type);
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent({ name: "QBtnGroup" }).exists()).toBe(false);
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
    wrapper.vm.brightness = 0;
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("update:modelValue")[0]).toEqual([{ raw: [0] }]);
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