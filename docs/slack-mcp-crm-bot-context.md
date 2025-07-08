# Slack MCP Server Context for CRM Bot

## Overview
This document contains the complete context for the Slack MCP (Model Context Protocol) server integration specifically configured for the CRM bot in the TextQL workspace. This MCP server instance is **project-specific** and configured exclusively for CRM bot testing and integration.

## Current MCP Server Configuration

### Server Details
- **MCP Server Name**: `slack` (in Claude Code configuration)
- **Bot Name**: `slack-mcp-textql-ethan`
- **Bot User ID**: `U0951TSB4P2`
- **Workspace**: TextQL (Team ID: `T04H9AS6RE1`)
- **Purpose**: Testing and integration with CRM bot functionality

### ⚠️ CRITICAL: Credential Separation
**There are TWO separate sets of Slack credentials in play:**

1. **CRM Bot Credentials** (in the crm-bot codebase)
   - These are the actual credentials for the crm-bot-ethan bot (`U0944Q3F58B`)
   - Used by the CRM bot application itself
   - Stored in the crm-bot project configuration

2. **MCP Server Credentials** (in Claude Code MCP config)
   - These are for the slack-mcp-textql-ethan bot (`U0951TSB4P2`)
   - Used ONLY by the MCP server to test/interact with the CRM bot
   - Stored in Claude Code's MCP configuration
   - **DO NOT CONFUSE WITH CRM BOT CREDENTIALS**

### End Goal
The purpose of this MCP server setup is to enable developers working on the CRM bot to:
- Test the CRM bot directly from the terminal using MCP commands
- Send test messages to channels where the CRM bot is present
- Verify CRM bot responses and behavior
- Debug integration issues
- All without needing to switch to the Slack UI or worry about authentication

### Important Note on Scope
This Slack MCP server is specifically configured for:
- The TextQL workspace only
- CRM bot testing channels
- Integration with the crm-bot-ethan bot

**If you need a generic Slack MCP server for other workspaces or purposes, you should create a new MCP server configuration rather than modifying this one.**

## Key Channels

### Primary Testing Channel
- **Name**: `#crm-bot-test`
- **Channel ID**: `C0946T1T4CB`
- **Purpose**: Main channel for testing CRM bot functionality
- **Bot Access**: ✅ slack-mcp-textql-ethan has access

### Secondary Channels
- **Name**: `#go-to-market`
- **Channel ID**: `C04PANKUJAG`
- **Bot Access**: ✅ slack-mcp-textql-ethan has access

## User and Bot IDs

### Human Users
- **Ethan Ding** (ethan): `U04HC95ENRY`
- **Mark Hay** (mark): `U04H9AVH8H3`

