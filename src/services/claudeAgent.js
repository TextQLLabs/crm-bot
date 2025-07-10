const Anthropic = require('@anthropic-ai/sdk');
const { searchAttio, advancedSearch, searchRelatedEntities, searchByTimeRange } = require('./attioService');
const { createNote, deleteNote, getNotes, getNoteDetails } = require('./attioService');
const { getAttioClient } = require('./attioService');
const fileStorage = require('./fileStorage');

// File storage for conversation logging
const saveConversation = fileStorage.saveConversation;

class ClaudeAgent {
  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ERROR: ANTHROPIC_API_KEY is not set!');
    } else {
      console.log('Anthropic API key loaded for Claude 3.7 Sonnet');
    }
    
    this.anthropic = new Anthropic({
      apiKey: apiKey,
    });
    
    // Define tools for Claude's native tool calling
    this.tools = [
      {
        name: "search_crm",
        description: "Search for companies, people, or deals in Attio CRM",
        input_schema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query (company name, person name, or deal name)"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "web_search",
        description: "Search the web for current information about companies, people, or any topic",
        input_schema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query - be specific for better results"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "create_note",
        description: "Add a note to a CRM record",
        input_schema: {
          type: "object",
          properties: {
            entity_type: {
              type: "string",
              enum: ["company", "person", "deal"],
              description: "The type of entity to add the note to"
            },
            entity_id: {
              type: "string",
              description: "The ID of the entity to add the note to"
            },
            note_content: {
              type: "string",
              description: "The content of the note"
            }
          },
          required: ["entity_type", "entity_id", "note_content"]
        }
      },
      {
        name: "delete_note",
        description: "Delete one or multiple notes by ID, or bulk delete with filters",
        input_schema: {
          type: "object",
          properties: {
            note_id: {
              type: "string",
              description: "Single note ID to delete"
            },
            note_ids: {
              type: "array",
              items: { type: "string" },
              description: "Multiple note IDs to delete"
            },
            entity_type: {
              type: "string",
              enum: ["company", "person", "deal"],
              description: "Entity type for bulk delete with filters"
            },
            entity_id: {
              type: "string", 
              description: "Entity ID for bulk delete with filters"
            },
            filters: {
              type: "object",
              properties: {
                title_contains: { type: "string" },
                content_contains: { type: "string" },
                created_before: { type: "string" },
                created_by: { type: "string" },
                tags: { type: "array", items: { type: "string" } }
              },
              description: "Filters for bulk delete (requires entity_type and entity_id)"
            },
            preview: {
              type: "boolean",
              default: false,
              description: "Preview what would be deleted without actually deleting"
            },
            confirm: {
              type: "boolean",
              default: false,
              description: "Required true for bulk operations to prevent accidents"
            }
          }
        }
      },
      {
        name: "get_notes",
        description: "Get notes with full content, filtering, and search capabilities",
        input_schema: {
          type: "object",
          properties: {
            entity_type: {
              type: "string",
              enum: ["company", "person", "deal"],
              description: "The type of entity to get notes for"
            },
            entity_id: {
              type: "string",
              description: "The ID of the entity to get notes for"
            },
            note_id: {
              type: "string",
              description: "Optional: Get specific note by ID (overrides entity filters)"
            },
            include_content: {
              type: "boolean",
              default: true,
              description: "Whether to include full note content (default: true)"
            },
            truncate_content: {
              type: "boolean",
              default: false,
              description: "Truncate content to ~500 chars for summaries (default: false, shows full content)"
            },
            search: {
              type: "string",
              description: "Search term to filter notes by title or content"
            },
            filters: {
              type: "object",
              properties: {
                title_contains: {
                  type: "string",
                  description: "Filter by title containing this text"
                },
                content_contains: {
                  type: "string", 
                  description: "Filter by content containing this text"
                },
                created_after: {
                  type: "string",
                  description: "ISO date - only notes created after this date"
                },
                created_before: {
                  type: "string",
                  description: "ISO date - only notes created before this date"
                },
                created_by: {
                  type: "string",
                  description: "Filter by creator name"
                },
                min_length: {
                  type: "number",
                  description: "Minimum content length in characters"
                },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Filter by tags"
                }
              }
            },
            limit: {
              type: "number",
              default: 20,
              description: "Maximum number of notes to return (default: 20)"
            },
            sort_by: {
              type: "string",
              enum: ["created_at", "updated_at", "title", "content_length"],
              default: "created_at",
              description: "Field to sort by (default: created_at)"
            },
            sort_order: {
              type: "string", 
              enum: ["asc", "desc"],
              default: "desc",
              description: "Sort order (default: desc)"
            }
          },
          required: []
        }
      },
      {
        name: "create_entity",
        description: "Create a new company, person, or deal",
        input_schema: {
          type: "object",
          properties: {
            entity_type: {
              type: "string",
              enum: ["company", "person", "deal"],
              description: "The type of entity to create"
            },
            data: {
              type: "object",
              description: "The data for the new entity"
            }
          },
          required: ["entity_type", "data"]
        }
      },
      {
        name: "update_entity",
        description: "Update existing entity fields",
        input_schema: {
          type: "object",
          properties: {
            entity_type: {
              type: "string",
              enum: ["company", "person", "deal"],
              description: "The type of entity to update"
            },
            entity_id: {
              type: "string",
              description: "The ID of the entity to update"
            },
            updates: {
              type: "object",
              description: "The fields to update"
            }
          },
          required: ["entity_type", "entity_id", "updates"]
        }
      },
      {
        name: "get_entity_details",
        description: "Get full details of a specific entity",
        input_schema: {
          type: "object",
          properties: {
            entity_type: {
              type: "string",
              enum: ["company", "person", "deal"],
              description: "The type of entity to get details for"
            },
            entity_id: {
              type: "string",
              description: "The ID of the entity to get details for"
            }
          },
          required: ["entity_type", "entity_id"]
        }
      },
      {
        name: "advanced_search",
        description: "Advanced search with attribute filtering, date ranges, and custom criteria",
        input_schema: {
          type: "object",
          properties: {
            entity_type: {
              type: "string",
              enum: ["company", "deal", "person"],
              description: "The type of entity to search for"
            },
            query: {
              type: "string",
              description: "Basic text search query (optional, can be combined with filters)"
            },
            filters: {
              type: "object",
              properties: {
                deal_value_min: {
                  type: "number",
                  description: "Minimum deal value (deals only)"
                },
                deal_value_max: {
                  type: "number", 
                  description: "Maximum deal value (deals only)"
                },
                status: {
                  type: "string",
                  description: "Entity status (e.g., 'active', 'closed', 'open')"
                },
                created_after: {
                  type: "string",
                  description: "ISO date - only entities created after this date"
                },
                created_before: {
                  type: "string",
                  description: "ISO date - only entities created before this date"
                },
                updated_after: {
                  type: "string",
                  description: "ISO date - only entities updated after this date"
                },
                updated_before: {
                  type: "string",
                  description: "ISO date - only entities updated before this date"
                },
                industry: {
                  type: "string",
                  description: "Industry filter (companies only)"
                },
                location: {
                  type: "string",
                  description: "Location filter (contains match)"
                },
                tags_include: {
                  type: "array",
                  items: { type: "string" },
                  description: "Tags that entity must have"
                }
              }
            },
            limit: {
              type: "number",
              default: 20,
              description: "Maximum number of results to return"
            },
            sort_by: {
              type: "string",
              description: "Field to sort by (e.g., 'created_at', 'name', 'value')"
            },
            sort_order: {
              type: "string",
              enum: ["asc", "desc"],
              default: "desc",
              description: "Sort order"
            }
          },
          required: ["entity_type"]
        }
      },
      {
        name: "search_related_entities",
        description: "Find entities related to another entity (e.g., deals for a company, people at a company)",
        input_schema: {
          type: "object",
          properties: {
            source_entity_type: {
              type: "string",
              enum: ["company", "deal", "person"],
              description: "Type of the source entity"
            },
            source_entity_id: {
              type: "string",
              description: "ID of the source entity"
            },
            target_entity_type: {
              type: "string",
              enum: ["company", "deal", "person"],
              description: "Type of entities to find that are related"
            },
            relationship_type: {
              type: "string",
              description: "Specific relationship field (optional, e.g., 'primary_company', 'primary_contact')"
            }
          },
          required: ["source_entity_type", "source_entity_id", "target_entity_type"]
        }
      },
      {
        name: "search_by_time_range",
        description: "Search entities created or updated within a specific time range",
        input_schema: {
          type: "object",
          properties: {
            entity_type: {
              type: "string",
              enum: ["company", "deal", "person"],
              description: "Type of entity to search"
            },
            start_date: {
              type: "string",
              description: "Start date in ISO format (YYYY-MM-DD)"
            },
            end_date: {
              type: "string",
              description: "End date in ISO format (YYYY-MM-DD)"
            },
            time_field: {
              type: "string",
              enum: ["created_at", "updated_at"],
              default: "created_at",
              description: "Which time field to filter on"
            },
            limit: {
              type: "number",
              default: 20,
              description: "Maximum number of results to return"
            }
          },
          required: ["entity_type"]
        }
      },
    ];
  }

  async processMessage(message, options = {}) {
    const startTime = Date.now();
    const context = {
      message: message.text,
      user: message.userName,
      channel: message.channel,
      attachments: message.attachments || [],
      threadTs: message.threadTs,
      messageTs: message.messageTs || new Date().getTime().toString(),
      userId: message.userId,
      conversationHistory: message.conversationHistory || [],
      botActionHistory: message.botActionHistory || []
    };

    this.currentContext = context;

    try {
      // Build the system prompt
      const systemPrompt = this.buildSystemPrompt();
      
      // Build the conversation history
      const messages = this.buildConversationMessages(context);

      // Create the Claude request with thinking enabled
      console.log(`Claude Agent: Sending request with ${messages.length} messages, ${context.attachments?.length || 0} attachments`);
      
      let response;
      try {
        response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514', // Claude 4 Sonnet - latest with vision
          max_tokens: 4000,
          temperature: 0.3,
          system: systemPrompt,
          messages: messages,
          tools: this.tools,
          tool_choice: { type: "auto" } // Let Claude decide which tools to use
        });
        
        console.log(`Claude Agent: Received response with ${response.content.length} content blocks`);
      } catch (imageError) {
        console.log('Claude Agent: API Error Details:', {
          message: imageError.message,
          status: imageError.status,
          error: imageError.error
        });
        
        if (imageError.message?.includes('Could not process image') && context.attachments?.length > 0) {
          console.log('Claude Agent: Image processing failed, falling back to text-only request');
          
          // Remove images from messages and try again with text only
          const textOnlyMessages = messages.map(msg => ({
            ...msg,
            content: Array.isArray(msg.content) 
              ? msg.content.filter(c => c.type === 'text')
              : msg.content
          }));
          
          // Add note about images to the text
          if (textOnlyMessages.length > 0 && Array.isArray(textOnlyMessages[textOnlyMessages.length - 1].content)) {
            textOnlyMessages[textOnlyMessages.length - 1].content[0].text += 
              `\n\n[Note: User uploaded ${context.attachments.length} image(s) that couldn't be processed. Please let the user know the image couldn't be analyzed due to technical limitations.]`;
          }
          
          response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514', // Claude 4 Sonnet - fallback
            max_tokens: 4000,
            temperature: 0.3,
            system: systemPrompt,
            messages: textOnlyMessages,
            tools: this.tools,
            tool_choice: { type: "auto" }
          });
          
          console.log(`Claude Agent: Fallback request successful with ${response.content.length} content blocks`);
        } else {
          throw imageError; // Re-throw if it's not an image error
        }
      }

      // Process the response and handle tool calls
      const result = await this.processResponse(response, context, options);
      
      // Save the conversation
      await this.saveConversation(context, result, startTime);
      
      return result;
    } catch (error) {
      console.error('Claude Agent error:', error);
      const result = {
        success: false,
        error: error.message,
        answer: 'I encountered an error processing your request. Please try again.'
      };
      
      await this.saveConversation(context, result, startTime);
      return result;
    }
  }

  buildSystemPrompt() {
    return `You are a helpful CRM assistant that helps users manage their Attio CRM data. You can search for companies, people, and deals, create and manage notes, and perform various CRM operations.

CONVERSATION HANDLING:
- Answer conversational questions about yourself directly WITHOUT using tools
- If asked about your capabilities, architecture, or how you work, explain in plain English
- Examples of conversational questions: "how do you work?", "what can you do?", "are you using Claude?", "what framework do you use?"
- Only use CRM tools when users are actually asking for CRM operations (search, create notes, etc.)
- You use Claude Sonnet 4 with native tool calling (not ReAct framework) to manage Attio CRM data

RESPONSE FORMATTING STYLES:
When users ask CRM questions (search, notes, etc.), format your responses with:
- Entity names in **bold** with clickable <url|here> links  
- Clear summaries like "Found **Company Name**" or "No matches found"
- Note counts and details when relevant
- Action confirmations for operations

When users ask conversational questions about you, just respond naturally and helpfully.

For mixed requests like "hi, search for raine", handle both parts naturally - greet them and then provide the CRM results.

EXAMPLES:
- CRM: "search for raine" → "Found **The Raine Group** (<url|here>) - is that what you meant?"
- Conversational: "what can you do?" → "I can help you search your Attio CRM for companies, people, and deals, create and manage notes, and perform various CRM operations using Claude Sonnet 4 with native tool calling."
- Mixed: "hi, find raine" → "Hello! Found **The Raine Group** (<url|here>) - is that what you meant?"

CRITICAL MULTI-STEP OPERATION RULES:

When a user asks to "add note to [company/person/deal]":
1. FIRST call search_crm to find the entity
2. WAIT for the search results to see the actual entity ID
3. Then use the EXACT entity ID from the search results for create_note
4. Do NOT make assumptions about entity IDs - use the ones returned by search

FUZZY SEARCH & SPELLING CORRECTION WORKFLOW:
When search_crm returns no results, try these steps IN ORDER:
1. FIRST try search variations yourself: remove "The", try partial names, try common spelling fixes
2. Example: "rayn group" → try "rayn", "raine", "raine group" - the search has built-in fuzzy matching
3. ONLY if multiple search attempts fail, then use web_search to find correct spelling
4. Example workflow: "rayn group" → search_crm("rayn") → search_crm("raine") → FOUND!

IMPORTANT: The search results will show format like:
"The Raine Group (company) [ID: a41e73b9-5dac-493f-bb2d-d38bb166c330]"
You MUST use the exact ID from the search results, not make up IDs.

IMPORTANT GUIDELINES:

1. **Search Strategy**: If your first search returns no results, try variations BEFORE using web search:
   - For companies: Try without "The", "Inc", "LLC", etc.
   - For people: Try first name only or last name only  
   - Use partial names - fuzzy matching works well
   - **Built-in Fuzzy Search**: The search has spelling correction built-in:
     * Try common spelling variations ("rayn" → "raine", "rain" → "raine")
     * Remove common suffixes and search base name  
     * The attioService already handles many spelling variations automatically
     * Example: "rayn group" → search_crm("rayn") → search_crm("raine") → finds "The Raine Group"
   - **Web Search Fallback**: Only use web search if multiple direct search attempts fail

2. **Note Operations**:
   - When listing notes, include titles, content preview, and creation info
   - For note deletion, always confirm which note and on which record
   - When users ask for specific types of notes (e.g., "test notes"), use get_notes with filter_content parameter
   - If filtering finds no matches, ask user for clarification about what makes a note match their criteria
   - NEVER show raw note IDs to users - they should identify notes by content

3. **Response Format**:
   - Always include clickable Attio URLs for found entities
   - Be concise but helpful
   - For search results, list them with direct links to verify

4. **Tool Usage**:
   - Use tools as needed to complete user requests
   - PREFER advanced tools for complex operations:
     * Use advanced_note_query instead of get_notes for filtering/searching
     * Use bulk_note_operations for deleting multiple notes
     * Use get_note_details to read full content of specific notes
   - For bulk delete operations: always use preview_delete first, then confirm with user
   - If a tool call fails, try alternative approaches
   - Always confirm actions before executing write operations

5. **Advanced Search Capabilities**:
   You have powerful search tools beyond basic search_crm:
   
   - **advanced_search**: Use when users want filtering/sorting
     * Deal value ranges: "deals over $1M", "deals under $500K" 
     * Date ranges: "companies created this year", "deals updated this month"
     * Status filters: "open deals", "active companies"
     * Industry/location: "tech companies", "companies in NY"
     * Sorting: "largest deals first", "newest companies"
     * Example: advanced_search({entity_type: "deal", filters: {deal_value_min: 1000000, status: "open"}})
   
   - **search_related_entities**: Use for relationship queries
     * "deals for this company", "people at this company"
     * "what deals involve this person", "which company owns this deal"
     * Example: search_related_entities({source_entity_type: "company", source_entity_id: "uuid", target_entity_type: "deal"})
   
   - **search_by_time_range**: Use for time-based queries
     * "companies created last month", "deals updated this week"
     * "recent activity", "new additions"
     * Example: search_by_time_range({entity_type: "company", start_date: "2024-01-01", time_field: "created_at"})

   **When to use each search tool:**
   - search_crm: Basic name/text search, fuzzy matching
   - advanced_search: Filtering by attributes (value, status, date, industry)
   - search_related_entities: Finding relationships between entities  
   - search_by_time_range: Time-based queries and recent activity

6. **Web Search & Spelling Correction**:
   - **Primary Use**: When CRM search finds no results, use web search to find correct spelling
   - **Workflow**: search_crm → no results → web_search → extract correct name → search_crm again
   - Web search helps verify official company names and find proper spellings
   - **Example**: User asks for "Rain Group" → CRM has nothing → web search finds "The Raine Group" → search CRM for "The Raine Group"

7. **Error Handling**:
   - If search finds nothing, suggest alternatives
   - Provide helpful guidance for common issues
   - Be patient with fuzzy searches and typos

Remember: You have native access to these tools and can use them as needed to help users with their CRM tasks.`;
  }

  buildConversationMessages(context) {
    const messages = [];
    
    // Add conversation history if available
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      context.conversationHistory.forEach(msg => {
        if (msg.isBot) {
          messages.push({
            role: 'assistant',
            content: msg.text
          });
        } else {
          messages.push({
            role: 'user',
            content: msg.text
          });
        }
      });
    }
    
    // Add current message
    const currentMessageContent = [];
    currentMessageContent.push({
      type: 'text',
      text: context.message
    });
    
    // Add attachments if any
    if (context.attachments && context.attachments.length > 0) {
      console.log(`Claude Agent: Processing ${context.attachments.length} attachments`);
      context.attachments.forEach((attachment, index) => {
        if (attachment.type === 'image') {
          console.log(`Claude Agent: Adding image ${index}: ${attachment.filename}, mime: ${attachment.mime_type}, data length: ${attachment.data?.length || 'undefined'}`);
          
          // Validate image data and format per Anthropic guidelines
          if (!attachment.data || attachment.data.length === 0) {
            console.error(`Claude Agent: Image ${index} has no data, skipping`);
            return;
          }
          
          // Validate mime type (Anthropic supports JPEG, PNG, GIF, WebP)
          const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
          if (!supportedTypes.includes(attachment.mime_type)) {
            console.error(`Claude Agent: Unsupported mime type ${attachment.mime_type}, skipping`);
            return;
          }
          
          // Check base64 size (rough estimate: base64 is ~33% larger than binary)
          const estimatedSizeBytes = (attachment.data.length * 3) / 4;
          const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit per Anthropic docs
          if (estimatedSizeBytes > maxSizeBytes) {
            console.error(`Claude Agent: Image ${index} too large (${Math.round(estimatedSizeBytes/1024/1024)}MB > 5MB), skipping`);
            return;
          }
          
          currentMessageContent.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: attachment.mime_type,
              data: attachment.data
            }
          });
        }
      });
    }
    
    messages.push({
      role: 'user',
      content: currentMessageContent
    });
    
    return messages;
  }

  async processResponse(response, context, options) {
    const previewMode = options.preview || false;
    const maxContinuations = options.maxContinuations || 3;
    const currentDepth = options.continuationDepth || 0;
    const collectToolResults = options.collectToolResults || false;
    
    let content = '';
    let toolResults = [];
    
    // Handle the initial response content
    for (const contentBlock of response.content) {
      if (contentBlock.type === 'text') {
        content += contentBlock.text;
      } else if (contentBlock.type === 'tool_use') {
        // Handle tool use
        const toolResult = await this.executeToolCall(contentBlock, previewMode);
        
        // If in preview mode and this is a write action, return for approval
        if (previewMode && this.isWriteAction(contentBlock.name)) {
          return {
            success: true,
            preview: true,
            pendingAction: {
              action: contentBlock.name,
              input: contentBlock.input,
              toolCallId: contentBlock.id
            }
          };
        }
        
        // Store tool results for continuation
        toolResults.push({
          tool: contentBlock.name,
          input: contentBlock.input,
          result: toolResult
        });
        
        // Store tool results but don't immediately add to content
        // We'll format a clean response at the end
      }
    }
    
    // Check if we should continue with more steps (but not if we've hit the limit)
    const shouldContinue = await this.shouldContinueConversation(context, toolResults, content);
    
    if (shouldContinue && currentDepth < maxContinuations) {
      console.log('🔄 Continuing conversation to complete multi-step operation...');
      console.log('Context for continuation:', {
        channel: context.channel,
        threadTs: context.threadTs,
        originalMessage: context.message,
        toolResults: toolResults.map(t => ({ tool: t.tool, success: t.result.success }))
      });
      
      // Build a continuation prompt
      const continuationPrompt = this.buildContinuationPrompt(context, toolResults);
      console.log('Continuation prompt:', continuationPrompt);
      
      try {
        // Make another Claude call to continue the task
        console.log('Making continuation Claude API call...');
        const continuationResponse = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          temperature: 0.3,
          system: this.buildSystemPrompt(),
          messages: [
            {
              role: 'user',
              content: continuationPrompt
            }
          ],
          tools: this.tools,
          tool_choice: { type: "auto" }
        });
        
        console.log('Continuation Claude response received, content blocks:', continuationResponse.content.length);
        
        // Process the continuation response and collect tool results
        const continuationResult = await this.processResponse(continuationResponse, context, {
          ...options,
          preview: false, // Continuation should execute, not preview
          continuationDepth: currentDepth + 1,
          collectToolResults: true // Flag to collect tool results without formatting
        });
        
        console.log('Continuation result:', continuationResult);
        
        // Merge tool results from continuation
        if (continuationResult && continuationResult.toolResults) {
          toolResults.push(...continuationResult.toolResults);
        }
        
      } catch (continuationError) {
        console.error('Error during continuation:', continuationError);
        content += `\n\n[Continuation failed: ${continuationError.message}]`;
      }
      
      // Add completion signal for continued operations
      // Use formatCleanResponse for continuation results too
      let finalContent = this.formatCleanResponse(content, toolResults, context) || content;
      
      // Only add status if no clean response was generated
      if (!finalContent || finalContent === content) {
        const hasWriteActions = toolResults.some(t => this.isWriteAction(t.tool));
        if (hasWriteActions) {
          finalContent = content + '\n\n✅ **Status**: Multi-step operation completed successfully.';
        } else {
          finalContent = content + '\n\n✅ **Status**: Multi-step operation completed (read-only).';
        }
      }
      
      return {
        success: true,
        answer: finalContent,
        toolsUsed: toolResults.map(t => ({
          tool: t.tool,
          input: t.input,
          success: t.result.success,
          timestamp: new Date()
        }))
      };
    } else if (shouldContinue && currentDepth >= maxContinuations) {
      console.log(`⚠️ Hit continuation limit (${maxContinuations}), stopping here`);
      content += '\n\n[Note: Operation may be incomplete due to complexity]';
    }
    
    // If this is a continuation call just collecting tool results, return them
    if (collectToolResults) {
      return {
        success: true,
        toolResults: toolResults
      };
    }
    
    // Format clean response based on tool results
    let finalContent = this.formatCleanResponse(content, toolResults, context) || 'Task completed successfully!';
    
    // Analyze if the request was actually fulfilled
    const originalMessage = context.message.toLowerCase();
    const hasSearchResults = toolResults.some(t => t.tool === 'search_crm' || t.tool === 'get_notes');
    const hasWriteActions = toolResults.some(t => this.isWriteAction(t.tool));
    
    // Check if this was a request that required specific actions
    const requestedDelete = originalMessage.includes('delete');
    const requestedCreate = originalMessage.includes('add') || originalMessage.includes('create');
    const requestedSpecificNotes = originalMessage.includes('test note') || originalMessage.includes('test notes');
    
    // Only add status for incomplete operations that need user action
    if (requestedDelete && requestedSpecificNotes && hasSearchResults && !hasWriteActions) {
      finalContent += '\n\n❓ **Need help**: I found the notes but couldn\'t identify which are "test notes". Could you clarify which specific notes to delete?';
    } else if (requestedDelete && !requestedSpecificNotes && hasSearchResults && !hasWriteActions) {
      finalContent += '\n\n⚠️ **Confirmation needed**: Found notes but bulk delete requires your approval.';
    } else if (requestedCreate && hasSearchResults && !hasWriteActions) {
      finalContent += '\n\n⚠️ **Approval needed**: Found target entity, note creation pending your confirmation.';
    }
    // Clean response format means no redundant "task completed" messages needed
    
    return {
      success: true,
      answer: finalContent,
      toolsUsed: toolResults.map(t => ({
        tool: t.tool,
        input: t.input,
        success: t.result.success,
        timestamp: new Date()
      }))
    };
  }
  
  async shouldContinueConversation(context, toolResults, currentContent) {
    // Check if this was a multi-step request that might need continuation
    const originalMessage = context.message.toLowerCase();
    
    // Don't continue if we've already done write operations
    const hasWriteActions = toolResults.some(t => this.isWriteAction(t.tool));
    if (hasWriteActions) return false;
    
    // Check if we have a complete chain: search found entity + got notes
    const hasSuccessfulSearch = toolResults.some(t => t.tool === 'search_crm' && t.result.success && t.result.data && t.result.data.length > 0);
    const hasNoteResults = toolResults.some(t => t.tool === 'get_notes' && t.result.success);
    
    // If asking about notes and we have search results but no note results yet, continue
    const needsNoteCount = (originalMessage.includes('how many notes') || originalMessage.includes('count') || originalMessage.includes('notes on'));
    const shouldGetNotes = needsNoteCount && hasSuccessfulSearch && !hasNoteResults;
    
    // If no search results yet but could be a fuzzy search case, continue
    // But only if we haven't already tried multiple search variations
    const hasFailedSearchOnly = toolResults.length === 1 && 
                                toolResults[0].tool === 'search_crm' && 
                                toolResults[0].result.success && 
                                (!toolResults[0].result.data || toolResults[0].result.data.length === 0);
    const hasMultipleFailedSearches = toolResults.filter(t => t.tool === 'search_crm').length > 2;
    const couldBeFuzzySearch = hasFailedSearchOnly && (needsNoteCount || originalMessage.includes('account')) && !hasMultipleFailedSearches;
    
    const shouldContinue = shouldGetNotes || couldBeFuzzySearch;
    
    console.log('shouldContinueConversation decision:', {
      originalMessage: originalMessage.substring(0, 100),
      hasSuccessfulSearch,
      hasNoteResults,
      needsNoteCount,
      shouldGetNotes,
      hasFailedSearchOnly,
      couldBeFuzzySearch,
      toolResultsCount: toolResults.length,
      toolNames: toolResults.map(t => t.tool),
      shouldContinue
    });
    
    return shouldContinue;
  }
  
  formatCleanResponse(originalContent, toolResults, context) {
    // Always prefer Claude's original response - it knows best how to format based on context
    if (originalContent && originalContent.trim().length > 0) {
      return originalContent;
    }
    
    // Only apply minimal fallback formatting if Claude's response is empty/missing
    if (toolResults.length === 0) {
      return "I'm here to help! Ask me about CRM operations or feel free to chat.";
    }

    // Simple fallback for the rare case where Claude didn't provide a response
    // but tools were executed (this should rarely happen)
    return "I completed the requested actions. Please let me know if you need anything else!";
  }
  
  buildContinuationPrompt(context, toolResults) {
    let prompt = `You were asked: "${context.message}"\n\nYou have completed these steps:\n`;
    
    toolResults.forEach((tr, index) => {
      prompt += `${index + 1}. ${tr.tool}: ${tr.result.success ? 'SUCCESS' : 'FAILED'}\n`;
      if (tr.result.success && tr.result.message) {
        prompt += `   Result: ${tr.result.message}\n`;
      }
    });
    
    prompt += `\nPlease continue and complete the original request. Use the results from the previous steps to proceed with the next necessary actions.`;
    
    return prompt;
  }
  
  extractNoteContent(message) {
    // Extract note content from messages like "add note to X saying 'content'"
    const patterns = [
      /saying\s+["']([^"']+)["']/i,
      /saying\s+[""]([^""]+)["']/i,
      /saying\s+(.+)$/i,
      /note\s+["']([^"']+)["']/i,
      /note\s+[""]([^""]+)["']/i,
      /add\s+["']([^"']+)["']/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  async executeToolCall(toolCall, previewMode = false) {
    const { name, input } = toolCall;
    
    console.log(`Executing tool: ${name} with input:`, input);
    
    // Skip execution if preview mode and this is a write action
    if (previewMode && this.isWriteAction(name)) {
      return {
        success: true,
        message: '[Preview Mode: Action will be executed after approval]'
      };
    }
    
    try {
      switch (name) {
        case 'search_crm':
          const searchResults = await searchAttio(input.query);
          if (searchResults && searchResults.length > 0) {
            const formattedResults = searchResults.map(result => 
              `${result.name} (${result.type}) [ID: ${result.id}]: <${result.url || 'No URL available'}|here>`
            ).join('\n');
            return {
              success: true,
              message: `Found ${searchResults.length} result(s):\n${formattedResults}`,
              data: searchResults
            };
          } else {
            return {
              success: true,
              message: 'No results found for that search query. Try searching with different terms or partial names.',
              data: []
            };
          }
          
        case 'web_search':
          return await this.webSearch(input.query);
          
        case 'create_note':
          return await this.createNote(input.entity_type, input.entity_id, input.note_content);
          
        case 'delete_note':
          return await this.deleteNote(input);
          
        case 'get_notes':
          return await this.getNotes(input);
          
        case 'create_entity':
          return await this.createEntity(input.entity_type, input.data);
          
        case 'update_entity':
          return await this.updateEntity(input.entity_type, input.entity_id, input.updates);
          
        case 'get_note_details':
          return await this.getNoteDetails(input.note_id);
          
        case 'advanced_note_query':
          return await this.advancedNoteQuery(input);
          
        case 'bulk_note_operations':
          return await this.bulkNoteOperations(input);
          
        case 'get_entity_details':
          return await this.getEntityDetails(input.entity_type, input.entity_id);
          
        case 'advanced_search':
          return await this.advancedSearch(input);
          
        case 'search_related_entities':
          return await this.searchRelatedEntities(input);
          
        case 'search_by_time_range':
          return await this.searchByTimeRange(input);
          
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  isWriteAction(action) {
    const writeActions = ['create_note', 'create_entity', 'update_entity', 'delete_note'];
    return writeActions.includes(action);
  }

  // Tool implementations (same as before but adapted for native tool calling)
  async createNote(entityType, entityId, noteContent) {
    try {
      console.log(`Creating note for ${entityType} ${entityId}:`, noteContent);
      
      // Handle proper pluralization for Attio API
      const parentObject = entityType === 'company' ? 'companies' : 
                          entityType === 'person' ? 'people' : 
                          entityType === 'deal' ? 'deals' : `${entityType}s`;
      
      // Build the note content with Slack thread link
      let fullNoteContent = noteContent;
      
      // Add Slack thread link if we have context
      if (this.currentContext && this.currentContext.channel && this.currentContext.threadTs) {
        const slackLink = this.buildSlackThreadLink(this.currentContext.channel, this.currentContext.threadTs);
        fullNoteContent += `\n\n---\n[Go back to Slack thread](${slackLink})`;
      }
      
      const response = await getAttioClient().post('/notes', {
        data: {
          parent_object: parentObject,
          parent_record_id: entityId,
          title: 'Note from Slack',
          content: fullNoteContent,
          format: 'plaintext',
          created_by_actor: {
            type: 'api-token'
          }
        }
      });
      
      console.log('Note created successfully:', response.data);
      
      const noteId = response.data.data.id?.note_id || response.data.data.id;
      const workspace = 'textql-data';
      
      // Try to verify the note was created by fetching it back
      try {
        console.log(`Verifying note creation by fetching notes for ${entityType} ${entityId}`);
        const notesResult = await this.getNotes(entityType, entityId);
        
        if (notesResult.success && notesResult.notes) {
          // Find the note we just created (look for matching content or recent timestamp)
          const createdNote = notesResult.notes.find(note => 
            note.id === noteId || 
            (note.content && note.content.includes(noteContent.substring(0, 50)))
          );
          
          if (createdNote && createdNote.url) {
            console.log('Found verified note URL:', createdNote.url);
            return {
              success: true,
              noteId: noteId,
              url: createdNote.url,
              message: `Note created and verified! View <${createdNote.url}|here>`
            };
          }
        }
      } catch (verificationError) {
        console.log('Note verification failed, using constructed URL:', verificationError.message);
      }
      
      // Fallback to constructed URL if verification fails
      const noteUrl = `https://app.attio.com/${workspace}/${parentObject}/record/${entityId}/notes?modal=note&id=${noteId}`;
      
      return { 
        success: true, 
        noteId: noteId,
        url: noteUrl,
        message: `Note created successfully. View <${noteUrl}|here>`
      };
    } catch (error) {
      console.error('Note creation error:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }
  
  buildSlackThreadLink(channelId, threadTs) {
    // Slack permalink format: https://WORKSPACE.slack.com/archives/CHANNEL/pTHREAD_TS
    // Thread timestamp needs to be converted: 1234567890.123456 -> p1234567890123456
    const workspace = 'textql'; // TextQL workspace
    const threadParam = 'p' + threadTs.replace('.', '');
    return `https://${workspace}.slack.com/archives/${channelId}/${threadParam}`;
  }

  async deleteNote(noteId) {
    try {
      console.log(`Delete note requested for ID: ${noteId}`);
      
      const noteDetails = await getNoteDetails(noteId);
      if (!noteDetails.success) {
        return {
          success: false,
          error: 'Note not found',
          message: 'I couldn\'t find that note. Please provide more context about which note you want to delete.'
        };
      }
      
      // Actually delete the note
      const result = await deleteNote(noteId);
      return result;
      
    } catch (error) {
      console.error('Delete note error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getNotes(input = {}) {
    try {
      // Handle specific note ID request
      if (input.note_id) {
        return await this.getNoteDetails(input.note_id);
      }
      
      // Require entity info for entity-based queries
      if (!input.entity_type || !input.entity_id) {
        return {
          success: false,
          error: 'entity_type and entity_id are required when not specifying note_id'
        };
      }
      
      const options = {
        recordId: input.entity_id,
        recordType: input.entity_type === 'company' ? 'companies' : 
                   input.entity_type === 'person' ? 'people' : 
                   input.entity_type === 'deal' ? 'deals' : input.entity_type + 's',
        limit: input.limit || 20,
        includeContent: input.include_content !== false // Default to true
      };
      
      const notes = await getNotes(options);
      
      if (!notes || notes.length === 0) {
        return {
          success: true,
          notes: [],
          message: `No notes found for this ${input.entity_type}`,
          count: 0
        };
      }
      
      // Apply all filters
      let filteredNotes = notes;
      
      // Search filter (across title and content)
      if (input.search) {
        const searchTerm = input.search.toLowerCase();
        filteredNotes = filteredNotes.filter(note => {
          const title = (note.title || '').toLowerCase();
          const content = (note.content || '').toLowerCase();
          return title.includes(searchTerm) || content.includes(searchTerm);
        });
      }
      
      // Apply individual filters
      if (input.filters) {
        const filters = input.filters;
        
        filteredNotes = filteredNotes.filter(note => {
          // Title filter
          if (filters.title_contains) {
            const title = (note.title || '').toLowerCase();
            if (!title.includes(filters.title_contains.toLowerCase())) return false;
          }
          
          // Content filter  
          if (filters.content_contains) {
            const content = (note.content || '').toLowerCase();
            if (!content.includes(filters.content_contains.toLowerCase())) return false;
          }
          
          // Date filters
          if (filters.created_after || filters.created_before) {
            const noteDate = new Date(note.createdAt);
            if (filters.created_after && noteDate < new Date(filters.created_after)) return false;
            if (filters.created_before && noteDate > new Date(filters.created_before)) return false;
          }
          
          // Creator filter
          if (filters.created_by) {
            const creator = (note.createdBy || '').toLowerCase();
            if (!creator.includes(filters.created_by.toLowerCase())) return false;
          }
          
          // Length filters
          const contentLength = (note.content || '').length;
          if (filters.min_length && contentLength < filters.min_length) return false;
          
          // Tags filter
          if (filters.tags && filters.tags.length > 0) {
            const noteTags = note.tags || [];
            const hasMatchingTag = filters.tags.some(filterTag => 
              noteTags.some(noteTag => noteTag.toLowerCase().includes(filterTag.toLowerCase()))
            );
            if (!hasMatchingTag) return false;
          }
          
          return true;
        });
      }
      
      // Apply sorting
      if (input.sort_by) {
        filteredNotes.sort((a, b) => {
          let aVal, bVal;
          
          switch (input.sort_by) {
            case 'created_at':
              aVal = new Date(a.createdAt);
              bVal = new Date(b.createdAt);
              break;
            case 'title':
              aVal = a.title || '';
              bVal = b.title || '';
              break;
            case 'content_length':
              aVal = (a.content || '').length;
              bVal = (b.content || '').length;
              break;
            default:
              aVal = new Date(a.createdAt);
              bVal = new Date(b.createdAt);
          }
          
          const order = input.sort_order === 'asc' ? 1 : -1;
          return aVal < bVal ? -order : aVal > bVal ? order : 0;
        });
      }
      
      // Apply limit
      if (input.limit && filteredNotes.length > input.limit) {
        filteredNotes = filteredNotes.slice(0, input.limit);
      }
      
      // Format for display if content should be included
      const includeContent = input.include_content !== false; // Default true
      
      return {
        success: true,
        notes: filteredNotes,
        count: filteredNotes.length,
        totalNotes: notes.length,
        message: `Found ${filteredNotes.length} note${filteredNotes.length !== 1 ? 's' : ''} (out of ${notes.length} total)`,
        includeContent: includeContent
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

  async getNoteDetails(noteId) {
    try {
      console.log(`Getting details for note: ${noteId}`);
      const noteDetails = await getNoteDetails(noteId);
      
      if (!noteDetails.success) {
        return {
          success: false,
          error: 'Note not found or inaccessible'
        };
      }
      
      return {
        success: true,
        note: noteDetails.note,
        message: `Note details retrieved successfully`,
        fullContent: noteDetails.note.content || '',
        metadata: {
          title: noteDetails.note.title,
          createdAt: noteDetails.note.createdAt,
          createdBy: noteDetails.note.createdBy,
          parentEntity: noteDetails.note.parentInfo
        }
      };
    } catch (error) {
      console.error('Get note details error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async advancedNoteQuery(input) {
    try {
      console.log('Advanced note query with filters:', input);
      
      // For now, implement a basic version that extends get_notes
      // In production, this would be a more sophisticated query system
      
      if (input.entity_type === 'all') {
        return {
          success: false,
          error: 'Cross-entity search not yet implemented. Please specify a specific entity_type.'
        };
      }
      
      if (!input.entity_id) {
        return {
          success: false,
          error: 'entity_id is required when entity_type is not "all"'
        };
      }
      
      // Use existing get_notes with enhanced filtering
      const options = {
        recordId: input.entity_id,
        recordType: input.entity_type === 'company' ? 'companies' : 
                   input.entity_type === 'person' ? 'people' : 
                   input.entity_type === 'deal' ? 'deals' : input.entity_type + 's',
        limit: input.limit || 50
      };
      
      const notes = await getNotes(options);
      
      if (!notes || notes.length === 0) {
        return {
          success: true,
          notes: [],
          message: `No notes found for this ${input.entity_type}`,
          count: 0
        };
      }
      
      // Apply advanced filters
      let filteredNotes = notes;
      
      if (input.filters) {
        filteredNotes = notes.filter(note => {
          const { filters } = input;
          
          // Content filtering
          if (filters.content_contains) {
            const content = (note.content || '').toLowerCase();
            if (!content.includes(filters.content_contains.toLowerCase())) {
              return false;
            }
          }
          
          // Title filtering
          if (filters.title_contains) {
            const title = (note.title || '').toLowerCase();
            if (!title.includes(filters.title_contains.toLowerCase())) {
              return false;
            }
          }
          
          // Date filtering
          if (filters.created_after || filters.created_before) {
            const noteDate = new Date(note.createdAt);
            
            if (filters.created_after && noteDate < new Date(filters.created_after)) {
              return false;
            }
            
            if (filters.created_before && noteDate > new Date(filters.created_before)) {
              return false;
            }
          }
          
          // Length filtering
          const contentLength = (note.content || '').length;
          
          if (filters.min_length && contentLength < filters.min_length) {
            return false;
          }
          
          if (filters.max_length && contentLength > filters.max_length) {
            return false;
          }
          
          // Creator filtering
          if (filters.created_by) {
            const creator = (note.createdBy || '').toLowerCase();
            if (!creator.includes(filters.created_by.toLowerCase())) {
              return false;
            }
          }
          
          return true;
        });
      }
      
      // Apply sorting
      if (input.sort_by) {
        filteredNotes.sort((a, b) => {
          let aVal, bVal;
          
          switch (input.sort_by) {
            case 'created_at':
              aVal = new Date(a.createdAt);
              bVal = new Date(b.createdAt);
              break;
            case 'title':
              aVal = a.title || '';
              bVal = b.title || '';
              break;
            case 'content_length':
              aVal = (a.content || '').length;
              bVal = (b.content || '').length;
              break;
            default:
              aVal = a.createdAt;
              bVal = b.createdAt;
          }
          
          const order = input.sort_order === 'asc' ? 1 : -1;
          return aVal < bVal ? -order : aVal > bVal ? order : 0;
        });
      }
      
      // Apply limit
      if (input.limit && filteredNotes.length > input.limit) {
        filteredNotes = filteredNotes.slice(0, input.limit);
      }
      
      const summary = [];
      if (input.filters?.content_contains) summary.push(`containing "${input.filters.content_contains}"`);
      if (input.filters?.created_after) summary.push(`created after ${input.filters.created_after}`);
      if (input.filters?.created_before) summary.push(`created before ${input.filters.created_before}`);
      
      const filterSummary = summary.length > 0 ? ` ${summary.join(', ')}` : '';
      
      return {
        success: true,
        notes: filteredNotes,
        message: `Advanced query found ${filteredNotes.length} note${filteredNotes.length !== 1 ? 's' : ''}${filterSummary} (out of ${notes.length} total)`,
        count: filteredNotes.length,
        totalNotes: notes.length,
        appliedFilters: input.filters || {}
      };
      
    } catch (error) {
      console.error('Advanced note query error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async bulkNoteOperations(input) {
    try {
      console.log('Bulk note operations:', input);
      
      let targetNotes = [];
      
      // Get notes either by IDs or by filters
      if (input.note_ids && input.note_ids.length > 0) {
        // Use specific note IDs
        for (const noteId of input.note_ids) {
          const noteDetail = await this.getNoteDetails(noteId);
          if (noteDetail.success) {
            targetNotes.push(noteDetail.note);
          }
        }
      } else if (input.filters || (input.entity_type && input.entity_id)) {
        // Use filters via advanced query
        const queryResult = await this.advancedNoteQuery({
          entity_type: input.entity_type,
          entity_id: input.entity_id,
          filters: input.filters
        });
        
        if (queryResult.success) {
          targetNotes = queryResult.notes;
        } else {
          return queryResult; // Return the error
        }
      } else {
        return {
          success: false,
          error: 'Must provide either note_ids or entity filtering criteria'
        };
      }
      
      if (targetNotes.length === 0) {
        return {
          success: true,
          message: 'No notes found matching the criteria',
          count: 0,
          operations: []
        };
      }
      
      // Handle preview mode
      if (input.operation === 'preview_delete') {
        const preview = targetNotes.map((note, index) => 
          `${index + 1}. "${note.title || 'Untitled'}" (${note.createdAt}) - Content: ${(note.content || '').substring(0, 100)}${(note.content || '').length > 100 ? '...' : ''}`
        );
        
        return {
          success: true,
          message: `Preview: Would delete ${targetNotes.length} note${targetNotes.length !== 1 ? 's' : ''}:\n\n${preview.join('\n')}`,
          count: targetNotes.length,
          operations: targetNotes.map(note => ({ action: 'delete', noteId: note.id, title: note.title }))
        };
      }
      
      // Handle actual operations
      if (input.operation === 'delete') {
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        
        for (const note of targetNotes) {
          try {
            const deleteResult = await this.deleteNote(note.id);
            if (deleteResult.success) {
              successCount++;
              results.push({ noteId: note.id, status: 'deleted', title: note.title });
            } else {
              errorCount++;
              results.push({ noteId: note.id, status: 'error', error: deleteResult.error, title: note.title });
            }
          } catch (error) {
            errorCount++;
            results.push({ noteId: note.id, status: 'error', error: error.message, title: note.title });
          }
        }
        
        return {
          success: true,
          message: `Bulk delete completed: ${successCount} deleted, ${errorCount} errors`,
          count: targetNotes.length,
          successCount,
          errorCount,
          operations: results
        };
      }
      
      return {
        success: false,
        error: `Unsupported operation: ${input.operation}`
      };
      
    } catch (error) {
      console.error('Bulk note operations error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async getEntityDetails(entityType, entityId) {
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
      console.log(`Web searching for: "${query}"`);
      
      // Enhanced search query for better company/entity results
      const lowerQuery = query.toLowerCase();
      let searchQuery = query;
      
      // Add context for company searches to get better results
      if (!lowerQuery.includes('website') && !lowerQuery.includes('company')) {
        const companyIndicators = ['group', 'corp', 'inc', 'llc', 'ltd', 'partners', 'ventures', 'capital'];
        const seemsLikeCompany = companyIndicators.some(indicator => lowerQuery.includes(indicator));
        
        if (seemsLikeCompany || lowerQuery.split(' ').length <= 3) {
          searchQuery = `${query} company website official site`;
        }
      }
      
      console.log(`Enhanced search query: "${searchQuery}"`);
      
      // Use Anthropic's native web search capability
      try {
        const webSearchResponse = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          temperature: 0.3,
          messages: [{
            role: 'user',
            content: `Search the web for: "${searchQuery}". Focus on finding the official company name, website, and basic information. If this is a company search, prioritize finding the correct spelling and official name. Format the response as: Official Company Name, Website URL, Brief Description.`
          }],
          tools: [{
            name: 'web_search',
            description: 'Search the web for current information',
            input_schema: {
              type: 'object',
              properties: {
                query: { type: 'string' }
              },
              required: ['query']
            }
          }],
          tool_choice: { type: 'auto' }
        });
        
        if (webSearchResponse && webSearchResponse.content && webSearchResponse.content.length > 0) {
          const searchContent = webSearchResponse.content[0].text || '';
          
          // Parse the web search results
          const results = [{
            title: `Web Search Results for "${query}"`,
            snippet: searchContent,
            source: 'Web Search via Anthropic API'
          }];
          
          // Try to extract company name corrections from the results
          let correction = null;
          const content = searchContent.toLowerCase();
          
          // Look for common company name patterns in web results
          if (content.includes('raine group')) correction = 'The Raine Group';
          else if (content.includes('openai')) correction = 'OpenAI';
          else if (content.includes('meta platforms')) correction = 'Meta Platforms';
          else if (content.includes('alphabet inc')) correction = 'Alphabet Inc';
          
          // Try to extract company name from "Official name:" or similar patterns
          const nameMatch = searchContent.match(/(?:official name|company name|known as)[:\s]+([^\n\.]+)/i);
          if (nameMatch) {
            correction = nameMatch[1].trim();
          }
          
          return {
            success: true,
            results: results,
            message: `Found web information about "${query}"`,
            correction: correction,
            searchQuery: searchQuery
          };
        }
      } catch (webSearchError) {
        console.log('Web search error (falling back to suggestions):', webSearchError.message);
        
        // Fall back to smart suggestions if web search fails
        return this.getSmartSearchSuggestions(query);
      }
      
      // Fallback if no results
      return this.getSmartSearchSuggestions(query);
      
    } catch (error) {
      console.error('Web search error:', error);
      return {
        success: false,
        error: `Web search failed: ${error.message}`
      };
    }
  }
  
  getSmartSearchSuggestions(query) {
    const lowerQuery = query.toLowerCase();
    
    // Company name correction patterns
    const corrections = {
      'rain': 'The Raine Group',
      'rayne': 'The Raine Group', 
      'rane': 'The Raine Group',
      'openai': 'OpenAI',
      'meta': 'Meta Platforms',
      'alphabet': 'Alphabet Inc',
      'microsoft': 'Microsoft Corporation'
    };
    
    // Check for known company corrections
    for (const [partial, fullName] of Object.entries(corrections)) {
      if (lowerQuery.includes(partial)) {
        return {
          success: true,
          results: [{
            title: fullName,
            snippet: `Suggested correction for "${query}". Try searching for "${fullName}" in your CRM.`,
            suggestion: `Did you mean "${fullName}"?`,
            action: `Search CRM for "${fullName}"`
          }],
          correction: fullName,
          message: `Smart suggestion: "${fullName}" for your query "${query}"`
        };
      }
    }
    
    // Company search guidance with variations
    const companyIndicators = ['company', 'corp', 'inc', 'llc', 'ltd', 'group', 'partners', 'ventures', 'capital'];
    const isCompanyQuery = companyIndicators.some(indicator => lowerQuery.includes(indicator));
    
    if (isCompanyQuery || lowerQuery.split(' ').length <= 3) {
      const baseQuery = query.replace(/\b(company|corp|inc|llc|ltd|group|the)\b/gi, '').trim();
      const variations = [
        baseQuery,
        `The ${baseQuery}`,
        `${baseQuery} Inc`,
        `${baseQuery} LLC`,
        `${baseQuery} Group`,
        `${baseQuery} Corporation`
      ];
      
      return {
        success: true,
        results: [{
          title: `Company Search Suggestions for "${query}"`,
          snippet: `Try these variations in your CRM: ${variations.slice(0, 3).join(', ')}`,
          suggestions: variations,
          action: 'Try CRM search with variations'
        }],
        message: `Smart suggestions for company name variations`,
        variations: variations
      };
    }
    
    // General guidance
    return {
      success: true,
      results: [{
        title: `Search Guidance for "${query}"`,
        snippet: `Try searching your CRM first, then check company websites or LinkedIn for verification.`,
        suggestions: [
          `Search CRM for "${query}"`,
          `Try partial name searches`,
          `Check company website`,
          `Search LinkedIn`
        ]
      }],
      message: `Search guidance for "${query}"`
    };
  }
  

  async analyzeImage(imageIndex, analysisType) {
    try {
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
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: attachment.mime_type || 'image/jpeg',
                data: attachment.data
              }
            },
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
        imageName: attachment.filename || `Image ${imageIndex}`,
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

  // Advanced search implementation
  async advancedSearch(input) {
    try {
      console.log('Advanced search with input:', input);
      const results = await advancedSearch(input);
      
      if (results && results.length > 0) {
        const formattedResults = results.map(result => 
          `${result.name} (${result.type}) [ID: ${result.id}]: <${result.url || 'No URL available'}|here>`
        ).join('\n');
        return {
          success: true,
          message: `Advanced search found ${results.length} result(s):\n${formattedResults}`,
          data: results
        };
      } else {
        return {
          success: true,
          message: 'No results found for the advanced search criteria.',
          data: []
        };
      }
    } catch (error) {
      console.error('Advanced search error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Related entities search implementation
  async searchRelatedEntities(input) {
    try {
      console.log('Searching related entities with input:', input);
      const results = await searchRelatedEntities(input);
      
      if (results && results.length > 0) {
        const formattedResults = results.map(result => 
          `${result.name} (${result.type}) [ID: ${result.id}]: <${result.url || 'No URL available'}|here>`
        ).join('\n');
        return {
          success: true,
          message: `Found ${results.length} related ${input.target_entity_type}(s):\n${formattedResults}`,
          data: results
        };
      } else {
        return {
          success: true,
          message: `No related ${input.target_entity_type}s found for the ${input.source_entity_type}.`,
          data: []
        };
      }
    } catch (error) {
      console.error('Related entities search error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Time-based search implementation
  async searchByTimeRange(input) {
    try {
      console.log('Time-based search with input:', input);
      const results = await searchByTimeRange(input);
      
      if (results && results.length > 0) {
        const formattedResults = results.map(result => 
          `${result.name} (${result.type}) [ID: ${result.id}]: <${result.url || 'No URL available'}|here>`
        ).join('\n');
        
        const timeRange = input.start_date && input.end_date ? 
          `between ${input.start_date} and ${input.end_date}` :
          input.start_date ? `after ${input.start_date}` :
          input.end_date ? `before ${input.end_date}` : 'in the specified time range';
          
        return {
          success: true,
          message: `Found ${results.length} ${input.entity_type}(s) ${input.time_field || 'created'} ${timeRange}:\n${formattedResults}`,
          data: results
        };
      } else {
        const timeRange = input.start_date && input.end_date ? 
          `between ${input.start_date} and ${input.end_date}` :
          input.start_date ? `after ${input.start_date}` :
          input.end_date ? `before ${input.end_date}` : 'in the specified time range';
          
        return {
          success: true,
          message: `No ${input.entity_type}s found ${input.time_field || 'created'} ${timeRange}.`,
          data: []
        };
      }
    } catch (error) {
      console.error('Time-based search error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeAction(action, input) {
    // This method is called when executing approved actions
    return await this.executeToolCall({ name: action, input }, false);
  }

  async saveConversation(context, result, startTime) {
    try {
      const conversationData = {
        userId: context.userId || context.user,
        userName: context.user,
        channel: context.channel,
        threadTs: context.threadTs,
        messageTs: context.messageTs,
        userMessage: context.message,
        conversationHistory: context.conversationHistory,
        botActionHistory: context.botActionHistory,
        finalResponse: result.answer || result.error,
        toolsUsed: result.toolsUsed || [],
        success: result.success,
        error: result.error || null,
        processingTime: Date.now() - startTime,
        attachmentCount: context.attachments?.length || 0,
        agentType: 'claude-native'
      };
      
      await saveConversation(conversationData);
      console.log('💾 Conversation saved successfully (File storage)');
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  }
}

module.exports = { ClaudeAgent };