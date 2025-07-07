# CRM Bot - Intelligent Slack to Attio CRM Integration

## Overview

CRM Bot is an intelligent Slack bot that monitors conversations and automatically creates/updates records in Attio CRM. Built by Ethan Ding for TextQL, this bot uses a ReAct (Reasoning + Acting) AI agent pattern to understand natural language requests and perform CRM operations.

## 🎯 Purpose & Vision

Built to streamline GTM (Go-To-Market) operations by:
- Automatically capturing important updates from Slack into the CRM
- Enabling natural language CRM queries directly from Slack
- Reducing manual data entry and keeping CRM records up-to-date
- Creating a seamless bridge between team communications and CRM data

## 🏗️ Architecture

```
crm-bot/
├── src/
│   ├── index-react.js              # Main entry point (Socket Mode)
│   ├── handlers/
│   │   └── slackHandlerReact.js    # Slack event handlers with preview mode
│   ├── services/
│   │   ├── reactAgent.js           # ReAct AI agent implementation
│   │   ├── attioService.js         # Attio CRM API integration
│   │   ├── database-mock.js        # In-memory DB fallback
│   │   └── database.js             # MongoDB integration
│   └── workers/                    # Cloudflare Workers (unused)
├── local-bot.js                    # 🆕 Local testing interface
├── test-bot.js                     # 🆕 Automated test suite
├── .env                            # Environment variables (source of truth)
├── railway.toml                    # Railway deployment config
├── CLAUDE.md                       # AI assistant context
├── DEVELOPMENT_WORKFLOW.md         # 🆕 Development guide
└── LOCAL_TESTING.md                # 🆕 Local testing setup
```

## 🚀 Current Functionality

### Core Features
- **Natural Language Processing**: Understands requests like "find all deals related to Raine Group"
- **Fuzzy Search**: Intelligently matches partial names and typos
- **Preview Mode**: Shows exactly what actions will be taken before executing
- **Thread Support**: Maintains conversation context across thread replies
- **Approval Workflow**: All write operations require user confirmation

### Supported CRM Operations
1. **Search** - Find companies, deals, or people with fuzzy matching
2. **Create Notes** - Add notes to any CRM record
3. **View Details** - Get comprehensive information about entities
4. **Create Entities** - Add new companies, deals, or people (coming soon)
5. **Update Fields** - Modify existing records (coming soon)

### AI Capabilities
- Uses Claude 3 for intelligent reasoning
- ReAct pattern for step-by-step problem solving
- Shows thinking process transparently
- Handles ambiguous requests gracefully

## 🛠️ Technical Stack

- **Framework**: Slack Bolt.js (Socket Mode)
- **AI**: Anthropic Claude API
- **CRM**: Attio API
- **Database**: MongoDB Atlas (with in-memory fallback)
- **Hosting**: Railway (production deployment)
- **Language**: Node.js 18+

## 📦 Setup & Installation

### Prerequisites
- Node.js 18+
- Slack workspace admin access
- Attio CRM account
- Anthropic API key
- MongoDB Atlas account (optional)

### Environment Variables
Create a `.env` file with:
```bash
# Slack Configuration (App ID: A094BJTADMG)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...

# APIs
ANTHROPIC_API_KEY=sk-ant-api03-...
ATTIO_API_KEY=...

# MongoDB (optional)
MONGODB_URI=mongodb+srv://...
```

### Slack App Configuration

1. Create a Slack app at https://api.slack.com/apps
2. Enable Socket Mode
3. Add Bot Token Scopes:
   - `app_mentions:read`
   - `chat:write`
   - `channels:history`
   - `channels:read`
   - `groups:history`
   - `groups:read`
   - `im:history`
   - `im:read`
   - `im:write`
   - `users:read`
4. Install app to workspace
5. Copy tokens to `.env`

### Local Development

**🎉 NEW**: Test the AI locally without Slack! Perfect for rapid development.

#### Development Workflow

1. **Test AI Logic Locally** (No Slack Required!)
   ```bash
   # Interactive testing - chat with the bot
   npm run local
   
   # Type commands like:
   > find rain group
   > search for the raine group
   > /debug  # Show AI reasoning steps
   > /exit   # Quit
   
   # Or quick one-liner tests
   echo "find the raine group" | npm run local
   
   # Run automated test suite
   npm run test:bot
   ```

2. **Deploy to Test Slack Features**
   ```bash
   git push origin main  # Auto-deploys to Railway
   ```

3. **Full Development Cycle**:
   - **Phase 1**: Test AI changes locally (`npm run local`)
   - **Phase 2**: Deploy and test Slack integration
   - See [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md) for details

#### Local Testing Features

