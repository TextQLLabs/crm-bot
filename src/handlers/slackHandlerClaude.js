const { ClaudeAgent } = require('../services/claudeAgent');
const axios = require('axios');

// File-based logging for interactions
const mockDb = require('../services/database-mock');
const logInteraction = mockDb.logInteraction;

async function handleMention({ event, message, say, client }) {
  console.log('🚀 handleMention START (Claude Agent)');
  try {
    const msg = event || message;
    const agent = new ClaudeAgent();
    
    console.log('🔍 handleMention called with:', {
      hasEvent: !!event,
      hasMessage: !!message,
      hasSay: !!say,
      hasClient: !!client,
      messageText: msg?.text?.substring(0, 50) + '...'
    });
    
    // Check if this is a threaded message
    let conversationHistory = [];
    let botActionHistory = [];
    let thinkingMessage;
    let isNotesQuery = false;
    
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
          blocks: m.blocks
        }));
      
      // Extract bot action history from previous interactions
      botActionHistory = threadHistory.messages
        .filter(m => m.bot_id && (
          m.text.includes('✅ Action executed successfully') ||
          m.text.includes('searched for') ||
          m.text.includes('created') ||
          m.text.includes('updated') ||
          m.blocks?.some(b => b.text?.text?.includes('Action Preview'))
        ))
        .map(m => {
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
        text: ":cat-roomba-exceptionally-fast: Processing your request...",
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
        text: ":cat-roomba-exceptionally-fast: Processing your request...",
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
          return `User: ${m.text}`;
        } else if (m.isBot) {
          let cleanText = m.text;
          if (cleanText.includes('🤔 Let me help') || cleanText.includes('🤔 Processing')) {
            return null;
          }
          return `Assistant: ${cleanText}`;
        } else {
          return `User: ${m.text}`;
        }
      })
      .filter(Boolean)
      .join('\n\n');
    
    // Add hidden context about what the bot has already done
    if (botActionHistory.length > 0) {
      fullContext += '\n\n[Hidden context - previous bot actions in this conversation:\n';
      botActionHistory.forEach(action => {
        fullContext += `- ${action.action}: ${action.details}\n`;
      });
      fullContext += 'Remember: The user cannot see this hidden context. Only reference these actions if relevant to the current request.]';
    }
    
    // Get any file attachments and canvas content
    const attachments = [];
    let canvasContent = '';
    
    if (msg.files && msg.files.length > 0) {
      console.log(`Processing ${msg.files.length} file attachments...`);
      console.log('File details:', msg.files.map(f => ({ name: f.name, mimetype: f.mimetype, size: f.size, subtype: f.subtype })));
      
      for (const file of msg.files) {
        // Check if this is a canvas file
        if (file.mimetype === 'application/vnd.slack-docs' || file.subtype === 'canvas') {
          console.log('Canvas detected in message:', file.name || 'Untitled Canvas');
          try {
            // Fetch canvas content using files.info API
            const canvasInfo = await client.files.info({
              file: file.id
            });
            
            if (canvasInfo.file.document_content && canvasInfo.file.document_content.markdown) {
              canvasContent += `\n\n[Canvas Content: ${file.name || 'Untitled Canvas'}]\n${canvasInfo.file.document_content.markdown}\n[End Canvas Content]\n`;
              console.log(`Canvas content retrieved, length: ${canvasInfo.file.document_content.markdown.length}`);
            } else {
              console.log('Canvas found but no markdown content available');
              canvasContent += `\n\n[Canvas: ${file.name || 'Untitled Canvas'} - content not accessible]\n`;
            }
          } catch (error) {
            console.error('Error fetching canvas content:', error);
            canvasContent += `\n\n[Canvas: ${file.name || 'Untitled Canvas'} - error accessing content: ${error.message}]\n`;
          }
        }
        // Handle image files as before
        if (file.mimetype && file.mimetype.startsWith('image/')) {
          try {
            if (msg._testImageData) {
              attachments.push({
                type: 'image',
                mime_type: file.mimetype,
                filename: file.name,
                data: msg._testImageData
              });
            } else {
              console.log(`Downloading image: ${file.name}, URL: ${file.url_private_download}`);
              console.log(`Using bot token: ${process.env.SLACK_BOT_TOKEN?.substring(0, 20)}...`);
              
              const response = await axios.get(file.url_private_download, {
                headers: {
                  'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
                },
                responseType: 'arraybuffer'
              });
              
              const base64Data = Buffer.from(response.data).toString('base64');
              console.log(`Downloaded ${file.name}, size: ${response.data.byteLength} bytes, base64 length: ${base64Data.length}`);
              
              // Debug: Check if base64 starts with valid image signature
              const base64Start = base64Data.substring(0, 50);
              console.log(`Base64 starts with: ${base64Start}`);
              
              // Validate base64 encoding
              try {
                Buffer.from(base64Data, 'base64');
                console.log('✅ Base64 encoding is valid');
              } catch (e) {
                console.error('❌ Base64 encoding is invalid:', e.message);
              }
              
              attachments.push({
                type: 'image',
                mime_type: file.mimetype,
                filename: file.name,
                data: base64Data
              });
              console.log(`Successfully processed ${file.name}`);
            }
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            console.error('Error details:', error.response?.status, error.response?.statusText);
          }
        } else {
          console.log(`Skipping non-image file: ${file.name} (${file.mimetype})`);
        }
      }
    }

    // Add canvas content to full context if present
    if (canvasContent) {
      fullContext += canvasContent;
      console.log('🎨 Canvas content added to context');
    }
    
    // Check if this is a read-only notes query (like "get notes" or "show notes")
    // Note creation requests should still use preview mode for safety
    const isReadOnlyNotesQuery = fullContext.toLowerCase().includes('get notes') || 
                                fullContext.toLowerCase().includes('show notes') ||
                                fullContext.toLowerCase().includes('list notes') ||
                                (fullContext.toLowerCase().includes('notes') && !fullContext.toLowerCase().includes('add'));
    console.log('🔍 Is read-only notes query?', isReadOnlyNotesQuery);
    
    // Process with Claude agent
    console.log('\n=== Starting Claude Agent ===');
    console.log('Full context:', fullContext);
    console.log('Attachments:', attachments.length);
    console.log('Canvas content included:', !!canvasContent);
    
    const result = await agent.processMessage({
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
    }, { preview: !isReadOnlyNotesQuery });

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
        text: preview.humanReadable.replace(/\*/g, ''),
        blocks: blocks
      });
      
      return;
    }

    // Log interaction
    await logInteraction({
      userId: msg.user,
      userName,
      message: fullContext,
      action: 'claude_agent',
      result: result,
      timestamp: new Date(),
      threadTs: msg.thread_ts || msg.ts,
      isThreaded: msg.thread_ts && msg.thread_ts !== msg.ts
    });

    // Format and send response
    if (result.success) {
      try {
        const responseText = result.answer || 'Task completed successfully!';
        
        const updatePayload = {
          channel: msg.channel,
          ts: thinkingMessage.ts,
          text: responseText
        };
        
        if (!isNotesQuery) {
          updatePayload.blocks = [];
        }
        
        console.log('📤 Sending update to Slack:', JSON.stringify(updatePayload, null, 2));
        
        await client.chat.update(updatePayload);
        console.log('✅ Update successful!');
      } catch (updateError) {
        console.error('❌ Error updating message:', updateError);
        
        // Check if error is due to message being too long
        if (updateError.code === 'slack_webapi_platform_error' && updateError.data?.error === 'msg_too_long') {
          console.log('Message too long, creating truncated version...');
          
          // Create a truncated version of the response
          const originalText = result.answer || 'Task completed';
          const maxLength = 3000; // Conservative limit for Slack messages
          const truncatedText = originalText.length > maxLength 
            ? originalText.substring(0, maxLength) + '\n\n... (truncated due to length)\n\n📄 **Full response was too long for Slack.** Consider asking for specific sections or using fewer filters.'
            : originalText;
          
          try {
            await client.chat.update({
              channel: msg.channel,
              ts: thinkingMessage.ts,
              text: truncatedText,
              blocks: [] // Remove blocks to save space
            });
            console.log('✅ Truncated update successful!');
          } catch (truncatedError) {
            console.error('❌ Truncated update also failed:', truncatedError);
            // Final fallback: simple error message
            try {
              await client.chat.update({
                channel: msg.channel,
                ts: thinkingMessage.ts,
                text: '❌ Response was too long for Slack. Please try asking for a specific part of the information or use fewer search results.'
              });
            } catch (finalError) {
              console.error('❌ Final fallback failed:', finalError);
            }
          }
        } else {
          // Other errors - use original fallback
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
      }
    } else {
      // Handle error case
      try {
        await client.chat.update({
          channel: msg.channel,
          ts: thinkingMessage.ts,
          text: `❌ I encountered an issue: ${result.error}\n\nPlease try rephrasing your request or contact support if this persists.`
        });
      } catch (errorUpdateError) {
        console.error('Error updating message with error:', errorUpdateError);
        try {
          await client.chat.postMessage({
            channel: msg.channel,
            thread_ts: msg.thread_ts || msg.ts,
            text: `❌ ${result.error}`
          });
        } catch (errorPostError) {
          console.error('Error posting error message:', errorPostError);
        }
      }
    }

  } catch (error) {
    console.error('Error in Claude handler:', error);
    console.error('Error stack:', error.stack);
    
    try {
      if (thinkingMessage && thinkingMessage.ts) {
        await client.chat.update({
          channel: msg.channel,
          ts: thinkingMessage.ts,
          text: `❌ I encountered an issue processing your request. Please try again.`
        });
      } else {
        await client.chat.postMessage({
          channel: msg.channel,
          text: `❌ I encountered an issue processing your request. Please try again.`,
          thread_ts: msg.thread_ts || msg.ts
        });
      }
    } catch (errorMessageError) {
      console.error('Failed to send error message:', errorMessageError);
    }
  }
}

