# Slack MCP Server Context for CRM Bot

## Claude Context Framework

### How to Use This Framework
Apply the same context framework as defined in `/Users/ethanding/projects/CLAUDE.md`. Use tags, dates, scopes, and structured format for all contexts.

---

# Current Project Contexts

## Context: Slack MCP Server Overview
**Tags:** #mcp #slack #testing #integration #textql
**Date:** 2025-01-10  
**Scope:** project

### Summary
Complete context for the Slack MCP (Model Context Protocol) server integration specifically configured for the CRM bot in the TextQL workspace. This MCP server instance is project-specific and configured exclusively for CRM bot testing and integration.

### Details

#### Server Configuration
- **MCP Server Name**: `slack` (in Claude Code configuration)
- **Bot Name**: `slack-mcp-textql-ethan`
- **Bot User ID**: `U0951TSB4P2`
- **Workspace**: TextQL (Team ID: `T04H9AS6RE1`)
- **Purpose**: Testing and integration with CRM bot functionality

#### End Goal
Enable developers working on the CRM bot to:
- Test the CRM bot directly from the terminal using MCP commands
- Send test messages to channels where the CRM bot is present
- Verify CRM bot responses and behavior
- Debug integration issues
- All without needing to switch to the Slack UI or worry about authentication

### Related
- See [Credential Separation Context](#context-critical-credential-separation)
- See [MCP Scope Context](#context-mcp-scope-limitations)

---

## Context: Critical Credential Separation
**Tags:** #critical #security #credentials #config #never
**Date:** 2025-01-10  
**Scope:** project

### Summary
**There are TWO separate sets of Slack credentials in play** - critical to never confuse them.

### Details

#### 1. CRM Bot Credentials (in the crm-bot codebase)
- These are the actual credentials for the crm-bot-ethan bot (`U0944Q3F58B`)
- Used by the CRM bot application itself
- Stored in the crm-bot project configuration

#### 2. MCP Server Credentials (in Claude Code MCP config)
- These are for the slack-mcp-textql-ethan bot (`U0951TSB4P2`)
- Used ONLY by the MCP server to test/interact with the CRM bot
- Stored in Claude Code's MCP configuration
- **DO NOT CONFUSE WITH CRM BOT CREDENTIALS**

### Related
- See [Slack Bot Tokens Context](../CLAUDE.md#context-three-sets-of-slack-bot-tokens)

---

## Context: MCP Scope Limitations
**Tags:** #mcp #scope #textql #limitations
**Date:** 2025-01-10  
**Scope:** project

### Summary
This Slack MCP server is specifically configured for limited scope - not a generic solution.

### Details
This Slack MCP server is specifically configured for:
- The TextQL workspace only
- CRM bot testing channels
- Integration with the crm-bot-ethan bot

**Important**: If you need a generic Slack MCP server for other workspaces or purposes, you should create a new MCP server configuration rather than modifying this one.

### Related
- See [Key Channels Context](#context-key-channels-and-access)

---

## Context: Key Channels and Access
**Tags:** #channels #testing #access #crm-bot-test #go-to-market
**Date:** 2025-01-10  
**Scope:** project

### Summary
Primary and secondary channels where the Slack MCP server has access for CRM bot testing.

### Details

#### Primary Testing Channel
- **Name**: `#crm-bot-test`
- **Channel ID**: `C0946T1T4CB`
- **Purpose**: Main channel for testing CRM bot functionality
- **Bot Access**: ✅ slack-mcp-textql-ethan has access

#### Secondary Channels
- **Name**: `#go-to-market`
- **Channel ID**: `C04PANKUJAG`
- **Bot Access**: ✅ slack-mcp-textql-ethan has access

### Related
- See [Testing Workflow Context](#context-testing-workflow-and-examples)

---

## Context: User and Bot IDs Reference
**Tags:** #user-ids #bot-ids #tagging #reference #critical
**Date:** 2025-01-10  
**Scope:** project

### Summary
Complete reference of user IDs and bot IDs needed for proper Slack API interactions and mentions.

### Details

#### Human Users
- **Ethan Ding** (ethan): `U04HC95ENRY`
- **Mark Hay** (mark): `U04H9AVH8H3`

#### Bot Users
- **crm-bot-ethan**: `U0944Q3F58B` (The actual CRM bot being tested)
- **slack-mcp-textql-ethan**: `U0951TSB4P2` (The MCP server bot)
- **Claude**: `U05LH7SL0HZ` (Anthropic's Claude bot)

#### App IDs (Not Directly Taggable)
- **crm-bot-ethan App ID**: `A094BJTADMG`
- **Note**: App IDs cannot be used for @ mentions, only User IDs work

### Related
- See [Slack Tagging Context](#context-slack-tagging-api-requirements)

---

## Context: Slack Tagging API Requirements
**Tags:** #tagging #api #user-ids #mentions #format #critical
**Date:** 2025-01-10  
**Scope:** project

### Summary
Understanding how Slack API tagging works vs UI - critical for proper mentions.

### Details

#### The Challenge
Unlike the Slack UI where you can type `@username`, the Slack API requires exact user IDs in a specific format.

#### Correct Format
```
<@USER_ID>
```

#### Examples
- ✅ **Correct**: `<@U04HC95ENRY>` - Creates a proper clickable mention
- ❌ **Wrong**: `@ethan` - Just plain text, no mention
- ❌ **Wrong**: `<@ethan>` - Just plain text, no mention
- ❌ **Wrong**: `<@A094BJTADMG>` - App IDs don't work for mentions

#### Finding User IDs
1. **From existing messages**: Use `mcp__slack__slack_get_channel_history` to see user IDs in past messages
2. **From user list**: Use `mcp__slack__slack_get_users` (though some bots may not appear)
3. **From mentions**: Have someone manually tag the user/bot in Slack, then check the message format

### Related
- See [User and Bot IDs Reference](#context-user-and-bot-ids-reference)
- See [Troubleshooting Context](#context-troubleshooting-common-issues)

---

## Context: Troubleshooting Common Issues
**Tags:** #troubleshooting #errors #permissions #solutions #debug
**Date:** 2025-01-10  
**Scope:** project

### Summary
Common issues encountered when using the Slack MCP server and their solutions.

### Details

#### 1. Bot Not in Channel
**Error**: `not_in_channel`
**Solution**: The bot must be manually invited to the channel by a workspace member. The bot cannot add itself to channels.

#### 2. Missing Permissions
**Error**: `missing_scope`
**Current Scopes**: 
- `channels:history` - Read message history
- `channels:read` - List and view channels
- `chat:write` - Post messages
- `reactions:write` - Add reactions
- `users:read` - List users

**Solution**: If additional scopes are needed, the Slack app must be reinstalled with new permissions.

#### 3. "Private User Info" on Mention
**Issue**: When hovering over a mention, it shows "private user info"
**Cause**: The user ID doesn't exist or isn't accessible
**Solution**: Verify the correct user ID from channel history or user list

#### 4. Bot User Not Found
**Issue**: Some bot users don't appear in `slack_get_users` results
**Example**: Initially couldn't find crm-bot-ethan in user list
**Solution**: Check channel history for messages mentioning the bot to find its user ID

### Related
- See [Slack Tagging Context](#context-slack-tagging-api-requirements)

---

## Context: Testing Workflow and Examples
**Tags:** #testing #workflow #examples #commands #development
**Date:** 2025-01-10  
**Scope:** project

### Summary
Step-by-step workflows and code examples for testing the CRM bot using the Slack MCP server.

### Details

#### 1. Basic Message Test
```javascript
mcp__slack__slack_post_message({
  channel_id: "C0946T1T4CB",
  text: "Hello from MCP server!"
})
```

#### 2. Mention Test
```javascript
mcp__slack__slack_post_message({
  channel_id: "C0946T1T4CB", 
  text: "Testing mentions: <@U04HC95ENRY> and <@U0944Q3F58B>"
})
```

#### 3. Thread Reply Test
```javascript
mcp__slack__slack_reply_to_thread({
  channel_id: "C0946T1T4CB",
  thread_ts: "1234567890.123456",
  text: "This is a thread reply"
})
```

#### 4. Testing CRM Bot Responses
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

#### 5. Practical CRM Bot Testing Example
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

### Related
- See [Key Channels Context](#context-key-channels-and-access)
- See [User and Bot IDs Reference](#context-user-and-bot-ids-reference)

---

## Context: Discovery Process Documentation
**Tags:** #historical #discovery #debugging #lessons-learned
**Date:** 2025-01-10  
**Scope:** project

### Summary
Historical documentation of how we discovered the correct configuration - valuable for understanding common pitfalls.

### Details

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

### Related
- See [Troubleshooting Context](#context-troubleshooting-common-issues)

---

## Context: Configuration Management
**Tags:** #configuration #mcp #claude-code #management
**Date:** 2025-01-10  
**Scope:** project

### Summary
How to manage the Slack MCP server configuration in Claude Code.

### Details

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

### Related
- See [MCP Scope Context](#context-mcp-scope-limitations)

---

## Context: Project Context Relationship
**Tags:** #documentation #relationship #main-project
**Date:** 2025-01-10  
**Scope:** project

### Summary
How this file relates to the main project context documentation.

### Details

Additional context about this MCP server is stored in:
- `/Users/ethanding/projects/CLAUDE.md` - Contains brief Slack MCP server info in the main project context
- This file provides the detailed, CRM-bot-specific context

### Related
- See [MCP Scope Context](#context-mcp-scope-limitations)

---

## Context: Future Considerations and Expansion
**Tags:** #future #expansion #considerations #scalability
**Date:** 2025-01-10  
**Scope:** project

### Summary
Considerations for future expansion or modification of the Slack MCP server setup.

### Details

If you need to:
- **Test in other workspaces**: Create a new MCP server configuration
- **Add more bots**: Document their user IDs here
- **Change permissions**: Will need to reinstall the Slack app and update the MCP configuration
- **Generic Slack MCP**: Create a separate MCP server instance with its own configuration

### Related
- See [MCP Scope Context](#context-mcp-scope-limitations)
- See [Configuration Management Context](#context-configuration-management)