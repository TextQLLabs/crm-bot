#!/usr/bin/env node

require('dotenv').config();

async function testSlackMCPAdvancedSearch() {
  console.log('🔍 Testing advanced_search via Slack MCP...\n');
  
  // Test using the Slack MCP to post a message that should trigger advanced_search
  try {
    const { mcp__slack__slack_post_message } = require('./src/services/slackMCP');
    
    // Post a message that should trigger advanced_search with stage filter
    const message = 'Find all deals in stage "Goal: Get to Financing"';
    const channelId = 'C0946T1T4CB'; // #crm-bot-test channel
    
    console.log(`Posting message: "${message}" to channel ${channelId}`);
    
    const result = await mcp__slack__slack_post_message({
      channel_id: channelId,
      text: message
    });
    
    console.log('✅ Message posted successfully!');
    console.log('Result:', result);
    
    // Wait a bit for the bot to process and respond
    console.log('\n⏳ Waiting 5 seconds for bot response...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check for the response
    const { mcp__slack__slack_get_channel_history } = require('./src/services/slackMCP');
    const history = await mcp__slack__slack_get_channel_history({
      channel_id: channelId,
      limit: 5
    });
    
    console.log('\n📝 Recent channel messages:');
    history.messages.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg.user}: ${msg.text.substring(0, 100)}...`);
    });
    
  } catch (error) {
    console.error('❌ Slack MCP test failed:', error.message);
    console.error('Error details:', error);
  }
}

testSlackMCPAdvancedSearch().catch(console.error);