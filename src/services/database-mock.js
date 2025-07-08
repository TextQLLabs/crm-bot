// Mock database service for testing without MongoDB
const interactions = [];
const conversations = [];
const cache = new Map();
const errors = [];

async function connectDB() {
  console.log('Using in-memory database (MongoDB connection bypassed for testing)');
  return true;
}

async function logInteraction(interaction) {
  interactions.push({
    ...interaction,
    timestamp: new Date()
  });
  console.log('Logged interaction:', interaction.message);
}

// Save complete conversation with all context
async function saveConversation(conversationData) {
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
    timestamp: new Date(),
    version: process.env.npm_package_version || '1.11.0',
    environment: process.env.RAILWAY_ENVIRONMENT || 'development'
  };
  
  conversations.push(conversation);
  console.log(`Saved conversation ${conversation.conversationId} to in-memory store`);
  return conversation;
}

// Get conversation history for a thread
async function getConversationHistory(threadTs, channel) {
  return conversations.filter(c => 
    (c.threadTs === threadTs || c.conversationId === threadTs) && 
    c.channel === channel
  ).sort((a, b) => b.timestamp - a.timestamp);
}

async function cacheAttioData(key, data) {
  cache.set(key, {
    data,
    createdAt: new Date()
  });
}

async function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && (new Date() - cached.createdAt) < 300000) { // 5 minutes
    return cached.data;
  }
  return null;
}

async function logError(error, context) {
  errors.push({
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context,
    timestamp: new Date()
  });
  console.error('Error logged:', error.message);
}

async function getRecentInteractions(userId, limit = 10) {
  return interactions
    .filter(i => i.userId === userId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

async function closeDB() {
  console.log('Closed in-memory database');
}

module.exports = {
  connectDB,
  logInteraction,
  saveConversation,
  getConversationHistory,
  cacheAttioData,
  getCachedData,
  logError,
  getRecentInteractions,
  closeDB
};