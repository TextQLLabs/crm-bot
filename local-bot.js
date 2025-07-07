#!/usr/bin/env node
require('dotenv').config();
const readline = require('readline');
const { ReactAgent } = require('./src/services/reactAgent');

// ANSI color codes for prettier output
const colors = {
  bot: '\x1b[36m',      // Cyan
  user: '\x1b[33m',     // Yellow
  system: '\x1b[90m',   // Gray
  error: '\x1b[31m',    // Red
  success: '\x1b[32m',  // Green
  reset: '\x1b[0m'
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `${colors.user}You: ${colors.reset}`
});

// Initialize the ReactAgent
const agent = new ReactAgent();

console.log(`${colors.system}===========================================`);
console.log(`CRM Bot Local Testing Environment`);
console.log(`Version: ${require('./package.json').version}`);
console.log(`===========================================`);
console.log(`Type your message to test the bot locally.`);
console.log(`Commands:`);
console.log(`  /exit    - Exit the bot`);
console.log(`  /clear   - Clear the screen`);
console.log(`  /debug   - Toggle debug mode`);
console.log(`  /thread  - Start a new thread (clear context)`);
console.log(`===========================================\n${colors.reset}`);

let debugMode = false;
let conversationHistory = [];

// Function to simulate the bot response
async function handleMessage(message) {
  // Handle special commands
  if (message.startsWith('/')) {
    const command = message.toLowerCase();
    
    switch (command) {
      case '/exit':
        console.log(`${colors.system}Goodbye!${colors.reset}`);
        process.exit(0);
        break;
        
      case '/clear':
        console.clear();
        console.log(`${colors.system}Screen cleared${colors.reset}\n`);
        rl.prompt();
        return;
        
      case '/debug':
        debugMode = !debugMode;
        console.log(`${colors.system}Debug mode: ${debugMode ? 'ON' : 'OFF'}${colors.reset}\n`);
        rl.prompt();
        return;
        
      case '/thread':
        conversationHistory = [];
        console.log(`${colors.system}Started new thread (context cleared)${colors.reset}\n`);
        rl.prompt();
        return;
        
      default:
        console.log(`${colors.error}Unknown command: ${command}${colors.reset}\n`);
        rl.prompt();
        return;
    }
  }

  // Show thinking indicator
  console.log(`${colors.bot}🤔 Thinking...${colors.reset}`);
  
  try {
    // Process message with ReactAgent
    const result = await agent.processMessage({
      text: message,
      userName: 'Local User',
      channel: 'local-test',
      attachments: [],
      isThreaded: conversationHistory.length > 0,
      threadTs: 'local-thread'
    });

    // Clear the thinking line
    process.stdout.write('\x1b[1A\x1b[2K');
    
    if (result.success) {
      // Show the bot's response
      console.log(`${colors.bot}Bot: ${result.answer || 'Task completed successfully!'}${colors.reset}`);
      
      // If debug mode is on, show the steps
      if (debugMode && result.steps) {
        console.log(`\n${colors.system}Debug - Steps taken:${colors.reset}`);
        result.steps.forEach((step, i) => {
          if (step.thought) {
            console.log(`${colors.system}  ${i + 1}. Thought: ${step.thought}${colors.reset}`);
          }
          if (step.action) {
            console.log(`${colors.system}     Action: ${step.action}${colors.reset}`);
            if (step.actionInput) {
              console.log(`${colors.system}     Input: ${JSON.stringify(step.actionInput)}${colors.reset}`);
            }
          }
        });
      }
      
      // Add to conversation history
      conversationHistory.push({
        user: 'Local User',
        text: message,
        response: result.answer
      });
      
    } else {
      console.log(`${colors.error}Bot: Error - ${result.error}${colors.reset}`);
    }
    
  } catch (error) {
    console.log(`${colors.error}System Error: ${error.message}${colors.reset}`);
    if (debugMode) {
      console.error(error.stack);
    }
  }

  console.log(); // Empty line for readability
  rl.prompt();
}

// Handle line input
rl.on('line', (line) => {
  const message = line.trim();
  if (message) {
    handleMessage(message);
  } else {
    rl.prompt();
  }
});

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log(`\n${colors.system}Goodbye!${colors.reset}`);
  process.exit(0);
});

// Start the prompt
rl.prompt();