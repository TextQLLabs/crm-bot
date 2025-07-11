const { App, ExpressReceiver } = require('@slack/bolt');
const dotenv = require('dotenv');
const express = require('express');
const { handleMention, handleButtonAction } = require('./handlers/slackHandlerClaude'); // Using Claude handler
const healthRoutes = require('./health');

// Message deduplication to prevent duplicate processing
const processedMessages = new Map();
const MESSAGE_TTL = 5 * 60 * 1000; // 5 minutes

function isMessageAlreadyProcessed(messageKey) {
  const now = Date.now();
  
  // Clean up old entries
  for (const [key, timestamp] of processedMessages.entries()) {
    if (now - timestamp > MESSAGE_TTL) {
      processedMessages.delete(key);
    }
  }
  
  if (processedMessages.has(messageKey)) {
    const lastProcessed = processedMessages.get(messageKey);
    const timeSince = (now - lastProcessed) / 1000;
    console.log(`🔍 Message ${messageKey} was processed ${timeSince.toFixed(1)}s ago`);
    return true;
  }
  
  console.log(`✅ Processing new message: ${messageKey}`);
  processedMessages.set(messageKey, now);
  return false;
}

// Database service - will attempt MongoDB first, fallback to mock
let connectDB;
let dbService = 'MongoDB';

// Load environment variables
dotenv.config();

// Debug: Check if env vars are loaded
console.log('Environment check:', {
  hasSlackBot: !!process.env.SLACK_BOT_TOKEN,
  hasSlackSigning: !!process.env.SLACK_SIGNING_SECRET,
  hasSlackApp: !!process.env.SLACK_APP_TOKEN,
  hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
  hasAttio: !!process.env.ATTIO_API_KEY
});

// Create Express receiver to support HTTP endpoints
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  dispatchErrorHandler: async ({ error, logger, client, data }) => {
    logger.error('Slack dispatch error:', error);
    // Do NOT send any response - just log
  }
});

// Add health check routes
receiver.router.use(healthRoutes);

// Add a basic root route
receiver.router.get('/', (req, res) => {
  res.json({
    service: 'CRM Bot (Claude Agent)',
    status: 'running',
    version: require('../package.json').version,
    agent: 'claude-native'
  });
});

// Configure app based on environment
const isSocketMode = process.env.NODE_ENV === 'development' || process.env.SLACK_APP_TOKEN;
const appConfig = {
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true,
  extendedErrorHandler: false
};

if (isSocketMode) {
  // Use Socket Mode for development
  appConfig.socketMode = true;
  appConfig.appToken = process.env.SLACK_APP_TOKEN;
  console.log('🔌 Using Socket Mode (development)');
} else {
  // Use HTTP receiver for production
  appConfig.receiver = receiver;
  console.log('🌐 Using HTTP receiver (production)');
}

const app = new App(appConfig);

// Add Socket Mode debugging
if (isSocketMode) {
  console.log('📡 Socket Mode app created, waiting for connection...');
}

// Handle app mentions in any channel with error handling
app.event('app_mention', async ({ event, client, ack }) => {
  try {
    // Acknowledge immediately if ack function is provided
    if (typeof ack === 'function') {
      await ack();
    }
    
    // Prevent duplicate processing
    const messageKey = `${event.channel}-${event.ts}`;
    if (isMessageAlreadyProcessed(messageKey)) {
      console.log(`⏭️ Skipping duplicate app_mention: ${messageKey}`);
      return;
    }
    
    // Additional safety check - make sure this is for the right bot
    const isDev = process.env.NODE_ENV === 'development';
    console.log(`🤖 Bot check - NODE_ENV: ${process.env.NODE_ENV}, isDev: ${isDev}`);
    console.log(`📝 Message text: "${event.text}"`);
    
    const isCorrectBot = isDev ? 
      (event.text.includes('U0953GV1A8L') || event.text.includes('@crm-bot-ethan-dev')) :
      (event.text.includes('U0944Q3F58B') || (event.text.includes('@crm-bot-ethan') && !event.text.includes('@crm-bot-ethan-dev')));
    
    console.log(`🎯 Is correct bot: ${isCorrectBot}`);
    
    if (isCorrectBot) {
      await handleMention({ event, client });
    } else {
      console.log('❌ Ignoring mention for other bot instance');
    }
  } catch (error) {
    console.error('Error in app_mention handler:', error);
    // Don't let Bolt send its own error message
  }
});

// Handle direct messages and thread replies with @mentions only
app.message(async ({ message, say, client }) => {
  try {
    // Prevent duplicate processing
    const messageKey = `${message.channel}-${message.ts}`;
    if (isMessageAlreadyProcessed(messageKey)) {
      console.log(`⏭️ Skipping duplicate message: ${messageKey}`);
      return;
    }
    
    // Handle DMs
    if (message.channel_type === 'im') {
      await handleMention({ message, client });
    }
    // Handle thread replies ONLY when bot is explicitly mentioned
    else if (message.thread_ts && message.text && message.bot_id !== message.user) {
      // Check if the bot is mentioned in the message (specific to this bot instance)
      const isDev = process.env.NODE_ENV === 'development';
      const isBotMentioned = message.text.includes('<@') && (
        isDev ? (
          // Dev bot only responds to dev mentions
          message.text.includes('U0953GV1A8L') || // Dev bot user ID
          message.text.includes('@crm-bot-ethan-dev')
        ) : (
          // Production bot only responds to production mentions
          message.text.includes('U0944Q3F58B') || // Production bot user ID
          message.text.includes('@crm-bot-ethan') && !message.text.includes('@crm-bot-ethan-dev')
        )
      );
      
      if (isBotMentioned) {
        await handleMention({ message, client });
      }
    }
  } catch (error) {
    console.error('Error in message handler:', error);
  }
});

// Handle button interactions with error catching
app.action('approve_action', async (args) => {
  try {
    await handleButtonAction(args);
  } catch (error) {
    console.error('Error in approve_action:', error);
  }
});

app.action('cancel_action', async (args) => {
  try {
    await handleButtonAction(args);
  } catch (error) {
    console.error('Error in cancel_action:', error);
  }
});

// Start the app
(async () => {
  try {
    // Use file-based storage
    const mockDb = require('./services/database-mock');
    connectDB = mockDb.connectDB;
    await connectDB();
    dbService = 'File Storage';
    
    console.log('🚂 Starting CRM Bot with Claude Agent...');
    console.log('🔍 Deployment:', process.env.RAILWAY_ENVIRONMENT ? `Railway (${process.env.RAILWAY_ENVIRONMENT})` : 'Local Development');
    console.log('💾 Database:', dbService);
    console.log('🤖 Agent: Claude Sonnet 4 with Native Tool Calling (v1.12.1)');
    
    // Start Slack app
    const port = process.env.PORT || 3000;
    await app.start(port);
    console.log(`⚡️ CRM Bot with Claude Agent is running on port ${port}!`);
    console.log('🧠 Using Claude native tool calling with thinking mode enabled');
    console.log('🔐 Preview mode enabled - all write actions require approval before execution');
    console.log(`🩺 Health check available at: http://localhost:${port}/health`);
  } catch (error) {
    console.error('Unable to start app:', error);
    process.exit(1);
  }
})();