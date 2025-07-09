const { ReactAgent } = require('./src/services/reactAgent');
const dotenv = require('dotenv');

// Load environment
dotenv.config();

async function testNotesQuery() {
  console.log('Testing simplified notes handling...\n');
  
  const agent = new ReactAgent();
  
  // Test query that causes issues
  const query = "can you find any notes on The Raine Group deal?";
  console.log('Query:', query);
  
  try {
    const result = await agent.processMessage({
      text: query,
      userName: 'Test User',
      userId: 'TEST123',
      channel: 'test-channel',
      attachments: [],
      isThreaded: false,
      threadTs: '123456',
      messageTs: '123456',
      conversationHistory: [],
      botActionHistory: []
    }, { preview: false });
    
    console.log('\n✅ SUCCESS!');
    console.log('Answer:', result.answer);
    console.log('Answer length:', result.answer?.length || 0);
    console.log('Success:', result.success);
    
    // Check if notes action was performed
    const hasNotesAction = result.steps?.some(s => s.action === 'get_notes');
    console.log('Used get_notes:', hasNotesAction);
    
    // Display answer format
    console.log('\n--- ANSWER FORMAT ---');
    console.log(result.answer);
    console.log('--- END ANSWER ---');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

// Run the test
testNotesQuery();