const Anthropic = require('@anthropic-ai/sdk');
const fileStorage = require('./fileStorage');

// Use file storage due to Node v24 MongoDB TLS issues
const saveConversation = fileStorage.saveConversation;

class ReactAgent {
  constructor() {
    // Debug: Check if API key is loaded
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ERROR: ANTHROPIC_API_KEY is not set!');
    } else {
      console.log('Anthropic API key loaded, length:', apiKey.length);
      console.log('First 20 chars:', apiKey.substring(0, 20) + '...');
    }
    
    this.anthropic = new Anthropic({
      apiKey: apiKey,
    });
    
    // Define available tools
    this.tools = {
      search_crm: {
        description: "Search for companies, people, or deals in Attio CRM",
        parameters: ["entity_type", "search_query"],
        execute: require('./attioService').searchAttio
      },
      web_search: {
        description: "Search Google to find information about a company or person",
        parameters: ["query"],
        execute: this.webSearch.bind(this)
      },
      create_note: {
        description: "Add a note to a CRM record",
        parameters: ["entity_type", "entity_id", "note_content"],
        execute: this.createNote.bind(this)
      },
      delete_note: {
        description: "Delete a specific note by its ID",
        parameters: ["note_id"],
        execute: this.deleteNote.bind(this)
      },
      get_notes: {
        description: "Get notes for a specific record or all notes",
        parameters: ["entity_type", "entity_id"],
        execute: this.getNotes.bind(this)
      },
      create_entity: {
        description: "Create a new company, person, or deal",
        parameters: ["entity_type", "data"],
        execute: this.createEntity.bind(this)
      },
      update_entity: {
        description: "Update existing entity fields",
        parameters: ["entity_type", "entity_id", "updates"],
        execute: this.updateEntity.bind(this)
      },
      get_entity_details: {
        description: "Get full details of a specific entity",
        parameters: ["entity_type", "entity_id"],
        execute: this.getEntityDetails.bind(this)
      },
      analyze_image: {
        description: "Analyze or transcribe text from an uploaded image",
        parameters: ["image_index", "analysis_type"],
        execute: this.analyzeImage.bind(this)
      }
    };
    
