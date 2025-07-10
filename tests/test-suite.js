#!/usr/bin/env node
require('dotenv').config();
const { ClaudeAgent } = require('../src/services/claudeAgent');
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

/**
 * Advanced CRM Bot Test Suite
 * 
 * This test suite validates the enhanced search capabilities of the CRM bot,
 * including new advanced search, relationship queries, and time-based filtering.
 * 
 * Test Categories:
 * 
 * 1. Core Search Functionality
 *    - Tests basic fuzzy search and multi-step operations
 *    - Validates critical "rayn → raine" fuzzy matching
 * 
 * 2. Advanced Search - Value Filtering
 *    - Tests deal value range filtering ($1M+, $500K-$2M, <$100K)
 *    - Validates advanced_search tool usage with financial filters
 * 
 * 3. Advanced Search - Date Filtering  
 *    - Tests date-based entity filtering (created this year, last month)
 *    - Validates search_by_time_range tool for recent activity
 * 
 * 4. Advanced Search - Status & Attributes
 *    - Tests status filtering (open deals, tech companies)
 *    - Validates complex multi-attribute queries
 * 
 * 5. Relationship Search
 *    - Tests entity relationship discovery (company→deals, company→people)
 *    - Validates search_related_entities tool usage
 * 
 * 6. Advanced Sorting & Ranking
 *    - Tests custom sorting (largest deals, newest companies)
 *    - Validates proper tool selection for ranking queries
 * 
 * 7. Write Operations (Preview Mode)
 *    - Tests note creation with preview mode
 *    - Validates write action safety mechanisms
 * 
 * 8. Introspection & Meta Questions
 *    - Tests conversational responses about bot capabilities
 *    - Validates that introspective questions don't trigger CRM tools
 *    - Tests architecture questions, greetings, and mixed requests
 * 
 * 9. Error Handling
 *    - Tests graceful handling of non-existent entities
 *    - Validates error recovery and user guidance
 * 
 * Key Testing Improvements:
 * - Removed redundant low-level tests (exact name matching, simple misspellings)
 * - Added comprehensive advanced search validation
 * - Focus on real-world enterprise CRM queries
 * - Tests tool selection intelligence (when to use which search tool)
 * 
 * Expected Tool Usage Patterns:
 * - search_crm: Basic name/text search with fuzzy matching
 * - advanced_search: Attribute filtering (value, status, date, industry)
 * - search_related_entities: Cross-entity relationship discovery
 * - search_by_time_range: Time-based queries and recent activity
 */

