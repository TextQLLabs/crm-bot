#!/usr/bin/env node
require('dotenv').config();

// Simple test that just saves to local file to verify test results
const fs = require('fs').promises;
const path = require('path');

async function testLocalSave() {
  console.log('🧪 Testing Local Save (MongoDB appears to have SSL issues with Node.js v24)\n');
  
  const testResult = {
    timestamp: new Date().toISOString(),
    successRate: 46.2,
    passed: 6,
    failed: 7,
    totalTests: 13,
    nodeVersion: process.version,
    mongoIssue: 'TLS/SSL error with Node.js v24.1.0'
  };
  
  try {
    // Create test-logs directory
    const logsDir = path.join(process.cwd(), 'test-logs');
    await fs.mkdir(logsDir, { recursive: true });
    
    // Save test file
    const filename = `test-local-${Date.now()}.json`;
    const filepath = path.join(logsDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(testResult, null, 2));
    
    console.log('✅ Local save successful!');
    console.log(`   File: ${filepath}`);
    console.log(`   Content: ${JSON.stringify(testResult, null, 2)}`);
    
    // Note about MongoDB
    console.log('\n⚠️  MongoDB SSL Issue:');
    console.log('   Node.js v24 has stricter TLS requirements');
    console.log('   MongoDB Atlas might need driver update');
    console.log('   Local file backup is working correctly');
    
    console.log('\n💡 Options:');
    console.log('   1. Use Node.js v20 or v22 (LTS versions)');
    console.log('   2. Wait for MongoDB driver update');
    console.log('   3. Use local file storage for now');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testLocalSave();