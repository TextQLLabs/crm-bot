require('dotenv').config();
const { ReactAgent } = require('./src/services/reactAgent');

async function testFullContentNotes() {
  const agent = new ReactAgent();
  
  console.log('\n=== Testing Full Content Notes Functionality ===\n');
  
  // Test 1: Request with "dump" keyword
  console.log('Test 1: Request last 3-4 notes on Twilio and dump the context');
  console.log('=======================================================\n');
  
  const message1 = {
    text: 'what were the last 3-4 notes on twilio? dump the context',
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
  
  // Test 2: Request with "full content"
  console.log('\n\nTest 2: Show full content of notes on Raine Group');
  console.log('=================================================\n');
  
  const message2 = {
    text: 'show me the full content of all notes on the raine group',
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
  
  // Test 3: Request specific number without dump
  console.log('\n\nTest 3: Show last 2 notes on a company (preview only)');
  console.log('====================================================\n');
  
  const message3 = {
    text: 'show me the last 2 notes on twilio',
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

testFullContentNotes().catch(console.error);