require('dotenv').config();
const { ReactAgent } = require('./src/services/reactAgent');

async function testNotesFunction() {
  const agent = new ReactAgent();
  
  console.log('\n=== Testing Notes Functionality ===\n');
  
  // Test 1: List notes on The Raine Group
  console.log('Test 1: List notes on The Raine Group');
  console.log('=====================================\n');
  
  const message1 = {
    text: 'can you show me a list of all the notes on raine group?',
    userName: 'Test User',
    channel: '#test',
    attachments: []
  };
  
  console.log('Input:', message1.text);
  console.log('\nProcessing...\n');
  
  const result1 = await agent.processMessage(message1);
  
  console.log('\n=== RESULT ===');
  console.log('Success:', result1.success);
  console.log('\nAnswer:');
  console.log(result1.answer);
  
  console.log('\n=== TOOL CALLS ===');
  result1.steps.forEach((step, i) => {
    if (step.action) {
      console.log(`\nStep ${i+1}: ${step.action}`);
      console.log('Input:', JSON.stringify(step.actionInput, null, 2));
      if (step.observation) {
        console.log('Observation preview:', JSON.stringify(step.observation).substring(0, 200) + '...');
      }
    }
  });
  
  // Test 2: Search for a specific company and list its notes
  console.log('\n\nTest 2: Find Twilio and show its notes');
  console.log('======================================\n');
  
  const message2 = {
    text: 'find twilio and show me all notes on it',
    userName: 'Test User',
    channel: '#test',
    attachments: []
  };
  
  console.log('Input:', message2.text);
  console.log('\nProcessing...\n');
  
  const result2 = await agent.processMessage(message2);
  
  console.log('\n=== RESULT ===');
  console.log('Success:', result2.success);
  console.log('\nAnswer:');
  console.log(result2.answer);
  
  // Test 3: Try to list all notes (no specific entity)
  console.log('\n\nTest 3: List all notes');
  console.log('======================\n');
  
  const message3 = {
    text: 'show me all recent notes',
    userName: 'Test User',
    channel: '#test',
    attachments: []
  };
  
  console.log('Input:', message3.text);
  console.log('\nProcessing...\n');
  
  const result3 = await agent.processMessage(message3);
  
  console.log('\n=== RESULT ===');
  console.log('Success:', result3.success);
  console.log('\nAnswer:');
  console.log(result3.answer);
}

testNotesFunction().catch(console.error);