- **Interactive Chat**: Real-time conversation with the bot
- **Debug Mode**: See the AI's reasoning process
- **Fuzzy Search**: Test misspellings like "rain" → "raine"
- **Thread Context**: Test multi-message conversations
- **Instant Feedback**: No deployment wait times

#### Best Practices

1. **Always Test AI Logic Locally First**
   ```bash
   # Make changes to reactAgent.js or attioService.js
   npm run local
   # Test your changes instantly
   ```

2. **Use Feature Branches**
   ```bash
   git checkout -b feature/improve-search
   # Test locally until perfect
   npm run local
   # Then deploy
   git push origin feature/improve-search
   ```

3. **Monitor Production**
   - Railway logs show deployment status
   - Bot includes version in responses (e.g., "🚂 v1.8.0")

## 🚂 Deployment

### Railway (Production)

- **Repository**: https://github.com/TextQLLabs/crm-bot
- **Auto-deploy**: ✅ Enabled - pushes to `main` branch trigger automatic deployment
- **Deploy Time**: ~2-3 minutes
- **Environment**: Variables set in Railway dashboard (not from `.env`)

### Deployment Process

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

2. **Railway Auto-Deploy**
   - Detects push within seconds
   - Builds new container
   - Runs health checks
   - Swaps to new version

3. **Monitor Deployment**
   - Go to Railway dashboard → Your project
   - Click on deployment to see logs
   - Look for: "⚡️ CRM Bot with ReAct Agent is running!"

### Error Handling

**Build Errors**:
- Shown in Railway dashboard under failed deployment
- Common: Missing dependencies, syntax errors
- Fix locally first, then push

**Runtime Errors**:
- Visible in Railway logs (real-time)
- Bot will show error messages in Slack
- Railway auto-restarts on crashes

**Rollback**:
- Railway dashboard → Deployments → Click previous deployment → "Redeploy"
- Or use git: `git revert HEAD && git push`

### Monitoring
- **Real-time Logs**: Railway dashboard → "View Logs"
- **Deployment Status**: Green = running, Red = failed
- **Debug Info**: Bot includes deployment info in thinking message
- **Alerts**: Set up in Railway dashboard (optional)

## 🧪 Testing

### Basic Test Flow
1. Mention the bot: `@crm-bot-ethan test`
2. Search test: `@crm-bot-ethan find deals related to Raine`
3. Note creation: `@crm-bot-ethan add a note to the Raine deal saying "Test note"`
4. Thread test: Reply to the bot's message to test context retention

### Testing with MCP Server
An MCP (Model Context Protocol) server is configured for the Slack integration, allowing direct bot testing without manual Slack interaction. This is available on the Ethan Ding account.

## 🗺️ Roadmap & Next Steps

### Immediate Priorities
- [ ] Add entity creation (companies, deals, people)
- [ ] Implement field updates
- [ ] Add bulk operations support
- [ ] Create activity/task logging

### Future Enhancements
- [ ] Multi-workspace support
- [ ] Custom field mapping
- [ ] Scheduled reports
- [ ] Webhook support for real-time CRM updates
- [ ] Integration with other tools (email, calendar)
- [ ] Advanced analytics and insights

### Technical Improvements
- [ ] Add comprehensive error handling
- [ ] Implement rate limiting
- [ ] Add request queuing
- [ ] Create admin dashboard
- [ ] Add performance monitoring
- [ ] Implement caching strategy

## 🐛 Troubleshooting

### Common Issues

1. **"invalid_auth" error**
   - Check Slack tokens are correct in Railway
   - Ensure tokens match the app (App ID: A094BJTADMG)

2. **"missing_scope" error**
   - Add missing OAuth scopes in Slack app
   - Reinstall app to workspace
   - Update tokens in Railway

3. **"401 invalid x-api-key"**
   - Verify Anthropic API key is correct
   - Check for extra spaces or quotes

4. **Bot not responding**
   - Check Railway deployment status
   - Verify bot is mentioned correctly
   - Check logs for connection errors

## 👥 Team

- **Built by**: Ethan Ding
- **Organization**: TextQL
- **Slack Workspace**: TextQL

## 📝 Notes

- Always use `.env` file as source of truth for credentials
- Socket Mode means no public URLs needed
- Railway handles automatic restarts on crashes
- MongoDB is optional - falls back to in-memory storage
- Preview mode ensures safety for all write operations

## 🔗 Important Links

- **GitHub**: https://github.com/TextQLLabs/crm-bot
- **Railway Dashboard**: [Check your Railway account]
- **Slack App**: https://api.slack.com/apps/A094BJTADMG
- **Attio CRM**: https://app.attio.com

## 📚 Additional Documentation

See `CLAUDE.md` for AI assistant context and technical implementation details.