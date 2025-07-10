#!/usr/bin/env node
require('dotenv').config();
const { ClaudeAgent } = require('./src/services/claudeAgent');

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

console.log(`${colors.cyan}🧪 Testing Timeout Behavior${colors.reset}\n`);

async function testWithTimeout(name, input, timeoutMs = 30000) {
  const agent = new ClaudeAgent();
  const startTime = Date.now();
  
  console.log(`${colors.yellow}⏱️  Running: ${name} (timeout: ${timeoutMs/1000}s)${colors.reset}`);
  
  try {
    const result = await Promise.race([
      agent.processMessage({
        text: input,
        userName: 'Test',
        channel: 'test',
        attachments: []
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs/1000}s`)), timeoutMs)
      )
    ]);
    
    const elapsed = Date.now() - startTime;
    console.log(`${colors.green}✅ Completed in ${elapsed}ms${colors.reset}`);
    console.log(`   Result: ${result.answer?.substring(0, 100)}...`);
    
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`${colors.red}❌ Failed after ${elapsed}ms${colors.reset}`);
    console.log(`   Error: ${error.message}`);
  }
  
  console.log('');
}

async function main() {
  // Test different scenarios
  await testWithTimeout('Quick search', 'find The Raine Group', 15000);
  await testWithTimeout('Complex search', 'find all companies related to media and entertainment', 20000);
  await testWithTimeout('Very short timeout', 'analyze the entire CRM database', 5000);
  
  console.log(`${colors.cyan}✨ Demo complete!${colors.reset}`);
  process.exit(0);
}

main().catch(console.error);