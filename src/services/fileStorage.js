const fs = require('fs').promises;
const path = require('path');

// Create data directory if it doesn't exist
const DATA_DIR = path.join(__dirname, '../../data');
const CONVERSATIONS_DIR = path.join(DATA_DIR, 'conversations');

async function ensureDirectories() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(CONVERSATIONS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating directories:', error);
  }
}

// Initialize directories on load
ensureDirectories();

async function saveConversation(conversationData) {
  try {
    const conversation = {
      conversationId: conversationData.threadTs || conversationData.messageTs,
      userId: conversationData.userId,
      userName: conversationData.userName,
      channel: conversationData.channel,
      channelName: conversationData.channelName,
      threadTs: conversationData.threadTs,
      messageTs: conversationData.messageTs,
      userMessage: conversationData.userMessage,
      conversationHistory: conversationData.conversationHistory || [],
      botActionHistory: conversationData.botActionHistory || [],
      agentThoughts: conversationData.agentThoughts || [],
      agentActions: conversationData.agentActions || [],
      finalResponse: conversationData.finalResponse,
      toolsUsed: conversationData.toolsUsed || [],
      success: conversationData.success !== undefined ? conversationData.success : true,
      error: conversationData.error || null,
      processingTime: conversationData.processingTime || 0,
      attachmentCount: conversationData.attachmentCount || 0,
      iterationCount: conversationData.iterationCount || 0,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.11.1',
      environment: process.env.RAILWAY_ENVIRONMENT || 'development'
    };
    
    // Create filename with timestamp and conversation ID
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_${conversation.conversationId}.json`;
    const filepath = path.join(CONVERSATIONS_DIR, filename);
    
    // Save to file
    await fs.writeFile(filepath, JSON.stringify(conversation, null, 2));
    console.log(`💾 Saved conversation to file: ${filename}`);
    
    // Also append to daily log file
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(CONVERSATIONS_DIR, `conversations_${today}.log`);
    const logEntry = JSON.stringify(conversation) + '\n';
    await fs.appendFile(logFile, logEntry);
    
    return conversation;
  } catch (error) {
    console.error('Failed to save conversation to file:', error);
    throw error;
  }
}

async function getConversationHistory(threadTs, channel) {
  try {
    const files = await fs.readdir(CONVERSATIONS_DIR);
    const conversations = [];
    
    // Read all conversation files for this thread
    for (const file of files) {
      if (file.endsWith('.json') && file.includes(threadTs)) {
        const filepath = path.join(CONVERSATIONS_DIR, file);
        const data = await fs.readFile(filepath, 'utf8');
        const conversation = JSON.parse(data);
        
        if (conversation.channel === channel) {
          conversations.push(conversation);
        }
      }
    }
    
    // Sort by timestamp
    conversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return conversations;
  } catch (error) {
    console.error('Failed to get conversation history:', error);
    return [];
  }
}

async function getRecentConversations(limit = 10) {
  try {
    const files = await fs.readdir(CONVERSATIONS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();
    const conversations = [];
    
    for (let i = 0; i < Math.min(limit, jsonFiles.length); i++) {
      const filepath = path.join(CONVERSATIONS_DIR, jsonFiles[i]);
      const data = await fs.readFile(filepath, 'utf8');
      conversations.push(JSON.parse(data));
    }
    
    return conversations;
  } catch (error) {
    console.error('Failed to get recent conversations:', error);
    return [];
  }
}

module.exports = {
  saveConversation,
  getConversationHistory,
  getRecentConversations
};