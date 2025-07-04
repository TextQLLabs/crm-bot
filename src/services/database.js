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
      tls: true,
      tlsAllowInvalidHostnames: false,
      tlsAllowInvalidCertificates: false,
      serverSelectionTimeoutMS: 5000,
      family: 4 // Force IPv4
    });
    await client.connect();
    db = client.db('crm-bot');
    
    // Create indexes
    await createIndexes();
    
    console.log('Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
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
  cacheAttioData,
  getCachedData,
  logError,
  getRecentInteractions,
  closeDB
};