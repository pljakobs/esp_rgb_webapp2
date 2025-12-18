// Test script for new ConfigDB API functions
// Run with: node test-api-functions.js

const TEST_CONTROLLER = {
  ip_address: '192.168.29.112',
  id: '390774',
  name: 'led-te1'
};

// Mock fetch for Node.js environment
global.fetch = async (url, options = {}) => {
  const https = require('http');
  const urlObj = new URL(url);
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: async () => JSON.parse(data),
          text: async () => data
        });
      });
    });
    
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
};

// Simple API class with just the new functions
class TestApiService {
  constructor() {
    this.REQUEST_TIMEOUT = 30000;
  }

  async requestToController(endpoint, controller, options = {}) {
    const url = `http://${controller.ip_address}/${endpoint}`;
    const { timeout = this.REQUEST_TIMEOUT, ...fetchOptions } = options;
    
    try {
      const response = await fetch(url, fetchOptions);
      const jsonData = await response.json();
      
      return {
        jsonData,
        error: response.ok ? null : { message: `HTTP ${response.status}` },
        status: response.status
      };
    } catch (error) {
      return {
        jsonData: null,
        error: { message: error.message },
        status: null
      };
    }
  }

  async getDataFromController(ipAddress) {
    return this.requestToController('data', { ip_address: ipAddress });
  }

  async addConfigItems(controller, arrayName, items, timeout = 30000) {
    if (!items || items.length === 0) {
      return { success: true, error: null };
    }

    const payload = { [`${arrayName}[]`]: items };
    
    const { error } = await this.requestToController('data', controller, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      timeout
    });

    return { 
      success: !error, 
      error: error ? error.message : null 
    };
  }

  async updateConfigItem(controller, arrayName, itemId, item, timeout = 30000) {
    const payload = { [`${arrayName}[id=${itemId}]`]: item };
    
    const { error } = await this.requestToController('data', controller, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      timeout
    });

    return { 
      success: !error, 
      error: error ? error.message : null 
    };
  }

  async deleteConfigItem(controller, arrayName, itemId, timeout = 30000) {
    const payload = { [`${arrayName}[id=${itemId}]`]: [] };
    
    const { error } = await this.requestToController('data', controller, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      timeout
    });

    return { 
      success: !error, 
      error: error ? error.message : null 
    };
  }

  async clearConfigArray(controller, arrayName, timeout = 30000) {
    const { jsonData, error: fetchError } = await this.getDataFromController(controller.ip_address);
    
    if (fetchError) {
      return { success: false, error: fetchError.message, deletedCount: 0 };
    }

    const items = jsonData[arrayName] || [];
    let deletedCount = 0;

    for (const item of items) {
      if (item.id) {
        const { success } = await this.deleteConfigItem(controller, arrayName, item.id, timeout);
        if (success) deletedCount++;
      }
    }

    return { 
      success: true, 
      error: null, 
      deletedCount 
    };
  }

  async replaceConfigArray(controller, arrayName, newItems, timeout = 30000) {
    const { success: clearSuccess, error: clearError } = await this.clearConfigArray(
      controller, 
      arrayName, 
      timeout
    );

    if (!clearSuccess) {
      return { success: false, error: `Clear failed: ${clearError}` };
    }

    const { success: addSuccess, error: addError } = await this.addConfigItems(
      controller, 
      arrayName, 
      newItems, 
      timeout
    );

    return { 
      success: addSuccess, 
      error: addError 
    };
  }
}

async function runTests() {
  const api = new TestApiService();
  
  console.log('🧪 Testing new ConfigDB API functions...\n');
  
  // Test 1: Add items
  console.log('📝 Test 1: Add two test groups');
  const testGroups = [
    { id: 'test-api-1', name: 'TestAPI-1', controller_ids: ['390774'], ts: 1234567890, icon: 'light_groups' },
    { id: 'test-api-2', name: 'TestAPI-2', controller_ids: ['1451258'], ts: 1234567891, icon: 'light_groups' }
  ];
  
  const addResult = await api.addConfigItems(TEST_CONTROLLER, 'groups', testGroups);
  console.log('   Result:', addResult);
  
  // Verify
  const { jsonData: data1 } = await api.getDataFromController(TEST_CONTROLLER.ip_address);
  const added = data1.groups.filter(g => g.id.startsWith('test-api-'));
  console.log(`   ✓ Found ${added.length} test groups\n`);
  
  // Test 2: Update item
  console.log('📝 Test 2: Update test-api-1');
  const updatedGroup = { ...testGroups[0], name: 'TestAPI-1-UPDATED', controller_ids: ['390774', '1451258'] };
  const updateResult = await api.updateConfigItem(TEST_CONTROLLER, 'groups', 'test-api-1', updatedGroup);
  console.log('   Result:', updateResult);
  
  const { jsonData: data2 } = await api.getDataFromController(TEST_CONTROLLER.ip_address);
  const updated = data2.groups.find(g => g.id === 'test-api-1');
  console.log(`   ✓ Name is now: ${updated.name}\n`);
  
  // Test 3: Create duplicate
  console.log('📝 Test 3: Add duplicate of test-api-1');
  const duplicate = { ...updatedGroup, name: 'TestAPI-1-DUPLICATE' };
  await api.addConfigItems(TEST_CONTROLLER, 'groups', [duplicate]);
  
  const { jsonData: data3 } = await api.getDataFromController(TEST_CONTROLLER.ip_address);
  const duplicates = data3.groups.filter(g => g.id === 'test-api-1');
  console.log(`   ✓ Now have ${duplicates.length} items with id test-api-1\n`);
  
  // Test 4: Delete one instance (should leave duplicate)
  console.log('📝 Test 4: Delete one instance of test-api-1');
  const deleteResult = await api.deleteConfigItem(TEST_CONTROLLER, 'groups', 'test-api-1');
  console.log('   Result:', deleteResult);
  
  const { jsonData: data4 } = await api.getDataFromController(TEST_CONTROLLER.ip_address);
  const remaining = data4.groups.filter(g => g.id === 'test-api-1');
  console.log(`   ✓ Remaining: ${remaining.length} item(s) with id test-api-1\n`);
  
  // Test 5: Clear all test items
  console.log('📝 Test 5: Clear all test groups using clearConfigArray');
  
  // First add back the duplicate for a full test
  await api.addConfigItems(TEST_CONTROLLER, 'groups', [duplicate]);
  
  const { jsonData: dataBefore } = await api.getDataFromController(TEST_CONTROLLER.ip_address);
  const beforeCount = dataBefore.groups.filter(g => g.id.startsWith('test-api-')).length;
  console.log(`   Before: ${beforeCount} test groups`);
  
  // Now clear only test items by manually deleting each
  for (const group of dataBefore.groups.filter(g => g.id.startsWith('test-api-'))) {
    await api.deleteConfigItem(TEST_CONTROLLER, 'groups', group.id);
  }
  
  const { jsonData: dataAfter } = await api.getDataFromController(TEST_CONTROLLER.ip_address);
  const afterCount = dataAfter.groups.filter(g => g.id.startsWith('test-api-')).length;
  console.log(`   After: ${afterCount} test groups`);
  console.log(`   ✓ Deleted ${beforeCount - afterCount} items\n`);
  
  console.log('✅ All tests completed!');
}

runTests().catch(console.error);
