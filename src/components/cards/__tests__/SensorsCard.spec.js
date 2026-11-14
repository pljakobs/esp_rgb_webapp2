import { mount, flushPromises } from "@vue/test-utils";
import { reactive, ref } from "vue";
import { createI18n } from "vue-i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Quasar,
  QTabs,
  QTab,
  QTabPanels,
  QTabPanel,
  QBanner,
  QInput,
  QToggle,
  QForm,
  QBtn,
  QExpansionItem,
  QLinearProgress,
} from "quasar/dist/quasar.client.js";
import SensorsCard from "../SensorsCard.vue";
import { useSensors } from "src/composables/useSensors";
import { sensorDefinitions } from "src/services/sensors";
import translations from "src/i18n/en.json";

vi.mock("src/composables/useSensors", () => ({ useSensors: vi.fn() }));
vi.mock("src/components/myCard.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

describe("Sensors card visualization", () => {
  let state;

  beforeEach(() => {
    state = {
      sensors: reactive(
        sensorDefinitions.map((definition) => ({
          ...definition,
          config: {
            extension_id: definition.id,
            enabled: true,
            available: true,
          },
          draft: {},
          supported: true,
          saving: false,
          error: "",
          actionError: "",
          history: [
            { x: 1000, y: -0.125 },
            { x: 2000, y: 0.25 },
          ],
          reading:
            definition.name === "current"
              ? {
                  valid: true,
                  age_ms: 5,
                  current_a: -0.125,
                  voltage_v: 12,
                  power_w: -1.5,
                }
              : {
                  valid: true,
                  age_ms: 5,
                  state: "complete",
                  data: {
                    f1: 10,
                    f2: 20,
                    f3: 40,
                    f4: 30,
                    f5: 80,
                    f6: 50,
                    f7: 60,
                    f8: 90,
                    clear_low: 500,
                    clear_high: 490,
                    nir_low: 20,
                    nir_high: 21,
                  },
                },
        })),
      ),
      loading: ref(false),
      reload: vi.fn(),
      save: vi.fn(),
      measure: vi.fn(),
    };
    useSensors.mockReturnValue(state);
  });

  function render() {
    return mount(SensorsCard, {
      global: {
        plugins: [
          [
            Quasar,
            {
              components: {
                QTabs,
                QTab,
                QTabPanels,
                QTabPanel,
                QBanner,
                QInput,
                QToggle,
                QForm,
                QBtn,
                QExpansionItem,
                QLinearProgress,
              },
            },
          ],
          createI18n({
            legacy: false,
            locale: "en",
            messages: { en: translations },
          }),
        ],
        stubs: { transition: true },
      },
    });
  }

  it("renders a tab per sensor with signed numeric current and a history graph", () => {
    const wrapper = render();
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(2);
    expect(wrapper.get('[data-testid="current-value"]').text()).toBe(
      "-0.125 A",
    );
    expect(
      wrapper.find('svg[aria-label="Current history in amperes"]').exists(),
    ).toBe(true);
    state.sensors[0].reading = { valid: false, error: "I2C failure" };
    return wrapper.vm.$nextTick().then(() => {
      expect(wrapper.find('[data-testid="current-value"]').exists()).toBe(
        false,
      );
      wrapper.unmount();
    });
  });

  it("hides controls until the controller reports the sensor capability", async () => {
    state.sensors.forEach((sensor) => {
      sensor.supported = false;
      sensor.config = null;
    });
    const wrapper = render();
    await flushPromises();
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(0);
    expect(wrapper.findAll("input")).toHaveLength(0);
    expect(wrapper.text()).toContain("Sensor extension is not included");
    wrapper.unmount();
  });

  it("renders all eight measured points, brightness and the fitted spectrum in its tab", async () => {
    const wrapper = render();
    await wrapper.findAll('[role="tab"]')[1].trigger("click");
    await flushPromises();
    const graph = wrapper.get(
      'svg[aria-label="Interpolated visible spectrum in raw ADC counts"]',
    );
    expect(graph.findAll("circle")).toHaveLength(8);
    expect(graph.findAll("circle title").map((title) => title.text())).toEqual([
      "F1: 10",
      "F2: 20",
      "F3: 40",
      "F4: 30",
      "F5: 80",
      "F6: 50",
      "F7: 60",
      "F8: 90",
    ]);
    expect(wrapper.get('[data-testid="brightness"]').text()).toContain(
      "500 / 490 ADC counts",
    );
    const measure = wrapper
      .findAll("button")
      .find((button) => button.text() === "Measure spectrum");
    await measure.trigger("click");
    expect(state.measure).toHaveBeenCalledWith(state.sensors[1]);
    state.sensors[1].reading = { valid: false, state: "measuring" };
    await wrapper.vm.$nextTick();
    expect(
      wrapper
        .find(
          'svg[aria-label="Interpolated visible spectrum in raw ADC counts"]',
        )
        .exists(),
    ).toBe(false);
    expect(wrapper.find('[data-testid="brightness"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
