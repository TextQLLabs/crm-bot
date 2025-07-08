require('dotenv').config();
const { ReactAgent } = require('./src/services/reactAgent');

async function testNotesWithUrls() {
  const agent = new ReactAgent();
  
  console.log('\n=== Testing Notes Display with Direct URLs ===\n');
  
  const message = {
    text: 'show me all notes on the raine group',
    userName: 'Test User',
    channel: '#test',
    attachments: []
  };
  
  console.log('Input:', message.text);
  console.log('\nProcessing...\n');
  
  const result = await agent.processMessage(message);
  
  console.log('\n=== BOT RESPONSE ===');
  console.log(result.answer);
  
  // Check if URLs are present
  const urlPattern = /https:\/\/app\.attio\.com\/textql-data\/[^\/]+\/record\/[^\/]+\/notes\?modal=note&id=[a-f0-9-]+/g;
  const matches = result.answer.match(urlPattern);
  
  if (matches) {
    console.log('\n=== DIRECT NOTE URLs FOUND ===');
    matches.forEach(url => {
      console.log('✅', url);
    });
  } else {
    console.log('\n❌ No direct note URLs found in response');
  }
}

testNotesWithUrls().catch(console.error);