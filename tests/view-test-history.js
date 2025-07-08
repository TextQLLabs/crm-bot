#!/usr/bin/env node
require('dotenv').config();
const { MongoClient } = require('mongodb');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

async function viewTestHistory() {
  let client = null;
  
  try {
    const MONGODB_URI = process.env.MONGODB_URI || process.env.MDB_MCP_CONNECTION_STRING;
    
    if (!MONGODB_URI) {
      console.log(`${colors.yellow}⚠️  MongoDB URI not found. Showing local logs only.${colors.reset}`);
      require('./view-test-logs');
      return;
    }
    
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    
    await client.connect();
    const db = client.db('crm-bot');
  
  try {
    // Get test runs from MongoDB
    const testRuns = await db.collection('test-runs')
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    
    if (testRuns.length === 0) {
      console.log(`${colors.yellow}No test runs found in MongoDB.${colors.reset}`);
      return;
    }
    
    // Latest run details
    const latest = testRuns[0];
    console.log(`${colors.bright}${colors.cyan}📊 Test Run History (MongoDB)${colors.reset}`);
    console.log(`${colors.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
    
    console.log(`${colors.bright}Latest Run:${colors.reset}`);
    console.log(`⏰ ${new Date(latest.createdAt).toLocaleString()}`);
    console.log(`📈 Success Rate: ${latest.successRate}%`);
    console.log(`⏱️  Duration: ${latest.totalTime}s\n`);
    
    // Show trend
    console.log(`${colors.bright}Success Rate Trend:${colors.reset}`);
    testRuns.slice(0, 5).reverse().forEach(run => {
      const date = new Date(run.createdAt).toLocaleDateString();
      const bar = '█'.repeat(Math.round(run.successRate / 5));
      const spaces = ' '.repeat(20 - Math.round(run.successRate / 5));
      const color = run.successRate >= 80 ? colors.green : 
                   run.successRate >= 60 ? colors.yellow : colors.red;
      
      console.log(`${date} [${color}${bar}${colors.dim}${spaces}${colors.reset}] ${run.successRate}%`);
    });
    
    // Common failures
    console.log(`\n${colors.bright}Common Failures (Last 5 Runs):${colors.reset}`);
    const failureCounts = {};
    
    testRuns.slice(0, 5).forEach(run => {
      run.failedTests?.forEach(test => {
        const key = test.name.replace(/ \(\d+\/\d+\)/, ''); // Remove progress counter
        failureCounts[key] = (failureCounts[key] || 0) + 1;
      });
    });
    
    Object.entries(failureCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([name, count]) => {
        console.log(`  ${colors.red}✗${colors.reset} ${name} (failed ${count} times)`);
      });
    
    // Stats
    console.log(`\n${colors.bright}Overall Stats:${colors.reset}`);
    const avgSuccessRate = testRuns.reduce((sum, r) => sum + r.successRate, 0) / testRuns.length;
    const avgDuration = testRuns.reduce((sum, r) => sum + r.totalTime, 0) / testRuns.length;
    
    console.log(`📊 Avg Success Rate: ${avgSuccessRate.toFixed(1)}%`);
    console.log(`⏱️  Avg Duration: ${avgDuration.toFixed(1)}s`);
    console.log(`📝 Total Runs: ${testRuns.length}`);
    
    // Query examples
    console.log(`\n${colors.dim}💡 MongoDB Query Examples:${colors.reset}`);
    console.log(`${colors.dim}Find all runs with low success rate:${colors.reset}`);
    console.log(`${colors.cyan}db.collection('test-runs').find({ successRate: { $lt: 50 } })${colors.reset}`);
    console.log(`${colors.dim}Find runs where fuzzy search failed:${colors.reset}`);
    console.log(`${colors.cyan}db.collection('test-runs').find({ 'failedTests.name': /fuzzy/i })${colors.reset}`);
    
  } catch (err) {
    console.error(`${colors.red}Error querying MongoDB:${colors.reset}`, err.message);
    console.log(`\n${colors.yellow}Falling back to local logs...${colors.reset}`);
    require('./view-test-logs');
  } finally {
    if (client) {
      await client.close();
    }
    process.exit(0);
  }
}

// Command line arguments
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log('Usage: node view-test-history.js [options]');
  console.log('Options:');
  console.log('  --help       Show this help message');
  console.log('  --detailed   Show full test details');
  console.log('  --export     Export to CSV');
  process.exit(0);
}

viewTestHistory().catch(console.error);