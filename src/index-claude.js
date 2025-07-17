const { App, ExpressReceiver } = require('@slack/bolt');
const dotenv = require('dotenv');
const express = require('express');
const { handleMention, handleButtonAction } = require('./handlers/slackHandlerClaude'); // Using Claude handler
const healthRoutes = require('./health');
const { CronScheduler } = require('./jobs');

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
  return false;
}

function markMessageAsProcessed(messageKey) {
  processedMessages.set(messageKey, Date.now());
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
  signatureVerification: false, // Disable signature verification for challenge handling
  endpoints: {
    events: '/slack/events'
  },
  dispatchErrorHandler: async ({ error, logger, client, data }) => {
    logger.error('Slack dispatch error:', error);
    // Do NOT send any response - just log
  }
});

// Add health check routes
receiver.router.use(healthRoutes);

// Add basic request logging (without consuming body stream)
receiver.router.use((req, res, next) => {
  console.log(`📍 Incoming request: ${req.method} ${req.url}`);
  next();
});

// Initialize cron scheduler (will be updated with Slack client after app initialization)
const cronScheduler = new CronScheduler();

// Add cron job management routes
receiver.router.get('/cron/status', (req, res) => {
  res.json(cronScheduler.getStatus());
});

receiver.router.get('/cron/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  res.json(cronScheduler.getHistory(limit));
});

