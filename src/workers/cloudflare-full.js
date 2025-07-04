/**
 * Full Cloudflare Worker for CRM Bot
 * Runs entirely on Cloudflare without local dependencies
 */

// Import the Worker-compatible ReactAgent
import { ReactAgentWorker } from '../services/reactAgent-worker.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Health check
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }
    
    // Handle Slack events
    if (url.pathname === '/slack/events' && request.method === 'POST') {
      const timestamp = request.headers.get('x-slack-request-timestamp');
      const signature = request.headers.get('x-slack-signature');
      const body = await request.text();
      
      // Verify Slack signature
      const isValid = await verifySlackRequest(
        timestamp,
        signature,
        body,
        env.SLACK_SIGNING_SECRET
      );
      
      if (!isValid) {
        return new Response('Unauthorized', { status: 401 });
      }
      
      const payload = JSON.parse(body);
      
      // URL verification
      if (payload.type === 'url_verification') {
        return new Response(payload.challenge, {
          headers: { 'Content-Type': 'text/plain' }
        });
      }
      
      // Process events asynchronously
      ctx.waitUntil(handleSlackEvent(payload, env));
      
      return new Response('', { status: 200 });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

async function verifySlackRequest(timestamp, signature, body, signingSecret) {
  if (!timestamp || !signature) return false;
  
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp) < fiveMinutesAgo) return false;
  
  const sigBasestring = `v0:${timestamp}:${body}`;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature_buffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(sigBasestring)
  );
  
  const computed_signature = 'v0=' + Array.from(new Uint8Array(signature_buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return computed_signature === signature;
}

async function handleSlackEvent(payload, env) {
  if (!payload.event) return;
  
  const event = payload.event;
  
  // Handle app mentions and DMs
  if (event.type === 'app_mention' || 
      (event.type === 'message' && event.channel_type === 'im')) {
    
    // Get conversation history if in thread
    let context = event.text;
    if (event.thread_ts) {
      const history = await getThreadHistory(
        event.channel,
        event.thread_ts,
        env.SLACK_BOT_TOKEN
      );
      context = formatConversationContext(history, event);
    }
    
    // Process with ReAct agent
    const agent = createReactAgent(env);
    const result = await agent.processMessage({
      text: context,
      userName: await getUserName(event.user, env.SLACK_BOT_TOKEN),
      channel: event.channel,
      threadTs: event.thread_ts || event.ts
    });
    
    // Send response
    if (result.preview && result.pendingAction) {
      await sendActionPreview(
        event.channel,
        event.thread_ts || event.ts,
        result.pendingAction,
        env.SLACK_BOT_TOKEN
      );
    } else if (result.answer) {
      await sendMessage(
        event.channel,
        result.answer,
        event.thread_ts || event.ts,
        env.SLACK_BOT_TOKEN
      );
    }
  }
}

// Slack API helpers
async function sendMessage(channel, text, threadTs, token) {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel,
      text,
      thread_ts: threadTs
    })
  });
  
  return response.json();
}

async function sendActionPreview(channel, threadTs, action, token) {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: formatActionPreview(action)
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Approve'
          },
          style: 'primary',
          action_id: 'approve_action',
          value: JSON.stringify(action)
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Cancel'
          },
          style: 'danger',
          action_id: 'cancel_action'
        }
      ]
    }
  ];
  
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel,
      blocks,
      thread_ts: threadTs
    })
  });
  
  return response.json();
}

async function getThreadHistory(channel, threadTs, token) {
  const response = await fetch(
    `https://slack.com/api/conversations.replies?channel=${channel}&ts=${threadTs}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const data = await response.json();
  return data.messages || [];
}

async function getUserName(userId, token) {
  const response = await fetch(
    `https://slack.com/api/users.info?user=${userId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const data = await response.json();
  return data.user?.real_name || data.user?.name || 'Unknown';
}

function formatConversationContext(messages, currentMessage) {
  return messages
    .map(m => `${m.user}: ${m.text}`)
    .join('\n\n');
}

function formatActionPreview(action) {
  let text = '📋 **Action Preview**\n\n';
  
  switch (action.action) {
    case 'create_note':
      text += `📝 Create note on ${action.input.entity_type}\n`;
      text += `Content: "${action.input.note_content}"`;
      break;
    default:
      text += `Action: ${action.action}\n`;
      text += `Details: ${JSON.stringify(action.input, null, 2)}`;
  }
  
  return text;
}

// Create ReactAgent instance
function createReactAgent(env) {
  return new ReactAgentWorker(env);
}