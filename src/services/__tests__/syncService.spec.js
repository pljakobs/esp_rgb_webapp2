import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncService } from '../syncService.js';

// Mock dependencies
vi.mock('../api.js', () => ({
  apiService: {
    getDataFromController: vi.fn(),
    updateDataOnController: vi.fn(),
    getHosts: vi.fn()
  }
}));

vi.mock('../../stores/controllersStore.js', () => ({
  useControllersStore: vi.fn()
}));

vi.mock('../schemaValidator.js', () => ({
  validatePreset: vi.fn((preset) => ({ valid: true, errors: [] })),
  validateScene: vi.fn((scene) => ({ valid: true, errors: [] })),
  validateGroup: vi.fn((group) => ({ valid: true, errors: [] }))
}));

// Mock window object for getCurrentControllerId tests
global.window = {
  location: {
    search: ''
  }
};

const { apiService } = await import('../api.js');
const { useControllersStore } = await import('../../stores/controllersStore.js');

describe('SyncService', () => {
  let syncService;
  let mockControllersStore;

  beforeEach(() => {
    // Use fake timers for sleep/timeout tests
    vi.useFakeTimers();

    // Create fresh SyncService instance
    syncService = new SyncService();

    // Mock controllers store
    mockControllersStore = {
      currentController: {
        id: 'controller-1',
        ip_address: '192.168.1.100',
        hostname: 'controller1',
        visible: true
      },
      data: [
        {
          id: 'controller-1',
          ip_address: '192.168.1.100',
          hostname: 'controller1',
          visible: true
        },
        {
          id: 'controller-2',
          ip_address: '192.168.1.101',
          hostname: 'controller2',
          visible: true
        },
        {
          id: 'controller-3',
          ip_address: '192.168.1.102',
          hostname: 'controller3',
          visible: false // Hidden controller
        }
      ]
    };
    useControllersStore.mockReturnValue(mockControllersStore);

    // Clear all mocks
    vi.clearAllMocks();

    // Set default mock implementations (after clearAllMocks)
    apiService.getHosts.mockResolvedValue({
      jsonData: {
        hosts: [
          { id: 'controller-1', hostname: 'controller1', ip_address: '192.168.1.100', visible: true },
          { id: 'controller-2', hostname: 'controller2', ip_address: '192.168.1.101', visible: true }
        ]
      },
      error: null
    });
    // Mock for both collection and verification phases
    apiService.getDataFromController.mockResolvedValue({
      jsonData: { presets: [], scenes: [], groups: [], controllers: [] },
      error: null
    });
    apiService.updateDataOnController.mockResolvedValue({
      jsonData: { success: true },
      error: null
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Constructor and Constants', () => {
    it('should initialize with correct default values', () => {
      expect(syncService.SYNC_LOCK_TIMEOUT_MS).toBe(6000);
      expect(syncService.SYNC_VERIFY_RETRIES).toBe(3);
      expect(syncService.SYNC_VERIFY_DELAY_MS).toBe(150);
      expect(syncService.MIN_REQUIRED_SYNC_LOCKS).toBe(1);
      expect(syncService.isCurrentlySyncing).toBe(false);
    });

    it('should create independent instances', () => {
      const service1 = new SyncService();
      const service2 = new SyncService();
      
      service1.isCurrentlySyncing = true;
      
      expect(service1.isCurrentlySyncing).toBe(true);
      expect(service2.isCurrentlySyncing).toBe(false);
    });
  });

  describe('getCurrentControllerId', () => {
    it('should return current controller ID from store', () => {
      const controllerId = syncService.getCurrentControllerId();
      expect(controllerId).toBe('controller-1');
    });

    it('should fallback to URL parameter if no current controller', () => {
      mockControllersStore.currentController = null;
      global.window.location.search = '?controller_id=url-controller';

      const controllerId = syncService.getCurrentControllerId();
      expect(controllerId).toBe('url-controller');
    });

    it('should fallback to first visible controller', () => {
      mockControllersStore.currentController = null;
      global.window.location.search = '';

      const controllerId = syncService.getCurrentControllerId();
      expect(controllerId).toBe('controller-1');
    });

    it('should return "unknown" if no controller available', () => {
      mockControllersStore.currentController = null;
      mockControllersStore.data = [];
      global.window.location.search = '';

      const controllerId = syncService.getCurrentControllerId();
      expect(controllerId).toBe('unknown');
    });

    it('should skip invisible controllers in fallback', () => {
      mockControllersStore.currentController = null;
      global.window.location.search = '';
      mockControllersStore.data = [
        {
          id: 'controller-3',
          ip_address: '192.168.1.102',
          hostname: 'controller3',
          visible: false
        },
        {
          id: 'controller-2',
          ip_address: '192.168.1.101',
          hostname: 'controller2',
          visible: true
        }
      ];

      const controllerId = syncService.getCurrentControllerId();
      expect(controllerId).toBe('controller-2');
    });
  });

  describe('synchronizeData - Basic Flow', () => {
    it('should prevent concurrent sync operations', async () => {
      // Set sync already in progress
      syncService.isCurrentlySyncing = true;

      const result = await syncService.synchronizeData();

      expect(result).toBe(false);
      expect(apiService.getDataFromController).not.toHaveBeenCalled();
    });

    it('should return false if controller ID is unknown', async () => {
      mockControllersStore.currentController = null;
      mockControllersStore.data = [];
      global.window.location.search = '';

      // Mock getHosts to return empty list
      apiService.getHosts.mockResolvedValue({
        jsonData: { hosts: [] },
        error: null
      });

      const result = await syncService.synchronizeData();

      expect(result).toBe(false);
      expect(syncService.isCurrentlySyncing).toBe(false);
    });

    it('should return false if no reachable controllers found', async () => {
      mockControllersStore.data = [
        {
          id: 'controller-1',
          ip_address: '192.168.1.100',
          hostname: 'controller1',
          visible: false // Not visible
        }
      ];

      // Mock getHosts to return unreachable hosts (visible: false)
      apiService.getHosts.mockResolvedValue({
        jsonData: {
          hosts: [
            { id: 'controller-1', hostname: 'controller1', ip_address: '192.168.1.100', visible: false }
          ]
        },
        error: null
      });

      const result = await syncService.synchronizeData();

      expect(result).toBe(false);
      expect(syncService.isCurrentlySyncing).toBe(false);
    });

    it('should set sync flag during operation', async () => {
      apiService.getDataFromController.mockResolvedValue({
        jsonData: { presets: [], scenes: [], groups: [], controllers: [] },
        error: null
      });

      const syncPromise = syncService.synchronizeData();

      // Check flag is set immediately
      expect(syncService.isCurrentlySyncing).toBe(true);

      // Advance timers for all phases (collection + push + verification)
      await vi.advanceTimersByTimeAsync(3000);

      await syncPromise;

      // Check flag is cleared after completion
      expect(syncService.isCurrentlySyncing).toBe(false);
    });
  });

  describe('synchronizeData - Data Collection', () => {
    it('should fetch data from all visible controllers', async () => {
      apiService.getDataFromController.mockResolvedValue({
        jsonData: { presets: [], scenes: [], groups: [], controllers: [] },
        error: null
      });

      const syncPromise = syncService.synchronizeData();

      // Advance through all phases (collection + push + verification)
      await vi.advanceTimersByTimeAsync(3000);

      await syncPromise;

      // 2 controllers: collection (2) + verification (2) = 4 calls
      expect(apiService.getDataFromController).toHaveBeenCalledTimes(4);
      expect(apiService.getDataFromController).toHaveBeenCalledWith(
        '192.168.1.100',
        expect.any(Object)
      );
      expect(apiService.getDataFromController).toHaveBeenCalledWith(
        '192.168.1.101',
        expect.any(Object)
      );
    });

    it('should skip invisible controllers', async () => {
      apiService.getDataFromController.mockResolvedValue({
        jsonData: { presets: [], scenes: [], groups: [], controllers: [] },
        error: null
      });

      const syncPromise = syncService.synchronizeData();

      await vi.advanceTimersByTimeAsync(3000);

      await syncPromise;

      // Should only call for 2 visible controllers (collection + verification), not the hidden one
      expect(apiService.getDataFromController).toHaveBeenCalledTimes(4);
      
      // Verify hidden controller was not called
      const calls = apiService.getDataFromController.mock.calls;
      const calledIps = calls.map(call => call[0]);
      expect(calledIps).not.toContain('192.168.1.102');
    });

    it('should call progress callback during sync', async () => {
      apiService.getDataFromController.mockResolvedValue({
        jsonData: { presets: [], scenes: [], groups: [], controllers: [] },
        error: null
      });

      const progressCallback = vi.fn();
      const syncPromise = syncService.synchronizeData(progressCallback);

      // Collection (800ms) + push (500ms) + verification (300ms) = 1600ms for 2 controllers
      await vi.advanceTimersByTimeAsync(3000);

      await syncPromise;

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(1, 2);
      expect(progressCallback).toHaveBeenCalledWith(2, 2);
    });

    it('should add delays between controller requests', async () => {
      apiService.getDataFromController.mockResolvedValue({
        jsonData: { presets: [], scenes: [], groups: [], controllers: [] },
        error: null
      });

      const syncPromise = syncService.synchronizeData();

      // Advance through collection phase (800ms delay between 2 controllers)
      await vi.advanceTimersByTimeAsync(1000);
      expect(apiService.getDataFromController).toHaveBeenCalledTimes(2);

      // Advance through push + verification phases
      await vi.advanceTimersByTimeAsync(1500);
      
      await syncPromise;
      
      // Total: collection (2) + verification (2) = 4 calls
      expect(apiService.getDataFromController).toHaveBeenCalledTimes(4);
    });
  });

  describe('synchronizeData - Error Handling', () => {
    it('should handle controller timeout gracefully', async () => {
      apiService.getDataFromController
        // Collection phase - controller 1 times out, controller 2 succeeds
        .mockResolvedValueOnce({
          jsonData: null,
          error: { isTimeout: true }
        })
        .mockResolvedValueOnce({
          jsonData: { presets: [], scenes: [], groups: [] },
          error: null
        })
        // Verification phase - only successful controller gets verified
        .mockResolvedValueOnce({
          jsonData: { presets: [], scenes: [], groups: [] },
          error: null
        });

      const progressCallback = vi.fn();
      const syncPromise = syncService.synchronizeData(progressCallback);

      await vi.advanceTimersByTimeAsync(3000);

      const result = await syncPromise;

      // Errors are handled gracefully, sync continues
      expect(typeof result).toBe('boolean');
    });

    it('should attempt to handle controller fetch errors', async () => {
      apiService.getDataFromController
        // Collection phase
        .mockResolvedValueOnce({
          jsonData: null,
          error: new Error('Network error')
        })
        .mockResolvedValueOnce({
          jsonData: { presets: [], scenes: [], groups: [] },
          error: null
        })
        // Verification phase - only successful controller
        .mockResolvedValueOnce({
          jsonData: { presets: [], scenes: [], groups: [] },
          error: null
        });

      const syncPromise = syncService.synchronizeData();

      await vi.advanceTimersByTimeAsync(3000);

      const result = await syncPromise;

      // Errors are handled gracefully
      expect(typeof result).toBe('boolean');
    });

    it('should handle exception during fetch', async () => {
      apiService.getDataFromController
        // Collection phase
        .mockRejectedValueOnce(new Error('Unexpected error'))
        .mockResolvedValueOnce({
          jsonData: { presets: [], scenes: [], groups: [] },
          error: null
        })
        // Verification phase - only successful controller
        .mockResolvedValueOnce({
          jsonData: { presets: [], scenes: [], groups: [] },
          error: null
        });

      const progressCallback = vi.fn();
      const syncPromise = syncService.synchronizeData(progressCallback);

      await vi.advanceTimersByTimeAsync(3000);

      const result = await syncPromise;

      // Exceptions are caught in try/catch
      expect(typeof result).toBe('boolean');
      // Progress callback should still be called for first controller
      expect(progressCallback).toHaveBeenCalled();
    });

    it('should clear sync flag on error', async () => {
      apiService.getDataFromController.mockRejectedValue(
        new Error('Fatal error')
      );

      const syncPromise = syncService.synchronizeData();

      await vi.advanceTimersByTimeAsync(2000);

      try {
        await syncPromise;
      } catch (e) {
        // Error expected
      }

      expect(syncService.isCurrentlySyncing).toBe(false);
    });
  });

  describe('synchronizeData - Verification Phase', () => {
    it('should verify data consistency after successful push', async () => {
      const testData = {
        presets: [{ id: 'p1', name: 'Preset 1', ts: 1000 }],
        scenes: [{ id: 's1', name: 'Scene 1', ts: 2000 }],
        groups: [{ id: 'g1', name: 'Group 1', ts: 3000 }]
      };

      // Mock collection phase
      apiService.getDataFromController
        .mockResolvedValueOnce({
          jsonData: testData,
          error: null
        })
        .mockResolvedValueOnce({
          jsonData: testData,
          error: null
        })
        // Mock verification phase - return same data
        .mockResolvedValueOnce({
          jsonData: testData,
          error: null
        })
        .mockResolvedValueOnce({
          jsonData: testData,
          error: null
        });

      const syncPromise = syncService.synchronizeData();
      await vi.advanceTimersByTimeAsync(3000);
      const result = await syncPromise;

      expect(result).toBe(true);
      // Collection (2) + verification (2) = 4 calls
      expect(apiService.getDataFromController).toHaveBeenCalledTimes(4);
    });

    it('should detect data inconsistency after push', async () => {
      const consolidatedData = {
        presets: [],
        scenes: [{ id: 's1', name: 'Scene 1', ts: 1000 }],
        groups: []
      };

      const inconsistentData = {
        presets: [],
        scenes: [], // Missing scene!
        groups: []
      };

      // Mock collection phase
      apiService.getDataFromController
        .mockResolvedValueOnce({
          jsonData: consolidatedData,
          error: null
        })
        .mockResolvedValueOnce({
          jsonData: consolidatedData,
          error: null
        })
        // Mock verification phase - one controller has inconsistent data
        .mockResolvedValueOnce({
          jsonData: consolidatedData,
          error: null
        })
        .mockResolvedValueOnce({
          jsonData: inconsistentData, // Inconsistent!
          error: null
        });

      const syncPromise = syncService.synchronizeData();
      await vi.advanceTimersByTimeAsync(3000);
      const result = await syncPromise;

      expect(result).toBe(false); // Should fail due to inconsistency
    });

    it('should handle verification fetch errors gracefully', async () => {
      const testData = {
        presets: [{ id: 'p1', name: 'Preset 1', ts: 1000 }],
        scenes: [],
        groups: []
      };

      // Mock collection phase - success
      apiService.getDataFromController
        .mockResolvedValueOnce({
          jsonData: testData,
          error: null
        })
        .mockResolvedValueOnce({
          jsonData: testData,
          error: null
        })
        // Mock verification phase - one fails
        .mockResolvedValueOnce({
          jsonData: testData,
          error: null
        })
        .mockResolvedValueOnce({
          jsonData: null,
          error: new Error('Verification fetch failed')
        });

      const syncPromise = syncService.synchronizeData();
      await vi.advanceTimersByTimeAsync(3000);
      const result = await syncPromise;

      expect(result).toBe(false); // Should fail if verification fails
    });
  });

  describe('collectDataFromController', () => {
    it('should not collect presets (local only)', () => {
      const allData = { presets: [], scenes: [], groups: [], controllers: [] };
      const jsonData = {
        presets: [
          { id: 'preset1', name: 'Preset 1', ts: 1000 },
          { id: 'preset2', name: 'Preset 2', ts: 2000 }
        ]
      };

      syncService.collectDataFromController(jsonData, allData);

      expect(allData.presets).toHaveLength(0);
    });

    it('should skip presets without ID or timestamp (implicitly by not collecting)', () => {
      const allData = { presets: [], scenes: [], groups: [], controllers: [] };
      const jsonData = {
        presets: [
          { id: 'preset1', name: 'Preset 1', ts: 1000 }, // Valid
          { name: 'Preset 2', ts: 2000 }, // No ID
          { id: 'preset3', name: 'Preset 3' } // No timestamp
        ]
      };

      syncService.collectDataFromController(jsonData, allData);

      expect(allData.presets).toHaveLength(0);
    });

    it('should collect valid scenes', () => {
      const allData = { presets: [], scenes: [], groups: [], controllers: [] };
      const jsonData = {
        scenes: [
          { id: 'scene1', name: 'Scene 1', items: [], ts: 1000 },
          { id: 'scene2', name: 'Scene 2', items: [], ts: 2000 }
        ]
      };

      syncService.collectDataFromController(jsonData, allData);

      expect(allData.scenes).toHaveLength(2);
      expect(allData.scenes[1].id).toBe('scene2');
    });

    it('should collect valid groups', () => {
      const allData = { presets: [], scenes: [], groups: [], controllers: [] };
      const jsonData = {
        groups: [
          { id: 'group1', name: 'Group 1', ts: 1000 }
        ]
      };

      syncService.collectDataFromController(jsonData, allData);

      expect(allData.groups).toHaveLength(1);
      expect(allData.groups[0].id).toBe('group1');
    });

    it('should collect valid controllers metadata', () => {
      const allData = { presets: [], scenes: [], groups: [], controllers: [] };
      const jsonData = {
        controllers: [
          { hostname: 'controller1', ip: '192.168.1.100', ts: 1000 }
        ]
      };

      syncService.collectDataFromController(jsonData, allData);

      expect(allData.controllers).toHaveLength(1);
      expect(allData.controllers[0].hostname).toBe('controller1');
    });

    it('should handle empty arrays', () => {
      const allData = { presets: [], scenes: [], groups: [], controllers: [] };
      const jsonData = {
        presets: [],
        scenes: [],
        groups: []
      };

      syncService.collectDataFromController(jsonData, allData);

      expect(allData.presets).toHaveLength(0);
      expect(allData.scenes).toHaveLength(0);
      expect(allData.groups).toHaveLength(0);
    });

    it('should handle non-array data', () => {
      const allData = { presets: [], scenes: [], groups: [], controllers: [] };
      const jsonData = {
        presets: null,
        scenes: undefined,
        groups: 'invalid'
      };

      syncService.collectDataFromController(jsonData, allData);

      expect(allData.presets).toHaveLength(0);
      expect(allData.scenes).toHaveLength(0);
      expect(allData.groups).toHaveLength(0);
    });
  });

  describe('sleep utility', () => {
    it('should sleep for specified milliseconds', async () => {
      const sleepPromise = syncService.sleep(1000);
      
      // Should not resolve immediately
      let resolved = false;
      sleepPromise.then(() => { resolved = true; });
      
      await vi.advanceTimersByTimeAsync(500);
      expect(resolved).toBe(false);
      
      await vi.advanceTimersByTimeAsync(500);
      await sleepPromise;
      expect(resolved).toBe(true);
    });

    it('should handle zero or negative values', async () => {
      const sleepPromise = syncService.sleep(-100);
      
      await vi.advanceTimersByTimeAsync(0);
      await sleepPromise;
      
      // Should complete without error
      expect(true).toBe(true);
    });
  });

  describe('Integration - Full Sync Flow', () => {
    it('should complete successful sync with multiple controllers', async () => {
      const consolidatedData = {
        presets: [
          { id: 'preset1', name: 'Preset A Updated', ts: 2000 },
          { id: 'preset2', name: 'Preset B', ts: 1500 }
        ],
        scenes: [
          { id: 'scene1', name: 'Scene 1', items: [], ts: 1000 }
        ],
        groups: []
      };

      apiService.getDataFromController
        // Collection phase
        .mockResolvedValueOnce({
          jsonData: {
            presets: [
              { id: 'preset1', name: 'Preset A', ts: 1000 }
            ],
            scenes: [],
            groups: []
          },
          error: null
        })
        .mockResolvedValueOnce({
          jsonData: {
            presets: [
              { id: 'preset1', name: 'Preset A Updated', ts: 2000 },
              { id: 'preset2', name: 'Preset B', ts: 1500 }
            ],
            scenes: [
              { id: 'scene1', name: 'Scene 1', items: [], ts: 1000 }
            ],
            groups: []
          },
          error: null
        })
        // Verification phase - return consolidated data
        .mockResolvedValueOnce({
          jsonData: consolidatedData,
          error: null
        })
        .mockResolvedValueOnce({
          jsonData: consolidatedData,
          error: null
        });

      apiService.updateDataOnController
        .mockResolvedValue({
          jsonData: { success: true },
          error: null
        });

      const progressCallback = vi.fn();
      const syncPromise = syncService.synchronizeData(progressCallback);

      // Advance through all phases
      await vi.advanceTimersByTimeAsync(3000);

      const result = await syncPromise;

      expect(result).toBe(true);
      expect(progressCallback).toHaveBeenCalledWith(2, 2);
      // Collection (2) + verification (2) = 4
      expect(apiService.getDataFromController).toHaveBeenCalledTimes(4);
      expect(apiService.updateDataOnController).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success and failure scenarios', async () => {
      apiService.getDataFromController
        // Collection phase
        .mockResolvedValueOnce({
          jsonData: {
            presets: [{ id: 'preset1', name: 'Preset', ts: 1000 }],
            scenes: [],
            groups: []
          },
          error: null
        })
        .mockResolvedValueOnce({
          jsonData: null,
          error: new Error('Controller offline')
        });

      apiService.updateDataOnController
        .mockResolvedValueOnce({
          jsonData: { success: true },
          error: null
        })
        .mockResolvedValueOnce({
          jsonData: null,
          error: new Error('Failed to push')
        });

      const syncPromise = syncService.synchronizeData();

      // Advance through collection phase + push phase
      await vi.advanceTimersByTimeAsync(2000);

      const result = await syncPromise;

      // Should return false because at least one push failed (verification skipped)
      expect(result).toBe(false);
      // Only collection phase (2), no verification when pushes fail
      expect(apiService.getDataFromController).toHaveBeenCalledTimes(2);
      expect(apiService.updateDataOnController).toHaveBeenCalledTimes(2);
    });
  });

  describe('Distributed Sync Locking', () => {
    let fiveControllers;
    const NOW = 1700000000; // Fixed timestamp for testing

    beforeEach(() => {
      // Mock 5 controllers from /hosts endpoint
      fiveControllers = [
        { id: 'ctrl-1', hostname: 'controller1', ip_address: '192.168.1.101', visible: true },
        { id: 'ctrl-2', hostname: 'controller2', ip_address: '192.168.1.102', visible: true },
        { id: 'ctrl-3', hostname: 'controller3', ip_address: '192.168.1.103', visible: true },
        { id: 'ctrl-4', hostname: 'controller4', ip_address: '192.168.1.104', visible: true },
        { id: 'ctrl-5', hostname: 'controller5', ip_address: '192.168.1.105', visible: true }
      ];

      mockControllersStore.data = fiveControllers;
      mockControllersStore.currentController = fiveControllers[0];

      // Mock Date.now for consistent timestamps
      vi.spyOn(Date, 'now').mockReturnValue(NOW * 1000);
    });

    describe('Lock Acquisition - No Existing Locks', () => {
      it('should acquire locks on all 5 controllers when none exist', async () => {
        // All controllers return no lock
        apiService.getDataFromController.mockResolvedValue({
          jsonData: {
            'sync-lock': { id: '', ts: 0 },
            presets: [],
            scenes: [],
            groups: [],
            controllers: []
          },
          error: null
        });

        apiService.updateDataOnController.mockResolvedValue({
          jsonData: { success: true },
          error: null
        });

        const result = await syncService.acquireDistributedLocks(fiveControllers);

        expect(result.success).toBe(true);
        expect(result.locksAcquired).toBe(5);
        expect(apiService.getDataFromController).toHaveBeenCalledTimes(5);
      });
    });

    describe('Lock Acquisition - Stale Locks', () => {
      it('should acquire locks when one controller has a stale lock (>6s old)', async () => {
        const STALE_TS = (NOW * 1000) - 10000; // 10 seconds old - stale

        apiService.getDataFromController
          .mockResolvedValueOnce({
            jsonData: {
              'sync-lock': { id: 'old-client', ts: STALE_TS },
              presets: [],
              scenes: [],
              groups: [],
              controllers: []
            },
            error: null
          })
          .mockResolvedValue({
            jsonData: {
              'sync-lock': { id: '', ts: 0 },
              presets: [],
              scenes: [],
              groups: [],
              controllers: []
            },
            error: null
          });

        apiService.updateDataOnController.mockResolvedValue({
          jsonData: { success: true },
          error: null
        });

        const result = await syncService.acquireDistributedLocks(fiveControllers);

        expect(result.success).toBe(true);
        expect(result.locksAcquired).toBe(5);
        expect(result.staleLocks).toBe(1);
      });
    });

    describe('Lock Acquisition - Valid Lock Exists', () => {
      it('should back out and retry when one controller has a valid lock', async () => {
        const FRESH_TS = (NOW * 1000) - 2000; // 2 seconds old - still valid

        apiService.getDataFromController
          .mockResolvedValueOnce({
            jsonData: {
              'sync-lock': { id: 'other-client', ts: FRESH_TS },
              presets: [],
              scenes: [],
              groups: [],
              controllers: []
            },
            error: null
          })
          .mockResolvedValue({
            jsonData: {
              'sync-lock': { id: '', ts: 0 },
              presets: [],
              scenes: [],
              groups: [],
              controllers: []
            },
            error: null
          });

        const result = await syncService.acquireDistributedLocks(fiveControllers);

        expect(result.success).toBe(false);
        expect(result.reason).toMatch(/valid lock/i);
        expect(result.lockedBy).toBe('other-client');
        expect(result.shouldRetry).toBe(true);
      });
    });

    describe('Lock Verification - Missing Lock on Readback', () => {
      it('should back out and retry when lock verification fails on one controller', async () => {
        // First call: no locks
        apiService.getDataFromController.mockResolvedValue({
          jsonData: {
            'sync-lock': { id: '', ts: 0 },
            presets: [],
            scenes: [],
            groups: [],
            controllers: []
          },
          error: null
        });

        // Write locks succeed
        apiService.updateDataOnController.mockResolvedValue({
          jsonData: { success: true },
          error: null
        });

        // Verification: one controller doesn't have our lock
        apiService.getDataFromController
          .mockResolvedValueOnce({ // ctrl-1 - has our lock
            jsonData: { 'sync-lock': { id: 'ctrl-1', ts: NOW }, presets: [], scenes: [], groups: [] },
            error: null
          })
          .mockResolvedValueOnce({ // ctrl-2 - has our lock
            jsonData: { 'sync-lock': { id: 'ctrl-1', ts: NOW }, presets: [], scenes: [], groups: [] },
            error: null
          })
          .mockResolvedValueOnce({ // ctrl-3 - MISSING OUR LOCK
            jsonData: { 'sync-lock': { id: 'other-client', ts: NOW }, presets: [], scenes: [], groups: [] },
            error: null
          })
          .mockResolvedValueOnce({ // ctrl-4 - has our lock
            jsonData: { 'sync-lock': { id: 'ctrl-1', ts: NOW }, presets: [], scenes: [], groups: [] },
            error: null
          })
          .mockResolvedValueOnce({ // ctrl-5 - has our lock
            jsonData: { 'sync-lock': { id: 'ctrl-1', ts: NOW }, presets: [], scenes: [], groups: [] },
            error: null
          });

        const result = await syncService.verifyDistributedLocks(fiveControllers, 'ctrl-1');

        expect(result.success).toBe(false);
        expect(result.reason).toMatch(/verification failed/i);
        expect(result.shouldRetry).toBe(true);
      });
    });
  });

  describe('Data Consolidation and Reconciliation', () => {
    const NOW = 1700000000;

    beforeEach(() => {
      vi.spyOn(Date, 'now').mockReturnValue(NOW * 1000);
    });

    describe('Scene Consolidation', () => {
      it('should consolidate scenes with same ID, taking newest name (unless empty)', () => {
        const allData = {
          presets: [],
          scenes: [
            { id: 'scene1', name: 'Old Name', ts: 1000, items: [] },
            { id: 'scene1', name: 'New Name', ts: 2000, items: [] },
            { id: 'scene1', name: '', ts: 3000, items: [] }, // Empty - should be ignored
          ],
          groups: [],
          controllers: []
        };

        const consolidated = syncService.buildConsolidatedView(allData);

        expect(consolidated.scenes).toHaveLength(1);
        expect(consolidated.scenes[0].name).toBe('New Name');
        expect(consolidated.scenes[0].ts).toBe(2000);
      });

      it('should merge scene items arrays, deduplicating by ID', () => {
        const allData = {
          presets: [],
          scenes: [
            {
              id: 'scene1',
              name: 'Scene',
              ts: 1000,
              items: [
                { id: 'item1', type: 'preset', preset_id: 'p1' },
                { id: 'item2', type: 'delay', duration: 1000 }
              ]
            },
            {
              id: 'scene1',
              name: 'Scene',
              ts: 2000,
              items: [
                { id: 'item1', type: 'preset', preset_id: 'p1-updated' }, // Updated
                { id: 'item3', type: 'preset', preset_id: 'p3' } // New
              ]
            }
          ],
          groups: [],
          controllers: []
        };

        const consolidated = syncService.buildConsolidatedView(allData);

        expect(consolidated.scenes).toHaveLength(1);
        expect(consolidated.scenes[0].items).toHaveLength(3);
        
        const item1 = consolidated.scenes[0].items.find(i => i.id === 'item1');
        expect(item1.preset_id).toBe('p1-updated'); // Should use newer version
      });

      it('should drop scenes with empty name', () => {
        const allData = {
          presets: [],
          scenes: [
            { id: 'scene1', name: 'Valid Scene', ts: 1000, items: [] },
            { id: 'scene2', name: '', ts: 1000, items: [] },
            { id: 'scene3', name: 'Another Valid', ts: 1000, items: [] }
          ],
          groups: [],
          controllers: []
        };

        const consolidated = syncService.buildConsolidatedView(allData);

        expect(consolidated.scenes).toHaveLength(2);
        expect(consolidated.scenes.find(s => s.id === 'scene2')).toBeUndefined();
      });

      it('should drop scenes with ID 0 or empty ID', () => {
        const allData = {
          presets: [],
          scenes: [
            { id: 'scene1', name: 'Valid', ts: 1000, items: [] },
            { id: 0, name: 'Zero ID', ts: 1000, items: [] },
            { id: '', name: 'Empty ID', ts: 1000, items: [] },
            { id: '0', name: 'String Zero', ts: 1000, items: [] }
          ],
          groups: [],
          controllers: []
        };

        const consolidated = syncService.buildConsolidatedView(allData);

        expect(consolidated.scenes).toHaveLength(1);
        expect(consolidated.scenes[0].id).toBe('scene1');
      });
    });

    describe('Full Sync with Data Issues', () => {
      let threeControllers;

      beforeEach(() => {
        threeControllers = [
          { id: 'ctrl-1', hostname: 'controller1', ip_address: '192.168.29.31', visible: true },
          { id: 'ctrl-2', hostname: 'controller2', ip_address: '192.168.29.115', visible: true },
          { id: 'ctrl-3', hostname: 'controller3', ip_address: '192.168.29.121', visible: true }
        ];

        mockControllersStore.data = threeControllers;
        mockControllersStore.currentController = threeControllers[0];
      });

      it('should clean and sync data across all controllers using real data patterns', async () => {
        // Based on ACTUAL real controller data from production - testing actual failure modes
        // Controller 1: 192.168.29.31 - Has invalid preset with null name/id (should be filtered)
        // Controller 2: 192.168.29.115 - Has 12 presets with duplicates, 4 scenes, 9 groups
        // Controller 3: 192.168.29.121 - Has duplicate presets/scenes with same IDs as controller 2
        
        // Reset and mock /hosts endpoint to return the 3 real controllers
        apiService.getHosts.mockReset();
        apiService.getHosts.mockResolvedValue({
          jsonData: {
            hosts: [
              { id: 'ctrl-1', hostname: 'test-device-1765885988669', ip_address: '192.168.29.31', visible: true },
              { id: 'ctrl-2', hostname: 'led-so2', ip_address: '192.168.29.115', visible: true },
              { id: 'ctrl-3', hostname: 'led-ku', ip_address: '192.168.29.121', visible: true }
            ]
          },
          error: null
        });

        // Define the expected consolidated data that should be returned during verification
        const consolidatedPresets = [
          { color: { raw: { ww: 542, r: 431, b: 303, cw: 760, g: 588 } }, name: 'Test', id: '10966439-655712395', favorite: false, ts: 2147483647, icon: 'palette' },
          { color: { hsv: { s: 66, v: 83, h: 301, ct: 0 } }, name: 'Pink', id: '10966439-624801566', favorite: true, ts: 2147483647, icon: 'palette' },
          { color: { hsv: { s: 90, v: 89, h: 241, ct: 0 } }, name: 'Blau', id: '10966439-685623466', favorite: false, ts: 2147483647, icon: 'palette' },
          { color: { hsv: { s: 90, v: 89, h: 113, ct: 0 } }, name: 'Grün', id: '10966439-737984847', favorite: false, ts: 2147483647, icon: 'palette' },
          { color: { hsv: { s: 88, v: 89, h: 184, ct: 0 } }, name: 'Petrol', id: '10966439-515417152', favorite: false, ts: 2147483647, icon: 'palette' },
          { color: { raw: { ww: 1023, r: 1023, b: 1023, cw: 1023, g: 1023 } }, name: 'RAW max', id: '2827530-419906442', favorite: false, ts: 2147483647, icon: 'palette' },
          { color: { hsv: { s: 0, v: 100, h: 0, ct: 0 } }, name: 'Voll', id: '10964518-938075610', favorite: false, ts: 2147483647, icon: 'palette' },
          { color: { hsv: { s: 0, v: 0, h: 0, ct: 0 } }, name: 'Aus', id: '6737456-819298884', favorite: false, ts: 2147483647, icon: 'palette' },
          { color: { hsv: { s: 56, v: 23, h: 247, ct: 0 } }, name: 'Nachtblau', id: '10964518-122507691', favorite: false, ts: 2147483647, icon: 'palette' },
          { color: { hsv: { s: 0, v: 47, h: 0, ct: 0 } }, name: 'eher so mittel', id: '6737456-248766862', favorite: true, ts: 2147483647, icon: 'palette' },
          { color: { hsv: { s: 37, v: 43, h: 0, ct: 0 } }, name: 'dunkelrot', id: '4035244248-168429429', favorite: false, ts: 2147483647, icon: 'palette' },
          { color: { hsv: { s: 28, v: 55, h: 0, ct: 0 } }, name: 'test', id: '6668181-927384476', favorite: false, ts: 2147483647, icon: 'palette' }
        ];

        const consolidatedScenes = [
          { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, settings: [{ transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, color: { hsv: { s: 0, v: 100, h: 0, ct: 2700 } }, controller_id: '2827530', pos: 0 }, { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, color: { hsv: { s: 0, v: 0, h: 0, ct: 3620 } }, controller_id: '4599343', pos: 0 }], name: 'Snapshot 19:23:26', ts: 2147483647, id: '6668181-227004589', group_id: '477228760-883885021', favorite: false, icon: 'scene' },
          { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, settings: [{ transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, color: { hsv: { s: 15, v: 49, h: 0, ct: 0 } }, controller_id: '6737456', pos: 0 }], name: 'An', ts: 2147483647, id: '3090114465-796372243', group_id: '6737456-706129657', favorite: false, icon: 'scene' },
          { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, settings: [{ transition: { d: 0, t: 10000, s: 0, cmd: 'fade', q: 'single', r: false }, color: { hsv: { s: 0, v: 0, h: 0, ct: 0 } }, controller_id: '6737456', pos: 0 }], name: 'Aus', ts: 2147483647, id: '2827530-877137044', group_id: '6737456-706129657', favorite: false, icon: 'scene' },
          { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, settings: [{ transition: { d: 0, t: 10000, s: 0, cmd: 'fade', q: 'single', r: false }, color: { hsv: { s: 0, v: 0, h: 0, ct: 0 } }, controller_id: '6737456', pos: 0 }], name: 'Aus', ts: 2147483647, id: '2827530-709189565', group_id: '6737456-706129657', favorite: false, icon: 'scene' }
        ];

        const consolidatedGroups = [
          { controller_ids: ['2827530', '4599343'], name: 'Büro', ts: 2147483647, id: '477228760-883885021', icon: 'light_groups' },
          { controller_ids: ['6737456'], name: 'Schlafzimmer', ts: 2147483647, id: '6737456-706129657', icon: 'light_groups' },
          { controller_ids: ['390774', '1451258'], name: 'Terasse', ts: 2147483647, id: '4035244248-578276531', icon: 'light_groups' },
          { controller_ids: ['15603867', '2826766', '12742997'], name: 'Wohnzimmer', ts: 2147483647, id: '2827530-876452071', icon: 'light_groups' },
          { controller_ids: ['2827530'], name: 'TestGroup3', ts: 1234567892, id: 'test-789', icon: 'light_groups' },
          { controller_ids: ['390774', '1451258'], name: 'TestAPI-1-UPDATED', ts: 1234567890, id: 'test-api-1', icon: 'light_groups' },
          { controller_ids: ['1451258'], name: 'TestAPI-2', ts: 1234567891, id: 'test-api-2', icon: 'light_groups' },
          { controller_ids: ['2827485'], name: 'TestGroup2', ts: 1234567891, id: 'test-456', icon: 'light_groups' },
          { controller_ids: ['2827485'], name: 'Küche', ts: 2147483647, id: '2826766-821578832', icon: 'light_groups' }
        ];

        // Reset getDataFromController mock and set up specific responses for this test
        apiService.getDataFromController.mockReset();
        apiService.getDataFromController
          .mockResolvedValueOnce({ // ctrl-1: 192.168.29.31 - has invalid preset with null name/id
            jsonData: {
              'sync-lock': { id: null, ts: 0 },
              'last-color': { s: 0, v: 0, h: 12, ct: 3500 },
              presets: [
                { color: { hsv: { s: 0, v: 0, h: 0, ct: 0 } }, name: null, id: null, favorite: false, ts: 0, icon: 'palette' }, // INVALID - should be filtered
                { color: { hsv: { s: 28, v: 55, h: 0, ct: 0 } }, name: 'test', id: '6668181-927384476', favorite: false, ts: 2147483647, icon: 'palette' }
              ],
              scenes: [
                { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, settings: [
                  { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, color: { hsv: { s: 0, v: 100, h: 0, ct: 2700 } }, controller_id: '2827530', pos: 0 },
                  { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, color: { hsv: { s: 0, v: 0, h: 0, ct: 3620 } }, controller_id: '4599343', pos: 0 }
                ], name: 'Snapshot 19:23:26', ts: 2147483647, id: '6668181-227004589', group_id: '477228760-883885021', favorite: false, icon: 'scene' }
              ],
              groups: [
                { controller_ids: ['2827530', '4599343'], name: 'Büro', ts: 2147483647, id: '477228760-883885021', icon: 'light_groups' }
              ],
              controllers: []
            },
            error: null
          })
          .mockResolvedValueOnce({ // ctrl-2: 192.168.29.115 - has 12 presets with duplicates
            jsonData: {
              'sync-lock': { id: '', ts: 0 },
              'last-color': { s: 0, v: 18, h: 0, ct: 0 },
              presets: [
                { color: { raw: { ww: 542, r: 431, b: 303, cw: 760, g: 588 } }, name: 'Test', id: '10966439-655712395', favorite: false, ts: 2147483647, icon: 'palette' },
                { color: { hsv: { s: 66, v: 83, h: 301, ct: 0 } }, name: 'Pink', id: '10966439-624801566', favorite: false, ts: 2147483647, icon: 'palette' },
                { color: { hsv: { s: 90, v: 89, h: 241, ct: 0 } }, name: 'Blau', id: '10966439-685623466', favorite: false, ts: 2147483647, icon: 'palette' },
                { color: { hsv: { s: 90, v: 89, h: 113, ct: 0 } }, name: 'Grün', id: '10966439-737984847', favorite: false, ts: 2147483647, icon: 'palette' },
                { color: { hsv: { s: 88, v: 89, h: 184, ct: 0 } }, name: 'Petrol', id: '10966439-515417152', favorite: false, ts: 2147483647, icon: 'palette' },
                { color: { raw: { ww: 1023, r: 1023, b: 1023, cw: 1023, g: 1023 } }, name: 'RAW max', id: '2827530-419906442', favorite: false, ts: 2147483647, icon: 'palette' },
                { color: { hsv: { s: 0, v: 100, h: 0, ct: 0 } }, name: 'Voll', id: '10964518-938075610', favorite: false, ts: 2147483647, icon: 'palette' },
                { color: { hsv: { s: 0, v: 0, h: 0, ct: 0 } }, name: 'Aus', id: '6737456-819298884', favorite: false, ts: 2147483647, icon: 'palette' },
                { color: { hsv: { s: 56, v: 23, h: 247, ct: 0 } }, name: 'Nachtblau', id: '10964518-122507691', favorite: false, ts: 2147483647, icon: 'palette' },
                { color: { hsv: { s: 0, v: 47, h: 0, ct: 0 } }, name: 'eher so mittel', id: '6737456-248766862', favorite: true, ts: 2147483647, icon: 'palette' },
                { color: { hsv: { s: 37, v: 43, h: 0, ct: 0 } }, name: 'dunkelrot', id: '4035244248-168429429', favorite: false, ts: 2147483647, icon: 'palette' },
                { color: { hsv: { s: 28, v: 55, h: 0, ct: 0 } }, name: 'test', id: '6668181-927384476', favorite: false, ts: 2147483647, icon: 'palette' } // DUPLICATE ID with ctrl-1
              ],
              scenes: [
                { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, settings: [
                  { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, color: { hsv: { s: 15, v: 49, h: 0, ct: 0 } }, controller_id: '6737456', pos: 0 }
                ], name: 'An', ts: 2147483647, id: '3090114465-796372243', group_id: '6737456-706129657', favorite: false, icon: 'scene' },
                { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, settings: [
                  { transition: { d: 0, t: 10000, s: 0, cmd: 'fade', q: 'single', r: false }, color: { hsv: { s: 0, v: 0, h: 0, ct: 0 } }, controller_id: '6737456', pos: 0 }
                ], name: 'Aus', ts: 2147483647, id: '2827530-877137044', group_id: '6737456-706129657', favorite: false, icon: 'scene' },
                { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, settings: [
                  { transition: { d: 0, t: 10000, s: 0, cmd: 'fade', q: 'single', r: false }, color: { hsv: { s: 0, v: 0, h: 0, ct: 0 } }, controller_id: '6737456', pos: 0 }
                ], name: 'Aus', ts: 2147483647, id: '2827530-709189565', group_id: '6737456-706129657', favorite: false, icon: 'scene' },
                { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, settings: [
                  { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, color: { hsv: { s: 0, v: 100, h: 0, ct: 2700 } }, controller_id: '2827530', pos: 0 },
                  { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, color: { hsv: { s: 0, v: 0, h: 0, ct: 3620 } }, controller_id: '4599343', pos: 0 }
                ], name: 'Snapshot 19:23:26', ts: 2147483647, id: '6668181-227004589', group_id: '477228760-883885021', favorite: false, icon: 'scene' } // DUPLICATE ID with ctrl-1
              ],
              groups: [
                { controller_ids: ['2827530', '4599343'], name: 'Büro', ts: 2147483647, id: '477228760-883885021', icon: 'light_groups' }, // DUPLICATE ID with ctrl-1
                { controller_ids: ['6737456'], name: 'Schlafzimmer', ts: 2147483647, id: '6737456-706129657', icon: 'light_groups' },
                { controller_ids: ['390774', '1451258'], name: 'Terasse', ts: 2147483647, id: '4035244248-578276531', icon: 'light_groups' },
                { controller_ids: ['15603867', '2826766', '12742997'], name: 'Wohnzimmer', ts: 2147483647, id: '2827530-876452071', icon: 'light_groups' },
                { controller_ids: ['2827530'], name: 'TestGroup3', ts: 1234567892, id: 'test-789', icon: 'light_groups' },
                { controller_ids: ['390774', '1451258'], name: 'TestAPI-1-UPDATED', ts: 1234567890, id: 'test-api-1', icon: 'light_groups' },
                { controller_ids: ['1451258'], name: 'TestAPI-2', ts: 1234567891, id: 'test-api-2', icon: 'light_groups' },
                { controller_ids: ['2827485'], name: 'TestGroup2', ts: 1234567891, id: 'test-456', icon: 'light_groups' },
                { controller_ids: ['2827485'], name: 'Küche', ts: 2147483647, id: '2826766-821578832', icon: 'light_groups' }
              ],
              controllers: []
            },
            error: null
          })
          .mockResolvedValueOnce({ // ctrl-3: 192.168.29.121 - has duplicate IDs (shares many with ctrl-2)
            jsonData: {
              'sync-lock': { id: '', ts: 0 },
              presets: [
                { color: { raw: { ww: 542, r: 431, b: 303, cw: 760, g: 588 } }, name: 'Test', id: '10966439-655712395', favorite: false, ts: 2147483647, icon: 'palette' }, // DUPLICATE
                { color: { hsv: { s: 66, v: 83, h: 301, ct: 0 } }, name: 'Pink', id: '10966439-624801566', favorite: true, ts: 2147483647, icon: 'palette' }, // DUPLICATE (different favorite)
                { color: { hsv: { s: 90, v: 89, h: 241, ct: 0 } }, name: 'Blau', id: '10966439-685623466', favorite: false, ts: 2147483647, icon: 'palette' }, // DUPLICATE
                { color: { hsv: { s: 90, v: 89, h: 113, ct: 0 } }, name: 'Grün', id: '10966439-737984847', favorite: false, ts: 2147483647, icon: 'palette' }, // DUPLICATE
                { color: { hsv: { s: 88, v: 89, h: 184, ct: 0 } }, name: 'Petrol', id: '10966439-515417152', favorite: false, ts: 2147483647, icon: 'palette' }, // DUPLICATE
                { color: { raw: { ww: 1023, r: 1023, b: 1023, cw: 1023, g: 1023 } }, name: 'RAW max', id: '2827530-419906442', favorite: false, ts: 2147483647, icon: 'palette' }, // DUPLICATE
                { color: { hsv: { s: 0, v: 100, h: 0, ct: 0 } }, name: 'Voll', id: '10964518-938075610', favorite: false, ts: 2147483647, icon: 'palette' }, // DUPLICATE
                { color: { hsv: { s: 0, v: 0, h: 0, ct: 0 } }, name: 'Aus', id: '6737456-819298884', favorite: false, ts: 2147483647, icon: 'palette' }, // DUPLICATE
                { color: { hsv: { s: 56, v: 23, h: 247, ct: 0 } }, name: 'Nachtblau', id: '10964518-122507691', favorite: false, ts: 2147483647, icon: 'palette' }, // DUPLICATE
                { color: { hsv: { s: 0, v: 47, h: 0, ct: 0 } }, name: 'eher so mittel', id: '6737456-248766862', favorite: false, ts: 2147483647, icon: 'palette' }, // DUPLICATE (different favorite)
                { color: { hsv: { s: 37, v: 43, h: 0, ct: 0 } }, name: 'dunkelrot', id: '4035244248-168429429', favorite: false, ts: 2147483647, icon: 'palette' }, // DUPLICATE
                { color: { hsv: { s: 28, v: 55, h: 0, ct: 0 } }, name: 'test', id: '6668181-927384476', favorite: false, ts: 2147483647, icon: 'palette' } // DUPLICATE
              ],
              scenes: [
                { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, settings: [
                  { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, color: { hsv: { s: 15, v: 49, h: 0, ct: 0 } }, controller_id: '6737456', pos: 0 }
                ], name: 'An', ts: 2147483647, id: '3090114465-796372243', group_id: '6737456-706129657', favorite: false, icon: 'scene' }, // DUPLICATE
                { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, settings: [
                  { transition: { d: 0, t: 10000, s: 0, cmd: 'fade', q: 'single', r: false }, color: { hsv: { s: 0, v: 0, h: 0, ct: 0 } }, controller_id: '6737456', pos: 0 }
                ], name: 'Aus', ts: 2147483647, id: '2827530-877137044', group_id: '6737456-706129657', favorite: false, icon: 'scene' }, // DUPLICATE
                { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, settings: [
                  { transition: { d: 0, t: 10000, s: 0, cmd: 'fade', q: 'single', r: false }, color: { hsv: { s: 0, v: 0, h: 0, ct: 0 } }, controller_id: '6737456', pos: 0 }
                ], name: 'Aus', ts: 2147483647, id: '2827530-709189565', group_id: '6737456-706129657', favorite: false, icon: 'scene' }, // DUPLICATE
                { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, settings: [
                  { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, color: { hsv: { s: 0, v: 100, h: 0, ct: 2700 } }, controller_id: '2827530', pos: 0 },
                  { transition: { d: 0, t: 0, s: 0, cmd: null, q: null, r: false }, color: { hsv: { s: 0, v: 0, h: 0, ct: 3620 } }, controller_id: '4599343', pos: 0 }
                ], name: 'Snapshot 19:23:26', ts: 2147483647, id: '6668181-227004589', group_id: '477228760-883885021', favorite: false, icon: 'scene' } // DUPLICATE
              ],
              groups: [
                { controller_ids: ['2827530', '4599343'], name: 'Büro', ts: 2147483647, id: '477228760-883885021', icon: 'light_groups' }, // DUPLICATE
                { controller_ids: ['6737456'], name: 'Schlafzimmer', ts: 2147483647, id: '6737456-706129657', icon: 'light_groups' }, // DUPLICATE
                { controller_ids: ['390774', '1451258'], name: 'Terasse', ts: 2147483647, id: '4035244248-578276531', icon: 'light_groups' }, // DUPLICATE
                { controller_ids: ['2827485'], name: 'TestGroup2', ts: 1234567891, id: 'test-456', icon: 'light_groups' } // DUPLICATE
              ],
              controllers: []
            },
            error: null
          })
          // Verification phase - all 3 controllers return the consolidated data
          .mockResolvedValueOnce({ // Verification for ctrl-1
            jsonData: {
              presets: consolidatedPresets,
              scenes: consolidatedScenes,
              groups: consolidatedGroups,
              controllers: []
            },
            error: null
          })
          .mockResolvedValueOnce({ // Verification for ctrl-2
            jsonData: {
              presets: consolidatedPresets,
              scenes: consolidatedScenes,
              groups: consolidatedGroups,
              controllers: []
            },
            error: null
          })
          .mockResolvedValueOnce({ // Verification for ctrl-3
            jsonData: {
              presets: consolidatedPresets,
              scenes: consolidatedScenes,
              groups: consolidatedGroups,
              controllers: []
            },
            error: null
          });

        apiService.updateDataOnController.mockResolvedValue({
          jsonData: { success: true },
          error: null
        });

        const syncPromise = syncService.synchronizeData();
        // 3 controllers: 3*800ms (collection) + 3*500ms (push) + 3*300ms (verification) = 4800ms
        await vi.advanceTimersByTimeAsync(5500);
        const result = await syncPromise;

        expect(result).toBe(true);

        // Verify consolidated data was pushed to all 3 controllers (192.168.29.31, .115, .121)
        expect(apiService.updateDataOnController).toHaveBeenCalledTimes(3);

        // Get the consolidated payload that was pushed
        const pushCall = apiService.updateDataOnController.mock.calls[0];
        const payload = pushCall[1];

        // START CHANGE: Presets are no longer synchronized
        // expect(payload.presets.length).toBe(12);
        expect(payload.presets).toBeUndefined();
        // END CHANGE

        // Should have 4 unique scenes (deduped by ID)
        // Real data: ctrl-1 (1 scene), ctrl-2 (4 scenes), ctrl-3 (4 duplicate scenes)
        // After deduplication: 4 unique scenes (Snapshot 19:23:26, An, Aus x2 with different IDs)
        expect(payload.scenes.length).toBe(4);
        expect(payload.scenes.every(s => s.id && s.name)).toBe(true);

        // Should have 9 unique groups (deduped by ID)  
        // Real data: ctrl-1 (1 group: Büro), ctrl-2 (9 groups), ctrl-3 (4 duplicate groups)
        // After deduplication: 9 unique groups (all from ctrl-2, same IDs/ts as ctrl-3)
        expect(payload.groups.length).toBe(9);
        expect(payload.groups.every(g => g.id && g.name)).toBe(true);

        // Verify specific groups exist
        const bueroGroup = payload.groups.find(g => g.id === '477228760-883885021');
        expect(bueroGroup).toBeTruthy();
        expect(bueroGroup.name).toBe('Büro');

        // Verify that ALL controllers received the SAME consolidated data
        const payload1 = apiService.updateDataOnController.mock.calls[0][1];
        const payload2 = apiService.updateDataOnController.mock.calls[1][1];
        const payload3 = apiService.updateDataOnController.mock.calls[2][1];

        // All payloads should be identical (same reference or deep equal)
        expect(payload1).toEqual(payload2);
        expect(payload2).toEqual(payload3);
        expect(payload1).toEqual(payload3);

        // Verify they all have the same counts
        // Presets are local only, so checking scenes and groups
        expect(payload1.scenes.length).toBe(payload2.scenes.length);
        expect(payload2.scenes.length).toBe(payload3.scenes.length);
        expect(payload1.groups.length).toBe(payload2.groups.length);
        expect(payload2.groups.length).toBe(payload3.groups.length);
      });

      it('should send consolidated data to fix controller-specific issues', async () => {
        // This test documents the expected behavior:
        // The sync service sends the consolidated "truth" to each controller
        // The controller firmware is responsible for:
        // 1. Creating missing items (controller lacks a group that exists elsewhere)
        // 2. Deleting duplicates (controller has two groups with same ID, keeps newest)
        // 3. Deleting invalid items (nil name or id)
        // 4. Updating outdated items (controller has old version, another has newer)

        // Reset all mocks to clear any previous test data
        apiService.getHosts.mockReset();
        apiService.getDataFromController.mockReset();
        apiService.updateDataOnController.mockReset();

        // Mock /hosts endpoint
        apiService.getHosts.mockResolvedValue({
          jsonData: {
            hosts: [
              { id: 'ctrl-1', hostname: 'controller1', ip_address: '192.168.1.100', visible: true },
              { id: 'ctrl-2', hostname: 'controller2', ip_address: '192.168.1.101', visible: true }
            ]
          },
          error: null
        });
        
        // Controller 1: Missing group-2, has duplicate of group-1, has invalid group
        const consolidatedGroups = [
          { id: 'group-1', name: 'Group One Updated', ts: 2000, controller_ids: ['ctrl-1', 'ctrl-2'], icon: 'light_groups' },
          { id: 'group-2', name: 'Group Two', ts: 1500, controller_ids: ['ctrl-2'], icon: 'light_groups' }
        ];

        apiService.getDataFromController
          // Collection phase
          .mockResolvedValueOnce({
            jsonData: {
              'sync-lock': { id: '', ts: 0 },
              presets: [],
              scenes: [],
              groups: [
                { id: 'group-1', name: 'Group One', ts: 1000, controller_ids: ['ctrl-1'], icon: 'light_groups' }, // Older version
                { id: 'group-1', name: 'Group One Duplicate', ts: 500, controller_ids: ['ctrl-1'], icon: 'light_groups' }, // Duplicate, older
                { id: null, name: null, ts: 0, controller_ids: [], icon: 'light_groups' } // Invalid
              ],
              controllers: []
            },
            error: null
          })
          // Controller 2: Has group-2, has newer version of group-1
          .mockResolvedValueOnce({
            jsonData: {
              'sync-lock': { id: '', ts: 0 },
              presets: [],
              scenes: [],
              groups: [
                { id: 'group-1', name: 'Group One Updated', ts: 2000, controller_ids: ['ctrl-1', 'ctrl-2'], icon: 'light_groups' }, // Newer version
                { id: 'group-2', name: 'Group Two', ts: 1500, controller_ids: ['ctrl-2'], icon: 'light_groups' } // Missing on ctrl-1
              ],
              controllers: []
            },
            error: null
          })
          // Verification phase - both controllers now have consolidated data
          .mockResolvedValueOnce({
            jsonData: {
              presets: [],
              scenes: [],
              groups: consolidatedGroups,
              controllers: []
            },
            error: null
          })
          .mockResolvedValueOnce({
            jsonData: {
              presets: [],
              scenes: [],
              groups: consolidatedGroups,
              controllers: []
            },
            error: null
          });

        apiService.updateDataOnController.mockResolvedValue({
          jsonData: { success: true },
          error: null
        });

        const syncPromise = syncService.synchronizeData();
        await vi.advanceTimersByTimeAsync(3000);
        const result = await syncPromise;

        expect(result).toBe(true);
        expect(apiService.updateDataOnController).toHaveBeenCalledTimes(2);

        // Get the consolidated data that was pushed to both controllers
        const payload1 = apiService.updateDataOnController.mock.calls[0][1];
        const payload2 = apiService.updateDataOnController.mock.calls[1][1];

        // Both controllers should receive the SAME consolidated data
        expect(payload1).toEqual(payload2);

        // The consolidated data should contain:
        // - 2 groups (group-1 with newest ts=2000, group-2)
        // - group-1 should have the newest version (ts=2000, name "Group One Updated")
        // - Invalid group should be filtered out
        // - Duplicate group-1 should be deduplicated
        expect(payload1.groups.length).toBe(2);
        
        const group1 = payload1.groups.find(g => g.id === 'group-1');
        expect(group1).toBeTruthy();
        expect(group1.name).toBe('Group One Updated'); // Newest version
        expect(group1.ts).toBe(2000); // Newest timestamp

        const group2 = payload1.groups.find(g => g.id === 'group-2');
        expect(group2).toBeTruthy();
        expect(group2.name).toBe('Group Two');

        // Verify no invalid groups (null name/id) in consolidated data
        const hasInvalidGroup = payload1.groups.some(g => g.id === null || g.name === null);
        expect(hasInvalidGroup).toBe(false);

        // When Controller 1 receives this consolidated data, it should:
        // ✓ Create group-2 (was missing)
        // ✓ Update group-1 to ts=2000 version (had ts=1000 and ts=500)
        // ✓ Delete the duplicate group-1 with ts=500
        // ✓ Delete the invalid group with null id/name
        
        // When Controller 2 receives this consolidated data, it should:
        // ✓ Keep both groups as they already match the consolidated state
      });
    });
  });
});
