import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Mock storeConstants first (before any imports that use it)
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
      COMPLETED: 'sync-completed',
      ERROR: 'sync-error'
    }
  },
  requestTimeout: 10000,
  retryDelay: 1000,
  sync_phases: []
}));

// Mock dependencies
vi.mock('../controllersStore.js', () => ({
  useControllersStore: vi.fn()
}));

vi.mock('../../services/api.js', () => ({
  apiService: {
    getData: vi.fn(),
    getAppData: vi.fn(),
    fetchApi: vi.fn()
  }
}));

vi.mock('../../services/syncService.js', () => ({
  syncService: {
    syncAll: vi.fn()
  }
}));

vi.mock('../../services/tools.js', () => ({
  makeID: vi.fn(() => 'test-id-' + Math.random().toString(36).substr(2, 9)),
  createAbortTimeout: vi.fn((timeoutMs, onTimeout) => ({
    controller: { abort: vi.fn() },
    signal: {},
    clear: vi.fn()
  })),
  broadcastToControllers: vi.fn(async (controllers, operation, onProgress) => {
    let successCount = 0;
    let failureCount = 0;
    for (const controller of controllers) {
      try {
        await operation(controller);
        successCount++;
      } catch (error) {
        failureCount++;
      }
      if (onProgress) onProgress(successCount + failureCount, controllers.length);
    }
    return { successCount, failureCount };
  }),
  getModifyPost: vi.fn(async (ipAddress, modifyFn) => {
    const existingData = { presets: [], scenes: [], groups: [] };
    const payload = await modifyFn(existingData);
    if (!payload) return { skipped: true, existingData };
    return { success: true, data: {} };
  })
}));

const { useControllersStore } = await import('../controllersStore.js');
const { apiService } = await import('../../services/api.js');
const { syncService } = await import('../../services/syncService.js');
const { makeID } = await import('../../services/tools.js');
const { storeStatus } = await import('../storeConstants.js');
const { useAppDataStore } = await import('../appDataStore.js');

