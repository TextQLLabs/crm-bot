const { App } = require('@slack/bolt');
const { handleMention, handleButtonAction } = require('../handlers/slackHandlerReact');
const { connectDB } = require('../services/database-mock');

// Custom receiver for Cloudflare Workers
class CloudflareReceiver {
  constructor({ signingSecret }) {
    this.signingSecret = signingSecret;
  }

  async start() {
    // No-op for Cloudflare Workers
    return this;
  }

  async stop() {
    // No-op for Cloudflare Workers
    return this;
  }
}

let app;
let dbInitialized = false;

async function initializeApp(env) {
  if (!app) {
    // Set environment variables from Cloudflare env
    process.env.SLACK_BOT_TOKEN = env.SLACK_BOT_TOKEN;
    process.env.SLACK_SIGNING_SECRET = env.SLACK_SIGNING_SECRET;
    process.env.SLACK_APP_TOKEN = env.SLACK_APP_TOKEN;
    process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
    process.env.ATTIO_API_KEY = env.ATTIO_API_KEY;
    process.env.MONGODB_URI = env.MONGODB_URI;

    // Initialize database connection
    if (!dbInitialized) {
      await connectDB();
      dbInitialized = true;
    }

    const receiver = new CloudflareReceiver({
      signingSecret: env.SLACK_SIGNING_SECRET
    });

    app = new App({
      token: env.SLACK_BOT_TOKEN,
      receiver,
      processBeforeResponse: true
    });

    // Register event handlers
    app.event('app_mention', handleMention);
    app.message(async ({ message, say, client }) => {
      if (message.channel_type === 'im') {
        await handleMention({ message, say, client });
      }
      else if (message.thread_ts && message.text && message.text.includes(`<@${env.SLACK_BOT_ID || 'U'}`)) {
        await handleMention({ message, say, client });
      }
    });
    
    // Handle button interactions
    app.action('approve_action', handleButtonAction);
    app.action('cancel_action', handleButtonAction);
    app.action('show_technical_details', handleButtonAction);
  }
  return app;
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      
      // Health check endpoint
      if (url.pathname === '/health') {
        return new Response('OK', { status: 200 });
      }

      // Slack challenge verification
      if (request.method === 'POST' && url.pathname === '/slack/events') {
        const body = await request.json();
        
        if (body.type === 'url_verification') {
          return new Response(body.challenge, {
            headers: { 'Content-Type': 'text/plain' }
          });
        }

        // Initialize app
        const app = await initializeApp(env);

        // Verify Slack signature
        const signature = request.headers.get('x-slack-signature');
        const timestamp = request.headers.get('x-slack-request-timestamp');
        
        // Process Slack event
        await processSlackEvent(body, env);

        return new Response('OK', { status: 200 });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  async scheduled(event, env, ctx) {
    // Run periodic tasks like cache cleanup
    console.log('Running scheduled task');
  }
};

async function processSlackEvent(payload, env) {
  const app = await initializeApp(env);
  
  // Handle different event types
  if (payload.event) {
    switch (payload.event.type) {
      case 'app_mention':
        await app.processEvent({
          type: 'event',
          body: payload
        });
        break;
      case 'message':
        if (payload.event.channel_type === 'im') {
          await app.processEvent({
            type: 'event',
            body: payload
          });
        }
        break;
    }
  }
}