### Bot Users
- **crm-bot-ethan**: `U0944Q3F58B` (The actual CRM bot being tested)
- **slack-mcp-textql-ethan**: `U0951TSB4P2` (The MCP server bot)
- **Claude**: `U05LH7SL0HZ` (Anthropic's Claude bot)

### App IDs (Not Directly Taggable)
- **crm-bot-ethan App ID**: `A094BJTADMG`
- **Note**: App IDs cannot be used for @ mentions, only User IDs work

## How Slack Tagging Works

### The Challenge
Unlike the Slack UI where you can type `@username`, the Slack API requires exact user IDs in a specific format.

### Correct Format
```
<@USER_ID>
```

### Examples
- ✅ **Correct**: `<@U04HC95ENRY>` - Creates a proper clickable mention
- ❌ **Wrong**: `@ethan` - Just plain text, no mention
- ❌ **Wrong**: `<@ethan>` - Just plain text, no mention
- ❌ **Wrong**: `<@A094BJTADMG>` - App IDs don't work for mentions

### Finding User IDs
1. **From existing messages**: Use `mcp__slack__slack_get_channel_history` to see user IDs in past messages
2. **From user list**: Use `mcp__slack__slack_get_users` (though some bots may not appear)
3. **From mentions**: Have someone manually tag the user/bot in Slack, then check the message format

## Common Issues and Solutions

### 1. Bot Not in Channel
**Error**: `not_in_channel`
**Solution**: The bot must be manually invited to the channel by a workspace member. The bot cannot add itself to channels.

### 2. Missing Permissions
**Error**: `missing_scope`
**Current Scopes**: 
- `channels:history` - Read message history
- `channels:read` - List and view channels
- `chat:write` - Post messages
- `reactions:write` - Add reactions
- `users:read` - List users

**Solution**: If additional scopes are needed, the Slack app must be reinstalled with new permissions.

### 3. "Private User Info" on Mention
**Issue**: When hovering over a mention, it shows "private user info"
**Cause**: The user ID doesn't exist or isn't accessible
**Solution**: Verify the correct user ID from channel history or user list

### 4. Bot User Not Found
**Issue**: Some bot users don't appear in `slack_get_users` results
**Example**: Initially couldn't find crm-bot-ethan in user list
**Solution**: Check channel history for messages mentioning the bot to find its user ID

## Testing Workflow

### 1. Basic Message Test
```javascript
mcp__slack__slack_post_message({
  channel_id: "C0946T1T4CB",
  text: "Hello from MCP server!"
})
```

### 2. Mention Test
```javascript
mcp__slack__slack_post_message({
  channel_id: "C0946T1T4CB", 
  text: "Testing mentions: <@U04HC95ENRY> and <@U0944Q3F58B>"
})
```

### 3. Thread Reply Test
```javascript
mcp__slack__slack_reply_to_thread({
  channel_id: "C0946T1T4CB",
  thread_ts: "1234567890.123456",
  text: "This is a thread reply"
})
```

### 4. Testing CRM Bot Responses
```javascript
// Send a message that should trigger the CRM bot
mcp__slack__slack_post_message({
  channel_id: "C0946T1T4CB",
  text: "<@U0944Q3F58B> can you find all deals related to the rain group?"
})

// Then check channel history to see if CRM bot responded
mcp__slack__slack_get_channel_history({
  channel_id: "C0946T1T4CB",
  limit: 5
})
```

### 5. Practical CRM Bot Testing Example
When developing the CRM bot, you can test it entirely from the terminal:

```bash
# 1. Start your CRM bot locally
npm run dev  # or however you start the CRM bot

# 2. In Claude Code, send test message to trigger the bot
# (Claude will use MCP to send this)
"Send message to crm-bot-test channel: '@crm-bot-ethan find customer data for Acme Corp'"

# 3. Check if bot responded correctly
"Get the last 5 messages from crm-bot-test channel"

# 4. Debug based on response
```

This workflow allows you to develop and test without constantly switching to the Slack UI.

## Discovery Process (Historical Context)

This section documents how we discovered the correct configuration:

1. **Initial Challenge**: Wanted to send a message tagging @crm-bot-ethan
2. **First Attempt**: Tried `#random` channel - got `not_in_channel` error
3. **Channel Switch**: User added bot to `#go-to-market` channel
4. **Tagging Issue**: Messages sent literal text like `<@crm-bot-ethan>` instead of creating mentions
5. **API Discovery**: Learned Slack API requires user IDs, not usernames
6. **Permission Issue**: Got `missing_scope` error trying to list users
7. **Token Update**: User reinstalled app with `users:read` permission
8. **User ID Hunt**: Searched through user list but couldn't find crm-bot-ethan
9. **Wrong ID**: Tried `U094DP93EUU` (from a URL) but got "private user info"
10. **Solution**: Found correct ID `U0944Q3F58B` in channel history from previous mentions

## Configuration Location

The Slack MCP server configuration is stored in Claude Code's MCP configuration, not in a single config file. It can be managed via:

```bash
# List all MCP servers
claude mcp list

# Get details about the Slack server
claude mcp get slack

# Remove if needed
claude mcp remove slack -s local

# Add new configuration
claude mcp add-json slack '{...config...}'
```

## Relationship to Main Project Context

Additional context about this MCP server is stored in:
- `/Users/ethanding/projects/CLAUDE.md` - Contains brief Slack MCP server info in the main project context
- This file provides the detailed, CRM-bot-specific context

## Future Considerations

If you need to:
- **Test in other workspaces**: Create a new MCP server configuration
- **Add more bots**: Document their user IDs here
- **Change permissions**: Will need to reinstall the Slack app and update the MCP configuration
- **Generic Slack MCP**: Create a separate MCP server instance with its own configuration