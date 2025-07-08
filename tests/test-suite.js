#!/usr/bin/env node
require('dotenv').config();
const { ReactAgent } = require('./src/services/reactAgent');
const { MongoClient } = require('mongodb');
const readline = require('readline');

// ANSI color codes and symbols
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m'
};

const symbols = {
  success: '✓',
  failure: '✗',
  pending: '○',
  running: '◉',
  arrow: '→',
  tool: '🔧',
  time: '⏱️',
  search: '🔍',
  note: '📝',
  create: '➕',
  update: '✏️',
  web: '🌐'
};

// Test suite definition
const testSuite = [
  {
    category: 'Fuzzy Search',
    tests: [
      {
        name: 'Exact company name match',
        input: 'find The Raine Group',
        expectedTools: ['search_crm'],
        expectedSuccess: true,
        validation: (result) => result.answer && result.answer.includes('https://app.attio.com')
      },
      {
        name: 'Misspelling: rain → raine',
        input: 'search for rain group',
        expectedTools: ['search_crm'],
        expectedSuccess: true,
        validation: (result) => result.answer && result.answer.toLowerCase().includes('raine')
      },
      {
        name: 'Misspelling: rayne → raine',
        input: 'find rayne group company',
        expectedTools: ['search_crm'],
        expectedSuccess: true,
        validation: (result) => result.answer && result.answer.toLowerCase().includes('raine')
      },
      {
        name: 'Partial name search',
        input: 'find companies with Raine in the name',
        expectedTools: ['search_crm'],
        expectedSuccess: true,
        validation: (result) => result.answer && result.answer.includes('https://app.attio.com')
      },
      {
        name: 'Non-existent company triggers web search',
        input: 'find XYZ123456 Corporation',
        expectedTools: ['search_crm', 'web_search'],
        expectedSuccess: true,
        validation: (result) => result.answer && (result.answer.includes('not found') || result.answer.includes('does not exist'))
      }
    ]
  },
  {
    category: 'Search Operations',
    tests: [
      {
        name: 'Search for people',
        input: 'find person named John',
        expectedTools: ['search_crm'],
        expectedSuccess: true,
        validation: (result) => result.answer && !result.answer.includes('error')
      },
      {
        name: 'Search for deals',
        input: 'find deals worth more than 100k',
        expectedTools: ['search_crm'],
        expectedSuccess: true,
        validation: (result) => result.answer && !result.answer.includes('error')
      },
      {
        name: 'Multi-entity search',
        input: 'search for anything related to media',
        expectedTools: ['search_crm'],
        expectedSuccess: true,
        validation: (result) => result.answer && !result.answer.includes('error')
      }
    ]
  },
  {
    category: 'Note Creation',
    tests: [
      {
        name: 'Create note with entity search',
        input: 'add a note to The Raine Group saying "Test note from automated suite"',
        expectedTools: ['search_crm', 'create_note'],
        expectedSuccess: true,
        validation: (result) => result.preview === true && result.pendingAction?.action === 'create_note',
        isWriteOperation: true
      },
      {
        name: 'Note on non-existent entity',
        input: 'add a note to XYZ123 Corporation saying "This should fail"',
        expectedTools: ['search_crm'],
        expectedSuccess: true,
        validation: (result) => result.answer && result.answer.includes('not found')
      }
    ]
  },
  {
    category: 'Entity Details',
    tests: [
      {
        name: 'Get company details',
        input: 'tell me more about The Raine Group',
        expectedTools: ['search_crm'],
        expectedSuccess: true,
        validation: (result) => result.answer && result.answer.includes('https://app.attio.com')
      }
    ]
  },
  {
    category: 'Error Handling',
    tests: [
      {
        name: 'Ambiguous request handling',
        input: 'find',
        expectedTools: [],
        expectedSuccess: true,
        validation: (result) => result.answer && result.answer.toLowerCase().includes('specific')
      },
      {
        name: 'Empty search query',
        input: 'search for ""',
        expectedTools: ['search_crm'],
        expectedSuccess: true,
        validation: (result) => result.answer !== undefined
      }
    ]
  }
];

