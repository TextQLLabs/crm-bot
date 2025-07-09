const { App, ExpressReceiver } = require('@slack/bolt');
const dotenv = require('dotenv');
const express = require('express');
const { handleMention, handleButtonAction } = require('./handlers/slackHandlerReact'); // Using ReAct handler
const healthRoutes = require('./health');

// Database service - will attempt MongoDB first, fallback to mock
let connectDB;
let dbService = 'MongoDB'; // Track which service we're using

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
  // Disable automatic error handling
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
    service: 'CRM Bot',
    status: 'running',
    version: require('../package.json').version
  });
});

// Configure app based on environment
const isSocketMode = process.env.NODE_ENV === 'development' || process.env.SLACK_APP_TOKEN;
const appConfig = {
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  // Disable Bolt's default error handler
  processBeforeResponse: true,
  extendedErrorHandler: false // Turn this off to prevent Bolt from handling errors
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
    // Our handler already sends error messages
  }
});

// Handle direct messages and thread replies
app.message(async ({ message, say, client }) => {
  try {
    // Handle DMs
    if (message.channel_type === 'im') {
      // Don't pass say to avoid automatic block formatting
      await handleMention({ message, client });
    }
    // Handle thread replies where bot is mentioned
    else if (message.thread_ts && message.text && message.bot_id !== message.user) {
      // Check if the message mentions the bot - bot mentions include the bot's user ID
      // This handles thread replies where the bot is mentioned
      // Don't pass say to avoid automatic block formatting
      await handleMention({ message, client });
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    // Don't let Bolt send its own error message
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

app.action('show_technical_details', async (args) => {
  try {
    await handleButtonAction(args);
  } catch (error) {
    console.error('Error in show_technical_details:', error);
  }
});

// Removed show_search_details action - using simple text responses now

// Remove global error handler - let errors be silent

// Start the app
(async () => {
  try {
    // Try to connect to MongoDB first
    try {
      const mongoDb = require('./services/database');
      connectDB = mongoDb.connectDB;
      await connectDB();
      dbService = 'MongoDB';
    } catch (mongoError) {
      // If MongoDB fails, fallback to mock
      console.log('⚠️  MongoDB connection failed, falling back to in-memory storage');
      const mockDb = require('./services/database-mock');
      connectDB = mockDb.connectDB;
      await connectDB();
      dbService = 'In-Memory';
    }
    
    console.log('🚂 Starting CRM Bot on Railway...');
    console.log('🔍 Deployment:', process.env.RAILWAY_ENVIRONMENT ? `Railway (${process.env.RAILWAY_ENVIRONMENT})` : 'Local Development');
    console.log('💾 Database:', dbService);
    
    // Start Slack app
    const port = process.env.PORT || 3000;
    await app.start(port);
    console.log(`⚡️ CRM Bot with ReAct Agent is running on port ${port}!`);
    console.log('📝 Using ReAct (Reasoning + Acting) pattern for intelligent CRM updates');
    console.log('🔐 Preview mode enabled - all write actions require approval before execution');
    console.log(`🩺 Health check available at: http://localhost:${port}/health`);
  } catch (error) {
    console.error('Unable to start app:', error);
    process.exit(1);
  }
})();