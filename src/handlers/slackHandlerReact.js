const { ReactAgent } = require('../services/reactAgent');
const axios = require('axios');

// Dynamic database service loading
let logInteraction;
try {
  // Try to load from main database service
  const db = require('../services/database');
  logInteraction = db.logInteraction;
} catch (error) {
  // Fallback to mock if main database fails
  const mockDb = require('../services/database-mock');
  logInteraction = mockDb.logInteraction;
}

async function handleMention({ event, message, say, client }) {
  console.log('🚀 handleMention START');
  try {
    const msg = event || message;
    const agent = new ReactAgent();
    
    // Debug: Log all Slack API calls
    console.log('🔍 handleMention called with:', {
      hasEvent: !!event,
      hasMessage: !!message,
      hasSay: !!say,
      hasClient: !!client,
      messageText: msg?.text?.substring(0, 50) + '...'
    });
    
    // IMPORTANT: Never use say() as it can cause block formatting issues
    if (say) {
      console.warn('⚠️ WARNING: say parameter was passed but should not be used!');
    }
    // Check if this is a threaded message
    let conversationHistory = [];
    let botActionHistory = []; // Hidden context of what bot has done
    let thinkingMessage;
    
    if (msg.thread_ts && msg.thread_ts !== msg.ts) {
      // This is a reply in a thread - get the conversation history
      console.log('Fetching thread history...');
      const threadHistory = await client.conversations.replies({
        channel: msg.channel,
        ts: msg.thread_ts,
        limit: 100
      });
      
      // Build conversation history including bot messages
      conversationHistory = threadHistory.messages
        .map(m => ({
          user: m.user,
          text: m.text.replace(/<@[A-Z0-9]+>/g, '').trim(),
          ts: m.ts,
          isBot: !!m.bot_id,
          botId: m.bot_id,
          blocks: m.blocks // Keep blocks to extract bot actions
        }));
      
      // Extract bot action history from previous interactions
      // Look for our specific bot messages that contain action results
      botActionHistory = threadHistory.messages
        .filter(m => m.bot_id && (
          m.text.includes('✅ Action executed successfully') ||
          m.text.includes('searched for') ||
          m.text.includes('created') ||
          m.text.includes('updated') ||
          m.blocks?.some(b => b.text?.text?.includes('Action Preview'))
        ))
        .map(m => {
          // Extract what action was taken
          if (m.text.includes('Note created successfully')) {
            return { action: 'created_note', details: m.text };
          } else if (m.text.includes('searched for')) {
            return { action: 'searched', details: m.text };
          } else if (m.blocks?.some(b => b.text?.text?.includes('Create a note on'))) {
            return { action: 'attempted_note_creation', details: 'User was shown note creation preview' };
          }
          return { action: 'unknown', details: m.text.substring(0, 100) };
        });
      
      // Send thinking message in thread
      thinkingMessage = await client.chat.postMessage({
        channel: msg.channel,
        text: "🤔 Processing your additional context...",
        thread_ts: msg.thread_ts
      });
    } else {
      // This is a new conversation
      conversationHistory = [{
        user: msg.user,
        text: msg.text.replace(/<@[A-Z0-9]+>/g, '').trim(),
        ts: msg.ts
      }];
      
      // Send initial thinking message
      console.log('📮 Sending initial thinking message...');
      const thinkingPayload = {
        channel: msg.channel,
        text: "🤔 Let me help you with that...",
        thread_ts: msg.ts
      };
      console.log('Thinking payload:', JSON.stringify(thinkingPayload, null, 2));
      thinkingMessage = await client.chat.postMessage(thinkingPayload);
      console.log('✅ Thinking message sent:', thinkingMessage.ts);
    }

    // Get user info
    const userInfo = await client.users.info({ user: msg.user });
    const userName = userInfo.user.real_name || userInfo.user.name;

    // Build full context from conversation history
    let fullContext = conversationHistory
      .map((m, index) => {
        if (index === 0) {
          // First message (original request)
          return `User: ${m.text}`;
        } else if (m.isBot) {
          // Bot response (visible to user)
          // Clean up bot responses to just show key information
          let cleanText = m.text;
          if (cleanText.includes('🤔 Let me help') || cleanText.includes('🤔 Processing')) {
            return null; // Skip thinking messages
          }
          return `Assistant: ${cleanText}`;
        } else {
          // User follow-up
          return `User: ${m.text}`;
        }
      })
      .filter(Boolean) // Remove null entries
      .join('\n\n');
    
    // Add hidden context about what the bot has already done
    if (botActionHistory.length > 0) {
      fullContext += '\n\n[Hidden context - previous bot actions in this conversation:\n';
      botActionHistory.forEach(action => {
        fullContext += `- ${action.action}: ${action.details}\n`;
      });
      fullContext += 'Remember: The user cannot see this hidden context. Only reference these actions if relevant to the current request.]';
    }
    
    // Get any file attachments and download them
    const attachments = [];
    if (msg.files && msg.files.length > 0) {
      console.log(`Processing ${msg.files.length} file attachments...`);
      
      for (const file of msg.files) {
        if (file.mimetype && file.mimetype.startsWith('image/')) {
          try {
            // For testing, check if we have test data
            if (msg._testImageData) {
              attachments.push({
                type: 'image',
                mime_type: file.mimetype,  // Changed from mimetype to mime_type
                filename: file.name,       // Changed from name to filename
                data: msg._testImageData
              });
            } else {
              // In production, download the file from Slack
              console.log(`Downloading image: ${file.name}`);
              const response = await axios.get(file.url_private_download, {
                headers: {
                  'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
                },
                responseType: 'arraybuffer'
              });
              
              const base64Data = Buffer.from(response.data).toString('base64');
              
              attachments.push({
                type: 'image',
                mime_type: file.mimetype,  // Changed from mimetype to mime_type
                filename: file.name,       // Changed from name to filename
                data: base64Data
              });
              console.log(`Successfully downloaded ${file.name}`);
            }
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
          }
        }
      }
    }

    // Remove the bypass - let's fix the actual issue
    
    // Process with ReAct agent in preview mode first
    console.log('\n=== Starting ReAct Agent (Preview Mode) ===');
    console.log('Full context:', fullContext);
    console.log('Attachments:', attachments.length);
    
    // Add a timeout to prevent hanging
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: false,
          error: 'Request timed out after 45 seconds'
        });
      }, 45000); // 45 second timeout
    });
    
    const agentPromise = agent.processMessage({
      text: fullContext,
      userName,
      userId: msg.user,
      channel: msg.channel,
      attachments,
      isThreaded: msg.thread_ts && msg.thread_ts !== msg.ts,
      threadTs: msg.thread_ts || msg.ts,
      messageTs: msg.ts,
      conversationHistory,
      botActionHistory
    }, { preview: true });
    
    // Race between agent and timeout
    const result = await Promise.race([agentPromise, timeoutPromise]);

    // Check if we have a pending action to approve
    if (result.preview && result.pendingAction) {
      // Format the pending action for user approval
      const preview = formatActionPreview(result.pendingAction);
      
      // Create blocks for the message
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🔍 Action Preview',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: preview.humanReadable
          }
        }
      ];
      
      // Add reasoning if it's different from the action description
      if (preview.thought && !preview.humanReadable.includes(preview.thought)) {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `💭 *Why:* ${preview.thought}`
            }
          ]
        });
      }
      
      // Add collapsible technical details
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🔧 *Technical Details*'
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Show JSON',
            emoji: true
          },
          action_id: 'show_technical_details',
          value: JSON.stringify(preview.apiPreview)
        }
      });
      
      // Add action buttons
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '✅ Approve & Execute',
              emoji: true
            },
            style: 'primary',
            action_id: 'approve_action',
            value: JSON.stringify({
              originalMessage: msg,
              pendingAction: result.pendingAction,
              context: { 
                text: fullContext, 
                userName, 
                channel: msg.channel, 
                attachments,
                threadTs: msg.thread_ts || msg.ts
              }
            })
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '❌ Cancel',
              emoji: true
            },
            style: 'danger',
            action_id: 'cancel_action'
          }
        ]
      });
      
      // Update thinking message with preview
      await client.chat.update({
        channel: msg.channel,
        ts: thinkingMessage.ts,
        text: preview.humanReadable.replace(/\*/g, ''), // Fallback text without markdown
        blocks: blocks
      });
      
      return; // Wait for user approval
    }

    // Log interaction
    await logInteraction({
      userId: msg.user,
      userName,
      message: fullContext,
      action: 'react_agent',
      result: result,
      timestamp: new Date(),
      threadTs: msg.thread_ts || msg.ts,
      isThreaded: msg.thread_ts && msg.thread_ts !== msg.ts
    });

    // Format and send response
    if (result.success) {
      try {
        // Simple response handling
        const responseText = result.answer || 'Task completed successfully!';
        
        // Always use simple text-only update
        const updatePayload = {
          channel: msg.channel,
          ts: thinkingMessage.ts,
          text: responseText
        };
        
        console.log('📤 Sending update to Slack:', JSON.stringify(updatePayload, null, 2));
        console.log('📏 Text length:', responseText.length);
        console.log('🔍 Contains **?', responseText.includes('**'));
        console.log('🔍 Has blocks?', !!updatePayload.blocks);
        
        await client.chat.update(updatePayload);
      } catch (updateError) {
        console.error('Error updating message:', updateError);
        
        // Fallback: post a new message
        try {
          await client.chat.postMessage({
            channel: msg.channel,
            thread_ts: msg.thread_ts || msg.ts,
            text: result.answer || 'Task completed'
          });
        } catch (fallbackError) {
          console.error('Error posting fallback message:', fallbackError);
        }
      }

    } else {
      await client.chat.update({
        channel: msg.channel,
        ts: thinkingMessage.ts,
        text: `❌ I encountered an issue: ${result.error}\n\nPlease try rephrasing your request or contact support if this persists.`
      });
    }

  } catch (error) {
    console.error('Error in ReAct handler:', error);
    console.error('Error stack:', error.stack);
    
    try {
      // Try to update the thinking message with the error
      if (thinkingMessage && thinkingMessage.ts) {
        await client.chat.update({
          channel: msg.channel,
          ts: thinkingMessage.ts,
          text: `❌ I encountered an issue processing your request. Please try again.`
        });
      } else {
        // If no thinking message, post a new message
        await client.chat.postMessage({
          channel: msg.channel,
          text: `❌ I encountered an issue processing your request. Please try again.`,
          thread_ts: msg.thread_ts || msg.ts
        });
      }
    } catch (errorMessageError) {
      console.error('Failed to send error message:', errorMessageError);
      // Silently fail - don't let any error bubble up to Bolt
    }
  }
}

