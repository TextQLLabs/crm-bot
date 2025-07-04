/**
 * Simple Cloudflare Worker for CRM Bot
 * Acts as a proxy to handle Slack webhooks
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }
    
    // Handle Slack events
    if (url.pathname === '/slack/events' && request.method === 'POST') {
      try {
        // Verify Slack signature
        const timestamp = request.headers.get('x-slack-request-timestamp');
        const signature = request.headers.get('x-slack-signature');
        const body = await request.text();
        
        if (!verifySlackSignature(timestamp, signature, body, env.SLACK_SIGNING_SECRET)) {
          return new Response('Unauthorized', { status: 401 });
        }
        
        const payload = JSON.parse(body);
        
        // Handle URL verification challenge
        if (payload.type === 'url_verification') {
          return new Response(payload.challenge, {
            headers: { 'Content-Type': 'text/plain' }
          });
        }
        
        // Process event asynchronously
        ctx.waitUntil(processSlackEvent(payload, env));
        
        // Return immediate response to Slack
        return new Response('', { status: 200 });
        
      } catch (error) {
        console.error('Error processing Slack event:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }
    
    // Handle Slack interactions (buttons)
    if (url.pathname === '/slack/interactive' && request.method === 'POST') {
      try {
        const formData = await request.formData();
        const payload = JSON.parse(formData.get('payload'));
        
        // Verify Slack signature
        const timestamp = request.headers.get('x-slack-request-timestamp');
        const signature = request.headers.get('x-slack-signature');
        const body = await request.text();
        
        if (!verifySlackSignature(timestamp, signature, body, env.SLACK_SIGNING_SECRET)) {
          return new Response('Unauthorized', { status: 401 });
        }
        
        // Process interaction asynchronously
        ctx.waitUntil(processSlackInteraction(payload, env));
        
        return new Response('', { status: 200 });
        
      } catch (error) {
        console.error('Error processing Slack interaction:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

function verifySlackSignature(timestamp, signature, body, signingSecret) {
  if (!timestamp || !signature) return false;
  
  // Check timestamp is within 5 minutes
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp) < fiveMinutesAgo) return false;
  
  // Calculate expected signature
  const sigBasestring = 'v0:' + timestamp + ':' + body;
  const crypto = globalThis.crypto;
  
  const encoder = new TextEncoder();
  const key = encoder.encode(signingSecret);
  const data = encoder.encode(sigBasestring);
  
  // Use Web Crypto API for HMAC
  return crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  ).then(cryptoKey => {
    return crypto.subtle.sign('HMAC', cryptoKey, data);
  }).then(signature => {
    const hash = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const mySignature = 'v0=' + hash;
    return mySignature === signature;
  }).catch(() => false);
}

async function processSlackEvent(payload, env) {
  // Forward to your actual bot endpoint or process here
  console.log('Processing Slack event:', payload.event?.type);
  
  // For now, just log the event
  // In production, you might forward this to another service
  // or process it directly using the Slack Web API
  
  if (payload.event?.type === 'app_mention' || 
      (payload.event?.type === 'message' && payload.event?.channel_type === 'im')) {
    // Handle mention or DM
    await sendSlackMessage(
      payload.event.channel,
      "I received your message! (This is a placeholder response from Cloudflare Worker)",
      env.SLACK_BOT_TOKEN
    );
  }
}

async function processSlackInteraction(payload, env) {
  console.log('Processing Slack interaction:', payload.type);
  
  // Handle button clicks
  if (payload.type === 'block_actions') {
    const action = payload.actions[0];
    
    if (action.action_id === 'approve_action' || action.action_id === 'cancel_action') {
      await updateSlackMessage(
        payload.channel.id,
        payload.message.ts,
        `Action ${action.action_id} received (placeholder)`,
        env.SLACK_BOT_TOKEN
      );
    }
  }
}

async function sendSlackMessage(channel, text, token) {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel,
      text
    })
  });
  
  return response.json();
}

async function updateSlackMessage(channel, ts, text, token) {
  const response = await fetch('https://slack.com/api/chat.update', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel,
      ts,
      text
    })
  });
  
  return response.json();
}