# Next Steps - Complete Your CRM Bot Setup

## ✅ What You Have So Far

1. **Slack App Created**: crm-bot-ethan (App ID: A094BJTADMG)
2. **Signing Secret**: Already in your `.env` file
3. **Project Structure**: Complete and ready

## 🔴 What You Still Need

### 1. Get Bot Token (5 minutes)

1. **Go to**: https://api.slack.com/apps/A094BJTADMG/oauth
2. **Scroll to** "OAuth & Permissions"
3. **Add these Bot Token Scopes**:
   - `app_mentions:read`
   - `chat:write`
   - `files:read`
   - `im:history`
   - `im:read`
   - `users:read`
4. **Click** "Install to Workspace" (green button at top)
5. **Authorize** the app
6. **Copy** the Bot User OAuth Token (starts with `xoxb-`)
7. **Replace** in `.env` file:
   ```
   SLACK_BOT_TOKEN=xoxb-paste-your-token-here
   ```

### 2. Enable Socket Mode & Get App Token (2 minutes)

1. **Go to**: https://api.slack.com/apps/A094BJTADMG/socket-mode
2. **Toggle** "Enable Socket Mode" to ON
3. **Name it**: `websocket`
4. **Click** "Generate"
5. **Copy** the token (starts with `xapp-`)
6. **Replace** in `.env` file:
   ```
   SLACK_APP_TOKEN=xapp-paste-your-token-here
   ```

### 3. Enable Event Subscriptions (2 minutes)

1. **Go to**: https://api.slack.com/apps/A094BJTADMG/event-subscriptions
2. **Toggle** "Enable Events" to ON
3. **Under** "Subscribe to bot events", click "Add Bot User Event"
4. **Add these events**:
   - `app_mention`
   - `message.im`
5. **Click** "Save Changes"

### 4. Get Anthropic API Key (2 minutes)

1. **Go to**: https://console.anthropic.com/settings/keys
2. **Click** "Create Key"
3. **Name**: `CRM Bot`
4. **Copy** the key (starts with `sk-ant-`)
5. **Replace** in `.env` file:
   ```
   ANTHROPIC_API_KEY=sk-ant-paste-your-key-here
   ```

### 5. Get Attio API Key (2 minutes)

1. **Go to**: https://app.attio.com
2. **Click** workspace name → Settings → API
3. **Click** "Create new key"
4. **Name**: `CRM Bot`
5. **Permissions**: Read and write all objects
6. **Copy** the key
7. **Replace** in `.env` file:
   ```
   ATTIO_API_KEY=paste-your-attio-key-here
   ```

### 6. File-based Storage Setup (1 minute)

**Set up local file storage:**

1. **Create** data directory:
   ```bash
   mkdir -p /Users/ethanding/projects/crm-bot/data
   ```
2. **Add** to `.env` file:
   ```
   DATA_STORAGE_PATH=/Users/ethanding/projects/crm-bot/data
   ```

## 🚀 Test Your Bot Locally

Once all `.env` values are filled:

```bash
cd /Users/ethanding/projects/crm-bot
npm install
npm start
```

You should see: "⚡️ CRM Bot is running!"

### Test in Slack:
1. **Invite bot** to #gtm channel: `/invite @crm-bot-ethan`
2. **Mention bot**: `@crm-bot-ethan hello!`
3. Bot should respond!

## 🌐 Deploy to Cloudflare (Optional - for 24/7)

Once local testing works, follow `CLOUDFLARE_SETUP.md` to deploy.

## ❓ Troubleshooting

**Bot not responding?**
- Check all scopes are added in OAuth & Permissions
- Verify Socket Mode is enabled
- Make sure bot is invited to channel
- Check terminal for error messages

**Still stuck?**
- All your app URLs start with: https://api.slack.com/apps/A094BJTADMG/
- Check `.env` has no typos or extra spaces
- Data storage path must have write permissions