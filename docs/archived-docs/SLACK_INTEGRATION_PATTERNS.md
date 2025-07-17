# Slack Integration Patterns and Best Practices

**Target Audience**: Future Claude Code instances working with Slack Bolt.js  
**Context**: Patterns learned from building a production Slack bot with complex interactions

## Overview

This document captures critical patterns for building reliable Slack bots with Bolt.js, focusing on error handling, timeouts, and message formatting based on real production experience.

## Core Integration Patterns

### 1. Safe Message Updates
**Problem**: Slack's chat.update can fail with various errors, causing Bolt.js to send its own error messages.

**Solution**: Always wrap updates in try-catch with fallback:

```javascript
// ✅ Safe update pattern
try {
  await client.chat.update({
    channel: msg.channel,
    ts: thinkingMessage.ts,
    text: responseText
  });
} catch (updateError) {
  console.error('Update failed:', updateError);
  // Fallback: post new message
  try {
    await client.chat.postMessage({
      channel: msg.channel,
      thread_ts: msg.thread_ts || msg.ts,
      text: responseText
    });
  } catch (fallbackError) {
    console.error('Fallback failed:', fallbackError);
    // Never rethrow - prevents Bolt from sending its own error
  }
}
```

### 2. Timeout Management
**Problem**: Slack has various timeouts that can cause Bolt.js to send error messages.

**Critical Timeouts**:
- Socket Mode: ~30 seconds
- HTTP Mode: 3 seconds for acknowledgment
- Interactive components: 30 seconds

**Solution**: Conservative timeout handling:

```javascript
// ✅ Conservative timeout pattern
const timeoutPromise = new Promise((resolve) => {
  setTimeout(() => {
    resolve({
      success: true,  // Mark as success to avoid error paths
      answer: 'The request is taking longer than expected. Please try again.',
      timedOut: true
    });
  }, 25000); // 25s - safely under Slack's 30s limit
});

const result = await Promise.race([operationPromise, timeoutPromise]);
```

### 3. Block vs Text Message Handling
**Problem**: Blocks can cause validation errors that are hard to debug.

**Strategy**: Use text-first approach with blocks as enhancement:

```javascript
// ✅ Text-first pattern
const updatePayload = {
  channel: msg.channel,
  ts: thinkingMessage.ts,
  text: responseText  // Always provide text
};

// Only add blocks for non-critical content
if (!isNotesQuery && !result.timedOut) {
  updatePayload.blocks = blocks;
}
```

### 4. Error Prevention in Bolt.js
**Problem**: Any unhandled error causes Bolt.js to send its own error message, which can have invalid blocks.

**Solution**: Comprehensive error containment:

```javascript
// ✅ Error containment pattern
app.event('app_mention', async ({ event, client, ack }) => {
  try {
    if (ack) await ack(); // Acknowledge immediately
    
    await handleMention({ event, client });
  } catch (error) {
    console.error('Error in handler:', error);
    // Never rethrow - prevents Bolt's error handler
    
    // Send your own error message
    try {
      await client.chat.postMessage({
        channel: event.channel,
        text: 'Sorry, I encountered an issue. Please try again.'
      });
    } catch (errorSendError) {
      console.error('Could not send error message:', errorSendError);
    }
  }
});
```

## Message Formatting Best Practices

### 1. Content Validation
**Common Issues**:
- Empty text in blocks → `invalid_blocks`
- Text over 2958 chars → `invalid_blocks`
- Button values over 2000 chars → `invalid_blocks`
- More than ~20 blocks → `invalid_blocks`

**Solution**: Validate before sending:

```javascript
// ✅ Content validation pattern
function validateMessageContent(text, blocks) {
  // Check text length
  if (text && text.length > 2950) {
    text = text.substring(0, 2950) + '...';
  }
  
  // Check block count
  if (blocks && blocks.length > 15) {
    blocks = blocks.slice(0, 15);
    // Add truncation notice
  }
  
  // Validate button values
  if (blocks) {
    blocks.forEach(block => {
      if (block.type === 'actions') {
        block.elements.forEach(element => {
          if (element.type === 'button' && element.value) {
            if (element.value.length > 2000) {
              element.value = JSON.stringify({truncated: true});
            }
          }
        });
      }
    });
  }
  
  return { text, blocks };
}
```

### 2. Progressive Message Updates
**Pattern**: Start with simple messages, enhance with blocks if needed.

```javascript
// ✅ Progressive enhancement pattern
// 1. Send simple thinking message
const thinkingMessage = await client.chat.postMessage({
  channel: msg.channel,
  text: "🤔 Processing your request...",
  thread_ts: msg.ts
});

// 2. Process request
const result = await processRequest();

// 3. Update with result (text-first)
const updatePayload = {
  channel: msg.channel,
  ts: thinkingMessage.ts,
  text: result.answer
};

// 4. Add blocks only if safe
if (result.success && !result.timedOut && result.blocks) {
  updatePayload.blocks = result.blocks;
}

await client.chat.update(updatePayload);
```

### 3. Thread Context Management
**Problem**: Complex thread context can cause processing delays and timeouts.

**Solution**: Efficient context building:

```javascript
// ✅ Efficient thread context pattern
if (msg.thread_ts && msg.thread_ts !== msg.ts) {
  const threadHistory = await client.conversations.replies({
    channel: msg.channel,
    ts: msg.thread_ts,
    limit: 20 // Limit context size
  });
  
  // Build lightweight context
  const conversationHistory = threadHistory.messages
    .filter(m => !m.text.includes('🤔')) // Skip thinking messages
    .map(m => ({
      user: m.user,
      text: m.text.replace(/<@[A-Z0-9]+>/g, '').trim(),
      isBot: !!m.bot_id
    }))
    .slice(-10); // Keep only recent context
}
```

