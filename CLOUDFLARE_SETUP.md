# Cloudflare Workers Setup Instructions

This guide will help you deploy the CRM Bot to Cloudflare Workers for 24/7 uptime.

## Prerequisites
Make sure you've completed the local setup first (all credentials in `.env` file).

## Step 1: Create Cloudflare Account

1. Go to: https://dash.cloudflare.com/sign-up
2. Create a free account
3. Verify your email

## Step 2: Get Your Account ID

1. After logging in, look at any page URL
2. You'll see: `https://dash.cloudflare.com/ACCOUNT_ID/...`
3. **COPY** your account ID (long string of numbers/letters)
4. **PASTE IT** in `/Users/ethanding/projects/crm-bot/wrangler.toml`:
   ```toml
   account_id = "your-account-id-here"
   ```

## Step 3: Install Wrangler CLI

In your terminal:
```bash
cd /Users/ethanding/projects/crm-bot
npm install -g wrangler
```

## Step 4: Login to Cloudflare

```bash
wrangler login
```
This will open a browser - click "Allow" to authorize Wrangler.

## Step 5: Create KV Namespace (for caching)

```bash
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CACHE" --preview
```

**COPY** the IDs it returns and **PASTE** them in `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "paste-the-id-here"
preview_id = "paste-the-preview-id-here"
```

## Step 6: Set Secret Environment Variables

Run these commands one by one. It will prompt you to paste each secret:

```bash
wrangler secret put SLACK_BOT_TOKEN
# Paste your xoxb-... token and press Enter

wrangler secret put SLACK_SIGNING_SECRET
# Paste your signing secret and press Enter

wrangler secret put SLACK_APP_TOKEN
# Paste your xapp-... token and press Enter

wrangler secret put ANTHROPIC_API_KEY
# Paste your sk-ant-... key and press Enter

wrangler secret put ATTIO_API_KEY
# Paste your Attio API key and press Enter

wrangler secret put MONGODB_URI
# Paste your mongodb+srv://... connection string and press Enter
```

## Step 7: Build and Deploy

```bash
# Build the worker
npm run build

# Deploy to Cloudflare
wrangler deploy
```

You'll see output like:
```
Published crm-bot (1.23 sec)
  https://crm-bot.YOUR-SUBDOMAIN.workers.dev
```

**COPY** that URL - you'll need it for Slack.

## Step 8: Update Slack to Use Cloudflare URL

1. Go back to your Slack app: https://api.slack.com/apps
2. Click on your CRM Bot app
3. Go to "Event Subscriptions"
4. Change the Request URL to:
   ```
   https://crm-bot.YOUR-SUBDOMAIN.workers.dev/slack/events
   ```
5. Wait for "Verified" ✓
6. Click "Save Changes"

## Step 9: Disable Socket Mode (Important!)

1. Go to "Socket Mode" in Slack app settings
2. Toggle "Enable Socket Mode" to OFF
3. Confirm when prompted

## Step 10: Test Your Deployment

1. Go to your #gtm channel in Slack
2. Type: `@CRM Bot hello from Cloudflare!`
3. The bot should respond!

## Monitoring & Logs

View your worker logs:
```bash
wrangler tail
```

Check worker metrics:
1. Go to: https://dash.cloudflare.com
2. Click "Workers & Pages"
3. Click on "crm-bot"
4. View requests, errors, and performance

## Updating the Bot

When you make changes:
```bash
# Deploy updates
wrangler deploy

# Or use npm script
npm run deploy
```

## Troubleshooting

**Bot not responding after deploy:**
- Check logs with `wrangler tail`
- Verify Socket Mode is OFF
- Check Event Subscriptions URL is updated
- Make sure all secrets are set correctly

**MongoDB connection issues:**
- Cloudflare IPs need to be whitelisted in MongoDB Atlas
- Use "Allow access from anywhere" in Atlas Network Access

**Rate limiting:**
- Free tier: 100,000 requests/day
- Each Slack event = 1 request
- Monitor usage in Cloudflare dashboard

## Cost

- **Cloudflare Workers Free Tier**: 100,000 requests/day
- **Paid Plan**: $5/month for 10 million requests
- For most teams, free tier is sufficient

## Next Steps

Your CRM Bot is now running 24/7! Consider:
- Setting up error alerts
- Adding custom domain
- Implementing rate limiting
- Adding more intelligent features