require('dotenv').config();
const { ReactAgent } = require('./src/services/reactAgent');

async function testRaineIssue() {
  const agent = new ReactAgent();
  
  const testCases = [
    { 
      input: 'can you show me a list of all the notes on raine group?',
      description: 'Original failing case'
    },
    {
      input: 'search for The Raine Group',
      description: 'Direct search'
    },
    {
      input: 'find the raine group company',
      description: 'Alternative phrasing'
    }
  ];
  
  for (const testCase of testCases) {
    console.log('\n' + '='.repeat(60));
    console.log(`Test: ${testCase.description}`);
    console.log(`Input: "${testCase.input}"`);
    console.log('='.repeat(60));
    
    const message = {
      text: testCase.input,
      userName: 'Test User',
      channel: '#test',
      attachments: []
    };
    
    const result = await agent.processMessage(message);
    
    console.log('\nResult:', result.success ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Answer:', result.answer);
    
    // Check if The Raine Group was found
    const foundRaine = result.answer.toLowerCase().includes('raine') && 
                      result.answer.includes('https://app.attio.com');
    console.log('Found The Raine Group?', foundRaine ? '✅ YES' : '❌ NO');
  }
}

testRaineIssue().catch(console.error);