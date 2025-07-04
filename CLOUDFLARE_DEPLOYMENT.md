# Cloudflare Workers Deployment Guide

This guide will help you deploy the CRM Bot to Cloudflare Workers for 24/7 availability.

## Prerequisites

- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- All environment variables configured

## Step 1: Set Up Cloudflare Account

1. Sign up for a Cloudflare account at https://cloudflare.com
2. Get your Account ID from the dashboard
3. Generate an API token with Workers permissions

## Step 2: Configure Wrangler

1. Update `wrangler.toml` with your account ID:
   ```toml
   account_id = "your-actual-account-id"
   ```

2. Authenticate Wrangler:
   ```bash
   wrangler login
   ```

## Step 3: Create KV Namespace (Optional)

If you want to use Cloudflare KV for caching:

```bash
# Create namespace
wrangler kv:namespace create "CACHE"

# Create preview namespace
wrangler kv:namespace create "CACHE" --preview
```

Update `wrangler.toml` with the IDs returned.

## Step 4: Set Secrets

Set all required secrets:

```bash
wrangler secret put SLACK_BOT_TOKEN
wrangler secret put SLACK_SIGNING_SECRET
wrangler secret put SLACK_APP_TOKEN
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put ATTIO_API_KEY
wrangler secret put MONGODB_URI
```

## Step 5: Deploy

Deploy to Cloudflare Workers:

```bash
# Deploy to development
npm run deploy

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## Step 6: Configure Slack App

1. Go to your Slack app settings
2. Update the Event Subscriptions URL:
   ```
   https://crm-bot.your-subdomain.workers.dev/slack/events
   ```
3. Update Interactivity & Shortcuts URL:
   ```
   https://crm-bot.your-subdomain.workers.dev/slack/interactive
   ```

## Step 7: Test the Deployment

1. Check Worker logs:
   ```bash
   wrangler tail
   ```

2. Test the health endpoint:
   ```bash
   curl https://crm-bot.your-subdomain.workers.dev/health
   ```

3. Send a test message in Slack

## Custom Domain (Optional)

To use a custom domain:

1. Add domain to Cloudflare
2. Update `wrangler.toml`:
   ```toml
   route = "https://bot.yourdomain.com/*"
   ```
3. Deploy again

## Monitoring

- View logs: `wrangler tail`
- Check metrics in Cloudflare dashboard
- Set up alerts for errors

## Troubleshooting

### Bot not responding
- Check Worker logs for errors
- Verify all secrets are set correctly
- Ensure Slack URLs are updated

### MongoDB connection issues
- Workers can't access MongoDB directly
- Consider using Cloudflare D1 or external API

### Rate limits
- Cloudflare Workers have request limits
- Implement caching with KV
- Consider upgrading plan if needed

## Rollback

To rollback to a previous version:

```bash
wrangler rollback [deployment-id]
```

## Environment Management

Use different environments for staging/production:

```bash
# Deploy to staging
wrangler deploy --env staging

# Deploy to production  
wrangler deploy --env production
```