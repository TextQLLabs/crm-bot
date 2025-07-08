require('dotenv').config();
const { ReactAgent } = require('./src/services/reactAgent');

async function testExactMessage() {
  const agent = new ReactAgent();
  
  console.log('\n=== Testing Exact User Message ===\n');
  
  const message = {
    text: 'can you show mea list of all the notes on raine group?',
    userName: 'Test User',
    channel: '#test',
    attachments: []
  };
  
  console.log('Input:', message.text);
  console.log('\nProcessing...\n');
  
  const result = await agent.processMessage(message);
  
  console.log('\n=== FINAL RESULT ===');
  console.log('Success:', result.success);
  console.log('\nAnswer:');
  console.log(result.answer);
  
  console.log('\n=== ALL STEPS ===');
  result.steps.forEach((step, i) => {
    console.log(`\nStep ${i+1}:`);
    console.log('Thought:', step.thought);
    if (step.action) {
      console.log('Action:', step.action);
      console.log('Input:', JSON.stringify(step.actionInput, null, 2));
      if (step.observation) {
        console.log('Observation:', JSON.stringify(step.observation, null, 2).substring(0, 200) + '...');
      }
    }
    if (step.finalAnswer) {
      console.log('Final Answer:', step.finalAnswer);
    }
  });
}

testExactMessage().catch(console.error);