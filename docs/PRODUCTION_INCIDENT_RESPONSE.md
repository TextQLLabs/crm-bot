# Production Incident Response Playbook

**Target Audience**: Future Claude Code instances handling production incidents  
**Context**: Systematic approach to investigating and resolving production issues

## Overview

This playbook provides a structured approach to handling production incidents, based on real experience resolving complex bot failures in production Slack environments.

## Incident Classification

### Severity Levels

**P0 - Critical**: Bot completely non-functional
- No responses to any messages
- All users affected
- **Response Time**: Immediate
- **Example**: App crashes, authentication failures

**P1 - High**: Major functionality broken
- Core features failing (e.g., notes queries)
- Consistent error messages
- **Response Time**: Within 30 minutes
- **Example**: "invalid_blocks" error affecting all notes queries

**P2 - Medium**: Partial functionality issues
- Some features working, others failing
- Intermittent errors
- **Response Time**: Within 2 hours
- **Example**: Search working but notes timing out

**P3 - Low**: Minor issues or degraded performance
- Slow responses but functional
- Non-critical features affected
- **Response Time**: Within 24 hours
- **Example**: Responses taking 20s instead of 10s

## Initial Response Protocol

### 1. Immediate Assessment (0-5 minutes)
**Goal**: Understand scope and impact

#### Quick Checks
```bash
# Check if bot is responding at all
# Test in Slack: @bot-name help

# Check deployment status
railway status

# Check recent deployments
git log --oneline -n 5
```

#### Gather Initial Data
- **When did it start?** Check recent deployments
- **What's the error pattern?** Consistent vs intermittent
- **Who's affected?** All users or specific scenarios
- **What changed?** Recent code pushes, config changes

### 2. Error Investigation (5-15 minutes)
**Goal**: Identify the specific failure mode

#### Check Logs
```bash
# Get recent logs
railway logs

# Look for error patterns
railway logs | grep -i error

# Check timing patterns
railway logs | grep -E "(START|completed|failed)"
```

#### Test Specific Scenarios
```javascript
// Test the failing scenario directly
mcp__slack__slack_post_message({
  channel_id: "C0946T1T4CB",
  text: "@bot-name [exact failing command]"
});

// Check response in thread
mcp__slack__slack_get_thread_replies({
  channel_id: "C0946T1T4CB",
  thread_ts: "message_timestamp"
});
```

### 3. Root Cause Analysis (15-30 minutes)
**Goal**: Understand why the failure is occurring

#### Systematic Investigation
1. **Isolate the component**
   - Test agent directly without Slack
   - Test Slack integration without agent
   - Test individual API calls

2. **Analyze error patterns**
   - Check error message structure
   - Look for timing correlations
   - Identify if error is from our code or external service

3. **Review recent changes**
   - Check git history for relevant changes
   - Look at environment variable changes
   - Check dependency updates

## Common Incident Patterns

### Pattern 1: Timeout Errors
**Symptoms**: 
- Bot responds with "request timed out"
- Long delays before error messages
- Errors after ~30-45 seconds

**Investigation Steps**:
```bash
# Check processing times in logs
railway logs | grep -E "(START|completed)" | tail -20

# Look for operations taking >25s
railway logs | grep -E "took \d{5,}ms"
```

**Common Causes**:
- External API slowness (Attio, Anthropic)
- Database connection issues
- Large context processing
- Network connectivity problems

**Resolution Pattern**:
1. Reduce timeout threshold
2. Implement graceful degradation
3. Add retry logic with exponential backoff
4. Cache frequently accessed data

### Pattern 2: Authentication Failures
**Symptoms**:
- "unauthorized" or "invalid_auth" errors
- Bot doesn't respond at all
- 401/403 errors in logs

**Investigation Steps**:
```bash
# Check environment variables
railway variables

# Test tokens directly
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" https://slack.com/api/auth.test
```

**Common Causes**:
- Expired tokens
- Token rotation
- Incorrect environment variables
- Slack app configuration changes

