# Debugging Methodology for CRM Bot Issues

**Target Audience**: Future Claude Code instances debugging production issues  
**Context**: Systematic approach used to solve the "invalid_blocks" error

## Overview

This document outlines the systematic debugging methodology that successfully resolved a complex production issue. The approach emphasizes isolation, hypothesis testing, and leveraging multiple debugging tools.

## Core Debugging Principles

### 1. Isolate the Problem Domain
**Pattern**: When facing a complex system error, isolate which component is actually failing.

**Example from invalid_blocks issue**:
```javascript
// Test the agent directly without Slack integration
const agent = new ReactAgent();
const result = await agent.processMessage({
  text: "can you find any notes on The Raine Group deal?",
  userName: 'Test User'
});
// Result: Agent worked perfectly (259 chars, clean output)
```

**Key insight**: The ReactAgent was working fine - the issue was in Slack integration.

### 2. Test with Production-Equivalent Data
**Pattern**: Use real API calls and actual data to replicate production conditions.

**Techniques Used**:
- Used MCP Slack server to send identical messages
- Called Attio API directly to get real notes data
- Tested exact message content that would be sent to Slack

### 3. Leverage Error Message Analysis
**Pattern**: Analyze the structure and source of error messages, not just the content.

**Critical observation**:
```json
// Error message had blocks we never created
"blocks":[{"type":"rich_text","block_id":"mz5ps","elements":[...]}]
```

**Conclusion**: Error wasn't from our code - it was from Slack Bolt.js framework.

## Debugging Tools and Techniques

### 1. Direct API Testing
Test components in isolation without the full system:

```javascript
// Test ReactAgent directly
const agent = new ReactAgent();
const result = await agent.processMessage(query);

// Test Slack messages directly
mcp__slack__slack_post_message({
  channel_id: "C0946T1T4CB",
  text: "Exact message content here"
});
```

### 2. Systematic Hypothesis Testing
Create multiple hypotheses and test each systematically:

**From invalid_blocks debugging**:
1. ✗ Malformed blocks in our code
2. ✗ Special characters in content  
3. ✗ Empty blocks array issue
4. ✗ Preview mode causing problems
5. ✅ Timeout causing Bolt error handler to trigger

### 3. Timing Analysis
Pay attention to timing patterns:

```javascript
// Log timestamps to identify timeout patterns
console.log('🚀 handleMention START');
console.log('📤 Sending update to Slack');
console.log('⏰ Request timed out after 45 seconds');
```

**Pattern recognition**: Consistent ~35-40 second delays indicated timeout issues.

### 4. Web Research Integration
Use web searches to find similar issues:

**Search patterns that worked**:
- `slack bolt "invalid_blocks" error "An API error occurred"`
- `slack chat.update "invalid_blocks" error empty blocks array`
- `slack bolt.js "An API error occurred: invalid_blocks" error handler timeout`

## Common Anti-Patterns to Avoid

### 1. Assuming Error Source
❌ **Don't assume**: "invalid_blocks error means our blocks are wrong"  
✅ **Do verify**: Check if the error message format matches your code

### 2. Over-Engineering Solutions
❌ **Don't over-engineer**: Complex block validation, character escaping, etc.  
✅ **Do find root cause**: The issue was timing, not content

### 3. Ignoring Framework Behavior
❌ **Don't ignore**: How Bolt.js handles timeouts and errors  
✅ **Do understand**: Framework error handling can cause issues

### 4. Testing Only Happy Path
❌ **Don't test only**: Successful cases  
✅ **Do test edge cases**: Timeouts, errors, long content

## Systematic Debugging Process

### Phase 1: Problem Isolation
1. **Reproduce reliably**: Find consistent reproduction steps
2. **Identify boundaries**: Which component is actually failing?
3. **Test in isolation**: Remove complexity to isolate the issue
4. **Document symptoms**: Exact error messages, timing, conditions

### Phase 2: Hypothesis Generation
1. **List all possibilities**: Don't dismiss any initially
2. **Order by likelihood**: Based on symptoms and system knowledge
3. **Make testable predictions**: What would you see if this hypothesis is true?
4. **Research similar issues**: Web search for patterns

### Phase 3: Systematic Testing
1. **Test one hypothesis at a time**: Don't change multiple things
2. **Use production-like conditions**: Real data, real timing
3. **Document all attempts**: What was tried, what was the result
4. **Verify the fix**: Test multiple times, different scenarios

### Phase 4: Solution Implementation
1. **Implement minimal fix**: Don't over-engineer
2. **Add monitoring**: Logs, metrics to detect future issues
3. **Document for future**: Create troubleshooting docs
4. **Test thoroughly**: Multiple scenarios, edge cases

## Key Debugging Commands

### Local Testing
```bash
# Test agent directly without Slack
node test-simplified-notes.js

# Test specific components
node src/test-*.js
```

### Production Debugging
```bash
# Check Railway logs
railway logs

# Check deployment status
railway status
```

### Slack Testing
```javascript
// Test message content directly
mcp__slack__slack_post_message({
  channel_id: "C0946T1T4CB", 
  text: "Your message here"
});

// Get recent messages
mcp__slack__slack_get_channel_history({
  channel_id: "C0946T1T4CB",
  limit: 5
});
```

## Lessons Learned

### 1. Framework Behavior Matters
Understanding how Bolt.js handles timeouts and errors was crucial. The framework's behavior can cause issues that appear to be in your code.

### 2. Timing is Critical
Slack has various timeouts:
- Socket Mode: ~30 seconds
- HTTP Mode: 3 seconds for acknowledgment
- Keep operations under 25 seconds for safety

### 3. Error Message Structure Analysis
The structure of error messages can reveal their true source:
- Our code: Simple text or specific block structures
- Bolt.js: Rich text with emoji elements
- Slack API: Specific error codes and formats

### 4. Production vs Development Differences
Some issues only appear in production:
- Network latency
- Slack's actual timeout enforcement
- Real API response times

## Future Debugging Checklist

When debugging similar issues:

- [ ] Can you reproduce the issue consistently?
- [ ] Have you isolated which component is failing?
- [ ] Have you tested with production-equivalent data?
- [ ] Have you analyzed the error message structure?
- [ ] Have you checked timing patterns?
- [ ] Have you researched similar issues online?
- [ ] Have you tested your hypotheses systematically?
- [ ] Have you verified the fix works reliably?

## Tools and Resources

### Essential Tools
- **MCP Slack Server**: Direct Slack API testing
- **Railway CLI**: Production log access
- **Local test scripts**: Component isolation
- **Web search**: Similar issue research

### Key Resources
- Slack API documentation
- Bolt.js GitHub issues
- Stack Overflow for similar problems
- Block Kit Builder for testing blocks

This methodology successfully resolved a complex production issue that had multiple false leads and required systematic investigation to identify the root cause.