# CRM Bot - Intelligent Slack-to-Attio Integration

An intelligent Slack bot that uses AI (Claude) with the ReAct pattern to automatically manage CRM data in Attio through natural language conversations.

## Features

- 🤖 **ReAct AI Agent**: Uses reasoning and acting pattern for intelligent decisions
- 🔍 **Fuzzy Search**: Smart matching across companies, people, and deals
- 📝 **Natural Language**: Just talk naturally - "create a note on Raine about our meeting"
- 💬 **Threaded Conversations**: Add context with follow-up messages
- ✅ **Action Preview**: See what the bot will do before it executes
- 🧠 **Context Awareness**: Remembers previous actions in the conversation
- ☁️ **24/7 Availability**: Deployed on Cloudflare Workers

## Quick Start

1. Clone the repository:
```bash
git clone <your-repo-url>
cd crm-bot
```

2. Install dependencies:
```bash
npm install
```

3. Set up credentials:
- Follow `SETUP_INSTRUCTIONS.md` for detailed steps
- Copy `.env.example` to `.env` and fill in values

4. Run locally:
```bash
npm start
```

5. Deploy to Cloudflare:
- Follow `CLOUDFLARE_SETUP.md` for deployment

## Usage Examples

**Creating Notes:**
```
@bot create a note on the Raine deal about our meeting discussing pricing
```

**Threaded Conversations:**
```
User: @bot create a note on Raine about the meeting
Bot: [Shows preview: "Create note on: Raine..."]
User: @bot actually, add that we discussed Q3 timeline and budget
Bot: [Updates understanding with additional context]
```

**Searching Records:**
```
@bot find The Raine Group company
```

## Project Structure

```
crm-bot/
├── src/
│   ├── handlers/       # Slack event handlers
│   ├── services/       # Core services (AI, Attio, DB)
│   ├── workers/        # Cloudflare Worker
│   └── index.js        # Local development entry
├── SETUP_INSTRUCTIONS.md
├── CLOUDFLARE_SETUP.md
├── CLAUDE.md          # AI assistant instructions
└── SPEC.md            # Full specification
```

## Commands

- `npm start` - Run locally
- `npm run dev` - Run with auto-reload
- `npm run deploy` - Deploy to Cloudflare
- `npm test` - Run tests

## Architecture

- **Slack Integration**: Bolt.js framework
- **AI Processing**: Anthropic Claude API
- **CRM**: Attio API
- **Database**: MongoDB Atlas
- **Hosting**: Cloudflare Workers
- **Caching**: Cloudflare KV

## Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit PR

## Support

- Check logs: `wrangler tail`
- MongoDB issues: Verify IP whitelist
- Slack issues: Check bot permissions
- Create GitHub issue for bugs

## License

[Your License]