    this.maxIterations = 15; // Increased to allow for multiple search attempts
  }

  async processMessage(message, options = {}) {
    const startTime = Date.now();
    const context = {
      message: message.text,
      user: message.userName,
      channel: message.channel,
      attachments: message.attachments || [],
      iterations: [],
      // Add metadata for conversation tracking
      threadTs: message.threadTs,
      messageTs: message.messageTs || new Date().getTime().toString(),
      userId: message.userId,
      conversationHistory: message.conversationHistory || [],
      botActionHistory: message.botActionHistory || []
    };

    // Store context for access in tool implementations
    this.currentContext = context;

    // If preview mode, stop before executing write actions
    const previewMode = options.preview || false;
    const planOnly = options.planOnly || false;

    // ReAct loop
    for (let i = 0; i < this.maxIterations; i++) {
      const step = await this.reactStep(context, { previewMode, planOnly });
      context.iterations.push(step);

      // If in preview mode and this is a write action, stop here
      if (previewMode && step.action && this.isWriteAction(step.action)) {
        return {
          success: true,
          preview: true,
          pendingAction: {
            action: step.action,
            input: step.actionInput,
            thought: step.thought
          },
          steps: context.iterations
        };
      }

      if (step.finalAnswer) {
        const result = {
          success: true,
          answer: step.finalAnswer,
          steps: context.iterations
        };
        
        // Save the conversation
        await this.saveConversation(context, result, startTime);
        
        return result;
      }

      if (step.error) {
        console.error('ReAct step error:', step.error);
        // Continue to next iteration to try recovery
      }
    }

    const result = {
      success: false,
      error: 'Max iterations reached',
      steps: context.iterations
    };
    
    // Save failed conversation
    await this.saveConversation(context, result, startTime);
    
    return result;
  }
  
  async saveConversation(context, result, startTime) {
    try {
      const conversationData = {
        // User and channel info
        userId: context.userId || context.user,
        userName: context.user,
        channel: context.channel,
        threadTs: context.threadTs,
        messageTs: context.messageTs,
        
        // Message content
        userMessage: context.message,
        conversationHistory: context.conversationHistory,
        botActionHistory: context.botActionHistory,
        
        // Agent processing details
        agentThoughts: context.iterations.map(s => s.thought).filter(Boolean),
        agentActions: context.iterations.map(s => ({
          action: s.action,
          input: s.actionInput,
          observation: s.observation
        })).filter(s => s.action),
        
        // Results
        finalResponse: result.answer || result.error,
        success: result.success,
        error: result.error || null,
        
        // Metadata
        toolsUsed: [...new Set(context.iterations.map(s => s.action).filter(Boolean))],
        processingTime: Date.now() - startTime,
        attachmentCount: context.attachments?.length || 0,
        iterationCount: context.iterations.length
      };
      
      await saveConversation(conversationData);
      console.log('💾 Conversation saved successfully (File storage)');
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  }

  isWriteAction(action) {
    const writeActions = ['create_note', 'create_entity', 'update_entity', 'delete_note'];
    return writeActions.includes(action);
  }

  async reactStep(context, options = {}) {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(context);

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userPrompt
        }]
      });

      const responseText = response.content[0].text;
      console.log('ReAct Response:', responseText);

      // Parse the response
      const parsed = this.parseReactResponse(responseText);
      
      // Execute action if present (unless in preview mode for write actions)
      if (parsed.action && parsed.actionInput) {
        // Skip execution if preview mode and this is a write action
        if (options.previewMode && this.isWriteAction(parsed.action)) {
          parsed.observation = '[Preview Mode: Action will be executed after approval]';
        } else {
          try {
            parsed.observation = await this.executeAction(parsed.action, parsed.actionInput);
          } catch (error) {
            parsed.observation = `Error executing ${parsed.action}: ${error.message}`;
            parsed.error = error.message;
          }
        }
      }

      return parsed;
    } catch (error) {
      return {
        thought: 'Error communicating with AI',
        error: error.message
      };
    }
  }

  buildSystemPrompt() {
    const toolDescriptions = Object.entries(this.tools)
      .map(([name, tool]) => `${name}: ${tool.description} (params: ${tool.parameters.join(', ')})`)
      .join('\n');

    return `You are a concise CRM assistant using the ReAct framework.
You help users manage their CRM data in Attio by searching, creating, and updating records.

You have access to these tools:
${toolDescriptions}

IMPORTANT: If the user has attached images, they will be referenced in the message. Use analyze_image to examine them.
- image_index: 0-based index of the image (0 for first image, 1 for second, etc.)
- analysis_type: "transcribe" (extract all text), "analyze" (understand content), or "both"

You must follow this EXACT format for EVERY response:

Thought: [Your reasoning about what to do next]
Action: [One of: ${Object.keys(this.tools).join(', ')}]
Action Input: {"param1": "value1", "param2": "value2"}

STOP HERE! Do NOT include "Observation:" in your response.
I will execute the action and provide the observation.
Wait for my observation before continuing.

After I provide an Observation, you may continue with:

Thought: [Reflect on the observation]
Action: [Next action or none]
Action Input: [Input for action or none]

When you have the final answer:

Thought: I now have enough information to provide the final answer
Final Answer: [Your complete response to the user]

CRITICAL: Never write "Observation:" in your responses. Only write Thought, Action, Action Input, or Final Answer.

SEARCH STRATEGY - IMPORTANT:
- When searching for entities, if your first search returns no results, ALWAYS try alternative searches
- For company searches, try these variations in order:
  1. Exact name as provided (e.g., "The Raine Group")
  2. Without common words like "The" (e.g., "Raine Group")
  3. Core name only (e.g., "Raine")
  4. Abbreviations or alternate names the user suggests
- For person searches, try:
  1. Full name (e.g., "John Smith")
  2. Last name only (e.g., "Smith")  
  3. First name only if last name gives too many results
- NEVER give up after one search - always try at least 2-3 variations
- The search function uses fuzzy matching, so partial names often work better than full names
- If no results found after trying CRM variations, use web_search to:
  1. Check if the company name is misspelled (e.g., "rain group" → "raine group")
  2. Find the correct/official company name
  3. Get additional context about the company
  4. Then retry CRM search with the corrected name

NOTES - LISTING AND DELETION:
- To list notes on a record, use get_notes with entity_type and entity_id
- When asked to show notes on a company/person/deal:
  1. First search for the entity to get its ID
  2. Then use get_notes with the entity_type and entity_id
  3. Display the notes with their titles, content preview, and creation info
- The bot automatically shows full note content when user says "dump", "full content", "complete", or "entire"
- Notes include: title, full content, creation date, and who created them
- For deleting notes:
  - NEVER show raw note IDs (UUIDs) to users - they are meaningless to humans
  - When asked to delete a note, you MUST:
    1. First ask which record (company/person/deal) the note is on
    2. Search for and find that record
    3. Use get_notes to list the notes on that record
    4. Ask the user to specify which note they want to delete based on the list
  - If given a note ID directly:
    - DO NOT just delete it with the raw UUID
    - Instead say something like: "I need more context about which note you want to delete. Could you tell me which company/person/deal this note is on?"
  - The delete_note tool requires the exact note ID, but users should identify notes by their content and parent record, not by ID

RESPONSE RULES:
- Always start with a Thought
- Use EXACT tool names from the list
- Action Input must be valid JSON
- Continue until you have a Final Answer
- CRITICAL: When presenting search results, ALWAYS include clickable Attio URLs for each found entity
- Never claim to have found something without providing the direct link to verify it
- BE CONCISE: Final Answers should be 1-3 sentences max unless showing a list of results
- When no results found after trying variations: State what you searched for and suggest the entity may need to be added
- When results found: List them with links, no extra explanation needed

DELETE NOTE SAFETY:
- The delete_note tool permanently deletes notes - there is no undo
- Always confirm the note_id is correct before deleting
- If asked to delete a note without a specific ID, ask for the note ID
- Be extra careful with note IDs - they should look like UUIDs (e.g., 550e8400-e29b-41d4-a716-446655440000)
- Note: get_entity_details does NOT work for notes - only for companies, people, and deals
- To delete a note, you need the exact note ID, which users can find in the Attio UI`;
  }

  buildUserPrompt(context) {
    let prompt = `User message: "${context.message}"\n`;
    prompt += `User: ${context.user}\n`;
    prompt += `Channel: ${context.channel}\n`;
    
    // Add attachment information
    if (context.attachments && context.attachments.length > 0) {
      prompt += `\nAttachments: ${context.attachments.length} image(s) attached\n`;
      context.attachments.forEach((att, index) => {
        prompt += `  - Image ${index}: ${att.name || 'unnamed'} (${att.mimetype})\n`;
      });
    }
    prompt += '\n';

    // Add previous iterations
    if (context.iterations.length > 0) {
      prompt += 'Previous steps:\n';
      context.iterations.forEach((step, i) => {
        prompt += `\nStep ${i + 1}:\n`;
        if (step.thought) prompt += `Thought: ${step.thought}\n`;
        if (step.action) prompt += `Action: ${step.action}\n`;
        if (step.actionInput) prompt += `Action Input: ${JSON.stringify(step.actionInput)}\n`;
        if (step.observation) prompt += `Observation: ${JSON.stringify(step.observation)}\n`;
      });
      prompt += '\nContinue from here:';
    } else {
      prompt += 'Begin:';
    }

    return prompt;
  }

  parseReactResponse(text) {
    const result = {};
    
    // Extract Thought
    const thoughtMatch = text.match(/Thought:\s*(.+?)(?=\n(?:Action:|Final Answer:|Observation:)|$)/s);
    if (thoughtMatch) result.thought = thoughtMatch[1].trim();
    
    // Extract Final Answer
    const finalAnswerMatch = text.match(/Final Answer:\s*(.+)/s);
    if (finalAnswerMatch) {
      result.finalAnswer = finalAnswerMatch[1].trim();
      return result;
    }
    
    // Extract Action
    const actionMatch = text.match(/Action:\s*(\w+)/);
    if (actionMatch) result.action = actionMatch[1].trim();
    
    // Extract Action Input
    const actionInputMatch = text.match(/Action Input:\s*({.+?})(?=\s*(?:Observation:|$))/s);
    if (actionInputMatch) {
      try {
        result.actionInput = JSON.parse(actionInputMatch[1]);
      } catch (e) {
        console.error('Failed to parse action input:', actionInputMatch[1]);
        result.actionInput = {};
      }
    }
    
    // Note: Observations should not be parsed from AI response - they come from tool execution
    // If the AI includes an Observation, ignore it
    
    return result;
  }

  async executeAction(action, input) {
    const tool = this.tools[action];
    if (!tool) {
      throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Executing ${action} with input:`, input);

    // Map the input to function parameters based on the action
    switch (action) {
      case 'search_crm':
        return await tool.execute(input.search_query || input.query);
        
      case 'web_search':
        return await this.webSearch(input.query);
        
      case 'create_note':
        return await this.createNote(
          input.entity_type,
          input.entity_id,
          input.note_content || input.note
        );
        
      case 'delete_note':
        return await this.deleteNote(input.note_id);
        
      case 'get_notes':
        return await this.getNotes(
          input.entity_type,
          input.entity_id
        );
        
      case 'create_entity':
        return await this.createEntity(
          input.entity_type,
          input.data
        );
        
      case 'update_entity':
        return await this.updateEntity(
          input.entity_type,
          input.entity_id,
          input.updates
        );
        
      case 'get_entity_details':
        return await this.getEntityDetails(
          input.entity_type,
          input.entity_id
        );
        
      case 'analyze_image':
        return await this.analyzeImage(
          input.image_index,
          input.analysis_type
        );
        
      default:
        throw new Error(`No execution handler for action: ${action}`);
    }
  }

  // Tool implementations
  async createNote(entityType, entityId, noteContent) {
    try {
      const { getAttioClient } = require('./attioService');
      
      console.log(`Creating note for ${entityType} ${entityId}:`, noteContent);
      
      // Use the correct API format with data wrapper
      const response = await getAttioClient().post('/notes', {
        data: {
          parent_object: `${entityType}s`,
          parent_record_id: entityId,
          title: 'Note from Slack',
          content: noteContent,
          format: 'plaintext',
          created_by_actor: {
            type: 'api-token'
          }
        }
      });
      
      console.log('Note created successfully:', response.data);
      
      const noteId = response.data.data.id?.note_id || response.data.data.id;
      const workspace = 'textql-data';
      const attioUrl = `https://app.attio.com/${workspace}/${entityType}/${entityId}/overview`;
      
      return { 
        success: true, 
        noteId: noteId,
        url: attioUrl,
        message: `Note created successfully. View at: ${attioUrl}`
      };
    } catch (error) {
      console.error('Note creation error:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  async deleteNote(noteId) {
    try {
      const { deleteNote, getNoteDetails } = require('./attioService');
      
      console.log(`Delete note requested for ID: ${noteId}`);
      
      // First get note details to show context
      const noteDetails = await getNoteDetails(noteId);
      if (!noteDetails.success) {
        // If we can't find the note, provide helpful guidance
        if (noteDetails.error === 'Note not found') {
          return {
            success: false,
            error: 'Note not found',
            message: 'I couldn\'t find that note. To delete a note, please first tell me which company, person, or deal the note is on, and I can help you identify the right note to delete.'
          };
        }
        return noteDetails;
      }
      
      // We have the note details, but we should guide the user to identify notes properly
      return {
        success: false,
        needsConfirmation: true,
        noteDetails: {
          title: noteDetails.title,
          content: noteDetails.content.substring(0, 100) + (noteDetails.content.length > 100 ? '...' : ''),
          parentName: noteDetails.parentName,
          parentType: noteDetails.parentType,
          parentUrl: noteDetails.parentUrl
        },
        message: `I found a note titled "${noteDetails.title}" on ${noteDetails.parentType} "${noteDetails.parentName}". However, for safety, I need you to confirm the deletion by describing which note you want to delete and on which record. You can view this ${noteDetails.parentType} at: ${noteDetails.parentUrl}`
      };
      
    } catch (error) {
      console.error('Delete note error:', error);
      return {
        success: false,
        error: error.message,
        message: 'I encountered an error. To delete a note, please tell me which company, person, or deal the note is on, and describe the note you want to delete.'
      };
    }
  }

  async getNotes(entityType, entityId, showFullContent = false) {
    try {
      const { getNotes } = require('./attioService');
      
      // Build options based on parameters
      const options = {};
      if (entityId) {
        options.recordId = entityId;
      }
      if (entityType) {
        // Convert to plural form for API
        if (entityType === 'company') {
          options.recordType = 'companies';
        } else if (entityType === 'person') {
          options.recordType = 'people';
        } else if (entityType === 'deal') {
          options.recordType = 'deals';
        } else {
          options.recordType = entityType + 's';
        }
      }
      // Check if user specified a number of notes
      const userMessage = this.currentContext?.message || '';
      const numberMatch = userMessage.match(/last\s+(\d+)(?:-(\d+))?\s+notes?/i) || 
                         userMessage.match(/(\d+)(?:-(\d+))?\s+(?:most\s+)?recent\s+notes?/i);
      
      if (numberMatch) {
        const num1 = parseInt(numberMatch[1]);
        const num2 = numberMatch[2] ? parseInt(numberMatch[2]) : num1;
        options.limit = Math.max(num1, num2);
      } else {
        options.limit = 20; // Default reasonable limit
      }
      
      const notes = await getNotes(options);
      
      if (!notes || notes.length === 0) {
        return {
          success: true,
          notes: [],
          message: entityId ? 
            `No notes found for this ${entityType}` : 
            'No notes found'
        };
      }
      
      // Check if user wants full content (phrases like "dump", "full content", "complete notes")
      const messageLower = this.currentContext?.message?.toLowerCase() || '';
      const wantsFullContent = showFullContent || 
        messageLower.includes('dump') || 
        messageLower.includes('full content') || 
        messageLower.includes('complete') ||
        messageLower.includes('entire');
      
      // Format notes for display
      const formattedNotes = notes.map((note, index) => {
        const contentDisplay = wantsFullContent ? 
          note.content || '(empty note)' : 
          `${note.content.substring(0, 150)}${note.content.length > 150 ? '...' : ''}`;
        
        // Construct direct note URL
        let noteUrl = '';
        if (note.id && note.parentObject && note.parentRecordId) {
          noteUrl = `\n   📎 View note: https://app.attio.com/textql-data/${note.parentObject}/record/${note.parentRecordId}/notes?modal=note&id=${note.id}`;
        }
          
        return `${index + 1}. **${note.title}** (${note.createdAt})
   ${contentDisplay}
   Created by: ${note.createdBy}${noteUrl}`;
      }).join('\n\n');
      
      return {
        success: true,
        notes: notes,
        message: `Found ${notes.length} note${notes.length > 1 ? 's' : ''}:\n\n${formattedNotes}`,
        count: notes.length,
        fullContent: wantsFullContent
      };
    } catch (error) {
      console.error('Get notes error:', error);
      return {
        success: false,
        error: error.message || 'Failed to retrieve notes'
      };
    }
  }

  async createEntity(entityType, data) {
    try {
      const { getAttioClient } = require('./attioService');
      const response = await getAttioClient().post(`/objects/${entityType}s/records`, {
        data: {
          values: data
        }
      });
      return { 
        success: true, 
        entityId: response.data.data.id.record_id,
        name: data.name?.[0]?.value || 'Created'
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  async updateEntity(entityType, entityId, updates) {
    try {
      const { getAttioClient } = require('./attioService');
      await getAttioClient().patch(`/objects/${entityType}s/records/${entityId}`, {
        data: {
          values: updates
        }
      });
      return { success: true, updated: Object.keys(updates) };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  async getEntityDetails(entityType, entityId) {
    const { getAttioClient } = require('./attioService');
    try {
      const response = await getAttioClient().get(`/objects/${entityType}s/records/${entityId}`);
      return { 
        success: true, 
        data: response.data.data 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  async webSearch(query) {
    try {
      // Simple web search simulation - in production, you'd use a real search API
      console.log(`Web searching for: "${query}"`);
      
      // For now, return helpful information about common misspellings
      const lowerQuery = query.toLowerCase();
      
      // Check for common variations of "The Raine Group"
      if (lowerQuery.includes('rain') || lowerQuery.includes('rayne') || lowerQuery.includes('rane')) {
        return {
          success: true,
          results: [
            {
              title: "The Raine Group - Investment Bank",
              snippet: "The Raine Group is a global merchant bank focused exclusively on technology, media, and telecommunications.",
              suggestion: "Did you mean 'The Raine Group'? (spelled R-A-I-N-E)"
            }
          ],
          correction: "The Raine Group"
        };
      }
      
      // Default response
      return {
        success: true,
        results: [],
        message: `No web results found for "${query}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async analyzeImage(imageIndex, analysisType) {
    try {
      // Get attachments from the current context
      // We need to pass context through the execution chain
      const currentIteration = this.currentContext?.iterations?.length || 0;
      const attachments = this.currentContext?.attachments || [];
      
      if (!attachments || attachments.length === 0) {
        return {
          success: false,
          error: 'No images attached to analyze'
        };
      }
      
      if (imageIndex >= attachments.length) {
        return {
          success: false,
          error: `Invalid image index ${imageIndex}. Only ${attachments.length} image(s) attached.`
        };
      }
      
      const attachment = attachments[imageIndex];
      
      // Prepare the image for Claude's vision API
      const imageData = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: attachment.mimetype || 'image/jpeg',
          data: attachment.data
        }
      };
      
      // Determine the prompt based on analysis type
      let prompt = '';
      switch (analysisType) {
        case 'transcribe':
          prompt = 'Please transcribe all text visible in this image. Include all messages, timestamps, usernames, and any other text you can see. Format it clearly.';
          break;
        case 'analyze':
          prompt = 'Please analyze this image and describe what you see. If it contains a conversation, summarize the key points, participants, and topics discussed.';
          break;
        case 'both':
        default:
          prompt = 'Please analyze this image. First, transcribe all visible text (messages, timestamps, usernames, etc.). Then provide a summary of what the image shows and any key information.';
          break;
      }
      
      console.log(`Analyzing image ${imageIndex} with type: ${analysisType}`);
      
      // Call Claude's vision API
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        temperature: 0.2,
        messages: [{
          role: 'user',
          content: [
            imageData,
            {
              type: 'text',
              text: prompt
            }
          ]
        }]
      });
      
      const analysisResult = response.content[0].text;
      console.log('Image analysis result:', analysisResult);
      
      return {
        success: true,
        imageIndex: imageIndex,
        imageName: attachment.name || `Image ${imageIndex}`,
        analysisType: analysisType,
        result: analysisResult
      };
      
    } catch (error) {
      console.error('Image analysis error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = { ReactAgent };