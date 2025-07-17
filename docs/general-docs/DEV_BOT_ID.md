# Development Bot Configuration

## Bot Identity
- **Bot User ID**: U0953GV1A8L
- **Bot Name**: @crm-bot-ethan-dev
- **App ID**: A0950KN8DPX

## Usage
- **Local Development**: `npm run dev` (uses `.env.dev` file)
- **Testing**: Tag this bot in Slack or via MCP for development testing
- **Agent**: Claude Sonnet 4 with native tool calling (upgraded from ReAct framework)

## Token Storage
- **Development tokens**: Stored in `.env.dev` file (git-ignored)
- **Production tokens**: Stored in Railway dashboard environment variables
- **MCP server tokens**: Stored in Claude Code MCP configuration

## Three Bot Summary
1. **Production Bot**: @crm-bot-ethan (U0944Q3F58B) - Railway deployment
2. **Development Bot**: @crm-bot-ethan-dev (U0953GV1A8L) - Local testing  
3. **MCP Test Bot**: slack-mcp-textql-ethan (U0951TSB4P2) - For MCP server testing

## Finding MCP Server Tokens
The MCP server tokens are stored in Claude Code's MCP configuration, not in project files:

```bash
# View current MCP server config (includes tokens)
claude mcp get slack

# List all configured MCP servers  
claude mcp list

# If MCP server needs recreation, ask user for tokens again
```

**Key Files for Token Reference**:
- Production tokens: `.env` (git-ignored)
- Development tokens: `.env.dev` (git-ignored)
- MCP server context: `/docs/slack-mcp-crm-bot-context.md`
- MCP server tokens: Claude Code MCP config (use commands above)

## Security Note
All token files are git-ignored for security. 

**If you're on Ethan Ding's computer**: The `.env.dev` file already exists locally with the correct tokens.

**If you're on a different machine**: You'll need to recreate `.env.dev` using tokens from https://api.slack.com/apps/A0950KN8DPX