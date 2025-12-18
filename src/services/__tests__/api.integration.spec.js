/**
 * ESP RGBWW Firmware API Integration Tests
 * 
 * Tests all HTTP endpoints against firmware specification
 * Requires a running controller at TEST_CONTROLLER_URL
 * 
 * Run with: npm test -- api.integration.spec.js
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Test configuration
const TEST_CONTROLLER_URL = process.env.TEST_CONTROLLER_URL || 'http://192.168.1.100';
const TEST_TIMEOUT = 10000;

// Helper function for API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${TEST_CONTROLLER_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const contentType = response.headers.get('content-type');
  let data;
  
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }
  
  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

// Helper to generate unique IDs
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to validate integer (not float)
function isInteger(value) {
  return Number.isInteger(value) && !Number.isNaN(value);
}

describe('API Integration Tests', () => {
  let testPresetId;
  let testSceneId;
  let testGroupId;
  let originalData;

  beforeAll(async () => {
    // Check if controller is reachable
    const ping = await apiRequest('/ping');
    expect(ping.status).toBe(200);
    expect(ping.data).toEqual({ ping: 'pong' });
    
    // Backup original data
    const dataResponse = await apiRequest('/data');
    originalData = dataResponse.data;
  }, TEST_TIMEOUT);

  describe('System Information Endpoints', () => {
    it('GET /ping - should return pong', async () => {
      const response = await apiRequest('/ping');
      
      expect(response.status).toBe(200);
      expect(response.data).toEqual({ ping: 'pong' });
    });

    it('GET /info - should return controller information', async () => {
      const response = await apiRequest('/info');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('deviceid');
      expect(response.data).toHaveProperty('git_version');
      expect(response.data).toHaveProperty('uptime');
      expect(response.data).toHaveProperty('heap_free');
      expect(response.data).toHaveProperty('connection');
      expect(response.data.connection).toHaveProperty('ip');
      expect(response.data.connection).toHaveProperty('mac');
      expect(response.data.connection).toHaveProperty('connected');
    });
  });

  describe('GET /data - Retrieve Application Data', () => {
    it('should return all application data with correct structure', async () => {
      const response = await apiRequest('/data');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('sync-lock');
      expect(response.data).toHaveProperty('presets');
      expect(response.data).toHaveProperty('scenes');
      expect(response.data).toHaveProperty('groups');
      expect(response.data).toHaveProperty('controllers');
      
      // Verify arrays
      expect(Array.isArray(response.data.presets)).toBe(true);
      expect(Array.isArray(response.data.scenes)).toBe(true);
      expect(Array.isArray(response.data.groups)).toBe(true);
      expect(Array.isArray(response.data.controllers)).toBe(true);
    });

    it('should have sync-lock with correct types', async () => {
      const response = await apiRequest('/data');
      const syncLock = response.data['sync-lock'];
      
      expect(syncLock).toBeDefined();
      expect(typeof syncLock.id).toBe('string');
      expect(isInteger(syncLock.ts)).toBe(true);
    });

    it('should have presets with integer timestamps', async () => {
      const response = await apiRequest('/data');
      
      if (response.data.presets.length > 0) {
        const preset = response.data.presets[0];
        
        expect(typeof preset.id).toBe('string');
        expect(typeof preset.name).toBe('string');
        expect(isInteger(preset.ts)).toBe(true);
        expect(typeof preset.favorite).toBe('boolean');
        
        if (preset.color?.hsv) {
          expect(isInteger(preset.color.hsv.h)).toBe(true);
          expect(isInteger(preset.color.hsv.s)).toBe(true);
          expect(isInteger(preset.color.hsv.v)).toBe(true);
          expect(preset.color.hsv.h).toBeGreaterThanOrEqual(0);
          expect(preset.color.hsv.h).toBeLessThanOrEqual(359);
          expect(preset.color.hsv.s).toBeGreaterThanOrEqual(0);
          expect(preset.color.hsv.s).toBeLessThanOrEqual(100);
          expect(preset.color.hsv.v).toBeGreaterThanOrEqual(0);
          expect(preset.color.hsv.v).toBeLessThanOrEqual(100);
        }
        
        if (preset.color?.raw) {
          expect(isInteger(preset.color.raw.r)).toBe(true);
          expect(isInteger(preset.color.raw.g)).toBe(true);
          expect(isInteger(preset.color.raw.b)).toBe(true);
          expect(preset.color.raw.r).toBeGreaterThanOrEqual(0);
          expect(preset.color.raw.r).toBeLessThanOrEqual(1023);
        }
      }
    });

    it('should have scenes with correct structure', async () => {
      const response = await apiRequest('/data');
      
      if (response.data.scenes.length > 0) {
        const scene = response.data.scenes[0];
        
        expect(typeof scene.id).toBe('string');
        expect(typeof scene.name).toBe('string');
        expect(isInteger(scene.ts)).toBe(true);
        expect(typeof scene.group_id).toBe('string');
        
        if (scene.settings) {
          expect(Array.isArray(scene.settings)).toBe(true);
          
          if (scene.settings.length > 0) {
            const setting = scene.settings[0];
            expect(typeof setting.controller_id).toBe('string');
            expect(isInteger(setting.pos)).toBe(true);
          }
        }
        
        if (scene.transition) {
          expect(typeof scene.transition.cmd).toBe('string');
          if (scene.transition.t) expect(isInteger(scene.transition.t)).toBe(true);
          if (scene.transition.d !== undefined) expect(isInteger(scene.transition.d)).toBe(true);
        }
      }
    });

    it('should have groups with string controller_ids', async () => {
      const response = await apiRequest('/data');
      
      if (response.data.groups.length > 0) {
        const group = response.data.groups[0];
        
        expect(typeof group.id).toBe('string');
        expect(typeof group.name).toBe('string');
        expect(isInteger(group.ts)).toBe(true);
        expect(Array.isArray(group.controller_ids)).toBe(true);
        
        group.controller_ids.forEach(ctrlId => {
          expect(typeof ctrlId).toBe('string');
        });
      }
    });
  });

  describe('POST /data - Update Application Data', () => {
    it('should create a new preset with quoted ID', async () => {
      testPresetId = generateId('test-preset');
      
      const preset = {
        id: testPresetId,
        name: 'Test Preset',
        ts: Math.floor(Date.now() / 1000),
        favorite: false,
        icon: 'palette',
        color: {
          hsv: {
            h: 180,
            s: 100,
            v: 75,
            ct: 3500,
          },
        },
      };
      
      const payload = {
        [`presets[id="${testPresetId}"]`]: preset,
      };
      
      const response = await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success');
      expect(response.data.success).toBe(true);
      
      // Verify preset was created
      const dataResponse = await apiRequest('/data');
      const createdPreset = dataResponse.data.presets.find(p => p.id === testPresetId);
      expect(createdPreset).toBeDefined();
      expect(createdPreset.name).toBe('Test Preset');
    });

    it('should reject preset with float values (FormatError)', async () => {
      const badPresetId = generateId('bad-preset');
      
      const badPreset = {
        id: badPresetId,
        name: 'Bad Preset',
        ts: Math.floor(Date.now() / 1000),
        color: {
          hsv: {
            h: 180.5, // Float - should fail
            s: 100.0,
            v: 75.2,
            ct: 3500,
          },
        },
      };
      
      const payload = {
        [`presets[id="${badPresetId}"]`]: badPreset,
      };
      
      const response = await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      // Should fail with 400
      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
      expect(response.data.error).toContain('FormatError');
    });

    it('should reject preset with unquoted ID', async () => {
      const badPresetId = generateId('unquoted');
      
      const preset = {
        id: badPresetId,
        name: 'Unquoted ID Preset',
        ts: Math.floor(Date.now() / 1000),
        color: {
          hsv: { h: 120, s: 50, v: 80, ct: 3000 },
        },
      };
      
      // Wrong: unquoted ID
      const payload = {
        [`presets[id=${badPresetId}]`]: preset,
      };
      
      const response = await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      expect(response.status).toBe(400);
    });

    it('should update existing preset field', async () => {
      if (!testPresetId) {
        testPresetId = generateId('test-preset');
        // Create first
        await apiRequest('/data', {
          method: 'POST',
          body: JSON.stringify({
            [`presets[id="${testPresetId}"]`]: {
              id: testPresetId,
              name: 'Original Name',
              ts: Math.floor(Date.now() / 1000),
              color: { hsv: { h: 0, s: 0, v: 100, ct: 3000 } },
            },
          }),
        });
      }
      
      const payload = {
        [`presets[id="${testPresetId}"].name`]: 'Updated Name',
        [`presets[id="${testPresetId}"].favorite`]: true,
      };
      
      const response = await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      expect(response.status).toBe(200);
      
      // Verify update
      const dataResponse = await apiRequest('/data');
      const updatedPreset = dataResponse.data.presets.find(p => p.id === testPresetId);
      expect(updatedPreset.name).toBe('Updated Name');
      expect(updatedPreset.favorite).toBe(true);
    });

    it('should create a group with controller_ids array', async () => {
      testGroupId = generateId('test-group');
      
      const group = {
        id: testGroupId,
        name: 'Test Group',
        ts: Math.floor(Date.now() / 1000),
        icon: 'light_groups',
        controller_ids: ['ctrl-1', 'ctrl-2'],
      };
      
      const payload = {
        [`groups[id="${testGroupId}"]`]: group,
      };
      
      const response = await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      expect(response.status).toBe(200);
      
      // Verify creation
      const dataResponse = await apiRequest('/data');
      const createdGroup = dataResponse.data.groups.find(g => g.id === testGroupId);
      expect(createdGroup).toBeDefined();
      expect(createdGroup.controller_ids).toEqual(['ctrl-1', 'ctrl-2']);
    });

    it('should create a scene with transitions', async () => {
      // Ensure group exists
      if (!testGroupId) {
        testGroupId = generateId('test-group');
        await apiRequest('/data', {
          method: 'POST',
          body: JSON.stringify({
            [`groups[id="${testGroupId}"]`]: {
              id: testGroupId,
              name: 'Scene Group',
              ts: Math.floor(Date.now() / 1000),
              controller_ids: ['ctrl-1'],
            },
          }),
        });
      }
      
      testSceneId = generateId('test-scene');
      
      const scene = {
        id: testSceneId,
        name: 'Test Scene',
        ts: Math.floor(Date.now() / 1000),
        group_id: testGroupId,
        favorite: false,
        icon: 'scene',
        transition: {
          cmd: 'fade',
          t: 2000,
          d: 1,
          s: 50,
        },
        settings: [
          {
            controller_id: 'ctrl-1',
            pos: 0,
            color: {
              hsv: {
                h: 200,
                s: 80,
                v: 60,
                ct: 3500,
              },
            },
            transition: {
              cmd: 'fade',
              t: 1000,
              d: 1,
            },
          },
        ],
      };
      
      const payload = {
        [`scenes[id="${testSceneId}"]`]: scene,
      };
      
      const response = await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      expect(response.status).toBe(200);
      
      // Verify creation
      const dataResponse = await apiRequest('/data');
      const createdScene = dataResponse.data.scenes.find(s => s.id === testSceneId);
      expect(createdScene).toBeDefined();
      expect(createdScene.settings).toHaveLength(1);
      expect(isInteger(createdScene.transition.t)).toBe(true);
    });

    it('should delete preset with DELETE command', async () => {
      if (!testPresetId) {
        testPresetId = generateId('delete-test');
        await apiRequest('/data', {
          method: 'POST',
          body: JSON.stringify({
            [`presets[id="${testPresetId}"]`]: {
              id: testPresetId,
              name: 'To Delete',
              ts: Math.floor(Date.now() / 1000),
              color: { hsv: { h: 0, s: 0, v: 100 } },
            },
          }),
        });
      }
      
      const payload = {
        [`presets[id="${testPresetId}"]`]: 'DELETE',
      };
      
      const response = await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      expect(response.status).toBe(200);
      
      // Verify deletion
      const dataResponse = await apiRequest('/data');
      const deletedPreset = dataResponse.data.presets.find(p => p.id === testPresetId);
      expect(deletedPreset).toBeUndefined();
    });
  });

  describe('GET /config - Retrieve Configuration', () => {
    it('should return complete configuration', async () => {
      const response = await apiRequest('/config');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('general');
      expect(response.data).toHaveProperty('network');
      expect(response.data).toHaveProperty('color');
      expect(response.data).toHaveProperty('security');
      expect(response.data).toHaveProperty('sync');
      expect(response.data).toHaveProperty('events');
    });

    it('should have general settings with correct types', async () => {
      const response = await apiRequest('/config');
      const general = response.data.general;
      
      expect(typeof general.device_name).toBe('string');
      expect(typeof general.is_initialized).toBe('boolean');
      expect(isInteger(general.buttons_debounce_ms)).toBe(true);
    });

    it('should mask passwords in response', async () => {
      const response = await apiRequest('/config');
      
      // MQTT password should be masked or omitted
      if (response.data.network?.mqtt?.password) {
        expect(response.data.network.mqtt.password).toContain('*');
      }
      
      // API password should be masked or omitted
      if (response.data.security?.api_password) {
        expect(response.data.security.api_password).toContain('*');
      }
    });

    it('should have network settings', async () => {
      const response = await apiRequest('/config');
      const network = response.data.network;
      
      expect(network).toHaveProperty('connection');
      expect(network).toHaveProperty('mqtt');
      expect(typeof network.connection.dhcp).toBe('boolean');
      expect(typeof network.mqtt.enabled).toBe('boolean');
      expect(isInteger(network.mqtt.port)).toBe(true);
    });

    it('should have color settings with integer values', async () => {
      const response = await apiRequest('/config');
      const color = response.data.color;
      
      expect(color).toHaveProperty('brightness');
      expect(isInteger(color.brightness.red)).toBe(true);
      expect(isInteger(color.brightness.green)).toBe(true);
      expect(isInteger(color.brightness.blue)).toBe(true);
      expect(isInteger(color.colortemp.ww)).toBe(true);
      expect(isInteger(color.colortemp.cw)).toBe(true);
    });
  });

  describe('POST /config - Update Configuration', () => {
    let originalDeviceName;

    it('should update device name', async () => {
      // Get original
      const getResponse = await apiRequest('/config');
      originalDeviceName = getResponse.data.general.device_name;
      
      const newName = `Test Device ${Date.now()}`;
      
      const payload = {
        general: {
          device_name: newName,
        },
      };
      
      const response = await apiRequest('/config', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      // Verify update
      const verifyResponse = await apiRequest('/config');
      expect(verifyResponse.data.general.device_name).toBe(newName);
    });

    it('should update MQTT settings', async () => {
      const payload = {
        network: {
          mqtt: {
            enabled: true,
            server: 'test.mqtt.local',
            port: 1883,
          },
        },
      };
      
      const response = await apiRequest('/config', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      expect(response.status).toBe(200);
    });

    it('should reject invalid configuration', async () => {
      const payload = {
        invalid_field: 'test',
        network: {
          invalid_network_field: 123,
        },
      };
      
      const response = await apiRequest('/config', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      // May return 400 or ignore invalid fields (depends on firmware)
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('GET /color - Current Color', () => {
    it('should return current color in HSV and RAW', async () => {
      const response = await apiRequest('/color');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('hsv');
      expect(response.data).toHaveProperty('raw');
      
      const { hsv, raw } = response.data;
      
      // HSV values can be floats in GET response
      expect(typeof hsv.h).toBe('number');
      expect(typeof hsv.s).toBe('number');
      expect(typeof hsv.v).toBe('number');
      
      // RAW values should be integers
      expect(isInteger(raw.r)).toBe(true);
      expect(isInteger(raw.g)).toBe(true);
      expect(isInteger(raw.b)).toBe(true);
      expect(raw.r).toBeGreaterThanOrEqual(0);
      expect(raw.r).toBeLessThanOrEqual(1023);
    });
  });

  describe('POST /color - Set Color', () => {
    it('should set HSV color with fade', async () => {
      const payload = {
        hsv: {
          h: 240,
          s: 100,
          v: 80,
          ct: 3500,
        },
        cmd: 'fade',
        t: 1000,
        d: 1,
      };
      
      const response = await apiRequest('/color', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      // Wait for transition
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Verify color changed
      const colorResponse = await apiRequest('/color');
      expect(Math.abs(colorResponse.data.hsv.h - 240)).toBeLessThan(5);
    });

    it('should set RAW color with solid', async () => {
      const payload = {
        raw: {
          r: 512,
          g: 256,
          b: 768,
          ww: 0,
          cw: 0,
        },
        cmd: 'solid',
        t: 500,
      };
      
      const response = await apiRequest('/color', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    it('should reject color with invalid HSV range', async () => {
      const payload = {
        hsv: {
          h: 400, // Invalid - max 359
          s: 100,
          v: 100,
        },
      };
      
      const response = await apiRequest('/color', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      expect(response.status).toBe(400);
    });
  });

  describe('Animation Control', () => {
    it('POST /toggle - should toggle controller', async () => {
      const response = await apiRequest('/toggle', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    it('POST /blink - should execute blink', async () => {
      const payload = {
        t: 300,
        channels: ['h', 's', 'v'],
      };
      
      const response = await apiRequest('/blink', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    it('POST /stop - should stop animation', async () => {
      const response = await apiRequest('/stop', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    it('POST /pause - should pause animation', async () => {
      const response = await apiRequest('/pause', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    it('POST /continue - should continue animation', async () => {
      const response = await apiRequest('/continue', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    it('POST /skip - should skip animation', async () => {
      const response = await apiRequest('/skip', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });
  });

  describe('Network Management', () => {
    it('GET /networks - should list available networks', async () => {
      const response = await apiRequest('/networks');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('scanning');
      expect(response.data).toHaveProperty('available');
      expect(Array.isArray(response.data.available)).toBe(true);
      expect(typeof response.data.scanning).toBe('boolean');
    });

    it('POST /scan_networks - should initiate scan', async () => {
      const response = await apiRequest('/scan_networks', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    it('GET /connect - should return connection status', async () => {
      const response = await apiRequest('/connect');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
      expect([0, 1, 2, 3]).toContain(response.data.status);
      
      if (response.data.status === 2) {
        expect(response.data).toHaveProperty('ip');
        expect(response.data).toHaveProperty('ssid');
      }
    });
  });

  describe('System Control', () => {
    it('POST /system with debug command', async () => {
      const payload = {
        cmd: 'debug',
        enable: true,
      };
      
      const response = await apiRequest('/system', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    it('should reject invalid system command', async () => {
      const payload = {
        cmd: 'invalid_command',
      };
      
      const response = await apiRequest('/system', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
    });
  });

  describe('OTA Update', () => {
    it('GET /update - should return update status', async () => {
      const response = await apiRequest('/update');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('rom_status');
      expect(response.data).toHaveProperty('webapp_status');
      expect([0, 1, 2, 3]).toContain(response.data.rom_status);
      expect([0, 1, 2, 3]).toContain(response.data.webapp_status);
    });

    // Note: POST /update test commented out - would trigger actual OTA update
    // it('POST /update - should initiate OTA update', async () => {
    //   const payload = {
    //     rom: { url: 'http://test.com/rom.bin' },
    //     spiffs: { url: 'http://test.com/spiffs.bin' },
    //   };
    //   
    //   const response = await apiRequest('/update', {
    //     method: 'POST',
    //     body: JSON.stringify(payload),
    //   });
    //   
    //   expect(response.status).toBe(200);
    // });
  });

  afterAll(async () => {
    // Cleanup: Delete test items
    const cleanupPayload = {};
    
    if (testPresetId) {
      cleanupPayload[`presets[id="${testPresetId}"]`] = 'DELETE';
    }
    if (testSceneId) {
      cleanupPayload[`scenes[id="${testSceneId}"]`] = 'DELETE';
    }
    if (testGroupId) {
      cleanupPayload[`groups[id="${testGroupId}"]`] = 'DELETE';
    }
    
    if (Object.keys(cleanupPayload).length > 0) {
      await apiRequest('/data', {
        method: 'POST',
        body: JSON.stringify(cleanupPayload),
      });
    }
    
    console.log('✅ Cleanup complete');
  }, TEST_TIMEOUT);
});
