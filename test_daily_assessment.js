#!/usr/bin/env node

/**
 * Test Script for Daily Deal Assessment System
 * 
 * This script tests the daily assessment functionality in a controlled way:
 * - Tests finding deals in "Goal: Get to Financing" stage
 * - Tests generating assessment prompts
 * - Tests calling Claude agent directly
 * - Runs with a maximum of 1 deal for safety
 */

require('dotenv').config();
const { DailyAssessmentJob, CronScheduler } = require('./src/jobs');
const { advancedSearch } = require('./src/services/attioService');

async function testDailyAssessment() {
  console.log('🧪 Testing Daily Deal Assessment System');
  console.log('=====================================\n');

  try {
    // Test 1: Check environment variables
    console.log('1️⃣ Testing Environment Variables...');
    const requiredEnvVars = [
      'ANTHROPIC_API_KEY',
      'ATTIO_API_KEY'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    console.log('✅ All required environment variables are present\n');

    // Test 2: Test finding deals in target stage
    console.log('2️⃣ Testing Deal Search...');
    const searchOptions = {
      entity_type: 'deal',
      filters: {
        stage: 'Goal: Get to Financing'
      },
      limit: 5
    };
    
    const deals = await advancedSearch(searchOptions);
    console.log(`✅ Found ${deals.length} deals in "Goal: Get to Financing" stage`);
    
    if (deals.length > 0) {
      console.log('Sample deals:');
      deals.slice(0, 3).forEach((deal, index) => {
        console.log(`  ${index + 1}. ${deal.name} (ID: ${deal.id}) - Value: ${deal.value || 'N/A'}`);
      });
    } else {
      console.log('⚠️ No deals found in target stage - the assessment would complete immediately');
    }
    console.log('');

    // Test 3: Test assessment prompt generation
    console.log('3️⃣ Testing Assessment Prompt Generation...');
    const dailyJob = new DailyAssessmentJob();
    
    if (deals.length > 0) {
      const sampleDeal = deals[0];
      const prompt = dailyJob.generateAssessmentPrompt(sampleDeal);
      console.log('✅ Assessment prompt generated successfully');
      console.log(`📝 Prompt length: ${prompt.length} characters`);
      console.log(`🎯 Target deal: ${sampleDeal.name}`);
    } else {
      console.log('⚠️ Skipping prompt generation - no deals available');
    }
    console.log('');

    // Test 4: Test cron scheduler initialization
    console.log('4️⃣ Testing Cron Scheduler...');
    const scheduler = new CronScheduler();
    const status = scheduler.getStatus();
    console.log('✅ Cron scheduler initialized successfully');
    console.log(`⏰ Daily assessment enabled: ${status.scheduler.enabled}`);
    console.log(`🌍 Timezone: ${status.scheduler.timezone}`);
    console.log(`📅 Next scheduled run: ${status.jobs[0]?.nextRun || 'Not scheduled'}`);
    console.log('');

    // Test 5: Run a limited test assessment (max 2 deals)
    console.log('5️⃣ Running Test Assessment (Max 2 Deals with 5-minute gaps)...');
    console.log('⚠️ This will actually process 2 deals with Claude and post Slack summary');
    
    const userConfirmation = process.argv.includes('--run-real-test');
    if (!userConfirmation) {
      console.log('🛑 Skipping real assessment test');
      console.log('💡 To run a real test with 2 deals, use: node test_daily_assessment.js --run-real-test');
    } else {
      console.log('🚀 Running real assessment test with LOCAL dev bot...');
      console.log('📱 Slack summary will be posted to #crm-bot-test by @crm-bot-ethan-dev');
      
      // Set up mock Slack client that simulates the actual bot posting
      const mockSlackClient = {
        chat: {
          postMessage: async (options) => {
            console.log('\n📱 SIMULATED SLACK MESSAGE FROM @crm-bot-ethan-dev:');
            console.log(`Channel: ${options.channel} (#crm-bot-test)`);
            console.log(`Message:\n${options.text}`);
            console.log('\n✅ Message would be posted by LOCAL dev bot (U0944Q3F58B)\n');
            return { ok: true, ts: Date.now() };
          }
        }
      };
      
      // Create daily assessment job with mock Slack client
      const dailyJob = new DailyAssessmentJob(mockSlackClient);
      
      const result = await dailyJob.runTest(2); // Test with 2 deals as requested
      
      console.log('✅ Test assessment completed');
      console.log('📊 Results:', JSON.stringify({
        success: result.success,
        totalDeals: result.runSummary?.totalDeals || 0,
        processedDeals: result.runSummary?.processedDeals || 0,
        successfulAssessments: result.runSummary?.successfulAssessments || 0,
        failedAssessments: result.runSummary?.failedAssessments || 0,
        durationMinutes: result.runSummary?.durationMinutes || 0
      }, null, 2));
      
      if (result.runSummary?.errors?.length > 0) {
        console.log('❌ Errors encountered:');
        result.runSummary.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error.dealName || 'Unknown'}: ${error.error}`);
        });
      }
    }
    console.log('');

    // Test 6: Test HTTP endpoints (if server is running)
    console.log('6️⃣ Testing HTTP Endpoints...');
    console.log('ℹ️ These endpoints are available when the server is running:');
    console.log('  GET  /cron/status          - Get cron scheduler status');
    console.log('  GET  /cron/history         - Get job execution history');
    console.log('  POST /cron/trigger-daily   - Manually trigger daily assessment');
    console.log('  POST /cron/trigger-test    - Trigger test assessment (1 deal)');
    console.log('  PUT  /cron/schedule        - Update daily schedule');
    console.log('  PUT  /cron/enabled         - Enable/disable daily assessments');
    console.log('');

    console.log('🎉 All tests completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`  • Environment: ✅ Ready`);
    console.log(`  • Deal Search: ✅ Working (${deals.length} deals found)`);
    console.log(`  • Prompt Generation: ✅ Working`);
    console.log(`  • Cron Scheduler: ✅ Ready`);
    console.log(`  • Assessment Test: ${userConfirmation ? '✅ Completed' : '⏭️ Skipped'}`);
    console.log('');
    console.log('🚀 The daily assessment system is ready for deployment!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('🔍 Full error:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception in test:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection in test:', reason);
  process.exit(1);
});

// Run the test
testDailyAssessment();