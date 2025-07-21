# Setup Instructions - Get Your Credentials

Follow these steps to get all the necessary credentials for the CRM Bot.

## 1. Slack Bot Setup

### Step 1: Create Slack App
1. Go to: https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. App Name: `CRM Bot` (or your preferred name)
4. Pick workspace: Select your company workspace
5. Click "Create App"

### Step 2: Get Bot Token
1. In your app settings, click "OAuth & Permissions" in left sidebar
2. Scroll to "Scopes" → "Bot Token Scopes"
3. Add these scopes:
   - `app_mentions:read` - Read mentions of your app
   - `chat:write` - Send messages
   - `files:read` - Read files shared in channels
   - `im:history` - Read direct messages
   - `im:read` - View basic info about direct messages
   - `users:read` - View users in workspace
4. Scroll up and click "Install to Workspace"
5. Authorize the app
6. **COPY THIS**: You'll see a token starting with `xoxb-`
7. **PASTE IT HERE**: Create a file `/Users/ethanding/projects/crm-bot/.env` and add:
   ```
   SLACK_BOT_TOKEN=xoxb-your-token-here
   ```

### Step 3: Get Signing Secret
1. Go to "Basic Information" in left sidebar
2. Scroll to "App Credentials"
3. **COPY**: The "Signing Secret"
4. **PASTE IT** in your `.env` file:
   ```
   SLACK_SIGNING_SECRET=your-signing-secret-here
   ```

### Step 4: Enable Socket Mode & Get App Token
1. Go to "Socket Mode" in left sidebar
2. Toggle "Enable Socket Mode" to ON
3. It will ask for a token name, enter: `websocket`
4. Click "Generate"
5. **COPY THIS**: Token starting with `xapp-`
6. **PASTE IT** in your `.env` file:
   ```
   SLACK_APP_TOKEN=xapp-your-app-token-here
   ```

### Step 5: Enable Events
1. Go to "Event Subscriptions" in left sidebar
2. Toggle "Enable Events" to ON
3. Under "Subscribe to bot events", add:
   - `app_mention`
   - `message.im`
4. Click "Save Changes"

## 2. Anthropic API Key

1. Go to: https://console.anthropic.com/settings/keys
2. Click "Create Key"
3. Name it: `CRM Bot`
4. **COPY** the key (starts with `sk-ant-`)
5. **PASTE IT** in your `.env` file:
   ```
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

## 3. Attio API Key

1. Go to Attio: https://app.attio.com
2. Click your workspace name (top left) → "Settings"
3. Click "API" in left sidebar
4. Click "Create new key"
5. Name: `CRM Bot`
6. Permissions: Select "Read and write" for all objects
7. **COPY** the API key
8. **PASTE IT** in your `.env` file:
   ```
   ATTIO_API_KEY=your-attio-key-here
   ```

## 4. File-based Storage Setup

### Data Storage Location
The bot will store data in local files instead of a database:

1. **Create storage directory**:
   ```bash
   mkdir -p /Users/ethanding/projects/crm-bot/data
   ```

2. **Set storage path** in your `.env` file:
   ```
   DATA_STORAGE_PATH=/Users/ethanding/projects/crm-bot/data
   ```

### Storage Structure
The bot will create the following directories:
- `data/cache/` - Cached CRM data
- `data/logs/` - Bot operation logs
- `data/state/` - Bot state information
- `data/tests/` - Test run results

## 5. Test Your Setup

1. Make sure your `.env` file has all 5 required values:
   ```
   SLACK_BOT_TOKEN=xoxb-...
   SLACK_SIGNING_SECRET=...
   SLACK_APP_TOKEN=xapp-...
   ANTHROPIC_API_KEY=sk-ant-...
   ATTIO_API_KEY=...
   DATA_STORAGE_PATH=/Users/ethanding/projects/crm-bot/data
   ```

2. Install dependencies:
   ```bash
   cd /Users/ethanding/projects/crm-bot
   npm install
   ```

3. Start the bot:
   ```bash
   npm start
   ```

4. You should see: "⚡️ CRM Bot is running!"

5. Test in Slack:
   - Go to your #gtm channel
   - Type: `@CRM Bot test`
   - The bot should respond!

## Troubleshooting

- **Bot not responding**: Make sure you invited the bot to #gtm channel
- **File storage error**: Check the data directory exists and has write permissions
- **Slack error**: Verify all scopes are added and app is reinstalled
- **Attio error**: Check API key has read/write permissions

## Next Steps

Once everything is working locally, we'll deploy to Cloudflare Workers for 24/7 uptime!