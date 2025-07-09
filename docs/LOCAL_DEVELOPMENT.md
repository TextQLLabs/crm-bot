# Local Development Setup

This guide helps you set up a local development environment for the CRM bot.

## Prerequisites

- Node.js >= 22.0.0
- npm
- Access to TextQL Slack workspace
- Attio API access
- MongoDB connection (optional - will use file storage if not available)

## Step 1: Create a Development Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name it: `crm-bot-dev-[yourname]` (e.g., `crm-bot-dev-ethan`)
4. Select the TextQL workspace

## Step 2: Configure OAuth & Permissions

Navigate to "OAuth & Permissions" and add these Bot Token Scopes:
- `app_mentions:read`
- `channels:history` 
- `channels:read`
- `chat:write`
- `groups:history`
- `groups:read`
- `im:history`
- `im:read`
- `im:write`
- `users:read`

Click "Install to Workspace" and authorize the app.

## Step 3: Enable Socket Mode

1. Go to "Socket Mode" in the sidebar
2. Enable Socket Mode
3. Generate an app-level token:
   - Token Name: `dev-token`
   - Scope: `connections:write`
4. Save the token - you'll need it for `.env.dev`

## Step 4: Configure Event Subscriptions

1. Go to "Event Subscriptions"
2. Enable Events
3. Under "Subscribe to bot events", add:
   - `app_mention`
   - `message.channels`
   - `message.groups`
   - `message.im`
4. Save changes

## Step 5: Set Up Environment Variables

1. Copy `.env.example` to `.env.dev`:
   ```bash
   cp .env.example .env.dev
   ```

2. Update `.env.dev` with your development app credentials:
   ```env
   # From OAuth & Permissions page
   SLACK_BOT_TOKEN=xoxb-your-dev-bot-token
   
   # From Basic Information → App Credentials
   SLACK_SIGNING_SECRET=your-dev-signing-secret
   
   # From Socket Mode → App-Level Tokens
   SLACK_APP_TOKEN=xapp-your-dev-app-token
   
   # Reuse from production
   ANTHROPIC_API_KEY=your-anthropic-key
   ATTIO_API_KEY=your-attio-key
   
   # Optional: Use different DB name for dev
   MONGODB_URI=mongodb+srv://user:pass@cluster/crm-bot-dev
   ```

## Step 6: Install Dependencies

```bash
npm install
```

## Step 7: Run the Development Bot

```bash
npm run dev
```

This will:
- Load environment variables from `.env.dev`
- Start the bot in Socket Mode (no public URL needed)
- Enable hot reloading with nodemon
- Connect to your development Slack app

## Testing Your Dev Bot

1. Go to any channel in TextQL workspace
2. Invite your dev bot: `/invite @crm-bot-dev-yourname`
3. Test with: `@crm-bot-dev-yourname search for stripe`

## Development Workflow

1. Make changes to the code
2. Nodemon will automatically restart the bot
3. Test in Slack immediately
4. No need to deploy or push to production

## Troubleshooting

### Bot doesn't respond
- Check that Socket Mode is enabled
- Verify the app is installed to workspace
- Check logs for connection errors
- Ensure bot is invited to the channel

### Invalid auth errors
- Regenerate tokens if needed
- Make sure you're using dev app tokens, not production

### MongoDB connection issues
- The bot will fall back to file storage
- Check logs for "Using file storage" message

## Tips

- Use a separate channel like `#crm-bot-dev` for testing
- The dev bot can coexist with the production bot
- Consider using different MongoDB database name to avoid conflicts
- You can run multiple dev instances with different `.env` files

## Production Deployment

When ready to deploy to production:
1. Test thoroughly with local dev bot
2. Commit and push to main branch
3. Railway will auto-deploy to production
4. Test in `#crm-bot-test` channel