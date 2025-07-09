# CRM Bot - Claude Instructions

## Project Overview
A Slack bot that monitors the #gtm channel for updates and automatically creates/updates records in Attio CRM. The bot uses AI to intelligently match messages to the correct deals or companies.

## IMPORTANT: Token Confusion Prevention
If you encounter Slack authentication errors or find conflicting tokens, note that there may be another Slack bot project with different tokens:
- **This project (crm-bot)**: Uses tokens in `.env` file (App ID: A094BJTADMG)
- **Other project**: May have tokens starting with:
  - Bot Token: xoxb-6886514773479-6904671780611-...
  - App Token: xapp-1-A06RB4Q02EJ-6902164037669-...
  - These were found in SESSION_SECRETS.md and are likely from a different Slack bot project
- **Always use the .env file as the source of truth for this project**

## Architecture
- **Framework**: Bolt.js for Slack integration
- **AI**: Anthropic Claude API for intelligent message processing
- **CRM**: Attio API for data management
- **Database**: MongoDB for caching and state
- **Hosting**: Cloudflare Workers (always-on)
- **Language**: JavaScript (ES Modules)

## Key Components

### 1. Slack Handler (`src/handlers/slackHandler.js`)
- Listens for @mentions in #gtm channel
- Extracts message context
- Passes to AI processor

### 2. AI Processor (`src/services/aiProcessor.js`)
- Uses Claude to analyze message
- Extracts company/deal references
- Determines action type (create note, update status, etc.)

### 3. Attio Service (`src/services/attioService.js`)
- Fetches deals and companies
- Matches entities from messages
- Creates/updates records
- Handles attachments (screenshots, files)

### 4. Database Service (`src/services/database.js`)
- Caches Attio data for performance
- Stores bot state and history
- Manages rate limiting

### 5. Cloudflare Worker (`src/workers/cloudflare.js`)
- Handles HTTP requests
- Manages Slack events
- Always-on hosting

## Environment Variables

### 📋 CRM Bot Environment Variable Guidelines

When working with this project's environment variables:

