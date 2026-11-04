import { shallowMount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import FirmwareSelectDialog from "./firmwareSelectDialog.vue";

vi.mock("quasar", () => ({
  useDialogPluginComponent: Object.assign(() => ({
    dialogRef: null, onDialogHide: vi.fn(), onDialogOK: vi.fn(), onDialogCancel: vi.fn(),
  }), { emits: [] }),
}));

function dialog() {
  const firmwareOptions = [
    { id: "old", release_line: "5.0", stage: "develop", type: "release", fw_version: "V5.0-2-develop" },
    { id: "new", release_line: "5.1", stage: "develop", type: "release", fw_version: "V5.1.0" },
    { id: "debug", release_line: "5.1", stage: "testing", type: "debug", fw_version: "V5.1.1" },
  ];
  return shallowMount(FirmwareSelectDialog, {
    props: { firmwareOptions, currentInfo: { app: { git_version: "V5.0-1-develop", build_type: "release" } }, otaUrl: "https://example.test/version.json" },
    global: { stubs: ["q-dialog", "q-card", "q-card-section", "q-separator", "q-card-actions", "q-btn", "mySelect", "svgIcon"] },
  });
}

describe("firmware release selectors", () => {
  it("defaults to the installed line and keeps other lines out of its versions", () => {
    const wrapper = dialog();
    expect(wrapper.vm.selectedReleaseLine).toBe("5.0");
    expect(wrapper.vm.availableVersions.map((entry) => entry.id)).toEqual(["old"]);
    wrapper.unmount();
  });

  it("clears the selected artifact when changing lines", async () => {
    const wrapper = dialog();
    wrapper.vm.selectedVersionId = "old";
    wrapper.vm.selectedReleaseLine = "5.1";
    await nextTick();
    expect(wrapper.vm.selectedFirmware).toBeNull();
    expect(wrapper.vm.availableVersions.map((entry) => entry.id)).toEqual(["new"]);
    wrapper.unmount();
  });

  it("does not switch debug back to release when choosing a stage", async () => {
    const wrapper = dialog();
    wrapper.vm.selectedReleaseLine = "5.1";
    wrapper.vm.selectedType = "debug";
    await nextTick();
    expect(wrapper.vm.selectedBranch).toBeNull();
    wrapper.vm.selectedBranch = "testing";
    await nextTick();
    expect(wrapper.vm.selectedType).toBe("debug");
    expect(wrapper.vm.availableVersions.map((entry) => entry.id)).toEqual(["debug"]);
    wrapper.unmount();
  });
});