// Test script to debug the notes formatting issue
const { ReactAgent } = require('./src/services/reactAgent');

async function testNotesFormatting() {
  console.log('Testing notes formatting for Slack...\n');
  
  const agent = new ReactAgent();
  
  // Simulate the user's request
  const message = {
    text: 'can you find any notes on The Raine Group deal?',
    userName: 'Test User',
    channel: '#test',
    userId: 'U123456',
    threadTs: '123456789.123456',
    messageTs: '123456789.123456'
  };
  
  console.log('Processing message:', message.text);
  
  try {
    const result = await agent.processMessage(message);
    
    console.log('\nResult:');
    console.log('Success:', result.success);
    console.log('Answer length:', result.answer?.length || 0);
    console.log('\nFormatted answer:');
    console.log(result.answer);
    
    // Check for problematic characters
    if (result.answer) {
      const problematicChars = result.answer.match(/[<>&]/g);
      if (problematicChars) {
        console.log('\nWARNING: Found unescaped characters:', [...new Set(problematicChars)]);
      }
      
      // Check for markdown issues
      const doubleAsterisks = result.answer.match(/\*\*/g);
      if (doubleAsterisks) {
        console.log('WARNING: Found ** (should be single * for Slack)');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testNotesFormatting().catch(console.error);