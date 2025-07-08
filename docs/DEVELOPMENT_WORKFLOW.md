# CRM Bot Development Workflow

## 🚀 Development Cycle

### Phase 1: Local AI Development (ReactAgent Logic)
**Goal**: Improve the AI's search and reasoning capabilities

1. **Make changes to AI logic**:
   - `src/services/reactAgent.js` - Agent reasoning and tools
   - `src/services/attioService.js` - Search logic and API calls

2. **Test locally WITHOUT Slack**:
   ```bash
   # Interactive testing
   npm run local
   
   # Type your test queries:
   # > find rain group
   # > search for rayne company
   # > /debug (to see reasoning steps)
   
   # Or quick test
   echo "find the raine group" | npm run local
   ```

3. **Run automated test suite**:
   ```bash
   npm run test:bot
   ```

4. **Iterate until AI behaves correctly**:
   - Fix search logic
   - Improve spelling variations
   - Add better error handling
   - Test edge cases

### Phase 2: Production Deployment (Slack Integration)
**Goal**: Ensure the bot works correctly in Slack

1. **Commit and push changes**:
   ```bash
   git add -A
   git commit -m "feat: improve search logic for X"
   git push origin main
   ```

2. **Wait for Railway auto-deployment** (~2-3 minutes)

3. **Test in Slack**:
   ```
   @crm-bot-ethan find rain group
   ```

4. **Check for Slack-specific issues**:
   - Button interactions working?
   - Modal displays correctly?
   - Thread context maintained?
   - Response formatting good?

## 📋 Development Log

### Latest Changes (v1.8.0) - January 2025

#### What We Changed:
1. **Fuzzy Search Improvements**:
   - Added spelling variations: rain→raine, rayne→raine, rane→raine
   - Improved search priority (exact match first)
   - Added web search fallback for corrections

2. **URL Format Fix** (v1.7.0):
   - Changed from `/companies/record/{id}` to `/company/{id}/overview`
   - Fixed links to actually open company pages

3. **Search Details Button** (v1.6.0):
   - Added "Show Search Details" button to responses
   - Shows what searches were performed and results

4. **Local Testing Setup**:
   - Created `npm run local` for interactive testing
   - Created `npm run test:bot` for automated tests
   - No Slack required for AI development

#### Testing Process Used:
1. **Local AI Testing**:
   ```bash
   # Tested fuzzy search locally
   echo "find rain group" | npm run local
   # ✅ Found "The Raine Group"
   
   echo "search for rayne group" | npm run local  
   # ✅ Found "The Raine Group"
   ```

2. **Production Testing**:
   - Deployed v1.8.0
   - Tested in #crm-bot-test channel
   - Verified URLs open correctly
   - Confirmed button interactions work

## 🛠️ Common Development Tasks

### Adding New Search Variations
1. Edit `src/services/attioService.js`:
   ```javascript
   // In generateSpellingVariations()
   if (lower.includes('targetword')) {
     variations.push(query.replace(/targetword/gi, 'correctword'));
   }
   ```

2. Test locally:
   ```bash
   echo "find targetword company" | npm run local
   ```

3. Deploy when working

### Improving Agent Responses
1. Edit `src/services/reactAgent.js`:
   - Update system prompt in `buildSystemPrompt()`
   - Add new tools in constructor
   - Modify search strategy instructions

2. Test conversation flow:
   ```bash
   npm run local
   # Have a full conversation to test context
   ```

### Adding New Slack Features
1. Edit `src/handlers/slackHandlerReact.js`:
   - Add button handlers
   - Format messages
   - Handle modals

2. **Must test in production** (no local Slack testing yet)

## 🔍 Debugging Tools

### Local Debugging
```bash
# Interactive with debug mode
npm run local
> /debug
> find company name

# Check specific variations
node -e "
const { generateSearchVariations } = require('./src/services/attioService');
console.log(generateSearchVariations('test company'));
"
```

### Production Debugging
```bash
# Check Railway logs
railway logs --service crm-bot

# Test in Slack and check "Show Search Details" button
@crm-bot-ethan find company
# Click "Show Search Details" to see what searches ran
```

## 📊 Version History

- **v1.8.0**: Fuzzy search with spelling corrections
- **v1.7.0**: Fixed Attio URL format
- **v1.6.0**: Added search details button, improved multi-search
- **v1.5.0**: Better search variations
- **v1.4.0**: Added "Show Search Details" button
- **v1.3.0**: Made responses more concise

## 🚨 Important Notes

1. **API Keys**: 
   - Local uses `.env` file
   - Production uses Railway environment variables
   - Update in Railway dashboard if key changes

2. **Testing Philosophy**:
   - AI logic → Test locally first (faster)
   - Slack features → Must test in production
   - Always increment version in package.json

3. **Deployment**:
   - Auto-deploys from `main` branch
   - Takes 2-3 minutes
   - Check Railway dashboard for status

## 🎯 Next Steps

1. **Create dev Slack app** for local Slack testing
2. **Add more web search** intelligence
3. **Improve error messages** when companies not found
4. **Add unit tests** for search variations