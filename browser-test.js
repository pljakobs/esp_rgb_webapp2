// Browser Console Test Script for ConfigDB API Functions
// INSTRUCTIONS:
// 1. Open app in browser (http://localhost:9000)
// 2. Open DevTools Console (F12)
// 3. Copy-paste this ENTIRE script (including the async function wrapper)
// 4. It will run automatically

(async () => {
  console.log('=== ConfigDB API Functions Test ===\n');
  
  // Import stores and services
  console.log('Importing stores and services...');
  const { useControllersStore } = await import('/src/stores/controllersStore.js');
  const controllersStore = useControllersStore();
  const { apiService } = await import('/src/services/api.js');
  
  // Test 1: Get reachable controllers
  console.log('\nTest 1: Getting reachable controllers...');
  const controllers = controllersStore.data.filter(c => c.ip_address);
  console.log(`Found ${controllers.length} reachable controllers:`, controllers.map(c => c.name || c.ip_address));

  if (controllers.length === 0) {
    console.error('No reachable controllers found! Cannot proceed with tests.');
    return;
  }
  
  // Test 2: Add items to all controllers
  console.log('\nTest 2: Adding test groups to all controllers...');
  const testGroups = [
    { id: 'browser-test-1', name: 'BrowserTest-1', controller_ids: [] },
    { id: 'browser-test-2', name: 'BrowserTest-2', controller_ids: [] }
  ];
  
  const addResult = await apiService.addConfigItemsToAll(
    controllers,
    'groups',
    testGroups,
    (completed, total) => console.log(`  Progress: ${completed}/${total}`)
  );
  console.log('Add Result:', addResult);
  
  // Verify on first controller
  console.log('\nVerifying add on first controller...');
  const verifyAdd = await fetch(`http://${controllers[0].ip_address}/data`).then(r => r.json());
  const addedGroups = verifyAdd.groups.filter(g => g.id.startsWith('browser-test-'));
  console.log('Found groups:', addedGroups);
  
  // Test 3: Update item on all controllers
  console.log('\nTest 3: Updating browser-test-1 on all controllers...');
  const updatedItem = { 
    id: 'browser-test-1', 
    name: 'BrowserTest-1-UPDATED', 
    controller_ids: ['123456'] 
  };
  
  const updateResult = await apiService.updateConfigItemOnAll(
    controllers,
    'groups',
    'browser-test-1',
    updatedItem,
    (completed, total) => console.log(`  Progress: ${completed}/${total}`)
  );
  console.log('Update Result:', updateResult);
  
  // Verify update
  console.log('\nVerifying update on first controller...');
  const verifyUpdate = await fetch(`http://${controllers[0].ip_address}/data`).then(r => r.json());
  const updatedGroup = verifyUpdate.groups.find(g => g.id === 'browser-test-1');
  console.log('Updated group:', updatedGroup);
  
  // Test 4: Delete single item from all controllers
  console.log('\nTest 4: Deleting browser-test-2 from all controllers...');
  const deleteResult = await apiService.deleteConfigItemFromAll(
    controllers,
    'groups',
    'browser-test-2',
    (completed, total) => console.log(`  Progress: ${completed}/${total}`)
  );
  console.log('Delete Result:', deleteResult);
  
  // Verify delete
  console.log('\nVerifying delete on first controller...');
  const verifyDelete = await fetch(`http://${controllers[0].ip_address}/data`).then(r => r.json());
  const deletedGroup = verifyDelete.groups.find(g => g.id === 'browser-test-2');
  console.log('browser-test-2 exists:', !!deletedGroup);
  
  // Test 5: Replace entire array on all controllers
  console.log('\nTest 5: Replacing all browser-test groups with new set...');
  const newGroups = [
    { id: 'browser-test-final-1', name: 'FinalTest-1', controller_ids: [] },
    { id: 'browser-test-final-2', name: 'FinalTest-2', controller_ids: [] }
  ];
  
  // First clear all browser-test groups
  console.log('  Clearing old test groups...');
  const verifyBefore = await fetch(`http://${controllers[0].ip_address}/data`).then(r => r.json());
  const oldTestGroups = verifyBefore.groups.filter(g => g.id.startsWith('browser-test-'));
  for (const group of oldTestGroups) {
    await apiService.deleteConfigItemFromAll(controllers, 'groups', group.id);
  }
  
  // Now add new ones
  console.log('  Adding new test groups...');
  const replaceResult = await apiService.addConfigItemsToAll(
    controllers,
    'groups',
    newGroups,
    (completed, total) => console.log(`    Progress: ${completed}/${total}`)
  );
  console.log('Replace Result:', replaceResult);
  
  // Final verification
  console.log('\nFinal verification on first controller...');
  const finalVerify = await fetch(`http://${controllers[0].ip_address}/data`).then(r => r.json());
  const finalGroups = finalVerify.groups.filter(g => g.id.startsWith('browser-test-'));
  console.log('Final test groups:', finalGroups);
  
  // Cleanup
  console.log('\n=== CLEANUP ===');
  console.log('Removing all test groups...');
  for (const group of finalGroups) {
    await apiService.deleteConfigItemFromAll(controllers, 'groups', group.id);
  }
  console.log('Cleanup complete!');
  
  console.log('\n=== ALL TESTS COMPLETE ===');
  console.log('Summary:');
  console.log('- Add:', addResult.successCount, 'successes,', addResult.failCount, 'failures');
  console.log('- Update:', updateResult.successCount, 'successes,', updateResult.failCount, 'failures');
  console.log('- Delete:', deleteResult.successCount, 'successes,', deleteResult.failCount, 'failures');
  console.log('- Replace:', replaceResult.successCount, 'successes,', replaceResult.failCount, 'failures');
})();