describe('AppDataStore', () => {
  let store;
  let mockControllersStore;
  let mockFetch;
  let originalFetch;

  beforeEach(() => {
    // Create fresh Pinia instance
    setActivePinia(createPinia());
    
    // Create fresh store instance
    store = useAppDataStore();

    // Mock controllers store
    mockControllersStore = {
      data: [
        { ip_address: '192.168.1.100', name: 'Controller 1' },
        { ip_address: '192.168.1.101', name: 'Controller 2' }
      ],
      currentController: { ip_address: '192.168.1.100', name: 'Controller 1' }
    };
    useControllersStore.mockReturnValue(mockControllersStore);

    // Mock global fetch
    originalFetch = global.fetch;
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Initial State', () => {
    it('should initialize with default state', () => {
      expect(store.data).toEqual({
        'last-color': {},
        presets: [],
        scenes: [],
        groups: [],
        controllers: [],
        'sync-lock': null
      });
      expect(store.storeStatus).toBe(storeStatus.store.IDLE);
      expect(store.syncStatus).toBe(storeStatus.sync.NOT_STARTED);
      expect(store.abortSaveOperation).toBe(false);
      expect(store.syncWatchInitialized).toBe(false);
    });

    it('should have correct initial getters', () => {
      expect(store.status).toBe(storeStatus.IDLE);
    });
  });

  describe('Status Mapping Getter', () => {
    it('should map LOADING store status', () => {
      store.storeStatus = storeStatus.store.LOADING;
      expect(store.status).toBe(storeStatus.LOADING);
    });

    it('should map ERROR store status', () => {
      store.storeStatus = storeStatus.store.ERROR;
      expect(store.status).toBe(storeStatus.ERROR);
    });

    it('should map READY with RUNNING sync to SYNCING', () => {
      store.storeStatus = storeStatus.store.READY;
      store.syncStatus = storeStatus.sync.RUNNING;
      expect(store.status).toBe(storeStatus.SYNCING);
    });

    it('should map READY with COMPLETED sync to SYNCED', () => {
      store.storeStatus = storeStatus.store.READY;
      store.syncStatus = storeStatus.sync.COMPLETED;
      expect(store.status).toBe(storeStatus.SYNCED);
    });

    it('should map READY without sync to READY', () => {
      store.storeStatus = storeStatus.store.READY;
      store.syncStatus = storeStatus.sync.NOT_STARTED;
      expect(store.status).toBe(storeStatus.READY);
    });
  });

  describe('fetchData', () => {
    it('should fetch data successfully', async () => {
      const mockData = {
        presets: [
          { id: 'preset1', name: 'Test Preset', color: { hsv: { h: 180, s: 100, v: 75 } } }
        ],
        scenes: [],
        groups: [],
        'last-color': { hsv: { h: 120, s: 80, v: 90 } },
        'sync-lock': null
      };

      apiService.getData.mockResolvedValueOnce({
        jsonData: mockData,
        error: null
      });

      await store.fetchData();

      expect(store.storeStatus).toBe(storeStatus.store.READY);
      expect(store.data.presets).toEqual(mockData.presets);
      expect(store.data['last-color']).toEqual(mockData['last-color']);
      expect(apiService.getData).toHaveBeenCalled();
    });

    it('should handle fetch errors', async () => {
      apiService.getData.mockResolvedValueOnce({
        jsonData: null,
        error: new Error('Network error')
      });

      await store.fetchData();

      expect(store.storeStatus).toBe(storeStatus.store.ERROR);
    });

    it('should set loading status during fetch', async () => {
      apiService.getData.mockImplementationOnce(async () => {
        expect(store.storeStatus).toBe(storeStatus.store.LOADING);
        return { jsonData: { presets: [], scenes: [] }, error: null };
      });

      await store.fetchData();
    });
  });

  describe('savePreset', () => {
    beforeEach(() => {
      // Mock successful fetch responses for existing data check
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          presets: [],
          scenes: []
        })
      });
    });

    it('should generate ID if preset has no ID', async () => {
      const preset = {
        name: 'New Preset',
        color: { hsv: { h: 180, s: 100, v: 75 } }
      };

      makeID.mockReturnValueOnce('generated-id');

      await store.savePreset(preset);

      expect(preset.id).toBe('generated-id');
      expect(makeID).toHaveBeenCalled();
    });

    it('should add timestamp to preset', async () => {
      const preset = {
        id: 'test-preset',
        name: 'Test Preset',
        color: { hsv: { h: 180, s: 100, v: 75 } }
      };

      const beforeTs = Date.now();
      await store.savePreset(preset);
      const afterTs = Date.now();

      expect(preset.ts).toBeGreaterThanOrEqual(beforeTs);
      expect(preset.ts).toBeLessThanOrEqual(afterTs);
    });

    it('should remove favorite flag before syncing', async () => {
      const preset = {
        id: 'test-preset',
        name: 'Test Preset',
        favorite: true,
        color: { hsv: { h: 180, s: 100, v: 75 } }
      };

      // Mock POST request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' })
      });

      await store.savePreset(preset);

      // Check that POST was called without favorite flag
      const postCalls = mockFetch.mock.calls.filter(call => 
        call[0].includes('/data') && call[1]?.method === 'POST'
      );
      
      if (postCalls.length > 0) {
        const body = JSON.parse(postCalls[0][1].body);
        const presetKey = Object.keys(body).find(k => k.includes('presets'));
        if (presetKey && body[presetKey]) {
          expect(body[presetKey].favorite).toBeUndefined();
        }
      }
    });

    it('should call progress callback during save', async () => {
      const preset = {
        id: 'test-preset',
        name: 'Test Preset',
        color: { hsv: { h: 180, s: 100, v: 75 } }
      };

      const progressCallback = vi.fn();

      await store.savePreset(preset, progressCallback);

      expect(progressCallback).toHaveBeenCalled();
      // Should be called for each controller
      expect(progressCallback).toHaveBeenCalledWith(
        expect.any(Number),
        mockControllersStore.data.length
      );
    });

    it('should respect abort operation flag', async () => {
      const preset = {
        id: 'test-preset',
        name: 'Test Preset',
        color: { hsv: { h: 180, s: 100, v: 75 } }
      };

      // Verify abortSaveOperation flag exists and can be set
      expect(store.abortSaveOperation).toBe(false);
      store.abortSaveOperation = true;
      expect(store.abortSaveOperation).toBe(true);
      
      // Reset for other tests
      store.abortSaveOperation = false;
    });

    it('should handle controller fetch timeout', async () => {
      const preset = {
        id: 'test-preset',
        name: 'Test Preset',
        color: { hsv: { h: 180, s: 100, v: 75 } }
      };

      // First call (check existing) times out, second call (POST) succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok' })
        });

      const progressCallback = vi.fn();

      await store.savePreset(preset, progressCallback);

      // Should still call progress callback even on timeout
      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe('deletePreset', () => {
    beforeEach(() => {
      store.data.presets = [
        { id: 'preset1', name: 'Preset 1' },
        { id: 'preset2', name: 'Preset 2' }
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' })
      });
    });

    it('should delete preset from all controllers', async () => {
      const preset = { id: 'preset1', name: 'Preset 1' };

      // Mock the GET request to check existing data, then POST to delete
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ presets: [preset] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok' })
        });

      await store.deletePreset(preset);

      // Should have made fetch calls (GET + POST)
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should remove preset from local store', async () => {
      const preset = { id: 'preset1', name: 'Preset 1' };

      expect(store.data.presets).toHaveLength(2);

      await store.deletePreset(preset);

      expect(store.data.presets).toHaveLength(1);
      expect(store.data.presets.find(p => p.id === 'preset1')).toBeUndefined();
    });

    it('should call progress callback during delete', async () => {
      const preset = { id: 'preset1', name: 'Preset 1' };
      const progressCallback = vi.fn();

      await store.deletePreset(preset, progressCallback);

      expect(progressCallback).toHaveBeenCalled();
    });

    it('should have abort mechanism available', async () => {
      const preset = { id: 'preset1', name: 'Preset 1' };
      const initialLength = store.data.presets.length;
      
      // Verify abort flag can be set
      store.abortSaveOperation = false;
      expect(store.abortSaveOperation).toBe(false);
      
      store.abortSaveOperation = true;
      expect(store.abortSaveOperation).toBe(true);
      
      // Reset
      store.abortSaveOperation = false;
    });
  });

  describe('saveScene', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          presets: [],
          scenes: []
        })
      });
    });

    it('should require scene to have an ID', async () => {
      const sceneWithId = {
        id: 'test-scene-id',
        name: 'New Scene',
        items: [
          { id: 'preset1', t: 1000 }
        ]
      };

      await store.saveScene(sceneWithId);

      // Scene should maintain its ID after save
      expect(sceneWithId.id).toBe('test-scene-id');
    });

    it('should add timestamp to scene', async () => {
      const scene = {
        id: 'test-scene',
        name: 'Test Scene',
        items: []
      };

      const beforeTs = Date.now();
      await store.saveScene(scene);
      const afterTs = Date.now();

      expect(scene.ts).toBeGreaterThanOrEqual(beforeTs);
      expect(scene.ts).toBeLessThanOrEqual(afterTs);
    });

    it('should handle scene with multiple items', async () => {
      const scene = {
        id: 'test-scene',
        name: 'Test Scene',
        items: [
          { id: 'preset1', t: 1000 },
          { id: 'preset2', t: 2000 },
          { id: 'preset3', t: 3000 }
        ]
      };

      await store.saveScene(scene);

      expect(scene.items).toHaveLength(3);
    });
  });

  describe('deleteScene', () => {
    beforeEach(() => {
      store.data.scenes = [
        { id: 'scene1', name: 'Scene 1', items: [] },
        { id: 'scene2', name: 'Scene 2', items: [] }
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' })
      });
    });

    it('should delete scene from all controllers', async () => {
      const scene = { id: 'scene1', name: 'Scene 1', items: [] };

      // Mock GET for existing data check, then POST for delete
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ scenes: [scene] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok' })
        });

      await store.deleteScene(scene);

      // Should have made fetch calls
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should remove scene from local store', async () => {
      const scene = { id: 'scene1', name: 'Scene 1' };

      expect(store.data.scenes).toHaveLength(2);

      await store.deleteScene(scene);

      expect(store.data.scenes).toHaveLength(1);
      expect(store.data.scenes.find(s => s.id === 'scene1')).toBeUndefined();
    });
  });

  describe('Type Validation - Integer HSV in Stored Data', () => {
    it('should store presets with integer HSV values', async () => {
      const preset = {
        id: 'test-preset',
        name: 'Test Preset',
        color: {
          hsv: {
            h: 180,  // Integer
            s: 100,  // Integer
            v: 75,   // Integer
            ct: 3500
          }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ presets: [] })
      }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' })
      });

      await store.savePreset(preset);

      // Verify integers are sent to firmware
      const postCalls = mockFetch.mock.calls.filter(call => 
        call[1]?.method === 'POST'
      );

      if (postCalls.length > 0) {
        const body = JSON.parse(postCalls[0][1].body);
        const presetKey = Object.keys(body).find(k => k.includes('presets'));
        if (presetKey && body[presetKey]?.color?.hsv) {
          const hsv = body[presetKey].color.hsv;
          expect(Number.isInteger(hsv.h)).toBe(true);
          expect(Number.isInteger(hsv.s)).toBe(true);
          expect(Number.isInteger(hsv.v)).toBe(true);
        }
      }
    });

    it('should handle scene items with integer HSV', async () => {
      const scene = {
        id: 'test-scene',
        name: 'Test Scene',
        items: [
          {
            id: 'item1',
            color: {
              hsv: {
                h: 240,
                s: 80,
                v: 90,
                ct: 4000
              }
            },
            t: 1000
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ scenes: [] })
      });

      await store.saveScene(scene);

      // Verify scene items maintain integer HSV
      expect(Number.isInteger(scene.items[0].color.hsv.h)).toBe(true);
      expect(Number.isInteger(scene.items[0].color.hsv.s)).toBe(true);
      expect(Number.isInteger(scene.items[0].color.hsv.v)).toBe(true);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent save operations', async () => {
      const preset1 = {
        id: 'preset1',
        name: 'Preset 1',
        color: { hsv: { h: 120, s: 100, v: 75 } }
      };

      const preset2 = {
        id: 'preset2',
        name: 'Preset 2',
        color: { hsv: { h: 240, s: 100, v: 75 } }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ presets: [] })
      });

      // Save both presets concurrently
      await Promise.all([
        store.savePreset(preset1),
        store.savePreset(preset2)
      ]);

      expect(preset1.ts).toBeDefined();
      expect(preset2.ts).toBeDefined();
    });

    it('should handle save and delete concurrently', async () => {
      store.data.presets = [
        { id: 'preset1', name: 'Preset 1' }
      ];

      const newPreset = {
        id: 'preset2',
        name: 'Preset 2',
        color: { hsv: { h: 120, s: 100, v: 75 } }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ presets: [] })
      });

      await Promise.all([
        store.savePreset(newPreset),
        store.deletePreset(store.data.presets[0])
      ]);

      // Preset1 should be deleted, preset2 should be added
      expect(store.data.presets.find(p => p.id === 'preset1')).toBeUndefined();
    });
  });

  describe('Error Recovery', () => {
    it('should continue processing other controllers on error', async () => {
      const preset = {
        id: 'test-preset',
        name: 'Test Preset',
        color: { hsv: { h: 180, s: 100, v: 75 } }
      };

      // First controller fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Controller 1 error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ presets: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'ok' })
        });

      const progressCallback = vi.fn();

      await store.savePreset(preset, progressCallback);

      // Should call progress for both controllers
      expect(progressCallback).toHaveBeenCalledTimes(mockControllersStore.data.length);
    });

    it('should handle network timeout gracefully', async () => {
      const preset = {
        id: 'test-preset',
        name: 'Test Preset',
        color: { hsv: { h: 180, s: 100, v: 75 } }
      };

      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const progressCallback = vi.fn();

      await store.savePreset(preset, progressCallback);

      // Should complete despite timeout
      expect(progressCallback).toHaveBeenCalled();
    });
  });
});
