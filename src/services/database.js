const { MongoClient } = require('mongodb');

let db = null;
let client = null;

async function connectDB() {
  try {
    // Use the MongoDB connection from environment
    const MONGODB_URI = process.env.MONGODB_URI || process.env.MDB_MCP_CONNECTION_STRING;
    
    if (!MONGODB_URI) {
      throw new Error('MongoDB connection string not found. Please set MONGODB_URI or MDB_MCP_CONNECTION_STRING');
    }
    
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority'
    });
    
    await client.connect();
    db = client.db('crm-bot');
    
    // Create indexes
    await createIndexes();
    
    console.log('✅ Connected to MongoDB successfully');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
}

async function createIndexes() {
  // Interactions collection
  await db.collection('interactions').createIndex({ timestamp: -1 });
  await db.collection('interactions').createIndex({ userId: 1 });
  await db.collection('interactions').createIndex({ recordId: 1 });
  
  // Cache collection with TTL
  await db.collection('cache').createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 300 } // 5 minute cache
  );
  
  // Errors collection
  await db.collection('errors').createIndex({ timestamp: -1 });
  
  // Conversations collection
  await db.collection('conversations').createIndex({ timestamp: -1 });
  await db.collection('conversations').createIndex({ conversationId: 1 });
  await db.collection('conversations').createIndex({ userId: 1 });
  await db.collection('conversations').createIndex({ threadTs: 1 });
  await db.collection('conversations').createIndex({ channel: 1 });
  await db.collection('conversations').createIndex({ "toolsUsed": 1 });
}

async function logInteraction(interaction) {
  try {
    await db.collection('interactions').insertOne({
      ...interaction,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to log interaction:', error);
  }
}

// Save complete conversation with all context
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
      timestamp: new Date(),
      version: process.env.npm_package_version || '1.11.0',
      environment: process.env.RAILWAY_ENVIRONMENT || 'development'
    };
    
    await db.collection('conversations').insertOne(conversation);
    console.log(`Saved conversation ${conversation.conversationId} to MongoDB`);
    return conversation;
  } catch (error) {
    console.error('Failed to save conversation:', error);
    throw error;
  }
}

// Get conversation history for a thread
async function getConversationHistory(threadTs, channel) {
  try {
    const conversations = await db.collection('conversations')
      .find({ 
        $or: [
          { threadTs: threadTs },
          { conversationId: threadTs }
        ],
        channel: channel
      })
      .sort({ timestamp: -1 })
      .toArray();
    return conversations;
  } catch (error) {
    console.error('Failed to get conversation history:', error);
    return [];
  }
}

async function cacheAttioData(key, data) {
  try {
    await db.collection('cache').replaceOne(
      { key },
      { 
        key,
        data,
        createdAt: new Date()
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('Failed to cache data:', error);
  }
}

async function getCachedData(key) {
  try {
    const result = await db.collection('cache').findOne({ key });
    return result?.data || null;
  } catch (error) {
    console.error('Failed to get cached data:', error);
    return null;
  }
}

async function logError(error, context) {
  try {
    await db.collection('errors').insertOne({
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      timestamp: new Date()
    });
  } catch (dbError) {
    console.error('Failed to log error to DB:', dbError);
  }
}

async function getRecentInteractions(userId, limit = 10) {
  try {
    return await db.collection('interactions')
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  } catch (error) {
    console.error('Failed to get recent interactions:', error);
    return [];
  }
}

async function closeDB() {
  if (client) {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
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