// Health check for Railway deployment
const express = require('express');
const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.RAILWAY_ENVIRONMENT || 'development',
      nodeVersion: process.version,
      storage: 'unknown',
      mongoUri: !!process.env.MONGODB_URI || !!process.env.MDB_MCP_CONNECTION_STRING
    };
    
    // Check MongoDB connection
    try {
      const db = require('./services/database');
      const dbInstance = db.getDB();
      
      if (dbInstance) {
        // Try to ping MongoDB
        await dbInstance.admin().ping();
        health.storage = 'mongodb';
        health.mongodb = 'connected';
        
        // Get conversation count
        const count = await dbInstance.collection('conversations').countDocuments();
        health.conversationCount = count;
      } else {
        // Database not initialized
        health.storage = 'file';
        health.mongodb = 'not initialized';
      }
    } catch (error) {
      health.storage = 'file';
      health.mongodb = `error: ${error.message}`;
    }
    
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Add a test endpoint to verify storage
router.get('/health/storage-test', async (req, res) => {
  try {
    const pkg = require('../package.json');
    const testResult = {
      timestamp: new Date().toISOString(),
      version: pkg.version,
      environment: process.env.RAILWAY_ENVIRONMENT || 'development',
      tests: {}
    };
    
    // Test 1: Check if MongoDB URI exists
    testResult.tests.mongoUriConfigured = !!process.env.MONGODB_URI || !!process.env.MDB_MCP_CONNECTION_STRING;
    
    // Test 2: Try to save a test conversation
    try {
      const { ReactAgent } = require('./services/reactAgent');
      const agent = new ReactAgent();
      
      // Check what storage type the agent is using
      testResult.tests.agentStorageType = agent.storageType || 'unknown';
      
      // Try to save a test conversation
      await agent.saveConversation({
        conversationId: 'health-check-' + Date.now(),
        userId: 'health-check',
        userName: 'Health Check',
        channel: '#health-check',
        userMessage: 'Storage test',
        finalResponse: 'Testing storage capability',
        success: true
      });
      
      testResult.tests.conversationSaveSuccess = true;
      testResult.tests.conversationSaveLocation = agent.storageType;
    } catch (error) {
      testResult.tests.conversationSaveSuccess = false;
      testResult.tests.conversationSaveError = error.message;
    }
    
    // Determine overall storage status
    if (testResult.tests.conversationSaveSuccess && testResult.tests.agentStorageType === 'mongodb') {
      testResult.storageStatus = 'MongoDB is working correctly';
    } else if (testResult.tests.conversationSaveSuccess && testResult.tests.agentStorageType === 'file') {
      testResult.storageStatus = 'Using file storage (MongoDB not available)';
    } else {
      testResult.storageStatus = 'Storage system error';
    }
    
    res.json(testResult);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;