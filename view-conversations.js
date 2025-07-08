#!/usr/bin/env node

const fileStorage = require('./src/services/fileStorage');
const fs = require('fs').promises;
const path = require('path');

async function viewConversations() {
  console.log('📊 CRM Bot Conversation Viewer\n');
  
  try {
    // Get recent conversations
    const conversations = await fileStorage.getRecentConversations(20);
    
    if (conversations.length === 0) {
      console.log('No conversations found yet.');
      console.log('\nData directory: data/conversations/');
      return;
    }
    
    console.log(`Found ${conversations.length} recent conversations:\n`);
    
    conversations.forEach((conv, index) => {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📅 ${conv.timestamp} | #${conv.channelName || conv.channel}`);
      console.log(`👤 ${conv.userName} (${conv.userId})`);
      console.log(`💬 "${conv.userMessage}"`);
      
      if (conv.toolsUsed && conv.toolsUsed.length > 0) {
        console.log(`🛠️  Tools: ${conv.toolsUsed.join(', ')}`);
      }
      
      console.log(`${conv.success ? '✅' : '❌'} Response: ${conv.finalResponse?.substring(0, 200)}...`);
      
      if (conv.agentThoughts && conv.agentThoughts.length > 0) {
        console.log(`\n🧠 Agent Thoughts (${conv.agentThoughts.length} steps):`);
        conv.agentThoughts.slice(0, 3).forEach((thought, i) => {
          console.log(`   ${i + 1}. ${thought.substring(0, 100)}...`);
        });
      }
      
      if (conv.error) {
        console.log(`\n❌ Error: ${conv.error}`);
      }
    });
    
    // Show storage info
    const dataDir = path.join(__dirname, 'data/conversations');
    const files = await fs.readdir(dataDir).catch(() => []);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const logFiles = files.filter(f => f.endsWith('.log'));
    
    console.log(`\n${'='.repeat(80)}`);
    console.log('\n📁 Storage Statistics:');
    console.log(`- Total conversation files: ${jsonFiles.length}`);
    console.log(`- Daily log files: ${logFiles.length}`);
    console.log(`- Data directory: ${dataDir}`);
    
  } catch (error) {
    console.error('Error viewing conversations:', error);
  }
}

// Run the viewer
viewConversations().catch(console.error);