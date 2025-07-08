#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function testConnection() {
  console.log('🔍 Testing MongoDB Connection...\n');
  
  // Check for connection strings
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MDB_MCP_CONNECTION_STRING;
  
  console.log('Environment variables found:');
  console.log('- MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Not set');
  console.log('- MDB_MCP_CONNECTION_STRING:', process.env.MDB_MCP_CONNECTION_STRING ? '✅ Set' : '❌ Not set');
  console.log('- Using:', MONGODB_URI ? 'Found connection string' : '❌ No connection string found');
  
  if (!MONGODB_URI) {
    console.error('\n❌ No MongoDB connection string found!');
    console.error('Please set either MONGODB_URI or MDB_MCP_CONNECTION_STRING');
    process.exit(1);
  }
  
  // Parse and display connection info (hide password)
  try {
    const url = new URL(MONGODB_URI);
    console.log('\nConnection details:');
    console.log('- Host:', url.hostname);
    console.log('- Database:', url.pathname.slice(1).split('?')[0] || 'default');
    console.log('- User:', url.username);
    console.log('- Password:', url.password ? '***' : 'None');
  } catch (e) {
    console.log('\nCould not parse connection string');
  }
  
  let client;
  try {
    console.log('\n📡 Attempting to connect...');
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    
    await client.connect();
    console.log('✅ Successfully connected to MongoDB!');
    
    // Test database access
    const db = client.db('crm-bot');
    console.log('\n📊 Testing database operations...');
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log('\nExisting collections:', collections.map(c => c.name));
    
    // Test write
    const testDoc = {
      test: true,
      timestamp: new Date(),
      message: 'Connection test from crm-bot'
    };
    
    const result = await db.collection('connection-tests').insertOne(testDoc);
    console.log('\n✅ Write test successful! Document ID:', result.insertedId);
    
    // Test read
    const readBack = await db.collection('connection-tests').findOne({ _id: result.insertedId });
    console.log('✅ Read test successful! Found document:', readBack);
    
    // Check conversations collection
    console.log('\n📋 Checking conversations collection...');
    const conversationCount = await db.collection('conversations').countDocuments();
    console.log(`Found ${conversationCount} conversations in database`);
    
    // Show recent conversations
    if (conversationCount > 0) {
      const recentConversations = await db.collection('conversations')
        .find({})
        .sort({ timestamp: -1 })
        .limit(3)
        .toArray();
      
      console.log('\nRecent conversations:');
      recentConversations.forEach(conv => {
        console.log(`- ${conv.timestamp}: User ${conv.userName || conv.userId} - "${conv.userMessage?.substring(0, 50)}..."`);
      });
    }
    
    console.log('\n✅ All tests passed! MongoDB is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error('Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n👋 Connection closed');
    }
  }
}

// Run the test
testConnection().catch(console.error);