// Test runner class
class TestRunner {
  constructor() {
    this.agent = new ReactAgent();
    this.results = [];
    this.startTime = Date.now();
    this.logBuffer = [];
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    // Detect if running in real terminal or force simple output
    this.isTTY = process.stdout.isTTY && !process.env.SIMPLE_OUTPUT;
  }

  log(message, includeInFile = true) {
    console.log(message);
    if (includeInFile) {
      this.logBuffer.push(message);
    }
  }

  async runAllTests() {
    if (this.isTTY) {
      console.clear();
    }
    this.printHeader();
    
    // Count total tests first
    const totalTestCount = testSuite.reduce((sum, cat) => sum + cat.tests.length, 0);
    let completedTests = 0;
    let passedTests = 0;
    let totalToolCalls = 0;
    let totalResponseTime = 0;

    for (const category of testSuite) {
      this.printCategoryHeader(category.category);
      
      for (const test of category.tests) {
        completedTests++;
        // Show progress in test name
        const testWithProgress = `${test.name} (${completedTests}/${totalTestCount})`;
        const result = await this.runSingleTest({ ...test, name: testWithProgress }, completedTests);
        
        if (result.success) passedTests++;
        totalToolCalls += result.toolCalls;
        totalResponseTime += result.responseTime;
        
        this.results.push(result);
      }
      
      this.log('', false); // Empty line between categories - don't save to file
    }

    await this.printSummary(totalTestCount, passedTests, totalToolCalls, totalResponseTime);
  }

