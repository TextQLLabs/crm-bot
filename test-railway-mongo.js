// Test MongoDB connection for Railway deployment
require('dotenv').config();

console.log('🚂 Testing MongoDB for Railway Deployment\n');
console.log('Node Version:', process.version);
console.log('Environment:', process.env.RAILWAY_ENVIRONMENT || 'local');

async function testMongoDB() {
  try {
    // Load production config
    if (process.env.RAILWAY_ENVIRONMENT) {
      require('./src/config/production');
    }
    
    const { connectDB, saveConversation, getDB } = require('./src/services/database');
    
    console.log('\n1️⃣ Connecting to MongoDB...');
    await connectDB();
    console.log('✅ Connected successfully!');
    
    console.log('\n2️⃣ Testing database operations...');
    
    // Test saving a conversation
    const testConversation = {
      conversationId: 'test-' + Date.now(),
      userId: 'test-user',
      userName: 'Test User',
      channel: '#test',
      userMessage: 'Testing MongoDB on Railway',
      agentThoughts: ['Testing connection'],
      agentActions: [],
      finalResponse: 'Test successful',
      toolsUsed: [],
      success: true,
      processingTime: 100,
      attachmentCount: 0,
      iterationCount: 1
    };
    
    await saveConversation(testConversation);
    console.log('✅ Save operation successful!');
    
    // Test database ping
    console.log('\n3️⃣ Testing database ping...');
    const db = getDB();
    await db.admin().ping();
    console.log('✅ Database ping successful!');
    
    // Get collection stats
    console.log('\n4️⃣ Getting collection stats...');
    const stats = await db.collection('conversations').stats();
    console.log(`📊 Conversations collection: ${stats.count} documents, ${(stats.size / 1024).toFixed(2)} KB`);
    
    console.log('\n✅ All tests passed! MongoDB is ready for Railway.');
    
  } catch (error) {
    console.error('\n❌ MongoDB test failed!');
    console.error('Error:', error.message);
    
    if (error.message.includes('tlsv1') || error.message.includes('SSL')) {
      console.error('\n⚠️  This appears to be a TLS/SSL issue.');
      console.error('Current Node version:', process.version);
      console.error('Railway should use Node 22 which fixes this issue.');
    }
  } finally {
    // Close connection
    const { closeDB } = require('./src/services/database');
    await closeDB();
  }
}

testMongoDB().catch(console.error);