// Test suite definition
const testSuite = [
  {
    category: 'Core Search Functionality',
    tests: [
      {
        name: 'Critical: rayn → raine fuzzy search with notes',
        input: 'how many notes are on the account rayn group',
        expectedTools: ['search_crm', 'get_notes'],
        expectedSuccess: true,
        validation: (result) => result.answer && result.answer.toLowerCase().includes('raine') && result.answer.includes('notes')
      },
      {
        name: 'Multi-step: Search + note count workflow',
        input: 'how many notes does The Raine Group have',
        expectedTools: ['search_crm', 'get_notes'],
        expectedSuccess: true,
        validation: (result) => result.answer && result.answer.includes('notes') && result.answer.includes('Raine')
      }
    ]
  },
  {
    category: 'Advanced Search - Value Filtering',
    tests: [
      {
        name: 'High-value deals search',
        input: 'show me all deals over $1 million',
        expectedTools: ['advanced_search'],
        expectedSuccess: true,
        validation: (result) => {
          const hasAdvancedSearch = result.toolsUsed?.some(t => t.tool === 'advanced_search');
          const hasCorrectFilter = result.answer && (result.answer.includes('deal') || result.answer.includes('found') || result.answer.includes('result'));
          return hasAdvancedSearch && hasCorrectFilter;
        }
      },
      {
        name: 'Deal value range filter',
        input: 'find deals between $500K and $2M',
        expectedTools: ['advanced_search'],
        expectedSuccess: true,
        validation: (result) => {
          const hasAdvancedSearch = result.toolsUsed?.some(t => t.tool === 'advanced_search');
          return hasAdvancedSearch && result.answer;
        }
      },
      {
        name: 'Low-value deals filter',
        input: 'show me deals under $100,000',
        expectedTools: ['advanced_search'],
        expectedSuccess: true,
        validation: (result) => {
          const hasAdvancedSearch = result.toolsUsed?.some(t => t.tool === 'advanced_search');
          return hasAdvancedSearch && result.answer;
        }
      }
    ]
  },
  {
    category: 'Advanced Search - Date Filtering',
    tests: [
      {
        name: 'Companies created this year',
        input: 'show me companies created in 2024',
        expectedTools: ['advanced_search'],
        expectedSuccess: true,
        validation: (result) => {
          const hasAdvancedSearch = result.toolsUsed?.some(t => t.tool === 'advanced_search');
          return hasAdvancedSearch && result.answer;
        }
      },
      {
        name: 'Recent deals search',
        input: 'find deals created in the last month',
        expectedTools: ['advanced_search'],
        expectedSuccess: true,
        validation: (result) => {
          const hasAdvancedSearch = result.toolsUsed?.some(t => t.tool === 'advanced_search');
          return hasAdvancedSearch && result.answer;
        }
      },
      {
        name: 'Time-based entity search',
        input: 'what companies were added recently',
        expectedTools: ['search_by_time_range'],
        expectedSuccess: true,
        validation: (result) => {
          const hasTimeSearch = result.toolsUsed?.some(t => t.tool === 'search_by_time_range');
          return hasTimeSearch && result.answer;
        }
      }
    ]
  },
  {
    category: 'Advanced Search - Status & Attributes',
    tests: [
      {
        name: 'Open deals filter',
        input: 'show me all open deals',
        expectedTools: ['advanced_search'],
        expectedSuccess: true,
        validation: (result) => {
          const hasAdvancedSearch = result.toolsUsed?.some(t => t.tool === 'advanced_search');
          return hasAdvancedSearch && result.answer;
        }
      },
      {
        name: 'Tech companies search',
        input: 'find all companies in the tech industry',
        expectedTools: ['advanced_search'],
        expectedSuccess: true,
        validation: (result) => {
          const hasAdvancedSearch = result.toolsUsed?.some(t => t.tool === 'advanced_search');
          return hasAdvancedSearch && result.answer;
        }
      },
      {
        name: 'Complex multi-filter search',
        input: 'show me open deals over $500K from tech companies',
        expectedTools: ['advanced_search'],
        expectedSuccess: true,
        validation: (result) => {
          const hasAdvancedSearch = result.toolsUsed?.some(t => t.tool === 'advanced_search');
          return hasAdvancedSearch && result.answer;
        }
      }
    ]
  },
  {
    category: 'Relationship Search',
    tests: [
      {
        name: 'Company to deals relationship',
        input: 'show me all deals for The Raine Group',
        expectedTools: ['search_crm', 'search_related_entities'],
        expectedSuccess: true,
        validation: (result) => {
          const hasRelatedSearch = result.toolsUsed?.some(t => t.tool === 'search_related_entities');
          return hasRelatedSearch && result.answer && result.answer.includes('deal');
        }
      },
      {
        name: 'Company to people relationship', 
        input: 'who works at The Raine Group',
        expectedTools: ['search_crm', 'search_related_entities'],
        expectedSuccess: true,
        validation: (result) => {
          const hasRelatedSearch = result.toolsUsed?.some(t => t.tool === 'search_related_entities');
          return hasRelatedSearch && result.answer;
        }
      },
      {
        name: 'Deal to company relationship',
        input: 'what company is associated with the largest deal',
        expectedTools: ['advanced_search', 'search_related_entities'],
        expectedSuccess: true,
        validation: (result) => {
          const hasSearch = result.toolsUsed?.some(t => ['advanced_search', 'search_related_entities'].includes(t.tool));
          return hasSearch && result.answer;
        }
      }
    ]
  },
  {
    category: 'Advanced Sorting & Ranking',
    tests: [
      {
        name: 'Largest deals first',
        input: 'show me the largest deals first',
        expectedTools: ['advanced_search'],
        expectedSuccess: true,
        validation: (result) => {
          const hasAdvancedSearch = result.toolsUsed?.some(t => t.tool === 'advanced_search');
          return hasAdvancedSearch && result.answer;
        }
      },
      {
        name: 'Newest companies first',
        input: 'show me the most recently added companies',
        expectedTools: ['search_by_time_range'],
        expectedSuccess: true,
        validation: (result) => {
          const hasTimeSearch = result.toolsUsed?.some(t => t.tool === 'search_by_time_range');
          return hasTimeSearch && result.answer;
        }
      }
    ]
  },
  {
    category: 'Write Operations (Preview Mode)',
    tests: [
      {
        name: 'Create note with entity search',
        input: 'add a note to The Raine Group saying "Test note from automated suite"',
        expectedTools: ['search_crm', 'create_note'],
        expectedSuccess: true,
        validation: (result) => result.preview === true && result.pendingAction?.action === 'create_note',
        isWriteOperation: true
      }
    ]
  },
  {
    category: 'Introspection & Meta Questions',
    tests: [
      {
        name: 'Architecture question - Claude vs ReAct',
        input: 'are you using react or claude? like the reAct framework or claude directly',
        expectedTools: [], // Should NOT use any tools for introspective questions
        expectedSuccess: true,
        validation: (result) => {
          const answer = result.answer.toLowerCase();
          const hasNoTools = !result.toolsUsed || result.toolsUsed.length === 0;
          // Very flexible validation - should be conversational, not search results
          const isNotSearchError = !answer.includes('no matches found') && !answer.includes('try searching');
          const isConversational = answer.length > 30; // Should be a real explanation
          const seemsRelevant = answer.includes('claude') || answer.includes('tool') || answer.includes('framework') || answer.includes('help');
          return hasNoTools && isNotSearchError && isConversational && seemsRelevant;
        }
      },
      {
        name: 'Capability inquiry',
        input: 'what can you do? what are your capabilities?',
        expectedTools: [], // Should explain capabilities without using tools
        expectedSuccess: true,
        validation: (result) => {
          const answer = result.answer.toLowerCase();
          const hasNoTools = !result.toolsUsed || result.toolsUsed.length === 0;
          const isNotSearchError = !answer.includes('no matches found') && !answer.includes('try searching');
          const isConversational = answer.length > 30;
          const explainsCRMCapabilities = answer.includes('search') || answer.includes('crm') || answer.includes('help') || answer.includes('find');
          return hasNoTools && isNotSearchError && isConversational && explainsCRMCapabilities;
        }
      },
      {
        name: 'How do you work question',
        input: 'how do you work? explain your process',
        expectedTools: [], // Should explain process without using tools
        expectedSuccess: true,
        validation: (result) => {
          const answer = result.answer.toLowerCase();
          const hasNoTools = !result.toolsUsed || result.toolsUsed.length === 0;
          const isNotSearchError = !answer.includes('no matches found') && !answer.includes('try searching');
          const isConversational = answer.length > 30;
          const explainsWork = answer.includes('help') || answer.includes('tool') || answer.includes('search') || answer.includes('work');
          return hasNoTools && isNotSearchError && isConversational && explainsWork;
        }
      },
      {
        name: 'Mixed conversation and CRM request',
        input: 'hi, how are you? also can you search for raine group',
        expectedTools: ['search_crm'], // Should use tools for the CRM part
        expectedSuccess: true,
        validation: (result) => {
          const answer = result.answer.toLowerCase();
          const hasSearchTool = result.toolsUsed?.some(t => t.tool === 'search_crm');
          const hasGreeting = answer.includes('hi') || answer.includes('hello') || answer.includes('good');
          const hasSearchResults = answer.includes('raine') || answer.includes('found') || answer.includes('result');
          return hasSearchTool && (hasGreeting || hasSearchResults);
        }
      },
      {
        name: 'General greeting',
        input: 'hello there!',
        expectedTools: [], // Should respond conversationally without tools
        expectedSuccess: true,
        validation: (result) => {
          const answer = result.answer.toLowerCase();
          const hasNoTools = !result.toolsUsed || result.toolsUsed.length === 0;
          const isNotSearchError = !answer.includes('no matches found') && !answer.includes('try searching');
          const isConversational = answer.length > 10; // Should be friendly, not empty
          const seemsFriendly = answer.includes('hello') || answer.includes('hi') || answer.includes('help') || answer.includes('here') || answer.includes('how');
          return hasNoTools && isNotSearchError && isConversational && seemsFriendly;
        }
      }
    ]
  },
  {
    category: 'Error Handling',
    tests: [
      {
        name: 'Non-existent entity graceful failure',
        input: 'find notes on XYZ123NonExistent Corporation',
        expectedTools: ['search_crm'],
        expectedSuccess: true,
        validation: (result) => result.answer && (result.answer.includes('not found') || result.answer.includes('No matches'))
      }
    ]
  }
];

// Test runner class
class TestRunner {
  constructor() {
    this.agent = new ClaudeAgent();
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
          userId: 'test-user',
          channel: 'test',
          attachments: [],
          threadTs: 'test-thread',
          messageTs: Date.now().toString()
        }, { preview: test.isWriteOperation }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout after 30s')), TIMEOUT)
        )
      ]);

      // Count tool calls - ClaudeAgent doesn't expose step details
      // For now, estimate based on result content
      actualTools = [];
      if (result.answer) {
        if (result.answer.includes('Tool result:')) toolCalls += 1;
        if (result.answer.includes('Found') && result.answer.includes('result')) {
          actualTools.push('search_crm');
        }
        if (result.preview && result.pendingAction) {
          actualTools.push(result.pendingAction.action);
          toolCalls += 1;
        }
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
    const version = require('../package.json').version;
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
    
    // Save test results locally only
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