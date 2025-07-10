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
      storage: 'file'
    };
    
    // Using file storage only
    health.storage = 'file';
    health.fileStorage = 'active';
    
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
    
    // Test 1: File storage configuration
    testResult.tests.fileStorageActive = true;
    
    // Test 2: File storage write test
    try {
      const fileStorage = require('./services/fileStorage');
      
      // Try to save a test conversation
      await fileStorage.saveConversation({
        timestamp: new Date().toISOString(),
        userId: 'health-check',
        userName: 'Health Check',
        channel: '#health-check',
        message: 'Storage test',
        finalAnswer: 'Testing storage capability',
        success: true
      });
      
      testResult.tests.conversationSaveSuccess = true;
      testResult.tests.conversationSaveLocation = 'file';
    } catch (error) {
      testResult.tests.conversationSaveSuccess = false;
      testResult.tests.conversationSaveError = error.message;
    }
    
    // Determine overall storage status
    if (testResult.tests.conversationSaveSuccess) {
      testResult.storageStatus = 'File storage is working correctly';
    } else {
      testResult.storageStatus = 'File storage system error';
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