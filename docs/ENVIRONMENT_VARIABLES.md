# Environment Variables Organization

## Overview
This document clarifies which environment variables are used where, which are shared across projects, and which are specific to the CRM bot.

## Variable Categories

### 1. 🌍 Shared Across All Projects
**Location**: `/Users/ethanding/projects/CLAUDE.md` and MCP configurations

#### MongoDB MCP Server
- **Variable**: `MDB_MCP_CONNECTION_STRING`
- **Scope**: All projects using MongoDB via MCP
- **Used by**: Claude Code MCP server, all projects
- **Example**: `mongodb+srv://ethan:password@ethan-test.mongodb.net/`
- **Note**: This is the SAME connection used by all projects

#### Railway CLI
- **Variable**: `RAILWAY_TOKEN` (if using Railway CLI globally)
- **Scope**: All Railway projects
- **Location**: User's shell profile (~/.zshrc or ~/.bashrc)
- **Note**: Allows `railway` CLI commands across all projects

### 2. 🤖 CRM Bot Specific - Production
**Location**: Railway Dashboard Environment Variables

#### Core Bot Credentials
- **SLACK_BOT_TOKEN**: `xoxb-...` (CRM bot's specific Slack token)
- **SLACK_SIGNING_SECRET**: CRM bot's Slack signing secret
- **SLACK_APP_TOKEN**: `xapp-...` (for Socket Mode)
- **ATTIO_API_KEY**: TextQL's Attio workspace key
- **ANTHROPIC_API_KEY**: `sk-ant-...` (could be shared, but kept separate for usage tracking)

#### Database
- **MONGODB_URI**: Same as `MDB_MCP_CONNECTION_STRING` but specifically for production
  - Can point to a different database name: `.../crm-bot-prod`

#### Railway Specific
- **Project**: invigorating-imagination
- **Service**: crm-bot
- **Environment**: production

### 3. 🧪 CRM Bot Specific - Development/Testing
**Location**: `/Users/ethanding/projects/crm-bot/.env`

```env
# Development overrides
NODE_ENV=development
PORT=3000

# Same credentials as production (for now)
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...
ATTIO_API_KEY=...
ANTHROPIC_API_KEY=sk-ant-...

# MongoDB - can use same cluster, different database
MONGODB_URI=mongodb+srv://ethan:password@ethan-test.mongodb.net/crm-bot-dev
```

### 4. 🔄 Environment Variable Flow

```
┌─────────────────────────────────────┐
│   Global/Shared Variables           │
│   (/Users/ethanding/projects/)      │
│                                     │
│   • MDB_MCP_CONNECTION_STRING       │
│   • RAILWAY_TOKEN (CLI)             │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│   CRM Bot Project                   │
│   (/crm-bot/.env)                   │
│                                     │
│   • Inherits MDB connection         │
│   • Project-specific Slack tokens   │
│   • Project-specific API keys       │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│   Railway Production                │
│   (Railway Dashboard)               │
│                                     │
│   • Mirrors .env for production     │
│   • May have different DB name      │
│   • NODE_ENV=production             │
└─────────────────────────────────────┘
```

## Implementation in Code

### Database Connection Priority
```javascript
// In database.js and test files:
const MONGODB_URI = process.env.MONGODB_URI || process.env.MDB_MCP_CONNECTION_STRING;
```
This allows:
1. Project-specific URI to override
2. Falls back to shared MCP connection
3. Can use different database names

### Removed/Deprecated Variables
- `SLACK_BOT_ID` - No longer needed (bot detection handled automatically)
- Cloudflare environment variables - Project uses Railway exclusively

### Fallback Variables
- `MDB_MCP_CONNECTION_STRING` - Shared MongoDB connection from MCP server
  - Used as fallback when `MONGODB_URI` is not set
  - Configured at the MCP server level, not in project

## Best Practices

### 1. Shared Variables
- Store in `/Users/ethanding/projects/CLAUDE.md` for documentation
- Configure once in MCP servers or shell profile
- Use for: MongoDB connections, global tools

### 2. Project Variables
- Store in `.env` for development
- Mirror in Railway dashboard for production
- Use for: API keys, tokens, project-specific configs

### 3. Never Share These
- Slack tokens (workspace-specific)
- Attio API keys (workspace-specific)
- Any credentials with limited scope

### 4. Testing vs Production
- Use different database names: `crm-bot-dev` vs `crm-bot-prod`
- Keep same cluster for simplicity
- Use `NODE_ENV` to switch behavior

## Setup Instructions

### For New Developer
1. Copy `.env.example` to `.env`
2. Fill in CRM bot specific values
3. Ensure MCP MongoDB server is configured with shared connection
4. Run `railway link` and select "invigorating-imagination" project

### For Production Deployment
1. All variables in `.env` should be mirrored in Railway dashboard
2. Set `NODE_ENV=production`
3. Use production database name in `MONGODB_URI`

### For Testing
1. Can use same `.env` file
2. Tests will use `MDB_MCP_CONNECTION_STRING` as fallback
3. Test data goes to same database (consider separate test DB)

## Variable Reference

| Variable | Shared? | Required? | Location | Notes |
|----------|---------|-----------|----------|-------|
| MDB_MCP_CONNECTION_STRING | ✅ Yes | For MCP | Global MCP config | All projects use this |
| MONGODB_URI | ❌ No | Yes | .env, Railway | Can override MCP connection |
| SLACK_BOT_TOKEN | ❌ No | Yes | .env, Railway | CRM bot specific |
| SLACK_SIGNING_SECRET | ❌ No | Yes | .env, Railway | CRM bot specific |
| SLACK_APP_TOKEN | ❌ No | Yes | .env, Railway | CRM bot specific |
| ATTIO_API_KEY | ❌ No | Yes | .env, Railway | TextQL workspace |
| ANTHROPIC_API_KEY | ⚠️ Maybe | Yes | .env, Railway | Could be shared |
| NODE_ENV | ❌ No | No | .env, Railway | Default: development |
| PORT | ❌ No | No | .env | Default: 3000 |
| RAILWAY_TOKEN | ✅ Yes | For CLI | Shell profile | For railway CLI |