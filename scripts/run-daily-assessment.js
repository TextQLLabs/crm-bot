#!/usr/bin/env node

/**
 * Railway Cron Job Script for Daily Deal Assessments
 * 
 * This script is executed by Railway's cron service daily at 8:00 AM.
 * It triggers the daily assessment job and exits with appropriate codes.
 */

require('dotenv').config();
const { CronScheduler } = require('../src/jobs');

async function runDailyAssessment() {
  console.log('🚀 Railway Cron Job: Starting daily deal assessment...');
  console.log(`⏰ Execution time: ${new Date().toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
  
  try {
    // Create scheduler instance
    const scheduler = new CronScheduler();
    
    // Run the daily assessment
    const result = await scheduler.triggerDailyAssessment();
    
    console.log('✅ Daily assessment completed');
    console.log('📊 Result summary:', JSON.stringify({
      success: result.success,
      totalDeals: result.runSummary?.totalDeals || 0,
      processedDeals: result.runSummary?.processedDeals || 0,
      successfulAssessments: result.runSummary?.successfulAssessments || 0,
      failedAssessments: result.runSummary?.failedAssessments || 0,
      durationMinutes: result.runSummary?.durationMinutes || 0
    }, null, 2));
    
    // Exit with success code
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Daily assessment failed with error:', error.message);
    console.error('🔍 Full error:', error);
    
    // Exit with error code
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception in daily assessment:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection in daily assessment:', reason);
  process.exit(1);
});

// Run the assessment
runDailyAssessment();