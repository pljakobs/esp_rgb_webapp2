import { mount } from '@vue/test-utils';
import ControllerItem from '../ControllerItem.vue';
import { createTestingPinia } from '@pinia/testing';
import { useAppDataStore } from 'src/stores/appDataStore';

describe('ControllerItem.vue', () => {
  let wrapper;
  let appData;
  const controller = { id: 'ctrl1', hostname: 'Test Controller' };
  const colorTypeOptions = [
    { label: 'HSV Color', value: 'hsv' },
    { label: 'Raw Color', value: 'raw' },
    { label: 'Preset', value: 'preset' },
  ];
  const directionOptions = [
    { label: 'Forward', value: 0 },
    { label: 'Reverse', value: 1 },
  ];
  const queueOptions = [
    { label: 'None', value: null },
    { label: 'Single', value: 'single' },
    { label: 'Back', value: 'back' },
  ];

  beforeEach(() => {
    wrapper = mount(ControllerItem, {
      global: {
        plugins: [createTestingPinia({ createSpy: jest.fn })],
      },
      props: {
        controller,
        settings: [],
        isExpanded: true,
        colorTypeOptions,
        directionOptions,
        queueOptions,
      },
    });
    appData = useAppDataStore();
  });

  it('adds a scene setting and emits add-setting', async () => {
    await wrapper.vm.addNewSetting();
    const emitted = wrapper.emitted('add-setting');
    expect(emitted).toBeTruthy();
    expect(emitted[0][0]).toMatchObject({ controller_id: controller.id });
  });

  it('removes a scene setting and emits remove-setting', async () => {
    // Simulate a setting
    const setting = { controller_id: controller.id, pos: 0, color: { hsv: {} } };
    await wrapper.setProps({ settings: [setting] });
    // Find the child SceneSettingItem and trigger remove
    const child = wrapper.findComponent({ name: 'SceneSettingItem' });
    child.vm.$emit('remove-setting', setting);
    await wrapper.vm.$nextTick();
    const emitted = wrapper.emitted('remove-setting');
    expect(emitted).toBeTruthy();
    expect(emitted[0][0]).toEqual(setting);
  });

  it('reorders settings with moveUp and moveDown', async () => {
    const settings = [
      { controller_id: controller.id, pos: 0, color: { hsv: { h: 0, s: 100, v: 100 } } },
      { controller_id: controller.id, pos: 1, color: { hsv: { h: 120, s: 100, v: 100 } } },
    ];
    await wrapper.setProps({ settings });
    // Move down the first item
    await wrapper.vm.moveDown(0);
    let emitted = wrapper.emitted('update-positions');
    expect(emitted).toBeTruthy();
    expect(emitted[0][0][0].pos).toBe(0);
    expect(emitted[0][0][1].pos).toBe(1);
    expect(emitted[0][0][0].color.hsv.h).toBe(120);
    expect(emitted[0][0][1].color.hsv.h).toBe(0);
    // Move up the second item
    await wrapper.vm.moveUp(1);
    emitted = wrapper.emitted('update-positions');
    expect(emitted[1][0][0].pos).toBe(0);
    expect(emitted[1][0][1].pos).toBe(1);
    expect(emitted[1][0][0].color.hsv.h).toBe(0);
    expect(emitted[1][0][1].color.hsv.h).toBe(120);
  });
});
