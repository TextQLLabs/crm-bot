#!/usr/bin/env node

const { ReactAgent } = require('./src/services/reactAgent');
const fileStorage = require('./src/services/fileStorage');
require('dotenv').config();

async function testConversationSave() {
  console.log('🧪 Testing Conversation Save Feature\n');
  
  const agent = new ReactAgent();
  
  // Test message
  const testMessage = {
    text: "Find information about The Raine Group",
    userName: "Test User",
    userId: "U123TEST",
    channel: "C123TEST",
    threadTs: "1234567890.123456",
    messageTs: "1234567890.123456",
    conversationHistory: [
      { user: "U123TEST", text: "Hi bot!", ts: "1234567890.123455" }
    ],
    botActionHistory: []
  };
  
  console.log('📤 Sending test message:', testMessage.text);
  console.log('⏳ Processing with ReactAgent...\n');
  
  try {
    const result = await agent.processMessage(testMessage);
    
    console.log('\n✅ Processing complete!');
    console.log('Success:', result.success);
    console.log('Answer:', result.answer?.substring(0, 200) + '...');
    console.log('Steps:', result.steps.length);
    console.log('Tools used:', [...new Set(result.steps.map(s => s.action).filter(Boolean))]);
    
    // Check if conversation was saved
    console.log('\n📁 Checking saved conversations...');
    const conversations = await fileStorage.getRecentConversations(5);
    console.log(`Found ${conversations.length} saved conversations`);
    
    if (conversations.length > 0) {
      const latest = conversations[0];
      console.log('\n🔍 Latest conversation:');
      console.log('- User:', latest.userName);
      console.log('- Message:', latest.userMessage);
      console.log('- Response:', latest.finalResponse?.substring(0, 100) + '...');
      console.log('- Tools:', latest.toolsUsed);
      console.log('- Processing time:', latest.processingTime + 'ms');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testConversationSave().catch(console.error);