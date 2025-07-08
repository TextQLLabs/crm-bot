#!/bin/bash

echo "🚂 Updating Railway environment variables..."

# First, you need to link to your project if not already linked
# railway link

# Load environment variables from .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    
    # Set all environment variables from .env
    echo "Setting ANTHROPIC_API_KEY..."
    railway vars set ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
    
    echo "Setting ATTIO_API_KEY..."
    railway vars set ATTIO_API_KEY="$ATTIO_API_KEY"
    
    echo "✅ Updated ANTHROPIC_API_KEY"
    echo "🔄 Railway will automatically redeploy with the new variable"
else
    echo "❌ Error: .env file not found"
    echo "Please ensure .env file exists with ANTHROPIC_API_KEY"
    exit 1
fi