import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { infoDataStore } from "src/stores/infoDataStore";
import { useRuntimeHistoryStore } from "src/stores/runtimeHistoryStore";
import InformationCard from "./InformationCard.vue";

vi.mock("src/stores/infoDataStore", () => ({ infoDataStore: vi.fn() }));
vi.mock("src/stores/runtimeHistoryStore", () => ({
  useRuntimeHistoryStore: vi.fn(),
}));
vi.mock("src/components/myCard.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

describe("runtime information with sparse info responses", () => {
  let info;
  let history;

  beforeEach(() => {
    info = reactive({ data: { device: { soc: "esp8266" } } });
    history = reactive({
      runtime: { heap_free: 20000, uptime: 120 },
      heapHistory: [
        { ts: Date.now() - 10000, val: 19000 },
        { ts: Date.now(), val: 20000 },
      ],
    });
    infoDataStore.mockReturnValue(info);
    useRuntimeHistoryStore.mockReturnValue(history);
  });

  it("renders runtime numbers and the graph without a runtime info section", async () => {
    const wrapper = mount(InformationCard);
    expect(wrapper.text()).toContain("20000");
    expect(wrapper.text()).toContain("00:02:00");
    expect(wrapper.find("svg.heap-sparkline").exists()).toBe(true);

    info.data = { device: { soc: "esp8266" }, runtime: undefined };
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("20000");
    expect(wrapper.find("svg.heap-sparkline").exists()).toBe(true);
    wrapper.unmount();
  });

  it("shows runtime values and history when telemetry arrives after mounting", async () => {
    history.runtime = {};
    history.heapHistory = [];
    const wrapper = mount(InformationCard);
    expect(wrapper.find("svg.heap-sparkline").exists()).toBe(false);

    history.runtime = { heap_free: 21000, uptime: 180 };
    history.heapHistory = [
      { ts: Date.now() - 10000, val: 20000, controllerKey: "first" },
      { ts: Date.now(), val: 21000, controllerKey: "second" },
    ];
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("21000");
    expect(wrapper.text()).toContain("00:03:00");
    expect(wrapper.find("svg.heap-sparkline").exists()).toBe(true);
    expect(wrapper.findAll(".sparkline-controller-boundary")).toHaveLength(1);
    expect(wrapper.findAll(".sparkline-line")).toHaveLength(0);
    wrapper.unmount();
  });
});