// Removed formatSuccessMessage - no longer needed with simple text responses

function formatReasoningSteps(steps) {
  let message = '🧠 Here\'s how I processed your request:\n\n';
  
  steps.forEach((step, i) => {
    if (step.thought) {
      message += `**Step ${i + 1}**: ${step.thought}\n`;
      
      if (step.action) {
        message += `   → Action: \`${step.action}\`\n`;
        
        if (step.observation) {
          const obs = typeof step.observation === 'object' 
            ? JSON.stringify(step.observation, null, 2) 
            : step.observation;
          
          // Truncate long observations
          const maxLength = 200;
          const displayObs = obs.length > maxLength 
            ? obs.substring(0, maxLength) + '...' 
            : obs;
            
          message += `   → Result: ${displayObs}\n`;
        }
      }
      message += '\n';
    }
  });

  return message;
}

function formatActionPreview(pendingAction) {
  // Build human-readable preview based on action type
  let humanReadable = '';
  
  switch (pendingAction.action) {
    case 'create_note':
      // Get entity name from the thought or use generic
      const entityMatch = pendingAction.thought.match(/(deal|company|person)\s+(?:named\s+|called\s+|")?([^"]+?)(?:"|\.|,|$)/i);
      const entityName = entityMatch ? entityMatch[2] : `${pendingAction.input.entity_type} ${pendingAction.input.entity_id}`;
      
      humanReadable = `📝 **Create a note on**: ${entityName}\n\n`;
      humanReadable += `**Note content:**\n> ${pendingAction.input.note_content || pendingAction.input.note}\n\n`;
      humanReadable += `**Will be added to**: ${pendingAction.input.entity_type} record`;
      break;
      
    case 'create_entity':
      const entityData = pendingAction.input.data;
      const name = entityData.name?.[0]?.value || 'New Record';
      humanReadable = `➕ **Create new ${pendingAction.input.entity_type}**: ${name}\n\n`;
      
      // Show key fields
      if (entityData.description) {
        humanReadable += `**Description**: ${entityData.description[0].value}\n`;
      }
      if (entityData.domains) {
        humanReadable += `**Domain**: ${entityData.domains[0].domain}\n`;
      }
      break;
      
    case 'update_entity':
      humanReadable = `✏️ **Update ${pendingAction.input.entity_type}** (ID: ${pendingAction.input.entity_id})\n\n`;
      humanReadable += '**Changes to make:**\n';
      
      const updates = pendingAction.input.updates;
      Object.entries(updates).forEach(([field, value]) => {
        humanReadable += `• ${field}: ${JSON.stringify(value)}\n`;
      });
      break;
      
    case 'delete_note':
      // Extract note details from the thought or observation
      const noteInfo = pendingAction.noteDetails || {};
      humanReadable = `🗑️ **Delete Note**\n\n`;
      
      if (noteInfo.title || noteInfo.parentName) {
        humanReadable += `📄 **Note**: "${noteInfo.title || 'Untitled'}"\n`;
        humanReadable += `📍 **On**: ${noteInfo.parentType || 'record'} "${noteInfo.parentName || 'Unknown'}"\n`;
        if (noteInfo.content) {
          humanReadable += `📝 **Preview**: ${noteInfo.content.substring(0, 100)}${noteInfo.content.length > 100 ? '...' : ''}\n`;
        }
        if (noteInfo.parentUrl) {
          humanReadable += `\n🔗 **View record**: ${noteInfo.parentUrl}\n`;
        }
      } else {
        // Fallback if we don't have note details
        humanReadable += `📄 **Note ID**: ${pendingAction.input.note_id}\n`;
        humanReadable += `\n⚠️ **Warning**: This will permanently delete the note. This action cannot be undone.\n`;
      }
      
      humanReadable += `\n💡 **Tip**: To delete multiple notes, please request them one at a time.`;
      break;
      
    default:
      humanReadable = `⚡ **Action**: ${pendingAction.action}\n`;
      humanReadable += `**Details**: ${JSON.stringify(pendingAction.input, null, 2)}`;
  }
  
  // Build the actual API request for technical details
  let apiPreview = {};
  
  switch (pendingAction.action) {
    case 'create_note':
      apiPreview = {
        method: 'POST',
        endpoint: '/notes',
        data: {
          data: {
            parent_object: `${pendingAction.input.entity_type}s`,
            parent_record_id: pendingAction.input.entity_id,
            title: 'Note from Slack',
            content: pendingAction.input.note_content || pendingAction.input.note,
            format: 'plaintext',
            created_by_actor: {
              type: 'api-token'
            }
          }
        }
      };
      break;
      
    case 'create_entity':
      apiPreview = {
        method: 'POST',
        endpoint: `/objects/${pendingAction.input.entity_type}s/records`,
        data: {
          values: pendingAction.input.data
        }
      };
      break;
      
    case 'update_entity':
      apiPreview = {
        method: 'PATCH',
        endpoint: `/objects/${pendingAction.input.entity_type}s/records/${pendingAction.input.entity_id}`,
        data: {
          values: pendingAction.input.updates
        }
      };
      break;
  }
  
  return {
    humanReadable,
    apiPreview,
    thought: pendingAction.thought
  };
}

// Handle button actions
async function handleButtonAction({ body, ack, client }) {
  await ack();
  
  const actionId = body.actions[0].action_id;
  const value = body.actions[0].value;
  
  if (actionId === 'show_technical_details') {
    // Show the JSON in a modal
    const apiPreview = JSON.parse(value);
    
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        title: {
          type: 'plain_text',
          text: 'Technical Details'
        },
        close: {
          type: 'plain_text',
          text: 'Close'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '```json\n' + JSON.stringify(apiPreview, null, 2) + '\n```'
            }
          }
        ]
      }
    });
    return;
  }

  // Removed show_search_details handler - no longer needed with simple text responses
  
  if (actionId === 'cancel_action') {
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: '❌ Action cancelled by user.',
      blocks: []
    });
    return;
  }
  
  if (actionId === 'approve_action') {
    const { originalMessage, pendingAction, context } = JSON.parse(value);
    
    // Update message to show execution in progress
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: '⏳ Executing approved action...',
      blocks: []
    });
    
    // Execute the pending action
    const agent = new ReactAgent();
    try {
      const result = await agent.executeAction(pendingAction.action, pendingAction.input);
      
      // Format success message with clear indication of what was done
      let successMsg = '✅ Action executed successfully!\n\n';
      
      // Make the action description very clear for future context
      switch (pendingAction.action) {
        case 'create_note':
          successMsg += `📝 **Created note on ${pendingAction.input.entity_type}**\n`;
          successMsg += `Content: "${pendingAction.input.note_content || pendingAction.input.note}"\n`;
          break;
        case 'create_entity':
          successMsg += `➕ **Created new ${pendingAction.input.entity_type}**\n`;
          break;
        case 'update_entity':
          successMsg += `✏️ **Updated ${pendingAction.input.entity_type}**\n`;
          break;
        case 'delete_note':
          successMsg += `🗑️ **Deleted note successfully**\n`;
          if (pendingAction.noteDetails) {
            successMsg += `Note: "${pendingAction.noteDetails.title || 'Untitled'}"\n`;
            successMsg += `From: ${pendingAction.noteDetails.parentType} "${pendingAction.noteDetails.parentName}"\n`;
          }
          break;
        default:
          successMsg += `**Action**: ${pendingAction.action}\n`;
      }
      
      if (result.url) {
        successMsg += `\n🔗 **View in Attio**: ${result.url}`;
      }
      
      if (result.message) {
        successMsg += `\n\n${result.message}`;
      }
      
      // Log the successful action for future context
      await logInteraction({
        userId: originalMessage.user,
        userName: context.userName,
        message: `Executed action: ${pendingAction.action}`,
        action: 'action_executed',
        result: {
          action: pendingAction.action,
          input: pendingAction.input,
          output: result
        },
        timestamp: new Date(),
        threadTs: context.threadTs
      });
      
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: successMsg
      });
      
    } catch (error) {
      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: `❌ Error executing action: ${error.message}`
      });
    }
  }
}

module.exports = { handleMention, handleButtonAction };