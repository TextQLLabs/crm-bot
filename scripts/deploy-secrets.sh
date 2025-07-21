#!/bin/bash

# Script to deploy secrets to Cloudflare Workers
# This reads from .env file and sets secrets via wrangler

echo "🔐 Setting Cloudflare Worker secrets from .env file..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    exit 1
fi

# Load .env file
export $(cat .env | grep -v '^#' | xargs)

# Function to set a secret
set_secret() {
    local name=$1
    local value=$2
    
    if [ -z "$value" ]; then
        echo "⚠️  Skipping $name (not found in .env)"
    else
        echo "Setting $name..."
        echo "$value" | wrangler secret put $name
    fi
}

# Set each secret
set_secret "SLACK_BOT_TOKEN" "$SLACK_BOT_TOKEN"
set_secret "SLACK_SIGNING_SECRET" "$SLACK_SIGNING_SECRET"
set_secret "SLACK_APP_TOKEN" "$SLACK_APP_TOKEN"
set_secret "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY"
set_secret "ATTIO_API_KEY" "$ATTIO_API_KEY"
# File storage - no secrets needed for local file system

echo "✅ Secrets deployment complete!"
echo ""
echo "Next steps:"
echo "1. Run: npm run deploy"
echo "2. Update Slack app URLs to your Worker URL"