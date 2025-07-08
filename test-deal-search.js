require('dotenv').config();
const { ReactAgent } = require('./src/services/reactAgent');

async function testDealSearch() {
  const agent = new ReactAgent();
  
  console.log('\n=== Testing Deal Search and URLs ===\n');
  
  const message = {
    text: 'search for deals with "raine" in the name',
    userName: 'Test User',
    channel: '#test',
    attachments: []
  };
  
  console.log('Input:', message.text);
  console.log('\nProcessing...\n');
  
  const result = await agent.processMessage(message);
  
  console.log('\n=== RESULT ===');
  console.log('Success:', result.success);
  console.log('\nAnswer:');
  console.log(result.answer);
  
  // Check if any deal URLs are present and verify format
  const dealUrlPattern = /https:\/\/app\.attio\.com\/textql-data\/deals?\/[a-f0-9-]+\/overview/g;
  const matches = result.answer.match(dealUrlPattern);
  
  if (matches) {
    console.log('\n=== DEAL URLs FOUND ===');
    matches.forEach(url => {
      const isCorrect = url.includes('/deals/');
      console.log(`${isCorrect ? '✅' : '❌'} ${url}`);
    });
  }
}

testDealSearch().catch(console.error);