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
      storage: 'unknown'
    };
    
    // Check MongoDB connection
    try {
      const db = require('./services/database');
      // Try to ping MongoDB
      await db.getDB()?.admin()?.ping();
      health.storage = 'mongodb';
      health.mongodb = 'connected';
    } catch (error) {
      health.storage = 'file';
      health.mongodb = 'not connected';
    }
    
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;