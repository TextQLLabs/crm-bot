const { App } = require('@slack/bolt');
const dotenv = require('dotenv');
const { handleMention, handleButtonAction } = require('./handlers/slackHandlerReact'); // Using ReAct handler
const { connectDB } = require('./services/database-mock'); // Using mock DB

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

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  port: process.env.PORT || 3000
});

// Handle app mentions in any channel
app.event('app_mention', handleMention);

// Handle direct messages and thread replies
app.message(async ({ message, say, client }) => {
  // Handle DMs
  if (message.channel_type === 'im') {
    await handleMention({ message, say, client });
  }
  // Handle thread replies where bot is mentioned
  else if (message.thread_ts && message.text && message.text.includes(`<@${process.env.SLACK_BOT_ID || 'U'}`)) {
    await handleMention({ message, say, client });
  }
});

// Handle button interactions
app.action('approve_action', handleButtonAction);
app.action('cancel_action', handleButtonAction);
app.action('show_technical_details', handleButtonAction);

// Start the app
(async () => {
  try {
    // Connect to Mock DB (no MongoDB)
    await connectDB();
    
    // Start Slack app
    await app.start();
    console.log('⚡️ CRM Bot with ReAct Agent is running!');
    console.log('📝 Using ReAct (Reasoning + Acting) pattern for intelligent CRM updates');
    console.log('🔐 Preview mode enabled - all write actions require approval before execution');
  } catch (error) {
    console.error('Unable to start app:', error);
    process.exit(1);
  }
})();