## Testing Patterns

### 1. Direct API Testing
**Use Case**: Test message content without full bot integration.

```javascript
// ✅ Direct testing pattern
// Test with MCP Slack server
await mcp__slack__slack_post_message({
  channel_id: "C0946T1T4CB",
  text: "Your exact message content here"
});

// Test updates
await mcp__slack__slack_post_message({
  channel_id: "C0946T1T4CB", 
  text: "Initial message"
});
// Note the timestamp, then test update
```

### 2. Component Isolation Testing
**Use Case**: Test business logic without Slack integration.

```javascript
// ✅ Isolation testing pattern
// Test agent directly
const agent = new ReactAgent();
const result = await agent.processMessage({
  text: "test query",
  userName: 'Test User'
});
console.log('Agent result:', result);
```

### 3. Timeout Testing
**Use Case**: Verify timeout handling works correctly.

```javascript
// ✅ Timeout testing pattern
// Temporarily reduce timeout for testing
const timeoutPromise = new Promise((resolve) => {
  setTimeout(() => {
    resolve({
      success: true,
      answer: 'Timeout test message',
      timedOut: true
    });
  }, 5000); // 5s for testing
});
```

## Common Pitfalls and Solutions

### 1. The "say" Parameter Trap
**Problem**: Using `say` parameter can cause automatic block formatting issues.

```javascript
// ❌ Avoid using say
app.event('app_mention', async ({ event, say, client }) => {
  await say("Hello"); // Can cause block formatting issues
});

// ✅ Use client directly
app.event('app_mention', async ({ event, client }) => {
  await client.chat.postMessage({
    channel: event.channel,
    text: "Hello"
  });
});
```

### 2. The Empty Blocks Array Issue
**Problem**: Empty blocks array `[]` can sometimes cause validation errors.

```javascript
// ❌ Risky: Always including blocks
const payload = {
  channel: msg.channel,
  ts: thinkingMessage.ts,
  text: responseText,
  blocks: [] // Can cause issues in some cases
};

// ✅ Safe: Conditional blocks
const payload = {
  channel: msg.channel,
  ts: thinkingMessage.ts,
  text: responseText
};

// Only add blocks if you have content
if (blocks && blocks.length > 0) {
  payload.blocks = blocks;
}
```

### 3. The Preview Mode Performance Issue
**Problem**: Preview mode can be slow for certain operations.

```javascript
// ❌ Always using preview mode
const result = await agent.processMessage(context, { preview: true });

// ✅ Conditional preview mode
const isSlowOperation = context.text.includes('notes');
const result = await agent.processMessage(context, { 
  preview: !isSlowOperation 
});
```

## Monitoring and Debugging

### 1. Essential Logging
**Pattern**: Log at key decision points:

```javascript
// ✅ Strategic logging pattern
console.log('🚀 handleMention START');
console.log('🔍 Is notes query?', isNotesQuery);
console.log('📤 Sending update to Slack:', JSON.stringify(payload, null, 2));
console.log('📏 Text length:', text.length);
console.log('✅ Update successful!');
```

### 2. Error Tracking
**Pattern**: Track error patterns:

```javascript
// ✅ Error tracking pattern
catch (error) {
  console.error('Error type:', error.constructor.name);
  console.error('Error message:', error.message);
  console.error('Error data:', error.data);
  console.error('Stack trace:', error.stack);
  
  // Track error patterns
  if (error.message.includes('invalid_blocks')) {
    console.error('INVALID_BLOCKS detected - check message structure');
  }
}
```

### 3. Performance Monitoring
**Pattern**: Track timing:

```javascript
// ✅ Performance monitoring pattern
const startTime = Date.now();
const result = await longRunningOperation();
const duration = Date.now() - startTime;

console.log(`Operation took ${duration}ms`);
if (duration > 20000) {
  console.warn('Operation approaching timeout threshold');
}
```

## Socket Mode vs HTTP Mode

### Socket Mode (Development)
- Real-time bidirectional communication
- ~30 second timeout
- Automatically handles reconnection
- Good for development and testing

### HTTP Mode (Production)
- Request-response pattern
- 3 second acknowledgment requirement
- More scalable for production
- Requires proper error handling

### Configuration Pattern
```javascript
// ✅ Environment-aware configuration
const isSocketMode = process.env.NODE_ENV === 'development' || process.env.SLACK_APP_TOKEN;

const appConfig = {
  token: process.env.SLACK_BOT_TOKEN,
  processBeforeResponse: true,
  extendedErrorHandler: false
};

if (isSocketMode) {
  appConfig.socketMode = true;
  appConfig.appToken = process.env.SLACK_APP_TOKEN;
} else {
  appConfig.receiver = receiver;
}
```

## Key Takeaways

1. **Always provide text fallback** - Blocks can fail, text rarely does
2. **Keep operations under 25 seconds** - Slack timeouts are unforgiving
3. **Never let errors bubble to Bolt** - Handle all errors explicitly
4. **Test with production-like data** - Edge cases matter
5. **Monitor timing patterns** - Consistent delays indicate timeout issues
6. **Use progressive enhancement** - Start simple, add complexity carefully

These patterns have been battle-tested in production and should help avoid common Slack integration pitfalls.