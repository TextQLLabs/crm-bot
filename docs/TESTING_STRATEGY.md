# CRM Bot Testing Strategy

## Overview
Streamlined testing strategy focused on critical functionality with concrete acceptance criteria for deterministic evaluation.

## Testing Philosophy

### Single Test Suite Approach
- **One command**: `npm run test` (or `npm run test 1 3 7` for specific tests)
- **9 critical tests**: Core functionality areas
- **Concrete criteria**: Deterministic evaluation based on actual results
- **Pass/fail threshold**: 7/10 on both execution and quality scores

## Testing Methods

### 1. Automated Test Suite
Run the streamlined test suite with dual LLM evaluation:

**Command**:
```bash
# Run all tests
npm run test

# Run specific tests
npm run test 1     # Just fuzzy search
npm run test 1 7   # Fuzzy search and count notes
npm run test --help # Show available tests
```

**What it tests**:
1. **Fuzzy Search** - Tests entity name matching with typos (rayn → raine)
2. **Organic Conversation** - Tests natural language capability detection  
3. **BMG Notes Content Verification** - Tests real content extraction and verification
4. **Notes Summarization** - Tests ability to summarize entity notes
5. **Create Note Capability** - Tests Claude Agent's ability to find entity and create notes
6. **Delete Note Capability** - Tests Claude Agent's ability to find entity, search notes, and delete
7. **Tools Listing** - Tests self-awareness of available capabilities
8. **Count Notes** - Tests entity finding and note counting
9. **Note Lookup Introspection** - Tests specific note finding by content

### New Note Management Tests (Added July 2025)
Tests 5 and 6 specifically test Claude Agent's orchestration of note operations:

**Test 5: Create Note Capability**
- Input: "create a note on Silver Lake saying 'Test note for verification'"
- Tests: search_crm → create_note workflow with URL provision
- Criteria: Must find entity, create note, provide accessible note URL

**Test 6: Delete Note Capability**  
- Input: "delete the test note on Silver Lake"
- Tests: search_crm → get_notes → delete_note workflow with verification
- Criteria: Must find entity, locate note, delete it, confirm deletion

### 2. Concrete Criteria Evaluation
Each test is evaluated using deterministic concrete criteria:

**Execution Score (1-10)**:
- Did the bot use the correct tools?
- Did it find the expected entities?
- Did it complete multi-step workflows?

**Quality Score (1-10)**:
- Did it mention expected entities/results?
- Did it provide correct counts/data?
- Did it include required URLs/links?

**Pass Criteria**: Both scores must be ≥7/10

### 3. Local Development Testing
**Quick Start**: Test locally with `@crm-bot-ethan-dev` before deploying!

**Setup** (one-time):
- Create dev Slack app: https://api.slack.com/apps
- Enable Socket Mode + add bot scopes
- Copy tokens to `.env.dev`
- Full guide: `/docs/LOCAL_DEVELOPMENT.md`

**Usage**:
```bash
npm run dev
```

**Test**: `@crm-bot-ethan-dev search for raine`

**Benefits**: Instant testing, hot reload, separate DB

### 4. Other Testing Methods
- **Local CLI**: `npm run local` (no Slack, direct agent testing)
- **Production**: Push to main branch for Railway auto-deploy

## Testing Workflow

### Development Workflow
1. **Local testing**: Use `npm run local` for quick CLI testing
2. **Development bot**: Use `npm run dev` + `@crm-bot-ethan-dev` for full Slack testing
3. **Run test suite**: `npm run test` to verify all critical functionality
4. **Deploy**: Push to main branch for Railway auto-deployment

### System Prompt Testing Protocol

#### 🚨 CRITICAL RULE
**NEVER deploy system prompt changes without running the test suite!**

#### Testing Protocol
Before changing system prompts in `src/services/claudeAgent.js`:
1. Run `npm run test` to establish baseline
2. Make your prompt changes
3. **IMMEDIATELY run `npm run test` again**
4. Verify all tests still pass (≥7/10 on both scores)
5. Only deploy after confirming no regressions

#### What Counts as System Prompt Changes
- Any edits to `buildSystemPrompt()` method
- Changes to tool calling instructions  
- Modifications to conversation handling rules
- Updates to multi-step operation rules

## Test Suite Details

### Test Structure
Each test in `tests/test.js` follows this pattern:
1. **Setup**: Create test context and ClaudeAgent
2. **Execute**: Process the test message
3. **Evaluate**: Use LLM judges for dual scoring
4. **Report**: Display execution and quality scores

### Adding New Tests
To add a new test to the suite:

1. **Add to `defineAllTests()` function**:
```javascript
{
  id: 9,
  name: 'New Test Name',
  input: 'user input message',
  emoji: '🔍',
  expected: {
    shouldFindEntity: 'Expected Entity',
    expectedNoteCount: 5,
    // ... other concrete criteria
  }
}
```

2. **Update evaluation logic** in `evaluateWithConcreteCriteria()` if needed

### Test Output
The test suite provides:
- Individual test results with dual scores
- Summary table with pass/fail status
- Average execution and quality scores
- Detailed failure analysis for debugging
- Overall pass/fail determination

### Pass Criteria
- **Individual test**: Both execution and quality scores ≥7/10
- **Overall suite**: All tests must pass
- **Failure handling**: Any test failure blocks deployment

## Best Practices

### Test Maintenance
- **Single test file**: Only `tests/test.js` - no proliferation
- **Core functionality**: Focus on critical user journeys
- **LLM evaluation**: Trust the dual-judge system
- **Regular updates**: Keep tests aligned with feature changes

### Quality Assurance
- Run tests after every system prompt change
- Use local testing for quick iteration
- Run specific failing tests for debugging: `npm run test 1`
- Examine conversation logs in `data/conversations/` for detailed failure analysis
- Fix failures before deploying to production