1. **Check Shared Variables First**
   - See `/Users/ethanding/projects/CLAUDE.md` for shared variables
   - This project uses `MDB_MCP_CONNECTION_STRING` as fallback for MongoDB

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
   const MONGODB_URI = process.env.MONGODB_URI || process.env.MDB_MCP_CONNECTION_STRING;
   ```
   - Allows project-specific override
   - Falls back to shared MCP connection
   - Can use different database names for dev/test/prod

5. **Adding New Variables**
   - Add to `.env.example` with clear comments
   - Document in `/docs/ENVIRONMENT_VARIABLES.md`
   - Add to Railway dashboard for production
   - Update this section if it's a critical variable

6. **Railway Deployment Context**
   - Project: invigorating-imagination
   - Service: crm-bot  
   - All `.env` variables must be mirrored in Railway dashboard
   - Railway auto-deploys from main branch

7. **Testing Considerations**
   - Tests use same MongoDB cluster (via MCP)
   - Consider using separate database name for tests
   - Mock external APIs when possible

## Deployment
1. Local development: `npm run dev`
2. Production: Auto-deploys via Railway from main branch
3. MongoDB Atlas for database (shared cluster)
4. Slack app configuration in TextQL workspace

## Testing

### Local Development Testing (NEW!)
**Quick Start**: Test locally with `@crm-bot-ethan-dev` before deploying!

1. **Setup** (one-time):
   - Create dev Slack app: https://api.slack.com/apps
   - Enable Socket Mode + add bot scopes
   - Copy tokens to `.env.dev`
   - Full guide: `/docs/LOCAL_DEVELOPMENT.md`

2. **Run**: `npm run dev`
3. **Test**: `@crm-bot-ethan-dev search for raine`
4. **Benefits**: Instant testing, hot reload, separate DB

### Other Testing Methods
- **Local CLI**: `npm run local` (no Slack, direct agent testing)
- **Unit tests**: For individual services
- **Integration tests**: For Slack events
- **Test suite**: `npm run test:suite` (automated test scenarios)
- **Production**: Push to main branch for Railway auto-deploy

## Error Handling
- Retry failed API calls
- Log errors to MongoDB
- Notify channel on critical failures

## Security
- Environment variables for secrets
- Validate Slack signatures
- Rate limit API calls
- Sanitize user inputs

## MCP Server Integration

A Slack MCP (Model Context Protocol) server is configured on the Ethan Ding account, enabling you to:
- Send messages directly to Slack channels
- Test the bot without manual Slack interaction
- Read channel messages and threads
- Simulate user interactions programmatically

### Testing with MCP

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

## Production Bot Details

- **Bot Name**: @crm-bot-ethan
- **App ID**: A094BJTADMG
- **Workspace**: TextQL
- **Deployment**: Railway (auto-deploys from main branch)
- **Repository**: https://github.com/TextQLLabs/crm-bot

## Development Workflow

1. **Local Testing** (NEW!): `npm run dev` → test with `@crm-bot-ethan-dev`
2. **Production**: Push to main → Railway auto-deploys → `@crm-bot-ethan`
3. **Logs**: `railway logs` for production, console for local dev

### Local Dev Setup (Quick Reference)
- **App Name**: `crm-bot-dev-ethan` 
- **Bot Name**: `@crm-bot-ethan-dev`
- **Config**: `.env.dev` (copy from `.env.example`)
- **Tokens Needed**: Bot token, Signing secret, App token (Socket Mode)
- **Full Guide**: `/docs/LOCAL_DEVELOPMENT.md`

## Testing Checklist

When testing changes:
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

## Prompt Testing Guidelines

**NEVER deploy prompt changes without local testing!**

Before changing the system prompt in ReactAgent:
1. Create a test case that verifies current behavior
2. Make your prompt changes
3. Run the same test to ensure nothing broke
4. Test edge cases that rely on the prompt instructions
5. Only deploy after all tests pass

Common prompt-related features to test:
- Multiple search variations (e.g., "The Raine Group" → "Raine Group" → "Raine")
- Fuzzy search behavior
- Note deletion safety (never showing UUIDs)
- Web search fallback
- Error recovery strategies

## MongoDB Documentation

**IMPORTANT**: See `/Users/ethanding/projects/MONGODB.md` for comprehensive documentation about all MongoDB collections used across TextQLLabs projects, including:
- Collection schemas
- Sample queries
- Index strategies
- Retention policies

The CRM Bot stores test results in MongoDB:
- **Database**: `crm-bot`
- **Collection**: `test-runs` (all test suite execution results with metrics)

## Automated Testing Suite

### Running the Test Suite
```bash
npm run test:suite        # Run all tests
npm run test:logs        # View local test logs
npm run test:history     # View MongoDB test history
```

### Test Categories
1. **Fuzzy Search** - Tests spelling variations (rain→raine, rayne→raine)
2. **Search Operations** - Tests all entity types (companies, people, deals)
3. **Note Creation** - Tests adding notes with preview mode
4. **Entity Details** - Tests information retrieval
5. **Error Handling** - Tests ambiguous/invalid requests

### Metrics Tracked
- **Success Rate**: Percentage of tests passing
- **Tool Calls**: Average number of tools used per test
- **Response Time**: Average time to complete each test
- **Tool Usage**: Which tools were actually called

### GUI Features
- Real-time test progress with status icons (✓ ✗ ◉)
- Color-coded results (green=pass, red=fail, yellow=running)
- Tool icons showing which tools were used (🔍 🌐 📝 ➕ ✏️)
- Summary statistics and progress bar
- Failed test details with error messages

### Adding New Tests
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

## Known Complexities

1. **Thread Context**: Bot maintains conversation history including hidden function calls
2. **Preview Mode**: All write operations show preview before executing
3. **Fuzzy Matching**: Uses string similarity for entity matching
4. **Error Recovery**: ReAct agent attempts multiple strategies on failure

## CLI Tools & API Knowledge

### Railway CLI
- **Version Note**: Current Railway CLI (as of July 2025) only supports **viewing** variables, not setting them
- **Linking**: `railway link` - Interactive command to connect to a project
- **Status**: `railway status` - Shows linked project info
- **Variables**: `railway variables` - Lists all env vars (read-only)
- **No Set Command**: Cannot set variables via CLI - must use Railway dashboard
- **Project Name**: Current project is "invigorating-imagination"
- **Service Name**: "crm-bot"

### Attio API
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

### Attio URL Format (IMPORTANT - Updated Jan 2025)
- **Overview URLs** (for viewing records):
  - Companies: `https://app.attio.com/textql-data/company/{id}/overview`
  - Deals: `https://app.attio.com/textql-data/deals/{id}/overview`
  - People: `https://app.attio.com/textql-data/person/{id}/overview`
  - Key rules:
    - Use singular form for companies and people (company, person)
    - Use PLURAL form for deals (deals, not deal)
    - No `/record/` in overview paths
    - Must include `/overview` at the end
- **Note URLs** (for viewing specific notes):
  - Format: `https://app.attio.com/textql-data/{type}/record/{record_id}/notes?modal=note&id={note_id}`
  - Example: `https://app.attio.com/textql-data/deals/record/637f050b-409d-4fdf-b401-b85d48a5e9df/notes?modal=note&id=05649629-8d0c-4b6a-a2b6-a0f9d95effa6`
  - Note URLs DO include `/record/` in the path
- **Examples**: 
  - ✅ Correct company overview: `https://app.attio.com/textql-data/company/a41e73b9-5dac-493f-bb2d-d38bb166c330/overview`
  - ✅ Correct deal overview: `https://app.attio.com/textql-data/deals/637f050b-409d-4fdf-b401-b85d48a5e9df/overview`
  - ✅ Correct note URL: `https://app.attio.com/textql-data/deals/record/637f050b-409d-4fdf-b401-b85d48a5e9df/notes?modal=note&id={note_id}`
  - ❌ Wrong: `https://app.attio.com/textql-data/deal/637f050b-409d-4fdf-b401-b85d48a5e9df/overview` (must be "deals" not "deal")

### Slack Bot Tokens
- **Current App ID**: A094BJTADMG (CRM Bot)
- **Other Project**: App ID A06RB4Q02EJ (different Slack bot, tokens start with xoxb-6886514773479...)
- **Socket Mode**: Requires app token (xapp-...) with `connections:write` scope
- **Required Scopes**: 
  - `app_mentions:read`, `chat:write`
  - `channels:history`, `channels:read` (for thread context)
  - `groups:history`, `groups:read`
  - `im:history`, `im:read`, `im:write`
  - `users:read`

### Environment Variable Management
- **Source of Truth**: Always use `.env` file
- **Railway**: Must update via dashboard, not CLI
- **Token Confusion**: Check App ID in token to identify which project
- **MongoDB**: Falls back to in-memory if connection fails