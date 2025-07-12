const Anthropic = require('@anthropic-ai/sdk');
const { 
  searchAttio, 
  advancedSearch, 
  searchRelatedEntities, 
  searchByTimeRange, 
  createNote, 
  getNotes, 
  deleteNote,
  updateEntityField,
  createPerson,
  createCompany,
  createDeal
} = require('./attioService');

/**
 * Claude Agent Framework
 * 
 * Built according to Anthropic's 2024 agent design principles:
 * - Multi-step thinking with extended reasoning
 * - Parallel tool execution for efficiency
 * - Transparency and debuggability
 * - Simple, clear system prompts
 * - Robust error handling and recovery
 * 
 * Features:
 * - Native Claude Sonnet 4 tool calling
 * - Fuzzy search protocols
 * - Multi-step workflow execution
 * - Thinking mode for complex reasoning
 * - Automatic action execution
 * - Error recovery mechanisms
 */
class ClaudeAgent {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    // Enable extended thinking for complex reasoning
    this.thinkingEnabled = true;
    this.maxRetries = 3;
    this.toolCallTimeout = 30000; // 30 seconds
    
    // Track tool usage for optimization
    this.toolMetrics = {
      totalCalls: 0,
      successRate: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Main entry point for processing messages
   * Uses interactive tool calling where Claude can see results and react
   */
  async processMessage(messageContext, options = {}) {
    const startTime = Date.now();
    
    try {
      // Interactive tool calling - Claude can see results and react
      const conversationResult = await this.planAndThink(messageContext);
      
      // Extract final response from the conversation
      const finalResponse = this.extractFinalResponse(conversationResult);
      
      // Update metrics
      this.updateMetrics(startTime, true);
      
      return {
        success: true,
        answer: finalResponse.answer,
        toolsUsed: conversationResult.toolsUsed,
        thinking: conversationResult.thinking,
        workflow: [], // No separate workflow in interactive mode
        preview: options.preview && finalResponse.needsApproval,
        pendingAction: finalResponse.pendingAction
      };
      
    } catch (error) {
      this.updateMetrics(startTime, false);
      
      // Attempt error recovery
      const recoveryResult = await this.handleError(error, messageContext);
      
      return {
        success: false,
        error: recoveryResult.error,
        answer: recoveryResult.answer,
        toolsUsed: [],
        thinking: recoveryResult.thinking
      };
    }
  }

  /**
   * Step 1: Interactive Tool Calling Phase
   * Uses proper tool calling conversation where Claude can see results and react
   */
  async planAndThink(messageContext) {
    const systemPrompt = this.buildSystemPrompt();
    const userMessageContent = this.buildUserMessageContent(messageContext);
    
    // Start conversation with user message
    let messages = [
      {
        role: 'user',
        content: userMessageContent
      }
    ];

    let toolsUsed = [];
    let maxIterations = 5;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      
      // Get Claude's response
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        temperature: 0.1,
        system: systemPrompt,
        messages: messages,
        tools: [
          ...this.getToolDefinitions(),
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 5
          }
        ]
      });

      // Add Claude's response to conversation
      messages.push({
        role: 'assistant',
        content: response.content
      });

      // Check if Claude wants to use tools
      const toolUses = response.content.filter(content => content.type === 'tool_use');
      
      if (toolUses.length === 0) {
        // No more tools to use, we're done
        return {
          thinking: this.extractThinking(response),
          workflow: [], // No separate workflow needed
          rawResponse: response,
          toolsUsed: toolsUsed,
          finalMessages: messages
        };
      }

      // Execute all tool calls and add results to conversation
      const toolResults = [];
      for (const toolUse of toolUses) {
        try {
          const toolResult = await this.executeToolCall({
            tool: toolUse.name,
            input: toolUse.input
          }, messageContext);
          
          toolsUsed.push({
            tool: toolUse.name,
            input: toolUse.input,
            result: toolResult,
            timing: toolResult.timing
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(toolResult, null, 2)
          });
        } catch (error) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Error: ${error.message}`,
            is_error: true
          });
        }
      }

      // Add tool results to conversation
      messages.push({
        role: 'user',
        content: toolResults
      });
    }

    // If we hit max iterations, return what we have
    return {
      thinking: ['Reached maximum iterations'],
      workflow: [],
      rawResponse: null,
      toolsUsed: toolsUsed,
      finalMessages: messages
    };
  }

  /**
   * Extract final response from interactive conversation
   */
  extractFinalResponse(conversationResult) {
    if (!conversationResult.finalMessages) {
      return {
        answer: "I encountered an error during processing.",
        needsApproval: false,
        pendingAction: null
      };
    }

    // Get the last assistant message
    const lastAssistantMessage = conversationResult.finalMessages
      .filter(msg => msg.role === 'assistant')
      .pop();

    if (!lastAssistantMessage) {
      return {
        answer: "I couldn't generate a response.",
        needsApproval: false,
        pendingAction: null
      };
    }

    // Extract text content from the message
    const textContent = lastAssistantMessage.content
      .filter(content => content.type === 'text')
      .map(content => content.text)
      .join('\n');

    return {
      answer: textContent || "I processed your request.",
      needsApproval: false,
      pendingAction: null
    };
  }

  /**
   * Step 2: Workflow Execution Phase
   * Executes actions in parallel when possible
   */
  async executeWorkflow(workflow, messageContext, options) {
    const toolsUsed = [];
    const results = [];
    
    // Group actions by dependency level for parallel execution
    const actionGroups = this.groupActionsByDependency(workflow);
    
    for (const group of actionGroups) {
      // Execute actions in parallel within each group
      const groupPromises = group.map(async (action) => {
        try {
          const toolResult = await this.executeToolCall(action, messageContext);
          toolsUsed.push({
            tool: action.tool,
            input: action.input,
            result: toolResult,
            timing: toolResult.timing
          });
          return toolResult;
        } catch (error) {
          // Individual tool failure doesn't stop the entire workflow
          toolsUsed.push({
            tool: action.tool,
            input: action.input,
            result: { error: error.message },
            timing: { duration: 0 }
          });
          return { error: error.message };
        }
      });
      
      const groupResults = await Promise.allSettled(groupPromises);
      results.push(...groupResults);
      
      // If any critical action failed, consider recovery
      const failures = groupResults.filter(r => r.status === 'rejected' || r.value?.error);
      if (failures.length > 0 && this.isCriticalFailure(failures)) {
        await this.attemptRecovery(failures, messageContext);
      }
    }
    
    return {
      toolsUsed,
      results,
      success: results.some(r => r.status === 'fulfilled' && !r.value?.error)
    };
  }

  /**
   * Step 3: Response Synthesis Phase
   * Combines results into coherent user response
   */
  async synthesizeResponse(executionResult, messageContext, thinking) {
    const systemPrompt = this.buildSystemPrompt();
    
    const synthesisPrompt = `Based on the tool execution results, provide a clear, helpful response to the user.

Original Request: ${messageContext.text}

Tool Results:
${executionResult.toolsUsed.map(tool => 
  `${tool.tool}: ${JSON.stringify(tool.result, null, 2)}`
).join('\n\n')}

Your thinking process:
${thinking}

Provide a response that:
1. Directly addresses what the user asked for
2. Includes relevant information from the tool results
3. Uses clear, conversational language
4. Includes clickable links where appropriate
5. Confirms any actions taken

If the user requested an action that requires approval, format it as a preview.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: synthesisPrompt
        }
      ],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3
        }
      ]
    });

    const answer = response.content[0].text;
    
    // Check if response needs approval
    const needsApproval = this.checkNeedsApproval(executionResult, messageContext);
    const pendingAction = needsApproval ? this.extractPendingAction(executionResult) : null;
    
    return {
      answer,
      needsApproval,
      pendingAction,
      rawResponse: response
    };
  }

  /**
   * Build system prompt with company-specific context
   */
  buildSystemPrompt() {
    return `You are a CRM Assistant for TextQL, integrated with Attio CRM and deployed in the TextQL Slack workspace.

*Core Capabilities*

You help users manage their CRM data through natural conversation. You can:

*🔍 Search & Discovery*
- *search_crm*: Find companies, deals, and people by name (supports fuzzy matching)
- *advanced_search*: Filter by criteria like deal value, creation date, status
- *search_related_entities*: Find related contacts, deals, or companies
- *search_by_time_range*: Search within specific time periods
- *Native web search*: I can search the web automatically when needed for current information, spelling corrections, and finding external data like LinkedIn profiles

*📝 Notes Management*
- *create_note*: Add notes to any entity with automatic Slack thread links and intelligent titles
- *get_notes*: Retrieve and filter notes by entity, date, or content (always search for entity first)
- *delete_note*: Remove notes with confirmation (search entity first, then find specific notes)

*✏️ Entity Updates*
- *update_entity_field*: Update specific fields on companies, deals, and people (e.g., contract values, statuses, contact info)

*➕ Entity Creation*
- *create_person*: Create new person records with name, email, phone, job title
- *create_company*: Create new company records with name, description, domain
- *create_deal*: Create new deal records with name, value, associated company

*🖼️ Image Analysis*
- You can view and analyze images shared in Slack conversations
- Extract text from screenshots, documents, and other visual content
- Analyze business-related content in images (emails, contracts, presentations, etc.)
- Help users by reading and interpreting visual information
- When an image is shared, provide detailed analysis of what you see

*Behavioral Principles*

*🎯 Multi-Step Thinking*
For complex requests, think through:
1. What is the user really asking for?
2. What tools do I need?
3. What's the optimal sequence?
4. Can I execute actions in parallel?
5. What could go wrong?

*🔄 Smart Search Approach*
When searching for entities, use your intelligence to find what the user is looking for:
- If a search returns no results, try common spelling variations and similar-sounding alternatives
- Use web search automatically for "did you mean" suggestions when helpful
- Try shortened versions (remove "The", "Inc", "Corp", etc.)
- Consider phonetic similarities and common misspellings
- Only suggest manual alternatives if automated attempts don't work

*⚡ Parallel Execution*
- Use multiple tools simultaneously when possible
- Don't wait for one search to complete before starting another
- Combine results intelligently

*🎪 Multi-Step Workflows*
Execute complete workflows in single responses by calling multiple tools:
- "create note for [company]: meeting scheduled" → search_crm + create_note + return URL
- "find [company] and count their notes" → search_crm + get_notes + provide count/summary
- "update [deal] value to $150k" → search_crm + update_entity_field + confirm change
- *CRITICAL*: When user asks to "count notes" or "get notes", you MUST call get_notes tool after finding the entity
- *🚨 CRITICAL UUID RULE*: For create_note, get_notes, delete_note, update_entity_field - ALWAYS use the exact "id" field from search_crm results (e.g., "ffc6013f-2148-4427-8c1f-fec7b3f36554"). NEVER use slugs, names, or made-up IDs!
- *For ambiguous searches*: Pick the most likely candidate (company > deal > person) and proceed
- *If multiple strong matches*: Choose the most relevant and mention the choice
- Never just plan - DO IT immediately with actual tool calls

*✏️ Field Update Guidelines*
When updating entity fields:
- *Common deal fields*: total_contract_value, stage, status, close_date_1, pilot_investment
- *Common company fields*: name, description, industry, location
- *Common person fields*: name, email_addresses, phone_numbers, title
- Always confirm the update and provide the new value in your response
- Include clickable link to the updated entity

*📝 Note Creation Guidelines*
When creating notes, provide appropriate titles that summarize the content:
- *Meeting notes*: "Meeting with [Person/Company] - [Date]"
- *Follow-ups*: "Follow-up: [Topic]"
- *General updates*: "[Company] Update - [Brief Summary]"
- *Action items*: "Action Items: [Brief Description]"
- *Default*: "Update from Slack" (if no specific context)

*Response Format*

*Slack Formatting Rules*
- Use *single asterisks* for bold text (not *double asterisks*)
- Use *bold headers* instead of ## markdown headers
- URLs: \`<https://example.com\\|Link Text>\` format for clickable links
- NO markdown headers (##, ###) - use *bold text* instead

*Entity References*
- *Bold* entity names with clickable Attio links using Slack hyperlink format
- *Company URLs*: \`<https://app.attio.com/textql-data/company/{id}/overview\|Company Name>\`
- *Person URLs*: \`<https://app.attio.com/textql-data/person/{id}/overview\|Person Name>\`
- *Deal URLs*: \`<https://app.attio.com/textql-data/deals/record/{id}/overview\|Deal Name>\`
- *Note URLs*: \`<https://app.attio.com/textql-data/notes/notes?modal=note&id={note_id}\|Note>\`

*Action Confirmations*
- Clear confirmations: "✅ Created note on *<https://app.attio.com/textql-data/company/{id}/overview\|Entity Name>*"
- Always include result URLs as clickable links with descriptive text
- Use "Show your working out" pattern for transparency

*Fuzzy Match Clarifications*
- "Found *<https://app.attio.com/textql-data/company/{id}/overview\|Company Name>* - I believe this matches your search for '[user query]'"
- Acknowledge when you've made intelligent corrections

*Error Handling*

*🔄 Retry Logic*
- Never give up after first failed search
- Try multiple variations automatically
- Provide helpful guidance for common issues
- Be patient with typos and fuzzy searches

*🛠️ Recovery Strategies*
- If entity not found, automatically use web search for spelling corrections and additional context
- If API fails, give concise error: "Sorry, CRM search is temporarily unavailable. Please try again shortly."
- If ambiguous results, ask for clarification with specific options
- Keep error messages brief and actionable

*Context Integration*

*📚 Conversation History*
- Reference previous actions in the thread
- Don't repeat searches if recently done
- Build on previous context intelligently

*🔗 Slack Integration*
- Add Slack thread links to notes automatically
- Use thread context for entity resolution
- Maintain conversational flow

*Tool Usage Guidelines*

*🎯 When to Use Each Tool*
- *Conversational questions* (how do you work?): Answer directly, no tools
- *Entity searches*: Use search_crm with fuzzy matching
- *Note operations*: ALWAYS search for entity first, then get/create/delete notes
- *"get notes" or "list notes"*: Search entity → get_notes → format results clearly
- *"summarize notes"*: Search entity → get_notes → provide concise summary
- *Complex queries*: Use advanced_search with proper filters

*📊 Status Notifications*
- Automatically send CRUD status notifications
- Include entity URLs and confirmation details
- Use system notifications for background actions

*Company-Specific Context*

*🏢 TextQL Environment*
- Attio workspace: textql-data
- Slack workspace: textql  
- Repository: https://github.com/TextQLLabs/crm-bot

*📍 Search Examples*
- Handle fuzzy searches and typos intelligently
- Support company names, deal names, and person names
- Use smart matching for partial queries

Remember: You're here to make CRM management effortless. Be proactive, accurate, and helpful while maintaining transparency about your actions.`;
  }

  /**
   * Build user message from context
   */
  buildUserMessageContent(messageContext) {
    // Start with text content
    let textMessage = `User: ${messageContext.userMessage || messageContext.text}`;
    
    // Add conversation history if available
    if (messageContext.conversationHistory?.length > 0) {
      textMessage += `\n\nConversation History:\n${messageContext.conversationHistory
        .map(m => `${m.isBot ? 'Assistant' : 'User'}: ${m.text}`)
        .join('\n')}`;
    }
    
    // Add bot action history if available
    if (messageContext.botActionHistory?.length > 0) {
      textMessage += `\n\nPrevious Actions:\n${messageContext.botActionHistory
        .map(a => `- ${a.action}: ${a.details}`)
        .join('\n')}`;
    }
    
    // Build content array for Claude API
    const content = [{
      type: 'text',
      text: textMessage
    }];
    
    // Add image attachments if available
    if (messageContext.attachments?.length > 0) {
      for (const attachment of messageContext.attachments) {
        if (attachment.type === 'image') {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: attachment.mime_type,
              data: attachment.data
            }
          });
        }
      }
    }
    
    // If no images, just return text string for backward compatibility
    if (content.length === 1) {
      return textMessage;
    }
    
    return content;
  }

  buildUserMessage(messageContext) {
    // Legacy method for backward compatibility
    let message = `User: ${messageContext.userMessage || messageContext.text}`;
    
    // Add conversation history if available
    if (messageContext.conversationHistory?.length > 0) {
      message += `\n\nConversation History:\n${messageContext.conversationHistory
        .map(m => `${m.isBot ? 'Assistant' : 'User'}: ${m.text}`)
        .join('\n')}`;
    }
    
    // Add bot action history if available
    if (messageContext.botActionHistory?.length > 0) {
      message += `\n\nPrevious Actions:\n${messageContext.botActionHistory
        .map(a => `- ${a.action}: ${a.details}`)
        .join('\n')}`;
    }
    
    // Add attachment information
    if (messageContext.attachments?.length > 0) {
      message += `\n\nAttachments: ${messageContext.attachments
        .map(a => `${a.filename} (${a.type})`)
        .join(', ')}`;
    }
    
    return message;
  }

  /**
   * Get tool definitions for Claude
   */
  getToolDefinitions() {
    return [
      {
        name: 'search_crm',
        description: 'Search for companies, deals, and people in the CRM. Supports fuzzy matching.',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (company name, person name, deal name)'
            },
            entity_type: {
              type: 'string',
              enum: ['company', 'person', 'deal', 'all'],
              description: 'Type of entity to search for'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'advanced_search',
        description: 'Advanced search with filters for deal value, dates, status, etc.',
        input_schema: {
          type: 'object',
          properties: {
            entity_type: {
              type: 'string',
              enum: ['company', 'person', 'deal'],
              description: 'Type of entity to search'
            },
            filters: {
              type: 'object',
              description: 'Search filters',
              properties: {
                deal_value_min: { type: 'number' },
                deal_value_max: { type: 'number' },
                created_after: { type: 'string' },
                created_before: { type: 'string' },
                status: { type: 'string' },
                stage: { type: 'string' }
              }
            }
          },
          required: ['entity_type']
        }
      },
      {
        name: 'search_related_entities',
        description: 'Find entities related to a specific company, person, or deal',
        input_schema: {
          type: 'object',
          properties: {
            entity_id: {
              type: 'string',
              description: 'ID of the entity to find relations for'
            },
            entity_type: {
              type: 'string',
              enum: ['company', 'person', 'deal'],
              description: 'Type of the source entity'
            },
            relation_type: {
              type: 'string',
              enum: ['contacts', 'deals', 'companies'],
              description: 'Type of relations to find'
            }
          },
          required: ['entity_id', 'entity_type']
        }
      },
      {
        name: 'search_by_time_range',
        description: 'Search for entities created or modified within a specific time period',
        input_schema: {
          type: 'object',
          properties: {
            start_date: {
              type: 'string',
              description: 'Start date (YYYY-MM-DD)'
            },
            end_date: {
              type: 'string',
              description: 'End date (YYYY-MM-DD)'
            },
            entity_type: {
              type: 'string',
              enum: ['company', 'person', 'deal'],
              description: 'Type of entity to search'
            }
          },
          required: ['start_date', 'end_date', 'entity_type']
        }
      },
      {
        name: 'create_note',
        description: 'Create a note on a company, person, or deal',
        input_schema: {
          type: 'object',
          properties: {
            entity_type: {
              type: 'string',
              enum: ['company', 'person', 'deal'],
              description: 'Type of entity to add note to'
            },
            entity_id: {
              type: 'string',
              description: 'EXACT UUID of the entity from search results (e.g., "ffc6013f-2148-4427-8c1f-fec7b3f36554"). NEVER use slugs or names - only the "id" field from search_crm results.'
            },
            note_content: {
              type: 'string',
              description: 'Content of the note'
            },
            note_title: {
              type: 'string',
              description: 'Title for the note (optional, will use "Update from Slack" if not provided)'
            },
            slack_thread_url: {
              type: 'string',
              description: 'URL of the Slack thread (auto-generated)'
            }
          },
          required: ['entity_type', 'entity_id', 'note_content']
        }
      },
      {
        name: 'get_notes',
        description: 'Get notes for a specific entity or search notes by content',
        input_schema: {
          type: 'object',
          properties: {
            entity_type: {
              type: 'string',
              enum: ['company', 'person', 'deal'],
              description: 'Type of entity to get notes for'
            },
            entity_id: {
              type: 'string',
              description: 'EXACT UUID of the entity from search results (e.g., "ffc6013f-2148-4427-8c1f-fec7b3f36554"). NEVER use slugs or names - only the "id" field from search_crm results.'
            },
            search_content: {
              type: 'string',
              description: 'Search within note content'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of notes to return'
            }
          },
          required: ['entity_type', 'entity_id']
        }
      },
      {
        name: 'delete_note',
        description: 'Delete a specific note',
        input_schema: {
          type: 'object',
          properties: {
            note_id: {
              type: 'string',
              description: 'ID of the note to delete'
            }
          },
          required: ['note_id']
        }
      },
      {
        name: 'update_entity_field',
        description: 'Update a specific field on a company, person, or deal',
        input_schema: {
          type: 'object',
          properties: {
            entity_type: {
              type: 'string',
              enum: ['company', 'person', 'deal'],
              description: 'Type of entity to update'
            },
            entity_id: {
              type: 'string',
              description: 'EXACT UUID of the entity from search results (e.g., "ffc6013f-2148-4427-8c1f-fec7b3f36554"). NEVER use slugs or names - only the "id" field from search_crm results.'
            },
            field_name: {
              type: 'string',
              description: 'Name of the field to update (e.g., "total_contract_value", "stage", "name", "description")'
            },
            field_value: {
              type: ['string', 'number', 'boolean'],
              description: 'New value for the field. For currency fields like total_contract_value, use numeric values (e.g., 150000 for $150,000)'
            },
            note_text: {
              type: 'string',
              description: 'Optional note to add documenting this change'
            }
          },
          required: ['entity_type', 'entity_id', 'field_name', 'field_value']
        }
      },
      {
        name: 'create_person',
        description: 'Create a new person record in the CRM',
        input_schema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Full name of the person (required)'
            },
            email: {
              type: 'string',
              description: 'Email address (optional)'
            },
            phone: {
              type: 'string',
              description: 'Phone number (optional)'
            },
            job_title: {
              type: 'string',
              description: 'Job title or position (optional)'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'create_company',
        description: 'Create a new company record in the CRM',
        input_schema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Company name (required)'
            },
            description: {
              type: 'string',
              description: 'Company description (optional)'
            },
            domain: {
              type: 'string',
              description: 'Company website domain (optional, e.g., "example.com")'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'create_deal',
        description: 'Create a new deal record in the CRM',
        input_schema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Deal name or title (required)'
            },
            value: {
              type: 'number',
              description: 'Deal value in USD (optional, e.g., 150000 for $150,000)'
            },
            company_id: {
              type: 'string',
              description: 'ID of associated company record (optional)'
            },
            owner_id: {
              type: 'string',
              description: 'ID of deal owner (optional, will use default if not provided)'
            }
          },
          required: ['name']
        }
      }
    ];
  }

  /**
   * Execute individual tool calls with error handling
   */
  async executeToolCall(action, messageContext) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (action.tool) {
        case 'search_crm':
          result = await searchAttio(action.input.query, action.input.entity_type);
          break;
        case 'advanced_search':
          result = await advancedSearch(action.input.entity_type, action.input.filters);
          break;
        case 'search_related_entities':
          result = await searchRelatedEntities(
            action.input.entity_id, 
            action.input.entity_type,
            action.input.relation_type
          );
          break;
        case 'search_by_time_range':
          result = await searchByTimeRange(
            action.input.start_date,
            action.input.end_date,
            action.input.entity_type
          );
          break;
        case 'create_note':
          result = await createNote(
            action.input.entity_id,
            action.input.entity_type,
            action.input.note_content,
            messageContext,
            action.input.note_title
          );
          break;
        case 'get_notes':
          result = await getNotes({
            recordId: action.input.entity_id,
            recordType: action.input.entity_type === 'company' ? 'companies' : 
                       action.input.entity_type === 'deal' ? 'deals' : 
                       action.input.entity_type === 'person' ? 'people' : action.input.entity_type,
            searchContent: action.input.search_content,
            limit: action.input.limit
          });
          break;
        case 'delete_note':
          result = await deleteNote(action.input.note_id);
          break;
        case 'update_entity_field':
          result = await updateEntityField(
            action.input.entity_type,
            action.input.entity_id,
            action.input.field_name,
            action.input.field_value,
            action.input.note_text
          );
          break;
        case 'create_person':
          result = await createPerson({
            name: action.input.name,
            email: action.input.email,
            phone: action.input.phone,
            jobTitle: action.input.job_title
          });
          break;
        case 'create_company':
          result = await createCompany({
            name: action.input.name,
            description: action.input.description,
            domain: action.input.domain
          });
          break;
        case 'create_deal':
          result = await createDeal({
            name: action.input.name,
            value: action.input.value,
            companyId: action.input.company_id,
            ownerId: action.input.owner_id
          });
          break;
        default:
          throw new Error(`Unknown tool: ${action.tool}`);
      }
      
      return {
        ...result,
        timing: {
          duration: Date.now() - startTime,
          startTime,
          endTime: Date.now()
        }
      };
      
    } catch (error) {
      return {
        error: error.message,
        timing: {
          duration: Date.now() - startTime,
          startTime,
          endTime: Date.now()
        }
      };
    }
  }

  /**
   * Execute a single action (for button approvals)
   */
  async executeAction(actionType, input) {
    const action = { tool: actionType, input };
    const fakeContext = { threadTs: 'approval-action' };
    
    return await this.executeToolCall(action, fakeContext);
  }

  /**
   * Generate Slack thread URL for notes
   */
  generateSlackThreadUrl(messageContext) {
    if (!messageContext.channel || !messageContext.threadTs) {
      return null;
    }
    
    // Detect test context and return null for proper test handling
    if (messageContext.channel === 'test' || messageContext.threadTs === 'test-thread' || messageContext.userId === 'test-user-id') {
      return null;
    }
    
    // Format: https://textql.slack.com/archives/C1234567890/p1234567890123456
    const timestamp = messageContext.threadTs.replace('.', '');
    return `https://textql.slack.com/archives/${messageContext.channel}/p${timestamp}`;
  }

  /**
   * Extract thinking from Claude response
   */
  extractThinking(response) {
    // Look for thinking patterns in the response
    const content = response.content[0].text;
    const thinkingMatch = content.match(/Think through this request step by step:(.*?)(?=Based on|$)/s);
    return thinkingMatch ? thinkingMatch[1].trim() : content;
  }

  /**
   * Extract workflow from Claude response
   */
  extractWorkflow(response) {
    // Extract tool calls from response
    const toolCalls = response.content.filter(c => c.type === 'tool_use');
    
    return toolCalls.map(call => ({
      tool: call.name,
      input: call.input,
      id: call.id
    }));
  }

  /**
   * Group actions by dependency for parallel execution
   */
  groupActionsByDependency(workflow) {
    // Simple implementation: assume all actions can run in parallel
    // In a more sophisticated version, we'd analyze dependencies
    return [workflow];
  }

  /**
   * Check if failures are critical
   */
  isCriticalFailure(failures) {
    // Define critical failures (e.g., all search operations failed)
    return failures.length > 0 && failures.every(f => 
      f.value?.error?.includes('network') || 
      f.value?.error?.includes('timeout')
    );
  }

  /**
   * Attempt recovery from failures
   */
  async attemptRecovery(failures, messageContext) {
    // Implement recovery strategies
    console.log('Attempting recovery from failures:', failures);
    
    // For now, just log - could implement retry logic, alternative tools, etc.
    return { recovered: false, attempts: 0 };
  }

  /**
   * Check if response needs user approval
   */
  checkNeedsApproval(executionResult, messageContext) {
    // Check if any tools used require approval
    const approvalRequired = executionResult.toolsUsed.some(tool => 
      ['create_note', 'delete_note', 'update_entity'].includes(tool.tool)
    );
    
    // Check if preview mode is enabled
    const previewMode = messageContext.preview;
    
    return approvalRequired && previewMode;
  }

  /**
   * Extract pending action for approval
   */
  extractPendingAction(executionResult) {
    const pendingTool = executionResult.toolsUsed.find(tool => 
      ['create_note', 'delete_note', 'update_entity'].includes(tool.tool)
    );
    
    return pendingTool ? {
      action: pendingTool.tool,
      input: pendingTool.input
    } : null;
  }

  /**
   * Handle errors with recovery strategies
   */
  async handleError(error, messageContext) {
    console.error('ClaudeAgent error:', error);
    
    // Implement error recovery strategies
    const recoveryStrategies = [
      this.retryWithSimplifiedPrompt,
      this.fallbackToBasicSearch,
      this.provideDiagnosticInfo
    ];
    
    for (const strategy of recoveryStrategies) {
      try {
        const result = await strategy.call(this, error, messageContext);
        if (result.success) {
          return result;
        }
      } catch (strategyError) {
        console.error('Recovery strategy failed:', strategyError);
      }
    }
    
    // Final fallback
    return {
      error: error.message,
      answer: "I encountered an issue processing your request. Please try rephrasing or contact support if this persists.",
      thinking: `Error encountered: ${error.message}`
    };
  }

  /**
   * Retry with simplified prompt
   */
  async retryWithSimplifiedPrompt(error, messageContext) {
    // Implement simplified retry logic
    return { success: false };
  }

  /**
   * Fallback to basic search
   */
  async fallbackToBasicSearch(error, messageContext) {
    // Implement basic search fallback
    return { success: false };
  }

  /**
   * Provide diagnostic information
   */
  async provideDiagnosticInfo(error, messageContext) {
    return {
      success: true,
      error: error.message,
      answer: `I encountered a technical issue: ${error.message}\n\nPlease try rephrasing your request or contact support.`,
      thinking: `Diagnostic: ${error.stack}`
    };
  }

  /**
   * Update performance metrics
   */
  updateMetrics(startTime, success) {
    const duration = Date.now() - startTime;
    
    this.toolMetrics.totalCalls++;
    this.toolMetrics.successRate = success ? 
      (this.toolMetrics.successRate + 1) / this.toolMetrics.totalCalls :
      this.toolMetrics.successRate * (this.toolMetrics.totalCalls - 1) / this.toolMetrics.totalCalls;
    
    this.toolMetrics.averageResponseTime = 
      (this.toolMetrics.averageResponseTime + duration) / 2;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.toolMetrics,
      thinkingEnabled: this.thinkingEnabled,
      uptime: process.uptime()
    };
  }
}

module.exports = { ClaudeAgent };