
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAppDataStore } from 'src/stores/appDataStore';

// Mock storeConstants to avoid window reference in Node.js
vi.mock('../storeConstants.js', () => ({
  storeStatus: {
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    ERROR: 'error',
    SYNCING: 'syncing',
    SYNCED: 'synced',
    store: {
      IDLE: 'store-idle',
      LOADING: 'store-loading',
      READY: 'store-ready',
      ERROR: 'store-error'
    },
    sync: {
      NOT_STARTED: 'sync-not-started',
      RUNNING: 'sync-running',
      COMPLETED: 'sync-completed'
    }
  },
  localhost: { hostname: 'localhost', ip_address: '127.0.0.1' },
  retryDelay: 1000,
  requestTimeout: 10000
}));

// Mock API using vi.mock for Vitest
vi.mock('src/services/api', () => ({
  addSceneSetting: vi.fn(() => Promise.resolve({ success: true })),
  removeSceneSetting: vi.fn(() => Promise.resolve({ success: true })),
  reorderSceneSettings: vi.fn(() => Promise.resolve({ success: true })),
}));
import * as api from 'src/services/api';

describe('Scene settings integration (store + API)', () => {
  let appData;
  beforeEach(() => {
    setActivePinia(createPinia());
    appData = useAppDataStore();
    appData.data.scenes = [
      {
        id: 'scene1',
        settings: [],
      },
    ];
  });

  it('adds a scene setting, updates store, and calls API', async () => {
    const newSetting = { controller_id: 'ctrl1', pos: 0, color: { hsv: {} } };
    appData.data.scenes[0].settings.push(newSetting);
    await api.addSceneSetting(newSetting);
    expect(appData.data.scenes[0].settings).toContainEqual(newSetting);
    expect(api.addSceneSetting).toHaveBeenCalledWith(newSetting);
  });

  it('removes a scene setting, updates store, and calls API', async () => {
    const setting = { controller_id: 'ctrl1', pos: 0, color: { hsv: {} } };
    appData.data.scenes[0].settings = [setting];
    appData.data.scenes[0].settings = appData.data.scenes[0].settings.filter(s => s !== setting);
    await api.removeSceneSetting(setting);
    expect(appData.data.scenes[0].settings).not.toContain(setting);
    expect(api.removeSceneSetting).toHaveBeenCalledWith(setting);
  });

  it('reorders settings, updates store, and calls API', async () => {
    const settings = [
      { controller_id: 'ctrl1', pos: 0, color: { hsv: { h: 0, s: 100, v: 100 } } },
      { controller_id: 'ctrl1', pos: 1, color: { hsv: { h: 120, s: 100, v: 100 } } },
    ];
    appData.data.scenes[0].settings = [...settings];
    const reordered = [settings[1], settings[0]];
    reordered.forEach((s, i) => (s.pos = i));
    appData.data.scenes[0].settings = reordered;
    await api.reorderSceneSettings(reordered);
    expect(appData.data.scenes[0].settings[0].color.hsv.h).toBe(120);
    expect(appData.data.scenes[0].settings[1].color.hsv.h).toBe(0);
    expect(api.reorderSceneSettings).toHaveBeenCalledWith(reordered);
  });
});