function formatActionPreview(pendingAction) {
  let humanReadable = '';
  
  switch (pendingAction.action) {
    case 'create_note':
      const entityName = pendingAction.input.entity_id;
      humanReadable = `📝 **Create a note on**: ${pendingAction.input.entity_type} ${entityName}\n\n`;
      humanReadable += `**Note content:**\n> ${pendingAction.input.note_content}\n\n`;
      humanReadable += `**Will be added to**: ${pendingAction.input.entity_type} record`;
      break;
      
    case 'create_entity':
      const entityData = pendingAction.input.data;
      const name = entityData.name?.[0]?.value || 'New Record';
      humanReadable = `➕ **Create new ${pendingAction.input.entity_type}**: ${name}\n\n`;
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
      humanReadable = `🗑️ **Delete Note**\n\n`;
      humanReadable += `📄 **Note ID**: ${pendingAction.input.note_id}\n`;
      humanReadable += `\n⚠️ **Warning**: This will permanently delete the note. This action cannot be undone.\n`;
      break;
      
    default:
      humanReadable = `⚡ **Action**: ${pendingAction.action}\n`;
      humanReadable += `**Details**: ${JSON.stringify(pendingAction.input, null, 2)}`;
  }
  
  return {
    humanReadable,
    apiPreview: pendingAction.input
  };
}

// Handle button actions
async function handleButtonAction({ body, ack, client }) {
  await ack();
  
  const actionId = body.actions[0].action_id;
  const value = body.actions[0].value;
  
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
      text: ':cat-roomba-exceptionally-fast: Executing approved action...',
      blocks: []
    });
    
    // Execute the pending action
    const agent = new ClaudeAgent();
    try {
      const result = await agent.executeAction(pendingAction.action, pendingAction.input);
      
      // Format success message
      let successMsg = '✅ Action executed successfully!\n\n';
      
      switch (pendingAction.action) {
        case 'create_note':
          successMsg += `📝 **Created note on ${pendingAction.input.entity_type}**\n`;
          successMsg += `Content: "${pendingAction.input.note_content}"\n`;
          break;
        case 'create_entity':
          successMsg += `➕ **Created new ${pendingAction.input.entity_type}**\n`;
          break;
        case 'update_entity':
          successMsg += `✏️ **Updated ${pendingAction.input.entity_type}**\n`;
          break;
        case 'delete_note':
          successMsg += `🗑️ **Deleted note successfully**\n`;
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
      
      // Log the successful action
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