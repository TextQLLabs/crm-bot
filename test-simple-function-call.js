require('dotenv').config();
const { ReactAgent } = require('./src/services/reactAgent');

async function testSimpleFunctionCall() {
  const agent = new ReactAgent();
  
  console.log('\n=== Testing Simple Function Call ===\n');
  
  // Very simple test case
  const message = {
    text: 'search for microsoft',
    userName: 'Test User',
    channel: '#test',
    attachments: []
  };
  
  console.log('Input:', message.text);
  console.log('\nProcessing...\n');
  
  const result = await agent.processMessage(message);
  
  console.log('\n=== RESULT ===');
  console.log('Success:', result.success);
  console.log('Answer:', result.answer);
  
  console.log('\n=== STEPS SUMMARY ===');
  result.steps.forEach((step, i) => {
    console.log(`\nStep ${i+1}:`);
    if (step.action) {
      console.log(`  Action: ${step.action}`);
      console.log(`  Input:`, step.actionInput);
      console.log(`  Got observation:`, !!step.observation);
    }
  });
}

testSimpleFunctionCall().catch(console.error);