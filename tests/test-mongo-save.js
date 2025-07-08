#!/usr/bin/env node
require('dotenv').config();
const { MongoClient } = require('mongodb');

// ANSI colors
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

async function testMongoSave() {
  console.log(`${colors.cyan}🧪 Testing MongoDB Connection & Save${colors.reset}\n`);
  
  let client = null;
  
  try {
    // Check for connection string
    const MONGODB_URI = process.env.MONGODB_URI || process.env.MDB_MCP_CONNECTION_STRING;
    
    if (!MONGODB_URI) {
      console.log(`${colors.red}❌ No MongoDB URI found in environment variables${colors.reset}`);
      console.log('   Looking for: MONGODB_URI or MDB_MCP_CONNECTION_STRING');
      return;
    }
    
    console.log(`${colors.green}✓ MongoDB URI found${colors.reset}`);
    console.log(`   Length: ${MONGODB_URI.length} characters`);
    console.log(`   Starts with: ${MONGODB_URI.substring(0, 20)}...`);
    
    // Try to connect
    console.log(`\n${colors.yellow}🔌 Connecting to MongoDB...${colors.reset}`);
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      tls: true,
      // Node.js 24 might have stricter TLS settings
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false
    });
    
    await client.connect();
    console.log(`${colors.green}✓ Connected successfully${colors.reset}`);
    
    // Select database
    const db = client.db('crm-bot');
    console.log(`${colors.green}✓ Selected database: crm-bot${colors.reset}`);
    
    // Create test document
    const testDoc = {
      _id: `test-${Date.now()}`,
      type: 'connection-test',
      timestamp: new Date(),
      message: 'Test save from test-mongo-save.js',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version
    };
    
    // Try to save
    console.log(`\n${colors.yellow}💾 Saving test document...${colors.reset}`);
    const result = await db.collection('test-runs').insertOne(testDoc);
    
    if (result.acknowledged) {
      console.log(`${colors.green}✓ Document saved successfully!${colors.reset}`);
      console.log(`   Document ID: ${testDoc._id}`);
      
      // Try to read it back
      console.log(`\n${colors.yellow}📖 Reading document back...${colors.reset}`);
      const savedDoc = await db.collection('test-runs').findOne({ _id: testDoc._id });
      
      if (savedDoc) {
        console.log(`${colors.green}✓ Document retrieved successfully${colors.reset}`);
        console.log(`   Content: ${JSON.stringify(savedDoc, null, 2)}`);
      }
      
      // Count total documents
      const count = await db.collection('test-runs').countDocuments();
      console.log(`\n${colors.cyan}📊 Total documents in test-runs: ${count}${colors.reset}`);
      
    } else {
      console.log(`${colors.red}❌ Failed to save document${colors.reset}`);
    }
    
  } catch (error) {
    console.log(`\n${colors.red}❌ Error: ${error.message}${colors.reset}`);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('   MongoDB server is not reachable');
    } else if (error.message.includes('authentication')) {
      console.log('   Authentication failed - check credentials');
    } else if (error.message.includes('timeout')) {
      console.log('   Connection timed out - check network/firewall');
    }
    
    console.log(`\n${colors.yellow}Full error:${colors.reset}`);
    console.log(error);
    
  } finally {
    if (client) {
      console.log(`\n${colors.yellow}🔌 Closing connection...${colors.reset}`);
      await client.close();
      console.log(`${colors.green}✓ Connection closed${colors.reset}`);
    }
  }
}

testMongoSave().catch(console.error);