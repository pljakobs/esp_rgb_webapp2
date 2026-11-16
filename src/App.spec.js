import { flushPromises, mount } from "@vue/test-utils";
import { h, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQuasar } from "quasar";
import { useControllersStore } from "src/stores/controllersStore";
import initializeStores from "src/services/initializeStores";
import App from "./App.vue";

vi.mock("quasar", () => ({ useQuasar: vi.fn() }));
vi.mock("src/stores/controllersStore", () => ({
  useControllersStore: vi.fn(),
}));
vi.mock("src/stores/storeConstants", () => ({ localhost: {} }));
vi.mock("src/services/initializeStores", () => ({
  default: vi.fn().mockResolvedValue(),
}));
vi.mock("src/services/notifications", () => ({ default: vi.fn() }));
vi.mock("src/services/appCommands", () => ({ default: vi.fn() }));
vi.mock("src/services/logServices", () => ({ default: vi.fn() }));

describe("Composition API app lifecycle", () => {
  let quasar;

  beforeEach(() => {
    vi.clearAllMocks();
    quasar = reactive({
      dark: { isActive: false },
      platform: { is: { mobile: false } },
    });
    useQuasar.mockReturnValue(quasar);
    useControllersStore.mockReturnValue(reactive({ currentController: null }));
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    vi.restoreAllMocks();
  });

  it("sets the initial theme, follows dark mode changes and initializes once", async () => {
    const wrapper = mount(App, { global: { stubs: { RouterView: true } } });
    await flushPromises();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(initializeStores).toHaveBeenCalledTimes(1);

    quasar.dark.isActive = true;
    await flushPromises();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    wrapper.unmount();
  });

  it("logs and captures child component errors", async () => {
    const failure = new Error("Child render failed");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const FailingChild = {
      name: "FailingChild",
      setup: () => () => {
        throw failure;
      },
    };
    const wrapper = mount(App, {
      global: { stubs: { RouterView: { setup: () => () => h(FailingChild) } } },
    });
    await flushPromises();
    expect(error).toHaveBeenCalledWith("Error in component: FailingChild");
    expect(error).toHaveBeenCalledWith(failure);
    wrapper.unmount();
  });
});