  async runSingleTest(test, testNumber) {
    const startTime = Date.now();
    let success = false;
    let toolCalls = 0;
    let actualTools = [];
    let error = null;
    const TIMEOUT = 30000; // 30 second timeout per test

    // Update status to running
    if (this.isTTY) {
      this.updateTestLine(testNumber, test.name, 'running');
    } else {
      console.log(`⏳ Running: ${test.name}`);
    }

    try {
      // Run the test with timeout
      const result = await Promise.race([
        this.agent.processMessage({
          text: test.input,
          userName: 'Test Suite',
          channel: 'test',
          attachments: [],
          preview: test.isWriteOperation // Use preview mode for write operations
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout after 30s')), TIMEOUT)
        )
      ]);

      // Count tool calls
      if (result.steps) {
        actualTools = result.steps
          .filter(s => s.action && s.action !== 'none')
          .map(s => s.action);
        toolCalls = actualTools.length;
      }

      // Validate result
      if (test.validation) {
        success = test.validation(result);
      } else {
        success = result.success;
      }

      // Check if expected tools were used
      if (test.expectedTools && test.expectedTools.length > 0) {
        const usedExpectedTools = test.expectedTools.every(tool => 
          actualTools.includes(tool)
        );
        success = success && usedExpectedTools;
      }

    } catch (err) {
      error = err.message;
      success = false;
    }

    const responseTime = Date.now() - startTime;

    // Update final status
    if (this.isTTY) {
      this.updateTestLine(testNumber, test.name, success ? 'passed' : 'failed', 
                         toolCalls, responseTime, actualTools);
    } else {
      // Simple output for non-TTY environments
      const status = success ? '✅' : '❌';
      console.log(`${status} ${test.name} - ${responseTime}ms - ${toolCalls} tools`);
      if (!success && error) {
        console.log(`   Error: ${error}`);
      }
    }

    // Log result for file
    const statusSymbol = success ? '✓' : '✗';
    const statusText = success ? 'PASSED' : 'FAILED';
    this.log(`[${statusText}] ${test.name} - ${responseTime}ms - ${toolCalls} tools`);
    if (error) {
      this.log(`  Error: ${error}`);
    }

    return {
      test: test.name,
      success,
      toolCalls,
      actualTools,
      responseTime,
      error
    };
  }

  updateTestLine(testNumber, testName, status, toolCalls = 0, responseTime = 0, tools = []) {
    // Only works in TTY environments
    if (!this.isTTY) return;
    
    // Move cursor up and clear line
    process.stdout.write('\x1b[1A\x1b[2K');
    
    const statusIcon = {
      pending: `${colors.dim}${symbols.pending}${colors.reset}`,
      running: `${colors.yellow}${symbols.running}${colors.reset}`,
      passed: `${colors.green}${symbols.success}${colors.reset}`,
      failed: `${colors.red}${symbols.failure}${colors.reset}`
    }[status];

    const testColor = status === 'failed' ? colors.red : 
                     status === 'passed' ? colors.green : 
                     status === 'running' ? colors.yellow : colors.dim;

    let line = `  ${statusIcon} ${testColor}${testName}${colors.reset}`;
    
    if (status === 'passed' || status === 'failed') {
      // Add metrics
      line += ` ${colors.dim}[${colors.reset}`;
      line += `${symbols.tool} ${toolCalls}`;
      line += ` ${colors.dim}|${colors.reset} `;
      line += `${symbols.time} ${responseTime}ms`;
      
      if (tools.length > 0) {
        line += ` ${colors.dim}|${colors.reset} `;
        line += tools.map(t => this.getToolIcon(t)).join(' ');
      }
      
      line += `${colors.dim}]${colors.reset}`;
    }

    console.log(line);
    
    if (this.isTTY && (status === 'pending' || status === 'running')) {
      // Add empty line for next test
      console.log('');
    }
  }

  getToolIcon(toolName) {
    const iconMap = {
      'search_crm': symbols.search,
      'web_search': symbols.web,
      'create_note': symbols.note,
      'create_entity': symbols.create,
      'update_entity': symbols.update
    };
    return iconMap[toolName] || symbols.tool;
  }

  printHeader() {
    const version = require('./package.json').version;
    const header = [
      `${colors.bright}${colors.cyan}╔═══════════════════════════════════════════════════════════╗${colors.reset}`,
      `${colors.bright}${colors.cyan}║           CRM Bot Test Suite v${version}                    ║${colors.reset}`,
      `${colors.bright}${colors.cyan}╚═══════════════════════════════════════════════════════════╝${colors.reset}`,
      ''
    ];
    header.forEach(line => this.log(line));
  }

  printCategoryHeader(category) {
    this.log(`${colors.bright}${colors.blue}━━━ ${category} ━━━${colors.reset}`);
    this.log('', false); // Empty line for first test - don't save to file
  }

  async saveTestResults(summary) {
    const fs = require('fs').promises;
    const path = require('path');
    
    // Try to save to MongoDB
    let mongoClient = null;
    try {
      const MONGODB_URI = process.env.MONGODB_URI || process.env.MDB_MCP_CONNECTION_STRING;
      
      if (MONGODB_URI) {
        mongoClient = new MongoClient(MONGODB_URI, {
          serverSelectionTimeoutMS: 5000
        });
        
        await mongoClient.connect();
        const db = mongoClient.db('crm-bot');
        
        const testRun = {
          ...summary,
          _id: this.timestamp,
          createdAt: new Date(),
          environment: process.env.NODE_ENV || 'development',
          nodeVersion: process.version,
          fullLog: this.logBuffer.join('\n')
        };
        
        await db.collection('test-runs').insertOne(testRun);
        console.log(`\n${colors.dim}📁 Test results saved to MongoDB${colors.reset}`);
        console.log(`   ${colors.cyan}Collection: test-runs${colors.reset}`);
        console.log(`   ${colors.cyan}Document ID: ${this.timestamp}${colors.reset}`);
      } else {
        console.log(`\n${colors.yellow}MongoDB URI not found. Saving locally only.${colors.reset}`);
      }
    } catch (err) {
      console.error(`${colors.red}Failed to save to MongoDB:${colors.reset}`, err.message);
    } finally {
      if (mongoClient) {
        await mongoClient.close();
      }
    }
    
    // Also save locally as backup
    const logsDir = path.join(process.cwd(), 'test-logs');
    try {
      await fs.mkdir(logsDir, { recursive: true });
    } catch (err) {}
    
    // Save summary locally
    const summaryPath = path.join(logsDir, `test-summary-${this.timestamp}.json`);
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    
    // Save latest results (overwrite)
    const latestPath = path.join(logsDir, 'latest-results.json');
    await fs.writeFile(latestPath, JSON.stringify(summary, null, 2), 'utf8');
    
    console.log(`   ${colors.cyan}Local backup: ${summaryPath}${colors.reset}`);
  }

  async printSummary(total, passed, toolCalls, responseTime) {
    const failed = total - passed;
    const successRate = ((passed / total) * 100).toFixed(1);
    const avgToolCalls = (toolCalls / total).toFixed(1);
    const avgResponseTime = Math.round(responseTime / total);
    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);

    console.log(`${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log('');
    console.log(`${colors.bright}📊 Test Summary${colors.reset}`);
    console.log('');
    
    // Results bar
    const barWidth = 40;
    const passedWidth = Math.round((passed / total) * barWidth);
    const failedWidth = barWidth - passedWidth;
    
    process.stdout.write('  ');
    process.stdout.write(`${colors.bgGreen}${' '.repeat(passedWidth)}${colors.reset}`);
    process.stdout.write(`${colors.bgRed}${' '.repeat(failedWidth)}${colors.reset}`);
    console.log(`  ${successRate}%`);
    console.log('');
    
    // Statistics
    console.log(`  ${colors.green}✓ Passed:${colors.reset} ${passed}`);
    console.log(`  ${colors.red}✗ Failed:${colors.reset} ${failed}`);
    console.log(`  ${colors.dim}─────────────${colors.reset}`);
    console.log(`  📈 Success Rate: ${successRate}%`);
    console.log(`  🔧 Avg Tool Calls: ${avgToolCalls}`);
    console.log(`  ⏱️  Avg Response: ${avgResponseTime}ms`);
    console.log(`  ⏱️  Total Time: ${totalTime}s`);
    console.log('');

    // Failed tests details
    if (failed > 0) {
      console.log(`${colors.bright}${colors.red}Failed Tests:${colors.reset}`);
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  ${colors.red}✗${colors.reset} ${r.test}`);
          if (r.error) {
            console.log(`    ${colors.dim}Error: ${r.error}${colors.reset}`);
          }
        });
      console.log('');
    }

    // Success message
    if (failed === 0) {
      console.log(`${colors.bright}${colors.green}✅ All tests passed!${colors.reset}\n`);
    } else {
      console.log(`${colors.bright}${colors.yellow}⚠️  Some tests failed${colors.reset}\n`);
    }

    // Prepare summary for saving
    const summary = {
      timestamp: this.timestamp,
      totalTests: total,
      passed: passed,
      failed: failed,
      successRate: parseFloat(successRate),
      avgToolCalls: parseFloat(avgToolCalls),
      avgResponseTime: avgResponseTime,
      totalTime: parseFloat(totalTime),
      failedTests: this.results
        .filter(r => !r.success)
        .map(r => ({
          name: r.test,
          error: r.error || 'Validation failed',
          toolCalls: r.toolCalls,
          responseTime: r.responseTime
        })),
      allResults: this.results
    };

    // Save results
    await this.saveTestResults(summary);

    // Exit code
    process.exit(failed > 0 ? 1 : 0);
  }
}

// Run the test suite
async function main() {
  const runner = new TestRunner();
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\nTest suite interrupted!');
    process.exit(1);
  });

  await runner.runAllTests();
}

// Check if we should run specific categories
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: npm run test:suite [options]');
  console.log('Options:');
  console.log('  --help     Show this help message');
  console.log('  --verbose  Show detailed test output');
  process.exit(0);
}

main().catch(console.error);