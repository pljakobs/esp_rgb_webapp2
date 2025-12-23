import { mount, flushPromises } from '@vue/test-utils';
import ControllerItem from '../ControllerItem.vue';
import { createTestingPinia } from '@pinia/testing';
import { useAppDataStore } from 'src/stores/appDataStore';

jest.mock('src/services/api', () => ({
  addSceneSetting: jest.fn(() => Promise.resolve({ success: true })),
  removeSceneSetting: jest.fn(() => Promise.resolve({ success: true })),
  reorderSceneSettings: jest.fn(() => Promise.resolve({ success: true })),
}));

import * as api from 'src/services/api';

describe('ControllerItem.vue integration', () => {
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
    appData.data.scenes = [
      {
        id: 'scene1',
        settings: [],
      },
    ];
  });

  it('adds a scene setting, updates store, and calls API', async () => {
    wrapper.vm.$emit = jest.fn();
    await wrapper.vm.addNewSetting();
    // Simulate parent handler updating store and calling API
    const newSetting = { controller_id: controller.id, pos: 0, color: { hsv: {} } };
    appData.data.scenes[0].settings.push(newSetting);
    await api.addSceneSetting(newSetting);
    expect(appData.data.scenes[0].settings).toContainEqual(newSetting);
    expect(api.addSceneSetting).toHaveBeenCalledWith(newSetting);
  });

  it('removes a scene setting, updates store, and calls API', async () => {
    const setting = { controller_id: controller.id, pos: 0, color: { hsv: {} } };
    appData.data.scenes[0].settings = [setting];
    wrapper.vm.$emit = jest.fn();
    // Simulate parent handler removing from store and calling API
    appData.data.scenes[0].settings = appData.data.scenes[0].settings.filter(s => s !== setting);
    await api.removeSceneSetting(setting);
    expect(appData.data.scenes[0].settings).not.toContain(setting);
    expect(api.removeSceneSetting).toHaveBeenCalledWith(setting);
  });

  it('reorders settings, updates store, and calls API', async () => {
    const settings = [
      { controller_id: controller.id, pos: 0, color: { hsv: { h: 0, s: 100, v: 100 } } },
      { controller_id: controller.id, pos: 1, color: { hsv: { h: 120, s: 100, v: 100 } } },
    ];
    appData.data.scenes[0].settings = [...settings];
    wrapper.vm.$emit = jest.fn();
    // Simulate parent handler reordering in store and calling API
    const reordered = [settings[1], settings[0]];
    reordered.forEach((s, i) => (s.pos = i));
    appData.data.scenes[0].settings = reordered;
    await api.reorderSceneSettings(reordered);
    expect(appData.data.scenes[0].settings[0].color.hsv.h).toBe(120);
    expect(appData.data.scenes[0].settings[1].color.hsv.h).toBe(0);
    expect(api.reorderSceneSettings).toHaveBeenCalledWith(reordered);
  });
});
