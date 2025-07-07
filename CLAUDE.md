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
```
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...
ANTHROPIC_API_KEY=sk-ant-...
ATTIO_API_KEY=...
MONGODB_URI=mongodb+srv://...
```

## Deployment
1. Local development: `npm run dev`
2. Deploy to Cloudflare: `npm run deploy`
3. MongoDB Atlas for database
4. Slack app configuration

## Testing
- Unit tests for each service
- Integration tests for Slack events
- Mock Attio API responses

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

## Development Notes

- The bot is currently production-only (no dev instance)
- All pushes to main auto-deploy to Railway
- Use feature branches for safer development
- Railway logs show deployment status and errors
- Bot includes deployment info in responses ("🚂 Railway" indicator)

## Testing Checklist

When testing changes:
1. Test API calls locally first (`node src/test-*.js`)
2. Check Railway build logs after pushing
3. Verify bot responds in Slack
4. Test both new messages and thread replies
5. Ensure preview mode works for write operations

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
- **Correct URL structure**:
  - Companies: `https://app.attio.com/textql-data/company/{id}/overview`
  - Deals: `https://app.attio.com/textql-data/deal/{id}/overview`
  - People: `https://app.attio.com/textql-data/person/{id}/overview`
- **Key differences from API paths**:
  - Use singular form (company, not companies)
  - No `/record/` in the path
  - Must include `/overview` at the end
  - Without `/overview`, links just go to the index page
- **Example**: 
  - ✅ Correct: `https://app.attio.com/textql-data/company/a41e73b9-5dac-493f-bb2d-d38bb166c330/overview`
  - ❌ Wrong: `https://app.attio.com/textql-data/companies/record/a41e73b9-5dac-493f-bb2d-d38bb166c330`

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