**Resolution Pattern**:
1. Regenerate tokens in Slack app settings
2. Update environment variables
3. Verify token scopes
4. Test authentication endpoints

### Pattern 3: Block Validation Errors
**Symptoms**:
- "invalid_blocks" errors
- Messages with blocks fail, text-only work
- Errors from Slack API

**Investigation Steps**:
```javascript
// Test exact message content
mcp__slack__slack_post_message({
  channel_id: "C0946T1T4CB",
  text: "Exact message that's failing"
});

// Check if blocks are the issue
// Try text-only version
```

**Common Causes**:
- Malformed block structure
- Text content too long (>2958 chars)
- Button values too long (>2000 chars)
- Too many blocks (>20)
- Empty text in blocks

**Resolution Pattern**:
1. Validate block structure
2. Add content length checks
3. Implement fallback to text-only
4. Use Block Kit Builder for testing

### Pattern 4: Framework Error Handler Issues
**Symptoms**:
- Error messages you didn't write
- Errors with specific formatting/blocks
- Errors after your code throws exceptions

**Investigation Steps**:
```bash
# Look for our error handling
railway logs | grep -E "(Error in|handleMention|catch)"

# Check if errors are bubbling up
railway logs | grep -E "(unhandled|uncaught)"
```

**Common Causes**:
- Unhandled exceptions reaching Bolt.js
- Bolt.js error handler sending invalid blocks
- Timeout causing framework error handling
- Missing try-catch blocks

**Resolution Pattern**:
1. Add comprehensive error handling
2. Prevent errors from bubbling to framework
3. Implement graceful timeout handling
4. Send your own error messages

## Incident Response Workflow

### Phase 1: Stabilization (0-30 minutes)
**Goal**: Stop the immediate bleeding

#### Quick Fixes
```bash
# If recent deployment caused issue
git revert HEAD
git push origin main

# If configuration issue
railway variables set VARIABLE_NAME=old_value

# If external service issue
# Implement circuit breaker or fallback
```

#### Immediate Mitigation
- Revert problematic changes
- Implement quick workarounds
- Add circuit breakers for external services
- Increase timeout thresholds temporarily

### Phase 2: Investigation (30-90 minutes)
**Goal**: Understand the full scope and root cause

#### Deep Dive Analysis
1. **Reproduce the issue**
   - Create minimal reproduction case
   - Test with various inputs
   - Document exact failure conditions

2. **Analyze system state**
   - Check all service dependencies
   - Verify configuration consistency
   - Review recent changes comprehensively

3. **Test hypotheses**
   - Create testable predictions
   - Use systematic debugging approach
   - Document what works vs what fails

### Phase 3: Resolution (90-120 minutes)
**Goal**: Implement proper fix and verify

#### Fix Implementation
1. **Develop targeted fix**
   - Address root cause, not symptoms
   - Implement with minimal risk
   - Add monitoring for future detection

2. **Test thoroughly**
   - Test fix in isolation
   - Test with various scenarios
   - Verify no regressions

3. **Deploy and monitor**
   - Deploy with monitoring
   - Test immediately after deployment
   - Monitor for 30 minutes post-deployment

### Phase 4: Post-Incident (2-24 hours)
**Goal**: Prevent future occurrences

#### Documentation
- Update troubleshooting docs
- Document root cause and fix
- Create runbook for similar issues
- Update monitoring and alerting

## Emergency Procedures

### Circuit Breaker Pattern
**Use Case**: When external service is failing

