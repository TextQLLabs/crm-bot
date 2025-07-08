#!/usr/bin/env node

// Simple test to check MongoDB status via MCP Slack bot
const testMongoDBStatus = async () => {
  console.log('🔍 Testing MongoDB status on Railway deployment...\n');
  
  console.log('This test will:');
  console.log('1. Send a test message to the CRM bot');
  console.log('2. Check if the conversation is saved');
  console.log('3. Report the storage type being used\n');
  
  console.log('To run this test:');
  console.log('1. Wait ~30 seconds for Railway deployment');
  console.log('2. Send a message to the bot in Slack');
  console.log('3. Check the health endpoint: https://crm-bot-production.up.railway.app/health');
  console.log('4. Check storage test: https://crm-bot-production.up.railway.app/health/storage-test\n');
  
  console.log('Expected results if MongoDB is working:');
  console.log('- storage: "mongodb"');
  console.log('- mongodb: "connected"');
  console.log('- conversationCount: <number>');
  console.log('- Bot responses include: "💾 Conversation saved successfully (MongoDB)"\n');
  
  console.log('If MongoDB is NOT working:');
  console.log('- storage: "file"');
  console.log('- mongodb: "not connected" or "not initialized"');
  console.log('- Bot responses include: "💾 Conversation saved successfully (File storage)"\n');
};

testMongoDBStatus();