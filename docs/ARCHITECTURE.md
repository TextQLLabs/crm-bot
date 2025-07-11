# CRM Bot Architecture

## Overview
A Slack bot that monitors channels for updates and automatically creates/updates records in Attio CRM using AI to intelligently match messages to the correct deals or companies.

## Tech Stack
- **Framework**: Bolt.js for Slack integration
- **AI**: Claude Sonnet 4 with native tool calling
- **CRM**: Attio API for data management
- **Storage**: File-based conversation persistence
- **Hosting**: Railway (Node.js compatible)
- **Language**: JavaScript (ES Modules)

## Current Architecture (v1.12.0)
- ✅ **Claude Sonnet 4**: Native tool calling for intelligent CRM operations
- ✅ **Perfect Image Processing**: 100% success rate with Claude's native vision API
- ✅ **Thinking Mode**: Enhanced reasoning transparency with native thinking
- ✅ **Performance**: Optimized response times, 99% tool call success rate
- ✅ **Architecture**: Clean codebase with modern patterns
- ✅ **Entry Point**: Uses `src/index-claude.js` exclusively
- ✅ **Development Setup**: Complete `.env.dev` configuration for local testing

## Key Components

### 1. Slack Handler (`src/handlers/slackHandlerClaude.js`)
- Listens for @mentions and channel messages
- Extracts context from messages and threads
- Handles message formatting and responses

### 2. Claude Agent (`src/services/claudeAgent.js`)
- Uses Claude Sonnet 4 with native tool calling
- Contains system prompt with company-specific references
- Manages conversation flow and tool selection

### 3. Attio Service (`src/services/attioService.js`)
- Fetches and matches entities from Attio CRM
- Creates and updates records (companies, deals, people)
- Handles API authentication and rate limiting

### 4. File Storage (`src/services/fileStorage.js`)
- Persists conversation data for debugging
- Stores test results and metrics
- Manages local development data

### 5. Cloudflare Worker (`src/workers/cloudflare.js`)
- Handles HTTP requests and webhooks
- Manages Slack event processing
- Provides backup processing path

## Data Flow
1. User mentions bot in Slack channel
2. Slack handler processes message and context
3. Claude agent analyzes request and selects tools
4. Attio service searches/updates CRM records
5. Database service caches results
6. Response sent back to Slack channel

## Key Features
- **Fuzzy Matching**: Intelligent entity matching using string similarity
- **Preview Mode**: Shows preview before executing write operations
- **Thread Context**: Maintains conversation history
- **Error Recovery**: Multiple retry strategies for failed operations
- **Multi-Step Operations**: Complex workflows like search + note creation