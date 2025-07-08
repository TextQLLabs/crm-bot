// Test script for delete_note functionality
require('dotenv').config();
const { deleteNote } = require('../src/services/attioService');
const { ReactAgent } = require('../src/services/reactAgent');

async function testDeleteNote() {
  console.log('=== Testing Delete Note Functionality ===\n');

  // Test 1: Test with a fake/invalid note ID
  console.log('Test 1: Attempting to delete non-existent note...');
  const fakeNoteId = 'fake-note-id-12345';
  const result1 = await deleteNote(fakeNoteId);
  console.log('Result:', result1);
  console.log('Expected: Should fail with "Note not found" error\n');

  // Test 2: Test ReactAgent with delete_note tool
  console.log('Test 2: Testing ReactAgent with delete_note tool...');
  const agent = new ReactAgent();
  
  // Simulate a message asking to delete a note
  const testMessage = {
    text: `Delete note with ID: ${fakeNoteId}`,
    userName: 'TestUser',
    channel: 'test-channel'
  };

  try {
    const response = await agent.processMessage(testMessage, { preview: true });
    console.log('ReactAgent Response:', JSON.stringify(response, null, 2));
    console.log('\nExpected: Should show preview of delete action\n');
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 3: Test with empty note ID
  console.log('Test 3: Testing with empty note ID...');
  const result3 = await deleteNote('');
  console.log('Result:', result3);
  console.log('Expected: Should handle gracefully\n');

  console.log('=== Tests Complete ===');
  console.log('\nIMPORTANT: To test with a real note:');
  console.log('1. Create a note on any Attio record');
  console.log('2. Get the note ID from the Attio UI or API');
  console.log('3. Replace the fakeNoteId variable with the real note ID');
  console.log('4. Run this test again to verify deletion works');
  console.log('\nNote IDs in Attio typically look like UUIDs, e.g., "550e8400-e29b-41d4-a716-446655440000"');
}

// Run the test
testDeleteNote().catch(console.error);