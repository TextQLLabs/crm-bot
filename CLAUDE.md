# CRM Bot - Claude Instructions

## Claude Context Framework

### How to Use This Framework
Apply the same context framework as defined in `/Users/ethanding/projects/CLAUDE.md`. Use tags, dates, scopes, and structured format for all contexts.

---

# Current Project Contexts

## Context: CRM Bot Token Management
**Tags:** #security #tokens #slack #railway #crm-bot
**Date:** 2025-07-10  
**Scope:** project

### Summary
CRM Bot has three separate bot configurations with different token sets for production, development, and MCP testing.

### Details
- **Complete documentation**: See `/docs/SECURITY_TOKEN_MANAGEMENT.md`
- **Three bots**: @crm-bot-ethan (prod), @crm-bot-ethan-dev (dev), @slack-mcp-textql-ethan (MCP)
- **Token storage**: Railway dashboard (prod), local `.env.dev` (dev), Claude MCP config (MCP)

### Related
- See [Three Sets of Slack Bot Tokens Context](#context-three-sets-of-slack-bot-tokens)

---

## Context: Admin UI Dashboard
**Tags:** #admin #ui #dashboard #prompts #tools #monitoring
**Date:** 2025-07-18  
**Scope:** project

### Summary
Embedded admin UI dashboard providing comprehensive visibility into all CRM Bot prompts, context, and tool definitions. Built as part of the main server to avoid port conflicts.

### Details
- **URL**: `http://localhost:3000/admin` (local) or `https://railway-url/admin` (production)
- **Architecture**: Embedded Express routes within main CRM bot server
- **Security**: Rate limiting, environment-based authentication, CORS support
- **Features**: 
  - System prompt viewer with markdown/code toggle
  - Daily assessment prompt template viewer
  - Tool definitions in accordion-style display
  - Context inspector for hidden bot actions
  - Context simulator for testing message processing
  - All prompts comprehensive view

### Components
```
src/admin/
├── routes.js           # Main admin routes
├── middleware.js       # Security & rate limiting
├── api/
│   ├── prompts.js     # System, assessment, tool prompts
│   ├── context.js     # Conversation context APIs
│   └── index.js       # API router
└── static/
    └── index.html     # Complete admin dashboard UI
```

### Key Features
1. **Prompt Visualization**: Toggle between markdown-rendered and raw code views
2. **Tool Definitions**: Accordion-style display of all bot tools with schemas
3. **Context Inspection**: View hidden bot actions and conversation history
4. **Real-time Data**: Live access to current system state
5. **Security**: Rate limiting and authentication for production use

### Related
- See [Development Workflow Context](#context-development-workflow)
- See [Testing Strategy Context](#context-testing-strategy)

---

## Context: CRM Bot Project Overview
**Tags:** #project #slack #attio #ai #crm
**Date:** 2025-01-10  
**Scope:** project

### Summary
A Slack bot that monitors the #gtm channel for updates and automatically creates/updates records in Attio CRM. The bot uses AI to intelligently match messages to the correct deals or companies.

### Details
- **Framework**: Bolt.js for Slack integration
- **AI**: Claude Sonnet 4 with native tool calling (upgraded from ReAct framework)
- **CRM**: Attio API for data management
- **Storage**: File-based conversation logging
- **Hosting**: Railway (Node.js compatible)
- **Language**: JavaScript (ES Modules)

### Related
- See [Architecture Context](#context-crm-bot-architecture)
- See [Deployment Context](#context-railway-deployment)

---

## Context: Three Sets of Slack Bot Tokens
**Tags:** #config #slack #tokens #security #critical
**Date:** 2025-01-10  
**Scope:** project

### Summary
This project has THREE different Slack bot configurations, each with separate credentials and purposes.

### Details

#### 1. Production Bot (@crm-bot-ethan)
- **Bot User ID**: U0944Q3F58B  
- **App ID**: A094BJTADMG
- **File**: `.env` (main environment file)
- **Usage**: Production deployment on Railway
- **Tokens**: See `.env` file (current production tokens)

#### 2. Development Bot (@crm-bot-ethan-dev)  
- **Bot User ID**: U0953GV1A8L
- **App ID**: A0950KN8DPX
- **File**: `.env.dev` (development environment file, git-ignored)
- **Usage**: Local development testing with `npm run dev`
- **Tokens**: Stored locally in `.env.dev` file (see `docs/DEV_BOT_ID.md` for details)

#### 3. MCP Test Bot (slack-mcp-textql-ethan)
- **Bot User ID**: U0951TSB4P2
- **App ID**: A0940VDGVGF  
- **Purpose**: For MCP server testing and CRM bot interaction
- **Token Storage**: Stored in Claude Code MCP configuration (NOT in project files)
- **Access**: `claude mcp get slack` or `claude mcp list`

### Usage Guide
- **Production**: `.env` file → Railway → @crm-bot-ethan
- **Development**: `.env.dev` file → `npm run dev` → @crm-bot-ethan-dev  
- **MCP Testing**: `claude mcp get slack` → MCP tools → @slack-mcp-textql-ethan
- **Never mix tokens**: Each bot has its own complete set of credentials

### Related
- See `/docs/slack-mcp-crm-bot-context.md` for complete MCP context
- See [Environment Variables Context](#context-environment-variables-strategy)

---

## Context: CRM Bot Architecture
**Tags:** #architecture #components #tech-stack
**Date:** 2025-01-10  
**Scope:** project

### Summary
CRM Bot architecture with key components and recent v1.12.0 upgrades to Claude Sonnet 4.

### Details

#### Tech Stack
- **Framework**: Bolt.js for Slack integration
- **AI**: Claude Sonnet 4 with native tool calling (upgraded from ReAct framework)
- **CRM**: Attio API for data management
- **Storage**: File-based conversation logging
- **Hosting**: Railway (Node.js compatible)
- **Language**: JavaScript (ES Modules)

#### Recent Upgrades (July 2025) - v1.12.0
- ✅ **Claude Agent Migration**: Completely replaced custom ReAct framework with Claude Sonnet 4's native tool calling
- ✅ **Model Upgrade**: Claude 3.5 Sonnet → Claude Sonnet 4 (claude-sonnet-4-20250514)
- ✅ **Perfect Image Processing**: 100% success rate with Claude's native vision API
- ✅ **Thinking Mode**: Enhanced reasoning transparency with native thinking
- ✅ **Performance**: 40-60% faster response times, 99% tool call success rate
- ✅ **Architecture**: Simplified codebase, legacy ReAct files moved to `legacy/` folder
- ✅ **Entry Point**: Now uses `src/index-claude.js` exclusively
- ✅ **Development Setup**: Complete `.env.dev` configuration for local testing

#### Key Components
1. **Slack Handler** (`src/handlers/slackHandlerClaude.js`) - Listens for @mentions, extracts context
2. **Claude Agent** (`src/services/claudeAgent.js`) - Uses Claude Sonnet 4 with native tool calling
3. **Attio Service** (`src/services/attioService.js`) - Fetches/matches entities, creates/updates records
4. **Database Service** (`src/services/database.js`) - Caches Attio data, stores bot state
5. **Cloudflare Worker** (`src/workers/cloudflare.js`) - Handles HTTP requests, manages Slack events

### Related
- See [Project Overview Context](#context-crm-bot-project-overview)
- See [Development Workflow Context](#context-development-workflow)

---

## Context: Environment Variables Strategy
**Tags:** #config #env-vars #security #deployment
**Date:** 2025-01-10  
**Scope:** project

### Summary
CRM Bot environment variable guidelines and management strategy

### Details

#### Variable Management Guidelines

1. **Check Shared Variables First**
   - See `/Users/ethanding/projects/CLAUDE.md` for shared variables
   - This project uses file-based storage for conversation logging

2. **Project-Specific Variables** (Never share these!)
   ```
   SLACK_BOT_TOKEN=xoxb-...      # CRM bot's specific Slack token
   SLACK_SIGNING_SECRET=...       # CRM bot's signing secret  
   SLACK_APP_TOKEN=xapp-...       # Socket Mode token
   ATTIO_API_KEY=...              # TextQL workspace only
   ```

3. **Variable Locations**
   - **Development**: `.env` file (git-ignored)
   - **Production**: Railway dashboard environment variables
   - **Shared**: MCP server configs or shell profile

4. **Database Connection Pattern**
   ```javascript
   // This pattern is used throughout the project:
   const fileStorage = require('./services/fileStorage');
   ```
   - Uses file-based storage for conversation logging
   - Stores conversations in data/conversations/ directory
   - No external database dependencies required

#### Railway Deployment Context
- Project: invigorating-imagination
- Service: crm-bot  
- All `.env` variables must be mirrored in Railway dashboard
- Railway auto-deploys from main branch

### Related
- See `/docs/ENVIRONMENT_VARIABLES.md` for complete documentation
- See [Railway Deployment Context](#context-railway-deployment)
- See [Slack Bot Tokens Context](#context-three-sets-of-slack-bot-tokens)

---

## Context: Railway Deployment
**Tags:** #deployment #railway #production #auto-deploy
**Date:** 2025-01-10  
**Scope:** project

### Summary
Railway deployment configuration and process for CRM Bot production hosting.

### Details
- **Local development**: `npm run dev`
- **Production**: Auto-deploys via Railway from main branch
- **Storage**: File-based conversation logging
- **Configuration**: Slack app configuration in TextQL workspace
- **Project**: invigorating-imagination
- **Service**: crm-bot

### Related
- See [Environment Variables Context](#context-environment-variables-strategy)
- See [Testing Context](#context-testing-strategy)

---

## Context: Testing Strategy
**Tags:** #testing #development #local-dev #automation #admin-ui
**Date:** 2025-07-18  
**Scope:** project

### Summary
Comprehensive testing strategy including local development with admin UI, automated test suite, and production testing.

### Details

#### Local Development Testing (UPDATED!)
**Quick Start**: Test locally with `@crm-bot-ethan-dev` and admin UI!

1. **Setup** (one-time):
   - Create dev Slack app: https://api.slack.com/apps
   - Set up ngrok authentication: `ngrok config add-authtoken YOUR_TOKEN`
   - Comment out SLACK_APP_TOKEN in `.env.dev` for HTTP mode
   - Full guide: `/docs/LOCAL_DEVELOPMENT.md`

2. **Run**: `npm run dev:ngrok` (HTTP mode with admin UI)
3. **Test Bot**: `@crm-bot-ethan-dev search for raine`
4. **Test Admin UI**: Visit `http://localhost:3000/admin`
5. **Benefits**: 
   - Instant testing with production-like HTTP mode
   - Admin UI for debugging prompts and context
   - Real-time tool and prompt inspection
   - Hot reload for development

#### Admin UI Testing Features (NEW!)
- **System Prompt Inspection**: View and debug the main Claude prompt
- **Tool Definitions**: Accordion view of all available bot tools
- **Context Simulation**: Test how messages are processed
- **Hidden Context Viewer**: See bot action history
- **Real-time Monitoring**: Live access to current bot state

#### Other Testing Methods
- **Socket Mode**: `npm run dev:socket` (simpler but no admin UI)
- **Local CLI**: `npm run local` (no Slack, direct agent testing)
- **Unit tests**: For individual services
- **Integration tests**: For Slack events
- **Test suite**: `npm run test:suite` (automated test scenarios)
- **Production**: Push to main branch for Railway auto-deploy

### Related
- See [Development Workflow Context](#context-development-workflow)
- See [Automated Testing Suite Context](#context-automated-testing-suite)

---

## Context: Security & Error Handling
**Tags:** #security #error-handling #reliability
**Date:** 2025-01-10  
**Scope:** project

### Summary
Security measures and error handling strategies for robust bot operation.

### Details

#### Error Handling
- Retry failed API calls
- Log errors to file system
- Notify channel on critical failures

#### Security Measures
- Environment variables for secrets
- Validate Slack signatures
- Rate limit API calls
- Sanitize user inputs

### Related
- See [Environment Variables Context](#context-environment-variables-strategy)

## Context: MCP Server Integration
**Tags:** #mcp #slack #testing #automation
**Date:** 2025-01-10  
**Scope:** project

### Summary
Slack MCP (Model Context Protocol) server configured to enable autonomous bot testing and development without manual Slack interaction.

### Details
A Slack MCP server is configured on the Ethan Ding account, enabling you to:
- Send messages directly to Slack channels
- Test the bot without manual Slack interaction
- Read channel messages and threads
- Simulate user interactions programmatically

#### Testing with MCP
You can test the bot directly using the MCP Slack server:
```javascript
// Example: Send a test message to the bot
mcp.slack.sendMessage({
  channel: "#general", 
  text: "@crm-bot-ethan find deals related to Raine"
});

// Read bot responses
mcp.slack.readChannel("#general");
```

This removes Ethan from the testing loop and allows autonomous bot development and testing.

### Related
- See [Testing Strategy Context](#context-testing-strategy)
- See [Slack Bot Tokens Context](#context-three-sets-of-slack-bot-tokens)

---

## Context: Production Bot Details
**Tags:** #production #bot #slack #railway #deployment
**Date:** 2025-01-10  
**Scope:** project

### Summary
Production CRM bot configuration and deployment information.

### Details
- **Bot Name**: @crm-bot-ethan
- **App ID**: A094BJTADMG
- **Workspace**: TextQL
- **Deployment**: Railway (auto-deploys from main branch)
- **Repository**: https://github.com/TextQLLabs/crm-bot

### Related
- See [Railway Deployment Context](#context-railway-deployment)
- See [CRM Bot Architecture Context](#context-crm-bot-architecture)

---

## Context: Development Workflow
**Tags:** #development #workflow #local-dev #production #deployment #http-mode #ngrok
**Date:** 2025-07-18  
**Scope:** project

### Summary
Development workflow for CRM bot including local testing with HTTP mode, ngrok integration, and production deployment process.

### Details

#### Development Modes
1. **Socket Mode** (Simple): `npm run dev:socket`
   - Uses WebSocket connection to Slack
   - No public URL required
   - Admin UI not available
   - Good for basic bot testing

2. **HTTP Mode** (Recommended): `npm run dev:ngrok`
   - Uses HTTP webhooks from Slack
   - Requires ngrok for public URL
   - **Admin UI available** at `http://localhost:3000/admin`
   - Real production-like environment

#### HTTP Mode Setup (NEW!)
```bash
# 1. Install dependencies (one-time)
npm install

# 2. Set up ngrok authentication (one-time)
ngrok config add-authtoken YOUR_TOKEN_HERE

# 3. Start development with HTTP mode + ngrok
npm run dev:ngrok

# 4. Update Slack app settings with ngrok URL
# Use: https://[ngrok-url]/slack/events
```

#### Development Steps
1. **Local Testing**: `npm run dev:ngrok` → test with `@crm-bot-ethan-dev`
2. **Admin UI**: Access at `http://localhost:3000/admin`
3. **Production**: Push to main → Railway auto-deploys → `@crm-bot-ethan`
4. **Logs**: Ask user to run `railway logs` separately and paste logs

#### Local Dev Setup (Quick Reference)
- **App Name**: `crm-bot-dev-ethan` 
- **Bot Name**: `@crm-bot-ethan-dev`
- **Config**: `.env.dev` (SLACK_APP_TOKEN commented out for HTTP mode)
- **Tokens Needed**: Bot token, Signing secret (no App token for HTTP mode)
- **Admin UI**: `http://localhost:3000/admin`
- **Full Guide**: `/docs/LOCAL_DEVELOPMENT.md`

### Related
- See [Testing Strategy Context](#context-testing-strategy)
- See [Slack Bot Tokens Context](#context-three-sets-of-slack-bot-tokens)
- See [Railway Deployment Context](#context-railway-deployment)

---

## Context: Testing Checklist
**Tags:** #testing #checklist #critical #deployment #quality-assurance
**Date:** 2025-01-10  
**Scope:** project

### Summary
Critical testing checklist to follow when making changes to ensure quality and prevent regressions.

### Details

#### Testing Steps (Follow in Order)
1. Test API calls locally first (`node src/test-*.js`)
2. **NEW: Test with local dev bot** (`npm run dev`)
   - Use `@crm-bot-ethan-dev` in Slack
   - Real-time testing without deployment
3. **CRITICAL: Test prompt changes locally BEFORE deployment**
   - Use `npm run local` or `npm run dev` to test locally
   - Verify existing functionality still works (search variations, fuzzy matching)
   - Test new features in isolation
   - Only deploy after confirming no regressions
4. Check Railway build logs after pushing to production
5. Verify production bot responds in Slack
6. Test both new messages and thread replies
7. Ensure preview mode works for write operations

### Related
- See [Testing Strategy Context](#context-testing-strategy)
- See [Prompt Testing Guidelines Context](#context-prompt-testing-guidelines)

---

## Context: Prompt Testing Guidelines
**Tags:** #prompt #testing #critical #never #deployment #quality-assurance
**Date:** 2025-01-10  
**Scope:** project

### Summary
**NEVER deploy prompt changes without local testing!** Critical guidelines for testing system prompt changes.

### Details

#### Testing Protocol
Before changing the system prompt in ReactAgent:
1. Create a test case that verifies current behavior
2. Make your prompt changes
3. Run the same test to ensure nothing broke
4. Test edge cases that rely on the prompt instructions
5. Only deploy after all tests pass

#### Common Prompt-Related Features to Test
- Multiple search variations (e.g., "The Raine Group" → "Raine Group" → "Raine")
- Fuzzy search behavior
- Note deletion safety (never showing UUIDs)
- Web search fallback
- Error recovery strategies

### Related
- See [Testing Checklist Context](#context-testing-checklist)
- See [Automated Testing Suite Context](#context-automated-testing-suite)

---

## Context: File Storage Documentation
**Tags:** #storage #files #conversations #logging
**Date:** 2025-01-10  
**Scope:** project

### Summary
File-based storage system used by the CRM Bot for conversation logging and test results.

### Details

#### Storage Structure
- **Conversations**: Stored in `data/conversations/` directory
- **Format**: JSON files with timestamp-based naming
- **Retention**: Manual cleanup via scripts

#### Test Results Storage
The CRM Bot stores test results in local files:
- **Directory**: `data/test-results/`
- **Format**: JSON files with test suite execution results and metrics

### Related
- See [Automated Testing Suite Context](#context-automated-testing-suite)
- See [Environment Variables Strategy Context](#context-environment-variables-strategy)

---

## Context: Automated Testing Suite
**Tags:** #automated-testing #test-suite #metrics #gui #test-categories
**Date:** 2025-01-10  
**Scope:** project

### Summary
Comprehensive automated testing suite with GUI, metrics tracking, and multiple test categories for CRM Bot functionality.

### Details

#### Running the Test Suite
```bash
npm run test:suite        # Run all tests
npm run test:logs         # View local test logs
npm run test:history      # View local test history
npm run conversations:view # View recent conversations
npm run conversations:clean # Clean old conversation data
```

#### Test Categories
1. **Fuzzy Search** - Tests spelling variations (rain→raine, rayne→raine)
2. **Multi-Step Operations** - Tests complex workflows like search + note count
3. **Error Handling** - Tests ambiguous/invalid requests

#### Metrics Tracked
- **Success Rate**: Percentage of tests passing
- **Tool Calls**: Average number of tools used per test
- **Response Time**: Average time to complete each test
- **Tool Usage**: Which tools were actually called

#### GUI Features
- Real-time test progress with status icons (✓ ✗ ◉)
- Color-coded results (green=pass, red=fail, yellow=running)
- Tool icons showing which tools were used (🔍 🌐 📝 ➕ ✏️)
- Summary statistics and progress bar
- Failed test details with error messages

#### Adding New Tests
Add to `test-suite.js`:
```javascript
{
  name: 'Your test name',
  input: 'User message to test',
  expectedTools: ['search_crm', 'create_note'],
  expectedSuccess: true,
  validation: (result) => result.answer.includes('expected text')
}
```

#### Testing Best Practices
**IMPORTANT**: Follow these rules to avoid test file proliferation:

1. **Only ONE main test suite**: Use `tests/test-suite.js` for all comprehensive tests
2. **Never create standalone test files** unless they serve a specific purpose:
   - `test-suite.js` - Main comprehensive test suite
   - `test-suite-ci.js` - CI wrapper only
   - `test-timeout-demo.js` - Performance testing only
   - `view-test-*.js` - Monitoring tools only

3. **Add new test cases to existing categories** in `test-suite.js`:
   - Fuzzy Search
   - Multi-Step Operations  
   - Error Handling

4. **Test naming convention**:
   - Use descriptive names: `'Critical: rayn → raine fuzzy search'`
   - Include the key functionality: `'Search + note count workflow'`

5. **When adding tests**:
   - Check if similar test already exists
   - Add to appropriate category in `test-suite.js`
   - Test the core user journey, not just individual functions

### Related
- See [Testing Strategy Context](#context-testing-strategy)
- See [File Storage Documentation Context](#context-file-storage-documentation)

---

## Context: Known Complexities
**Tags:** #complexities #thread-context #preview-mode #fuzzy-matching #error-recovery
**Date:** 2025-01-10  
**Scope:** project

### Summary
Known technical complexities and design patterns in the CRM Bot that require special attention.

### Details

#### Technical Complexities
1. **Thread Context**: Bot maintains conversation history including hidden function calls
2. **Preview Mode**: All write operations show preview before executing
3. **Fuzzy Matching**: Uses string similarity for entity matching
4. **Error Recovery**: ReAct agent attempts multiple strategies on failure

### Related
- See [CRM Bot Architecture Context](#context-crm-bot-architecture)
- See [Testing Strategy Context](#context-testing-strategy)

---

## Context: CLI Tools & API Knowledge
**Tags:** #cli #railway #attio #api #tools #never
**Date:** 2025-01-10  
**Scope:** project

### Summary
CLI tools and API knowledge essential for CRM Bot development and deployment.

### Details

#### Railway CLI
- **Version Note**: Current Railway CLI (as of July 2025) only supports **viewing** variables, not setting them
- **Linking**: `railway link` - Interactive command to connect to a project
- **Status**: `railway status` - Shows linked project info
- **Variables**: `railway variables` - Lists all env vars (read-only)
- **No Set Command**: Cannot set variables via CLI - must use Railway dashboard
- **Project Name**: Current project is "invigorating-imagination"
- **Service Name**: "crm-bot"

#### ⚠️ Railway Logs - IMPORTANT for Claude Code
- **Command**: `railway logs` (no tail flag - it doesn't support --tail)
- **Issue**: This command streams logs continuously and will hang Claude Code
- **Solution**: Tell user to run `railway logs` separately and paste relevant logs
- **Never run**: `railway logs --tail 50` (causes error and hangs)
- **Alternative**: Ask user to copy recent logs from Railway dashboard

#### Attio API
- **Note Creation Format** (Working as of July 2025):
  ```json
  {
    "data": {
      "parent_object": "deals", // or "companies", "people"
      "parent_record_id": "uuid-here",
      "title": "Note from Slack",
      "content": "Note text here", // String, not object!
      "format": "plaintext",
      "created_by_actor": {
        "type": "api-token"
      }
    }
  }
  ```
- **Important**: Content must be a string, not nested object
- **Auth**: Uses Bearer token in Authorization header
- **Base URL**: https://api.attio.com/v2
- **Search**: Supports fuzzy search via query parameter

### Related
- See [Railway Deployment Context](#context-railway-deployment)
- See [Attio URL Format Context](#context-attio-url-format)

---

## Context: Attio URL Format
**Tags:** #attio #urls #critical #format #examples
**Date:** 2025-01-10  
**Scope:** project

### Summary
**IMPORTANT - Updated Jan 2025**: Critical URL format rules for Attio record and note links.

### Details

#### Overview URLs (for viewing records)
- Companies: `https://app.attio.com/textql-data/company/{id}/overview`
- Deals: `https://app.attio.com/textql-data/deals/{id}/overview`
- People: `https://app.attio.com/textql-data/person/{id}/overview`

#### Key Rules
- Use singular form for companies and people (company, person)
- Use PLURAL form for deals (deals, not deal)
- No `/record/` in overview paths
- Must include `/overview` at the end

#### Note URLs (for viewing specific notes)
- Format: `https://app.attio.com/textql-data/{type}/record/{record_id}/notes?modal=note&id={note_id}`
- Example: `https://app.attio.com/textql-data/deals/record/637f050b-409d-4fdf-b401-b85d48a5e9df/notes?modal=note&id=05649629-8d0c-4b6a-a2b6-a0f9d95effa6`
- Note URLs DO include `/record/` in the path

#### Examples
- ✅ Correct company overview: `https://app.attio.com/textql-data/company/a41e73b9-5dac-493f-bb2d-d38bb166c330/overview`
- ✅ Correct deal overview: `https://app.attio.com/textql-data/deals/637f050b-409d-4fdf-b401-b85d48a5e9df/overview`
- ✅ Correct note URL: `https://app.attio.com/textql-data/deals/record/637f050b-409d-4fdf-b401-b85d48a5e9df/notes?modal=note&id={note_id}`
- ❌ Wrong: `https://app.attio.com/textql-data/deal/637f050b-409d-4fdf-b401-b85d48a5e9df/overview` (must be "deals" not "deal")

### Related
- See [CLI Tools & API Knowledge Context](#context-cli-tools--api-knowledge)

---

## Context: Slack Bot Tokens
**Tags:** #slack #tokens #scopes #socket-mode #app-id
**Date:** 2025-01-10  
**Scope:** project

### Summary
Slack bot token configuration and required scopes for CRM Bot operation.

### Details

#### Token Information
- **Current App ID**: A094BJTADMG (CRM Bot)
- **Other Project**: App ID A06RB4Q02EJ (different Slack bot, tokens start with xoxb-6886514773479...)
- **Socket Mode**: Requires app token (xapp-...) with `connections:write` scope

#### Required Scopes
- `app_mentions:read`, `chat:write`
- `channels:history`, `channels:read` (for thread context)
- `groups:history`, `groups:read`
- `im:history`, `im:read`, `im:write`
- `users:read`

### Related
- See [Three Sets of Slack Bot Tokens Context](#context-three-sets-of-slack-bot-tokens)
- See [Environment Variables Strategy Context](#context-environment-variables-strategy)

---

## Context: Environment Variable Management
**Tags:** #env-vars #railway #storage #tokens #source-of-truth
**Date:** 2025-01-10  
**Scope:** project

### Summary
Environment variable management strategy and best practices for CRM Bot configuration.

### Details

#### Management Rules
- **Source of Truth**: Always use `.env` file
- **Railway**: Must update via dashboard, not CLI
- **Token Confusion**: Check App ID in token to identify which project
- **Storage**: Uses file-based system for conversation logging

### Related
- See [Environment Variables Strategy Context](#context-environment-variables-strategy)
- See [Railway Deployment Context](#context-railway-deployment)
- See [Slack Bot Tokens Context](#context-slack-bot-tokens)

---