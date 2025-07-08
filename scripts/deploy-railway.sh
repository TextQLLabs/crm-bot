#!/bin/bash

echo "🚂 Deploying to Railway..."

# Create new Railway project with GitHub repo
railway link crm-bot || railway init --name crm-bot

# Set all environment variables from .env
echo "📝 Setting environment variables..."
export $(cat .env | grep -v '^#' | xargs)

railway variables set SLACK_BOT_TOKEN="$SLACK_BOT_TOKEN"
railway variables set SLACK_SIGNING_SECRET="$SLACK_SIGNING_SECRET"
railway variables set SLACK_APP_TOKEN="$SLACK_APP_TOKEN"
railway variables set ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
railway variables set ATTIO_API_KEY="$ATTIO_API_KEY"
railway variables set MONGODB_URI="$MONGODB_URI"

# Deploy
echo "🚀 Deploying..."
railway up

# Get the deployment URL
echo "✅ Deployment complete!"
echo "🔗 Your app URL:"
railway open