```javascript
// Emergency circuit breaker
const circuitBreaker = {
  isOpen: false,
  failureCount: 0,
  lastFailureTime: null,
  threshold: 5,
  timeout: 60000 // 1 minute
};

async function protectedOperation() {
  if (circuitBreaker.isOpen) {
    if (Date.now() - circuitBreaker.lastFailureTime > circuitBreaker.timeout) {
      circuitBreaker.isOpen = false;
      circuitBreaker.failureCount = 0;
    } else {
      return { success: false, error: 'Service temporarily unavailable' };
    }
  }
  
  try {
    const result = await externalService();
    circuitBreaker.failureCount = 0;
    return result;
  } catch (error) {
    circuitBreaker.failureCount++;
    if (circuitBreaker.failureCount >= circuitBreaker.threshold) {
      circuitBreaker.isOpen = true;
      circuitBreaker.lastFailureTime = Date.now();
    }
    throw error;
  }
}
```

### Graceful Degradation
**Use Case**: When core functionality is impaired

```javascript
// Fallback response when main functionality fails
async function handleWithFallback(message) {
  try {
    return await fullProcessing(message);
  } catch (error) {
    console.error('Full processing failed:', error);
    
    // Try simplified processing
    try {
      return await simplifiedProcessing(message);
    } catch (fallbackError) {
      console.error('Fallback failed:', fallbackError);
      
      // Final fallback
      return {
        success: true,
        answer: "I'm experiencing technical difficulties. Please try again in a few minutes."
      };
    }
  }
}
```

### Emergency Rollback
**Use Case**: When new deployment breaks everything

```bash
# Quick rollback procedure
git log --oneline -n 5  # Find last working commit
git revert HEAD  # Revert the problematic commit
git push origin main  # Deploy immediately

# Or if multiple commits need reverting
git reset --hard <last-working-commit>
git push origin main --force  # Use with caution
```

## Communication Protocol

### Internal Communication
- **Slack channel**: #crm-bot-incidents
- **Update frequency**: Every 15 minutes during active incident
- **Status format**: "Status: [Investigating|Mitigating|Resolved] - [brief description]"

### User Communication
- **Channel**: Same channel where bot is used
- **Message format**: "We're experiencing technical difficulties. Investigating..."
- **Update when**: When resolution is deployed

## Prevention Strategies

### 1. Proactive Monitoring
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    dependencies: {
      slack: 'connected',
      attio: 'connected',
      anthropic: 'connected',
      mongodb: 'connected'
    }
  };
  
  res.json(healthStatus);
});
```

### 2. Gradual Rollouts
```javascript
// Feature flags for gradual rollout
const featureFlags = {
  newNotesFeature: process.env.ENABLE_NEW_NOTES === 'true',
  improvedSearch: process.env.ENABLE_IMPROVED_SEARCH === 'true'
};

if (featureFlags.newNotesFeature) {
  return await newNotesProcessing(query);
} else {
  return await legacyNotesProcessing(query);
}
```

### 3. Comprehensive Testing
```bash
# Pre-deployment testing checklist
npm run test:suite  # Run full test suite
npm run test:integration  # Test Slack integration
npm run test:performance  # Check performance benchmarks
```

## Key Metrics to Monitor

### Response Time
- **Alert threshold**: >20 seconds average
- **Critical threshold**: >25 seconds
- **Check frequency**: Every 5 minutes

### Error Rate
- **Alert threshold**: >5% error rate
- **Critical threshold**: >10% error rate
- **Check frequency**: Every 1 minute

### Availability
- **Alert threshold**: <95% availability
- **Critical threshold**: <90% availability
- **Check frequency**: Every 1 minute

## Post-Incident Review Template

### Incident Summary
- **Date**: 
- **Duration**: 
- **Severity**: 
- **Impact**: 
- **Root Cause**: 

### Timeline
- **Detection**: When was the incident first detected?
- **Response**: When did investigation begin?
- **Resolution**: When was the issue resolved?
- **Recovery**: When was service fully restored?

### What Went Well
- Quick detection
- Effective communication
- Systematic investigation

### What Could Be Improved
- Faster response time
- Better monitoring
- More comprehensive testing

### Action Items
- [ ] Implement additional monitoring
- [ ] Update documentation
- [ ] Add automated tests
- [ ] Improve error handling

This playbook has been validated through real production incidents and provides a structured approach to handling bot failures effectively.