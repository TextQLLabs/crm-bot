## Context: Environment Variables Organization
**Tags:** #env-vars #environment #variables #shared #production #development #file-storage #railway #slack #attio #security #scope #crm-bot #mcp
**Date:** 2025-01-10
**Scope:** project

### Summary
Comprehensive guide to environment variable organization for the CRM bot project, distinguishing between shared variables across all projects and project-specific variables for development, testing, and production environments. Updated to use file-based storage instead of database connections.

### Details

#### Variable Categories

##### 1. 🌍 Shared Across All Projects
**Location**: `/Users/ethanding/projects/CLAUDE.md` and MCP configurations

**File Storage MCP Server**
- **Variable**: `DATA_STORAGE_PATH`
- **Scope**: All projects using file-based storage
- **Used by**: Claude Code MCP server, all projects
- **Example**: `/Users/ethanding/projects/shared-data/`
- **Note**: This is the SAME storage path used by all projects

**Railway CLI**
- **Variable**: `RAILWAY_TOKEN` (if using Railway CLI globally)
- **Scope**: All Railway projects
- **Location**: User's shell profile (~/.zshrc or ~/.bashrc)
- **Note**: Allows `railway` CLI commands across all projects

##### 2. 🤖 CRM Bot Specific - Production
**Location**: Railway Dashboard Environment Variables

**Core Bot Credentials**
- **SLACK_BOT_TOKEN**: `xoxb-...` (CRM bot's specific Slack token)
- **SLACK_SIGNING_SECRET**: CRM bot's Slack signing secret
- **SLACK_APP_TOKEN**: `xapp-...` (for Socket Mode)
- **ATTIO_API_KEY**: TextQL's Attio workspace key
- **ANTHROPIC_API_KEY**: `sk-ant-...` (could be shared, but kept separate for usage tracking)

**File Storage**
- **DATA_STORAGE_PATH**: Same as shared storage path but specifically for production
  - Can point to a different directory: `.../crm-bot-prod/data`

**Railway Specific**
- **Project**: invigorating-imagination
- **Service**: crm-bot
- **Environment**: production

##### 3. 🧪 CRM Bot Specific - Development/Testing
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

# File Storage - can use same base path, different directory
DATA_STORAGE_PATH=/Users/ethanding/projects/crm-bot/data-dev
```

##### 4. 🔄 Environment Variable Flow

```
┌─────────────────────────────────────┐
│   Global/Shared Variables           │
│   (/Users/ethanding/projects/)      │
│                                     │
│   • DATA_STORAGE_PATH               │
│   • RAILWAY_TOKEN (CLI)             │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│   CRM Bot Project                   │
│   (/crm-bot/.env)                   │
│                                     │
│   • Inherits storage path           │
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
│   • May have different data dir     │
│   • NODE_ENV=production             │
└─────────────────────────────────────┘
```

#### Implementation in Code

**File Storage Path Priority**
```javascript
// In storage.js and test files:
const DATA_STORAGE_PATH = process.env.DATA_STORAGE_PATH || process.env.SHARED_DATA_PATH;
```
This allows:
1. Project-specific storage path to override
2. Falls back to shared MCP storage path
3. Can use different data directories

**Removed/Deprecated Variables**
- `SLACK_BOT_ID` - No longer needed (bot detection handled automatically)
- Cloudflare environment variables - Project uses Railway exclusively

**Fallback Variables**
- `SHARED_DATA_PATH` - Shared file storage path from MCP server
  - Used as fallback when `DATA_STORAGE_PATH` is not set
  - Configured at the MCP server level, not in project

#### Best Practices

**1. Shared Variables**
- Store in `/Users/ethanding/projects/CLAUDE.md` for documentation
- Configure once in MCP servers or shell profile
- Use for: File storage paths, global tools

**2. Project Variables**
- Store in `.env` for development
- Mirror in Railway dashboard for production
- Use for: API keys, tokens, project-specific configs

**3. Never Share These**
- Slack tokens (workspace-specific)
- Attio API keys (workspace-specific)
- Any credentials with limited scope

**4. Testing vs Production**
- Use different data directories: `crm-bot-dev` vs `crm-bot-prod`
- Keep same base storage path for simplicity
- Use `NODE_ENV` to switch behavior

#### Setup Instructions

**For New Developer**
1. Copy `.env.example` to `.env`
2. Fill in CRM bot specific values
3. Ensure MCP file storage is configured with shared data path
4. Run `railway link` and select "invigorating-imagination" project

**For Production Deployment**
1. All variables in `.env` should be mirrored in Railway dashboard
2. Set `NODE_ENV=production`
3. Use production data directory in `DATA_STORAGE_PATH`

**For Testing**
1. Can use same `.env` file
2. Tests will use `SHARED_DATA_PATH` as fallback
3. Test data goes to same directory (consider separate test directory)

#### Variable Reference

| Variable | Shared? | Required? | Location | Notes |
|----------|---------|-----------|----------|-------|
| SHARED_DATA_PATH | ✅ Yes | For MCP | Global MCP config | All projects use this |
| DATA_STORAGE_PATH | ❌ No | Yes | .env, Railway | Can override MCP storage path |
| SLACK_BOT_TOKEN | ❌ No | Yes | .env, Railway | CRM bot specific |
| SLACK_SIGNING_SECRET | ❌ No | Yes | .env, Railway | CRM bot specific |
| SLACK_APP_TOKEN | ❌ No | Yes | .env, Railway | CRM bot specific |
| ATTIO_API_KEY | ❌ No | Yes | .env, Railway | TextQL workspace |
| ANTHROPIC_API_KEY | ⚠️ Maybe | Yes | .env, Railway | Could be shared |
| NODE_ENV | ❌ No | No | .env, Railway | Default: development |
| PORT | ❌ No | No | .env | Default: 3000 |
| RAILWAY_TOKEN | ✅ Yes | For CLI | Shell profile | For railway CLI |

### Related
- `/Users/ethanding/projects/CLAUDE.md` - Global project settings and shared variables
- `/Users/ethanding/projects/crm-bot/.env` - Development environment variables
- Railway Dashboard - Production environment variables
- MCP file storage server configuration