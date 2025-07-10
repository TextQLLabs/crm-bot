const { App, ExpressReceiver } = require('@slack/bolt');
const dotenv = require('dotenv');
const express = require('express');
const { handleMention, handleButtonAction } = require('./handlers/slackHandlerClaude'); // Using Claude handler
const healthRoutes = require('./health');

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
    // Acknowledge immediately
    if (ack) await ack();
    
    // Don't pass say to avoid automatic block formatting
    await handleMention({ event, client });
  } catch (error) {
    console.error('Error in app_mention handler:', error);
    // Don't let Bolt send its own error message
  }
});

// Handle direct messages and thread replies with @mentions only
app.message(async ({ message, say, client }) => {
  try {
    // Handle DMs
    if (message.channel_type === 'im') {
      await handleMention({ message, client });
    }
    // Handle thread replies ONLY when bot is explicitly mentioned
    else if (message.thread_ts && message.text && message.bot_id !== message.user) {
      // Check if the bot is mentioned in the message (multiple patterns to catch all mention formats)
      const isBotMentioned = message.text.includes('<@') && (
        message.text.includes('@crm-bot') ||
        message.text.includes('crm-bot') ||
        message.text.includes('U0944Q3F58B') || // Production bot user ID
        message.text.includes('U0953GV1A8L')    // Dev bot user ID
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
    console.log('🤖 Agent: Claude 3.7 Sonnet with Native Tool Calling');
    
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