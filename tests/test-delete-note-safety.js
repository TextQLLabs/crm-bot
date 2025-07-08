// Test script to verify delete_note safety features
require('dotenv').config();
const { ReactAgent } = require('../src/services/reactAgent');

async function testDeleteNoteSafety() {
  console.log('=== Testing Delete Note Safety Features ===\n');
  
  const agent = new ReactAgent();

  // Test 1: Preview mode should prevent immediate deletion
  console.log('Test 1: Preview mode test...');
  const previewMessage = {
    text: 'Delete note 550e8400-e29b-41d4-a716-446655440000',
    userName: 'SafetyTestUser',
    channel: 'safety-test'
  };

  const previewResult = await agent.processMessage(previewMessage, { preview: true });
  console.log('Preview Result:', JSON.stringify(previewResult, null, 2));
  
  if (previewResult.preview && previewResult.pendingAction) {
    console.log('✅ SUCCESS: Preview mode prevented immediate deletion');
    console.log('Pending action:', previewResult.pendingAction);
  } else {
    console.log('❌ FAIL: Preview mode did not work as expected');
  }

  console.log('\n---\n');

  // Test 2: Verify delete_note is marked as a write action
  console.log('Test 2: Write action classification...');
  const isWrite = agent.isWriteAction('delete_note');
  console.log(`Is delete_note a write action? ${isWrite}`);
  if (isWrite) {
    console.log('✅ SUCCESS: delete_note is correctly classified as a write action');
  } else {
    console.log('❌ FAIL: delete_note should be classified as a write action');
  }

  console.log('\n---\n');

  // Test 3: Test with vague request (should ask for confirmation)
  console.log('Test 3: Vague deletion request...');
  const vagueMessage = {
    text: 'Delete the note I just created',
    userName: 'VagueUser',
    channel: 'vague-test'
  };

  const vagueResult = await agent.processMessage(vagueMessage, { preview: false });
  console.log('Vague request result:', JSON.stringify(vagueResult, null, 2));
  console.log('Expected: Agent should ask for specific note ID or search for recent notes');

  console.log('\n=== Safety Tests Complete ===');
}

// Run the safety tests
testDeleteNoteSafety().catch(console.error);