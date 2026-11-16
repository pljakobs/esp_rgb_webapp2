import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import MyCard from "./myCard.vue";

function mountCard(props = {}) {
  return mount(MyCard, {
    props: { icon: "settings", title: "Settings", ...props },
    slots: { default: '<div class="card-content">Content</div>' },
    global: {
      stubs: {
        QCard: { template: "<div><slot /></div>" },
        QCardSection: { template: "<section><slot /></section>" },
        QSeparator: true,
        svgIcon: true,
      },
    },
  });
}

describe("collapsible cards", () => {
  it("starts collapsed and toggles its content and emits state changes", async () => {
    const wrapper = mountCard();
    expect(wrapper.find(".card-content").exists()).toBe(false);

    await wrapper.find(".rotate-icon").trigger("click");
    expect(wrapper.find(".card-content").exists()).toBe(true);

    await wrapper.find(".rotate-icon").trigger("click");
    expect(wrapper.find(".card-content").exists()).toBe(false);
    expect(wrapper.emitted("update:collapsed")).toEqual([[false], [true]]);
    wrapper.unmount();
  });

  it("starts expanded when requested and follows parent state changes", async () => {
    const wrapper = mountCard({ collapsed: false });
    expect(wrapper.find(".card-content").exists()).toBe(true);

    await wrapper.setProps({ collapsed: true });
    expect(wrapper.find(".card-content").exists()).toBe(false);

    await wrapper.setProps({ collapsed: false });
    expect(wrapper.find(".card-content").exists()).toBe(true);
    wrapper.unmount();
  });
});
