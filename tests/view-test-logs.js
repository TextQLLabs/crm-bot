#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

async function viewTestLogs() {
  const logsDir = path.join(process.cwd(), 'test-logs');
  
  try {
    // Check if logs directory exists
    await fs.access(logsDir);
    
    // Read latest results
    const latestPath = path.join(logsDir, 'latest-results.json');
    const latestData = JSON.parse(await fs.readFile(latestPath, 'utf8'));
    
    console.log(`${colors.bright}${colors.cyan}📊 Latest Test Run Summary${colors.reset}`);
    console.log(`${colors.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
    
    console.log(`⏰ Run Time: ${new Date(latestData.timestamp).toLocaleString()}`);
    console.log(`⏱️  Duration: ${latestData.totalTime}s\n`);
    
    // Results summary
    const passedPercent = Math.round((latestData.passed / latestData.totalTests) * 100);
    const passBar = '█'.repeat(Math.round(passedPercent / 5));
    const failBar = '░'.repeat(20 - Math.round(passedPercent / 5));
    
    console.log(`${colors.green}✓ Passed: ${latestData.passed}${colors.reset} | ${colors.red}✗ Failed: ${latestData.failed}${colors.reset}`);
    console.log(`[${colors.green}${passBar}${colors.red}${failBar}${colors.reset}] ${passedPercent}%\n`);
    
    if (latestData.failedTests.length > 0) {
      console.log(`${colors.bright}${colors.red}Failed Tests:${colors.reset}`);
      latestData.failedTests.forEach(test => {
        console.log(`  ${colors.red}✗${colors.reset} ${test.name}`);
        if (test.error) {
          console.log(`    ${colors.dim}→ ${test.error}${colors.reset}`);
        }
      });
      console.log('');
    }
    
    // List all test runs
    const files = await fs.readdir(logsDir);
    const summaryFiles = files
      .filter(f => f.startsWith('test-summary-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (summaryFiles.length > 1) {
      console.log(`${colors.bright}${colors.cyan}📁 Test History (${summaryFiles.length} runs)${colors.reset}`);
      console.log(`${colors.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
      
      // Show last 5 runs
      for (let i = 0; i < Math.min(5, summaryFiles.length); i++) {
        const summaryPath = path.join(logsDir, summaryFiles[i]);
        const data = JSON.parse(await fs.readFile(summaryPath, 'utf8'));
        const runDate = new Date(data.timestamp).toLocaleString();
        const status = data.failed === 0 ? `${colors.green}✓${colors.reset}` : `${colors.yellow}⚠${colors.reset}`;
        
        console.log(`${status} ${runDate} - ${data.passed}/${data.totalTests} passed (${data.successRate}%)`);
      }
      
      if (summaryFiles.length > 5) {
        console.log(`${colors.dim}... and ${summaryFiles.length - 5} more${colors.reset}`);
      }
    }
    
    console.log(`\n${colors.dim}💡 Tip: View full logs in test-logs/ directory${colors.reset}`);
    
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`${colors.yellow}⚠️  No test logs found. Run 'npm run test:suite' first.${colors.reset}`);
    } else {
      console.error('Error reading logs:', err);
    }
  }
}

// Command line argument handling
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node view-test-logs.js [options]');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('  --all          Show all test runs (not just last 5)');
  process.exit(0);
}

viewTestLogs().catch(console.error);