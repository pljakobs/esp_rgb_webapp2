import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiService } from '../api.js';

// Mock storeConstants before importing (avoids window.location.hostname error)
vi.mock('../../stores/storeConstants.js', () => ({
  requestTimeout: 10000,
  retryDelay: 1000,
  sync_phases: []
}));

// Mock the controllersStore
vi.mock('../../stores/controllersStore.js', () => ({
  useControllersStore: vi.fn()
}));

const { useControllersStore } = await import('../../stores/controllersStore.js');
const { requestTimeout, retryDelay } = await import('../../stores/storeConstants.js');

describe('ApiService', () => {
  let apiService;
  let mockControllersStore;
  let mockFetch;
  let originalFetch;

  beforeEach(() => {
    // Reset timers before each test
    vi.useFakeTimers();

    // Create mock controllers store
    mockControllersStore = {
      currentController: {
        ip_address: '192.168.1.100',
        name: 'Test Controller'
      }
    };
    useControllersStore.mockReturnValue(mockControllersStore);

    // Mock global fetch
    originalFetch = global.fetch;
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Create fresh ApiService instance
    apiService = new ApiService();
  });

  afterEach(() => {
    // Restore real timers
    vi.useRealTimers();
    // Restore original fetch
    global.fetch = originalFetch;
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('Constructor and Store Access', () => {
    it('should initialize with null controllers store', () => {
      expect(apiService._controllersStore).toBeNull();
    });

    it('should lazy-load controllers store on first access', () => {
      expect(apiService._controllersStore).toBeNull();
      const store = apiService.controllersStore;
      expect(store).toBe(mockControllersStore);
      expect(apiService._controllersStore).toBe(mockControllersStore);
    });

    it('should initialize empty request tracking maps', () => {
      expect(apiService._activeRequests).toBeInstanceOf(Map);
      expect(apiService._requestQueue).toBeInstanceOf(Map);
      expect(apiService._activeRequests.size).toBe(0);
      expect(apiService._requestQueue.size).toBe(0);
    });
  });

  describe('fetchApi - Basic Requests', () => {
    it('should make successful GET request to current controller', async () => {
      const mockData = { status: 'ok', data: { value: 42 } };
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => mockData
      });

      const result = await apiService.fetchApi('data');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.100/data',
        expect.objectContaining({
          method: 'GET',
          headers: {},
          signal: expect.any(AbortSignal)
        })
      );
      expect(result).toEqual({
        jsonData: mockData,
        error: null,
        status: 200
      });
    });

    it('should make POST request with JSON body', async () => {
      const requestBody = { scenes: [], groups: [] };
      const mockData = { status: 'ok' };
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => mockData
      });

      const result = await apiService.fetchApi('data', null, {
        method: 'POST',
        body: requestBody
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.100/data',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
      );
      expect(result.jsonData).toEqual(mockData);
    });

    it('should use specified controller instead of current', async () => {
      const specificController = {
        ip_address: '192.168.1.200',
        name: 'Other Controller'
      };
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: 'ok' })
      });

      await apiService.fetchApi('color', specificController);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.200/color',
        expect.any(Object)
      );
    });

    it('should return error when no controller available', async () => {
      mockControllersStore.currentController = null;

      const result = await apiService.fetchApi('data');

      expect(result).toEqual({
        jsonData: null,
        error: { message: 'No controller available' },
        status: null
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should add custom headers to request', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: 'ok' })
      });

      await apiService.fetchApi('data', null, {
        headers: { 'X-Custom-Header': 'test-value' }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { 'X-Custom-Header': 'test-value' }
        })
      );
    });

    it('should split large /data POST payloads into throttled chunks', async () => {
      apiService._chunking.maxPayloadBytes = 220;
      apiService._chunking.interChunkDelayMs = 0;

      const largePayload = {
        scenes: Array.from({ length: 8 }, (_, i) => ({
          id: `scene-${i}`,
          name: `Scene ${i}`,
          ts: Date.now() + i,
          group_id: 'group-1'
        })),
        groups: [
          {
            id: 'group-1',
            name: 'Group 1',
            ts: Date.now(),
            controller_ids: ['1']
          }
        ]
      };

      mockFetch.mockImplementation(async () => ({
        status: 200,
        json: async () => ({ success: true })
      }));

      const result = await apiService.fetchApi('data', null, {
        method: 'POST',
        body: largePayload
      });

      expect(mockFetch.mock.calls.length).toBeGreaterThan(1);

      for (const call of mockFetch.mock.calls) {
        const bodyString = call[1].body;
        expect(typeof bodyString).toBe('string');
        const bodyBytes = new TextEncoder().encode(bodyString).length;
        expect(bodyBytes).toBeLessThanOrEqual(apiService._chunking.maxPayloadBytes);
      }

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
    });

    it('should reject invalid /data payload before sending request', async () => {
      const result = await apiService.updateDataOnController('192.168.1.100', {
        scenes: [
          {
            id: 'scene-1',
            // name missing -> invalid against app-data schema
            ts: Date.now(),
            group_id: 'group-1',
            settings: [],
          },
        ],
      });

      expect(result.status).toBeNull();
      expect(result.error).toBeTruthy();
      expect(result.error.schema).toBe('app-data.cfgdb');
      expect(result.error.message).toContain('app-data.cfgdb');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should reject invalid /config payload before sending request', async () => {
      const result = await apiService.updateConfigOnController('192.168.1.100', {
        network: {
          telemetry: {
            statsEnabled: 'true', // must be boolean
          },
        },
      });

      expect(result.status).toBeNull();
      expect(result.error).toBeTruthy();
      expect(result.error.schema).toBe('app-config.cfgdb');
      expect(result.error.message).toContain('app-config.cfgdb');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('fetchApi - Timeout Handling', () => {
    it('should set up AbortController with timeout', async () => {
      mockFetch.mockImplementationOnce((url, options) => {
        // Verify AbortSignal is passed
        expect(options.signal).toBeInstanceOf(AbortSignal);
        return Promise.resolve({
          status: 200,
          json: async () => ({ status: 'ok' })
        });
      });

      await apiService.fetchApi('data');
      
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should accept custom timeout parameter', async () => {
      const customTimeout = 5000;
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: 'ok' })
      });

      const result = await apiService.fetchApi('data', null, {}, 0, customTimeout);
      
      expect(result.jsonData).toEqual({ status: 'ok' });
    });

    it('should clear timeout on successful response', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: 'ok' })
      });

      await apiService.fetchApi('data');

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('fetchApi - Error Handling', () => {
    it('should handle 404 errors without retry', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Endpoint not found' })
      });

      const result = await apiService.fetchApi('invalid-endpoint');

      expect(result.status).toBe(404);
      expect(result.error).toEqual({ status: 404, statusText: 'Not Found' });
      expect(result.jsonData).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retry
    });

    it('should retry on 429 errors with exponential backoff', async () => {
      mockFetch
        .mockResolvedValueOnce({
          status: 429,
          statusText: 'Too Many Requests',
          json: async () => ({ error: 'Rate limited' })
        })
        .mockResolvedValueOnce({
          status: 429,
          statusText: 'Too Many Requests',
          json: async () => ({ error: 'Rate limited' })
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ status: 'ok' })
        });

      const resultPromise = apiService.fetchApi('data');

      // Fast-forward through retry delays
      await vi.advanceTimersByTimeAsync(retryDelay * 2 ** 0); // First retry
      await vi.advanceTimersByTimeAsync(retryDelay * 2 ** 1); // Second retry
      
      const result = await resultPromise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.jsonData).toEqual({ status: 'ok' });
    });

    it('should retry on network errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ status: 'ok' })
        });

      const resultPromise = apiService.fetchApi('data');

      // Fast-forward through retry delay
      await vi.advanceTimersByTimeAsync(retryDelay);
      
      const result = await resultPromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.jsonData).toEqual({ status: 'ok' });
    });

    it('should stop retrying after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const resultPromise = apiService.fetchApi('data');

      // Fast-forward through all retry delays (10 retries)
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(retryDelay * 2 ** i);
      }
      
      const result = await resultPromise;

      expect(mockFetch).toHaveBeenCalledTimes(11); // Initial + 10 retries
      expect(result.error).toEqual(new Error('Network error'));
    });

    it('should handle JSON parse errors', async () => {
      // Mock multiple retries - all fail with JSON parse error
      for (let i = 0; i < 11; i++) {
        mockFetch.mockResolvedValueOnce({
          status: 200,
          json: async () => {
            throw new Error('Invalid JSON');
          }
        });
      }

      const resultPromise = apiService.fetchApi('data');
      
      // Fast-forward through all retry delays
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(retryDelay * 2 ** i);
      }
      
      const result = await resultPromise;

      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('Invalid JSON');
    }, 15000);
  });

  describe('Request Queueing', () => {
    it('should execute single request immediately', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: 'ok' })
      });

      const result = await apiService.fetchApi('data');

      expect(result.jsonData).toEqual({ status: 'ok' });
      const activeSet = apiService._activeRequests.get('192.168.1.100');
      expect(activeSet.size).toBe(0); // Should be empty after completion
    });

    it('should queue concurrent requests to same controller', async () => {
      let resolveFirst;
      const firstRequest = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      mockFetch
        .mockImplementationOnce(() => firstRequest)
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ request: 2 })
        });

      const promise1 = apiService.fetchApi('data');
      const promise2 = apiService.fetchApi('color');

      // Second request should be queued
      expect(apiService._requestQueue.get('192.168.1.100')).toBeDefined();
      expect(apiService._requestQueue.get('192.168.1.100').length).toBe(1);

      // Resolve first request
      resolveFirst({
        status: 200,
        json: async () => ({ request: 1 })
      });

      await promise1;
      await promise2;

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle requests to different controllers concurrently', async () => {
      const controller1 = { ip_address: '192.168.1.100', name: 'Controller 1' };
      const controller2 = { ip_address: '192.168.1.200', name: 'Controller 2' };

      mockFetch
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ controller: 1 })
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ controller: 2 })
        });

      const [result1, result2] = await Promise.all([
        apiService.fetchApi('data', controller1),
        apiService.fetchApi('data', controller2)
      ]);

      expect(result1.jsonData).toEqual({ controller: 1 });
      expect(result2.jsonData).toEqual({ controller: 2 });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Convenience Methods', () => {
    it('should call fetchApi with correct endpoint for requestToController', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: 'ok' })
      });

      const result = await apiService.requestToController('test-endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.100/test-endpoint',
        expect.any(Object)
      );
      expect(result.jsonData).toEqual({ status: 'ok' });
    });

    it('should call fetchApi for getAppData', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ presets: {}, scenes: {} })
      });

      const result = await apiService.getAppData();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.100/data',
        expect.any(Object)
      );
      expect(result.jsonData).toEqual({ presets: {}, scenes: {} });
    });

    it('should call fetchApi for getColorData', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ color: { hsv: { h: 180, s: 100, v: 75 } } })
      });

      const result = await apiService.getColorData();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.100/color',
        expect.any(Object)
      );
      expect(result.jsonData).toEqual({ color: { hsv: { h: 180, s: 100, v: 75 } } });
    });

    it('should pass controller parameter to convenience methods', async () => {
      const customController = { ip_address: '192.168.1.250', name: 'Custom' };
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: 'ok' })
      });

      await apiService.getAppData(customController);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.250/data',
        expect.any(Object)
      );
    });
  });

  describe('Type Safety - HSV Float vs Integer', () => {
    it('should accept float HSV values for /color endpoint', async () => {
      const colorData = {
        hsv: { h: 180.5, s: 100.0, v: 75.3, ct: 3500 }
      };
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: 'ok' })
      });

      await apiService.fetchApi('color', null, {
        method: 'POST',
        body: colorData
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(colorData)
        })
      );
    });

    it('should handle GET /color response with float HSV values', async () => {
      const mockResponse = {
        color: {
          hsv: { h: 126.98, s: 96.97, v: 75.32, ct: 3500 }
        }
      };
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => mockResponse
      });

      const result = await apiService.fetchApi('color');

      expect(result.jsonData.color.hsv.h).toBeCloseTo(126.98);
      expect(result.jsonData.color.hsv.s).toBeCloseTo(96.97);
      expect(result.jsonData.color.hsv.v).toBeCloseTo(75.32);
    });

    it('should send preset with integer HSV values to /data endpoint', async () => {
      const presetData = {
        'presets[id="test"]': {
          id: 'test',
          name: 'Test Preset',
          color: {
            hsv: { h: 180, s: 100, v: 75, ct: 3500 }
          }
        }
      };
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: 'ok' })
      });

      await apiService.fetchApi('data', null, {
        method: 'POST',
        body: presetData
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody['presets[id="test"]'].color.hsv.h).toBe(180);
      expect(Number.isInteger(sentBody['presets[id="test"]'].color.hsv.h)).toBe(true);
    });

    it('should handle FormatError::BadType when floats sent to /data', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 400,
        json: async () => ({
          error: 'FormatError::BadType: Expected integer, got float'
        })
      });

      const result = await apiService.fetchApi('data', null, {
        method: 'POST',
        body: {
          'presets[id="test"]': {
            color: { hsv: { h: 180.5, s: 100.0, v: 75.3 } }
          }
        }
      });

      expect(result.status).toBe(400);
      expect(result.jsonData.error).toContain('FormatError::BadType');
    });
  });
});
