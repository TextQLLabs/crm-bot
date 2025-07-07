# Local Testing Setup for CRM Bot

## Option 1: Separate Development Slack App (Recommended)

### Steps:
1. **Create a new Slack App** at https://api.slack.com/apps
   - Name it something like "crm-bot-dev" or "crm-bot-ethan-local"
   - Install it to your workspace
   - Add to the same testing channel (#crm-bot-test)

2. **Create a `.env.local` file** with the dev bot's credentials:
   ```bash
   # Dev Bot Configuration
   SLACK_BOT_TOKEN=xoxb-dev-bot-token
   SLACK_SIGNING_SECRET=dev-signing-secret
   SLACK_APP_TOKEN=xapp-dev-app-token
   
   # Same API keys as production
   ANTHROPIC_API_KEY=your-anthropic-key
   ATTIO_API_KEY=your-attio-key
   MONGODB_URI=your-mongodb-uri
   ```

3. **Update your local testing workflow**:
   ```bash
   # Use local env for development
   cp .env.local .env
   npm run dev
   
   # Test with @crm-bot-dev instead of @crm-bot-ethan
   ```

4. **Gitignore the local env**:
   ```bash
   echo ".env.local" >> .gitignore
   ```

## Option 2: ngrok Tunnel (Quick but Limited)

### Steps:
1. **Install ngrok**: `brew install ngrok`
2. **Start your local bot**: `npm run dev`
3. **Create tunnel**: `ngrok http 3000`
4. **Update Slack App settings**:
   - Change Event Subscriptions URL to ngrok URL
   - Change Interactivity URL to ngrok URL
   - This affects the PRODUCTION bot!

### Pros/Cons:
- ✅ Quick to set up
- ❌ Affects production bot while testing
- ❌ Need to update URLs each time ngrok restarts

## Option 3: Docker-based Testing

### Steps:
1. **Create docker-compose.yml**:
   ```yaml
   version: '3.8'
   services:
     crm-bot:
       build: .
       env_file: .env.local
       ports:
         - "3000:3000"
       volumes:
         - ./src:/app/src
       command: npm run dev
   ```

2. **Run locally**: `docker-compose up`

## Option 4: Unit Testing with Mocks

### Create test files:
```javascript
// test/test-react-agent.js
const { ReactAgent } = require('../src/services/reactAgent');

// Mock Slack client
const mockClient = {
  chat: {
    postMessage: jest.fn(),
    update: jest.fn()
  }
};

// Test search behavior
test('searches with multiple variations', async () => {
  const agent = new ReactAgent();
  const result = await agent.processMessage({
    text: 'find rain group',
    userName: 'Test User',
    channel: 'test'
  });
  
  // Verify it tried multiple searches
  expect(result.steps.filter(s => s.action === 'search_crm').length).toBeGreaterThan(1);
});
```

## Recommended Workflow

1. **Use Option 1** (separate dev Slack app) for integration testing
2. **Use Option 4** (unit tests) for logic testing
3. **Test flow**:
   ```bash
   # 1. Run unit tests
   npm test
   
   # 2. Test with local Slack app
   cp .env.local .env
   npm run dev
   # Test in Slack with @crm-bot-dev
   
   # 3. Deploy to Railway
   git push origin main
   # Test in Slack with @crm-bot-ethan
   ```

## Quick Local Testing Without Slack

For testing just the search logic without Slack:

```javascript
// test-local.js
require('dotenv').config();
const { ReactAgent } = require('./src/services/reactAgent');

async function testLocally() {
  const agent = new ReactAgent();
  
  // Simulate various searches
  const testCases = [
    'find the raine group',
    'search for rain group',
    'find rayne group company'
  ];
  
  for (const query of testCases) {
    console.log(`\nTesting: "${query}"`);
    const result = await agent.processMessage({
      text: query,
      userName: 'Local Test',
      channel: 'test'
    });
    
    console.log('Result:', result.answer);
  }
}

testLocally();
```

Run with: `node test-local.js`

## Environment Variables Management

```bash
# .env (production - used by Railway)
SLACK_BOT_TOKEN=xoxb-production-token

# .env.local (local dev - not committed)
SLACK_BOT_TOKEN=xoxb-dev-token

# Switch between them
cp .env.local .env  # for local testing
cp .env.production .env  # for production
```

## Railway Deployment After Local Testing

Once you've tested locally:

```bash
# 1. Ensure you're using production env
cp .env.production .env

# 2. Commit and push
git add -A
git commit -m "feat: tested locally and ready for production"
git push origin main

# 3. Railway auto-deploys from main branch
# 4. Test in production with @crm-bot-ethan
```