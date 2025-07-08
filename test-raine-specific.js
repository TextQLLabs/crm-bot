require('dotenv').config();
const { ReactAgent } = require('./src/services/reactAgent');

async function testRaineSearch() {
  const agent = new ReactAgent();
  
  console.log('\n=== Testing "The Raine Group" search ===\n');
  
  const message = {
    text: 'can you show me a list of all the notes on raine group?',
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
  console.log('\n=== STEPS ===');
  result.steps.forEach((step, i) => {
    console.log(`\nStep ${i+1}:`);
    console.log('Thought:', step.thought);
    if (step.action) console.log('Action:', step.action);
    if (step.actionInput) console.log('Input:', JSON.stringify(step.actionInput));
    if (step.observation) console.log('Observation:', JSON.stringify(step.observation, null, 2));
  });
}

testRaineSearch().catch(console.error);