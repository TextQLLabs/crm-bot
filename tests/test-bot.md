# Testing Your CRM Bot

## ✅ Bot is Running!

Your CRM bot started successfully and is now listening for messages in Slack.

## How to Test

### 1. Invite the Bot to Your Channel

Go to your #gtm channel in Slack and type:
```
/invite @crm-bot-ethan
```

### 2. Test Basic Response

In the #gtm channel, type:
```
@crm-bot-ethan hello! This is a test.
```

The bot should respond with "🤔 Processing your update..."

### 3. Test CRM Updates

Try these example messages:

**Create a company note:**
```
@crm-bot-ethan Just had a great call with Acme Corp. They're interested in our Enterprise plan.
```

**Update a deal:**
```
@crm-bot-ethan Meeting with TechStartup went well. Budget confirmed at $50k.
```

**Add a contact:**
```
@crm-bot-ethan Met Sarah Johnson, the new CTO at BigCorp. She's replacing Mike.
```

### 4. Check the Logs

In your terminal where the bot is running, you'll see:
- Connection messages
- Incoming events
- AI processing logs
- Attio API calls

### 5. Verify in Attio

After sending a test message:
1. Go to https://app.attio.com
2. Search for the company/deal mentioned
3. Check the timeline for new notes

## Troubleshooting

**Bot not responding?**
- Make sure bot is invited to channel
- Check terminal for error messages
- Verify bot is running (should see "⚡️ CRM Bot is running!")

**"No matches found" error?**
- The company/deal doesn't exist in Attio yet
- Bot will ask if you want to create it

**API errors?**
- Check your Attio API key has read/write permissions
- Verify MongoDB is accessible

## Next Steps

Once testing is complete:
1. Deploy to Cloudflare Workers for 24/7 uptime
2. Add more team members to test
3. Customize the AI prompts for your specific needs