receiver.router.post('/cron/trigger-daily', async (req, res) => {
  try {
    const result = await cronScheduler.triggerDailyAssessment();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

receiver.router.post('/cron/trigger-test', async (req, res) => {
  try {
    const maxDeals = parseInt(req.query.maxDeals) || 2; // Default to 2 deals for testing
    const result = await cronScheduler.triggerTestAssessment(maxDeals);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

receiver.router.put('/cron/schedule', async (req, res) => {
  try {
    const { hour, minute } = req.body;
    const result = cronScheduler.updateDailySchedule(hour, minute);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

receiver.router.put('/cron/enabled', async (req, res) => {
  try {
    const { enabled } = req.body;
    const result = cronScheduler.setDailyAssessmentEnabled(enabled);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get the daily assessment instruction prompt
receiver.router.get('/api/assessment-prompt', (req, res) => {
  try {
    const { DailyAssessmentJob } = require('./jobs/dailyAssessment');
    const assessmentJob = new DailyAssessmentJob();
    
    // Create a sample deal object to generate the prompt
    const sampleDeal = {
      id: 'sample-deal-id',
      name: 'Sample Deal Name',
      value: 150000,
      company_name: 'Sample Company',
      stage: 'Goal: Get to Financing',
      created_at: new Date().toISOString()
    };
    
    const prompt = assessmentJob.generateAssessmentPrompt(sampleDeal);
    
    res.json({
      success: true,
      prompt: prompt,
      note: 'This is the template prompt used for daily assessments. Deal-specific details are replaced with actual values during execution.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint to get the system prompt for the Claude agent
receiver.router.get('/api/system-prompt', (req, res) => {
  try {
    const { ClaudeAgent } = require('./services/claudeAgent');
    const agent = new ClaudeAgent();
    
    const systemPrompt = agent.buildSystemPrompt();
    
    res.json({
      success: true,
      prompt: systemPrompt,
      note: 'This is the system prompt used by the Claude agent for all interactions.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add a basic root route with HTML UI
receiver.router.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CRM Bot Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 0;
            text-align: center;
            margin-bottom: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 1.2em;
            opacity: 0.9;
        }
        
        .status {
            display: inline-block;
            padding: 5px 10px;
            background: #4CAF50;
            color: white;
            border-radius: 20px;
            font-size: 0.9em;
            margin-top: 10px;
        }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border: 1px solid #e0e0e0;
        }
        
        .card h3 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 1.3em;
        }
        
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            transition: background 0.3s;
            cursor: pointer;
            border: none;
            font-size: 1em;
            margin: 5px;
        }
        
        .btn:hover {
            background: #5a67d8;
        }
        
        .btn-success {
            background: #4CAF50;
        }
        
        .btn-success:hover {
            background: #45a049;
        }
        
        .btn-warning {
            background: #ff9800;
        }
        
        .btn-warning:hover {
            background: #f57c00;
        }
        
        .btn-danger {
            background: #f44336;
        }
        
        .btn-danger:hover {
            background: #da190b;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .info-item {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 5px;
            border-left: 4px solid #667eea;
        }
        
        .info-item strong {
            color: #667eea;
            display: block;
            margin-bottom: 5px;
        }
        
        .prompt-viewer {
            background: #f8f9fa;
            border: 1px solid #e0e0e0;
            border-radius: 5px;
            padding: 15px;
            margin-top: 15px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.9em;
            white-space: pre-wrap;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .hidden {
            display: none;
        }
        
        .loading {
            text-align: center;
            padding: 20px;
            color: #666;
        }
        
        .error {
            color: #f44336;
            background: #ffebee;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
        }
        
        .success {
            color: #4CAF50;
            background: #e8f5e8;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
        }
        
        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: #666;
            border-top: 1px solid #e0e0e0;
        }
        
        .version {
            font-size: 0.9em;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 CRM Bot Dashboard</h1>
            <p>Claude Agent for TextQL CRM Management</p>
            <div class="status">✅ Running</div>
        </div>

        <div class="grid">
            <div class="card">
                <h3>📊 Daily Assessment</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <strong>Status</strong>
                        <span id="assessment-status">Loading...</span>
                    </div>
                    <div class="info-item">
                        <strong>Next Run</strong>
                        <span id="next-run">Loading...</span>
                    </div>
                    <div class="info-item">
                        <strong>Last Run</strong>
                        <span id="last-run">Loading...</span>
                    </div>
                </div>
                <button class="btn btn-success" onclick="triggerAssessment()">🚀 Run Assessment</button>
                <button class="btn btn-warning" onclick="triggerTestAssessment()">🧪 Test Run (2 deals)</button>
                <button class="btn" onclick="showAssessmentPrompt()">📝 View Assessment Prompt</button>
                <div id="assessment-prompt" class="prompt-viewer hidden"></div>
            </div>

            <div class="card">
                <h3>🧠 System Prompt</h3>
                <p>View and understand the system prompt used by the Claude agent for all interactions.</p>
                <button class="btn" onclick="showSystemPrompt()">📖 View System Prompt</button>
                <div id="system-prompt" class="prompt-viewer hidden"></div>
            </div>

            <div class="card">
                <h3>⚙️ Cron Management</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <strong>Timezone</strong>
                        <span id="timezone">Loading...</span>
                    </div>
                    <div class="info-item">
                        <strong>Schedule</strong>
                        <span id="schedule">Loading...</span>
                    </div>
                </div>
                <button class="btn" onclick="toggleCron()">🔄 Toggle Cron</button>
                <button class="btn" onclick="showCronHistory()">📈 View History</button>
            </div>

            <div class="card">
                <h3>📱 Quick Actions</h3>
                <a href="/health" class="btn">🩺 Health Check</a>
                <a href="/cron/status" class="btn">📊 Cron Status</a>
                <a href="/cron/history" class="btn">📋 Cron History</a>
            </div>
        </div>

        <div class="card">
            <h3>📋 System Information</h3>
            <div class="info-grid">
                <div class="info-item">
                    <strong>Version</strong>
                    <span class="version">${require('../package.json').version}</span>
                </div>
                <div class="info-item">
                    <strong>Agent</strong>
                    <span>Claude Sonnet 4 (Native Tool Calling)</span>
                </div>
                <div class="info-item">
                    <strong>Environment</strong>
                    <span>${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}</span>
                </div>
                <div class="info-item">
                    <strong>Platform</strong>
                    <span>${process.env.RAILWAY_ENVIRONMENT ? 'Railway' : 'Local'}</span>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>CRM Bot Dashboard - Powered by Claude Sonnet 4</p>
            <p class="version">Last updated: ${new Date().toLocaleString()}</p>
        </div>
    </div>

    <script>
        // Load initial status
        loadAssessmentStatus();

        async function loadAssessmentStatus() {
            try {
                const response = await fetch('/cron/status');
                const data = await response.json();
                
                // Update assessment status
                document.getElementById('assessment-status').textContent = 
                    data.currentJob.isRunning ? 'Running' : 'Idle';
                
                if (data.jobs && data.jobs.length > 0) {
                    const job = data.jobs[0];
                    document.getElementById('next-run').textContent = 
                        new Date(job.nextRun).toLocaleString();
                    document.getElementById('last-run').textContent = 
                        job.lastRun !== 'Never' ? new Date(job.lastRun).toLocaleString() : 'Never';
                    document.getElementById('schedule').textContent = job.schedule;
                }
                
                document.getElementById('timezone').textContent = data.scheduler.timezone;
                
            } catch (error) {
                console.error('Error loading status:', error);
            }
        }

        async function triggerAssessment() {
            if (confirm('Are you sure you want to trigger the daily assessment?')) {
                try {
                    const response = await fetch('/cron/trigger-daily', { method: 'POST' });
                    const data = await response.json();
                    
                    if (data.success) {
                        showMessage('Assessment triggered successfully!', 'success');
                        loadAssessmentStatus();
                    } else {
                        showMessage('Error: ' + data.error, 'error');
                    }
                } catch (error) {
                    showMessage('Error triggering assessment: ' + error.message, 'error');
                }
            }
        }

        async function triggerTestAssessment() {
            if (confirm('Are you sure you want to trigger a test assessment (2 deals)?')) {
                try {
                    const response = await fetch('/cron/trigger-test', { method: 'POST' });
                    const data = await response.json();
                    
                    if (data.success) {
                        showMessage('Test assessment triggered successfully!', 'success');
                        loadAssessmentStatus();
                    } else {
                        showMessage('Error: ' + data.error, 'error');
                    }
                } catch (error) {
                    showMessage('Error triggering test assessment: ' + error.message, 'error');
                }
            }
        }

        async function showAssessmentPrompt() {
            const promptDiv = document.getElementById('assessment-prompt');
            
            if (!promptDiv.classList.contains('hidden')) {
                promptDiv.classList.add('hidden');
                return;
            }
            
            promptDiv.innerHTML = '<div class="loading">Loading assessment prompt...</div>';
            promptDiv.classList.remove('hidden');
            
            try {
                const response = await fetch('/api/assessment-prompt');
                const data = await response.json();
                
                if (data.success) {
                    promptDiv.textContent = data.prompt;
                } else {
                    promptDiv.innerHTML = '<div class="error">Error: ' + data.error + '</div>';
                }
            } catch (error) {
                promptDiv.innerHTML = '<div class="error">Error loading prompt: ' + error.message + '</div>';
            }
        }

        async function showSystemPrompt() {
            const promptDiv = document.getElementById('system-prompt');
            
            if (!promptDiv.classList.contains('hidden')) {
                promptDiv.classList.add('hidden');
                return;
            }
            
            promptDiv.innerHTML = '<div class="loading">Loading system prompt...</div>';
            promptDiv.classList.remove('hidden');
            
            try {
                const response = await fetch('/api/system-prompt');
                const data = await response.json();
                
                if (data.success) {
                    promptDiv.textContent = data.prompt;
                } else {
                    promptDiv.innerHTML = '<div class="error">Error: ' + data.error + '</div>';
                }
            } catch (error) {
                promptDiv.innerHTML = '<div class="error">Error loading prompt: ' + error.message + '</div>';
            }
        }

        async function toggleCron() {
            // This would implement cron enable/disable functionality
            showMessage('Cron toggle functionality coming soon!', 'info');
        }

        async function showCronHistory() {
            window.open('/cron/history', '_blank');
        }

        function showMessage(message, type) {
            const messageDiv = document.createElement('div');
            messageDiv.className = type;
            messageDiv.textContent = message;
            
            document.body.appendChild(messageDiv);
            
            setTimeout(() => {
                messageDiv.remove();
            }, 5000);
        }

        // Auto-refresh status every 30 seconds
        setInterval(loadAssessmentStatus, 30000);
    </script>
</body>
</html>
  `);
});

// Challenge verification is now handled above, before other middleware

// Configure app based on environment
// Force HTTP mode on Railway, Socket Mode only for local development
const isSocketMode = process.env.NODE_ENV === 'development' && 
                     process.env.SLACK_APP_TOKEN && 
                     !process.env.RAILWAY_ENVIRONMENT;
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

// Add Socket Mode debugging and error handling
if (isSocketMode) {
  console.log('📡 Socket Mode app created, waiting for connection...');
  
  // Add Socket Mode connection event handlers with retry logic
  let connectionAttempts = 0;
  const maxRetries = 3;
  
  const handleSocketModeError = (error) => {
    console.error('📡 Socket Mode error:', error.message || error);
    
    if (error.message && error.message.includes('server explicit disconnect')) {
      console.log('📡 Server disconnected during connection attempt');
      
      if (connectionAttempts < maxRetries) {
        connectionAttempts++;
        console.log(`📡 Retrying connection (attempt ${connectionAttempts}/${maxRetries})...`);
        
        // Add a small delay before retrying
        setTimeout(() => {
          console.log('📡 Attempting to reconnect...');
        }, 2000);
      } else {
        console.error('📡 Max connection attempts reached. Please check your Slack app configuration.');
        process.exit(1);
      }
    }
  };
  
  // Set up error handlers
  app.client.on('disconnect', (error) => {
    console.log('📡 Socket Mode disconnected:', error?.message || 'No error details');
    handleSocketModeError(error || new Error('Unknown disconnect'));
  });
  
  app.client.on('error', handleSocketModeError);
  
  // Add connection success indicator
  app.client.on('ready', () => {
    console.log('📡 Socket Mode connected successfully');
    connectionAttempts = 0; // Reset counter on successful connection
  });
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
      // Mark as processed only after we decide to process it
      markMessageAsProcessed(messageKey);
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
      markMessageAsProcessed(messageKey);
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
        markMessageAsProcessed(messageKey);
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
    const fileStorage = require('./services/fileStorage');
    connectDB = async () => {
      console.log('Using file-based conversation logging to data/conversations/');
      return true;
    };
    await connectDB();
    dbService = 'File Storage';
    
    console.log('🚂 Starting CRM Bot with Claude Agent...');
    console.log('🔍 Deployment:', process.env.RAILWAY_ENVIRONMENT ? `Railway (${process.env.RAILWAY_ENVIRONMENT})` : 'Local Development');
    console.log('💾 Database:', dbService);
    console.log('🤖 Agent: Claude Sonnet 4 with Native Tool Calling (v1.12.1)');
    
    // Start Slack app with better error handling
    const port = process.env.PORT || 3000;
    
    console.log(`🌐 Starting app in ${isSocketMode ? 'Socket Mode' : 'HTTP Mode'} on port ${port}`);
    console.log(`📍 Environment: NODE_ENV=${process.env.NODE_ENV}, has SLACK_APP_TOKEN=${!!process.env.SLACK_APP_TOKEN}`);
    
    if (isSocketMode) {
      console.log('🔐 Socket Mode validation...');
      if (!process.env.SLACK_APP_TOKEN) {
        throw new Error('SLACK_APP_TOKEN is required for Socket Mode');
      }
      if (!process.env.SLACK_APP_TOKEN.startsWith('xapp-')) {
        throw new Error('SLACK_APP_TOKEN must start with "xapp-"');
      }
    }
    
    // Start the app with additional error handling for Socket Mode
    try {
      await app.start(port);
    } catch (startError) {
      // Check if it's the specific Socket Mode state machine error
      if (startError.message && startError.message.includes('Unhandled event') && 
          startError.message.includes('server explicit disconnect')) {
        console.error('⚠️ Socket Mode connection issue detected');
        console.error('This usually means:');
        console.error('1. Your Slack app token may be invalid or expired');
        console.error('2. Socket Mode might not be enabled in your Slack app settings');
        console.error('3. Network connectivity issues');
        console.error('\nPlease check your Slack app configuration and try again.');
        process.exit(1);
      }
      
      // Re-throw other errors
      throw startError;
    }
    console.log(`⚡️ CRM Bot with Claude Agent is running on port ${port}!`);
    console.log('🧠 Using Claude native tool calling with thinking mode enabled');
    console.log('🔐 Preview mode enabled - all write actions require approval before execution');
    console.log(`🩺 Health check available at: http://localhost:${port}/health`);
    
    // Set up Slack client for cron scheduler
    cronScheduler.setSlackClient(app.client);
    
    // Start the cron scheduler for daily assessments
    console.log('⏰ Starting cron scheduler for daily deal assessments...');
    cronScheduler.start();
    console.log('⏰ Cron scheduler started successfully');
    console.log(`📊 Cron status available at: http://localhost:${port}/cron/status`);
    
    // Add graceful shutdown handling
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down gracefully...');
      await app.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Unable to start app:', error);
    
    // Provide specific error messages for common issues
    if (error.message.includes('socket-mode')) {
      console.error('\n💡 Socket Mode troubleshooting:');
      console.error('1. Check your SLACK_APP_TOKEN is valid and starts with "xapp-"');
      console.error('2. Verify Socket Mode is enabled in your Slack app settings');
      console.error('3. Ensure the app token has "connections:write" scope');
      console.error('4. Check your internet connection');
    }
    
    process.exit(1);
  }
})();