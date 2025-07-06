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