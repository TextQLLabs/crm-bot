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
  createDeal,
  getTasks,
  createTask,
  updateTask,
  searchTasksByContent
} = require('./attioService');

const { MemoryService } = require('./memoryService');

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
    const progressCallback = messageContext.progressCallback || (() => {});
    
    // Start conversation with user message
    let messages = [
      {
        role: 'user',
        content: userMessageContent
      }
    ];

    let toolsUsed = [];
    let iteration = 0;

    while (true) {
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
          // Progress update based on tool type
          switch (toolUse.name) {
            case 'search_crm':
            case 'advanced_search':
              await progressCallback('searching');
              break;
            case 'create_note':
            case 'create_person':
            case 'create_company':
            case 'create_deal':
              await progressCallback('creating');
              break;
            case 'update_entity':
              await progressCallback('updating');
              break;
            case 'manage_tasks':
              await progressCallback('managing_tasks');
              break;
            case 'web_search':
              await progressCallback('web_search');
              break;
            default:
              await progressCallback('thinking');
          }
          
          // Send tool execution start notification
          await progressCallback('tool_output', null, {
            tool: toolUse.name,
            input: toolUse.input,
            status: 'executing'
          });
          
          const toolResult = await this.executeToolCall({
            tool: toolUse.name,
            input: toolUse.input
          }, messageContext);
          
          // Send tool completion notification
          await progressCallback('tool_output', null, {
            tool: toolUse.name,
            input: toolUse.input,
            result: toolResult,
            status: toolResult.error ? 'failed' : 'completed'
          });
          
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
          // Send tool failure notification
          await progressCallback('tool_output', null, {
            tool: toolUse.name,
            input: toolUse.input,
            result: { error: error.message },
            status: 'failed'
          });
          
          await progressCallback('error', `Tool ${toolUse.name} failed: ${error.message}`);
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

    // This should never be reached due to the while(true) loop
    return {
      thinking: ['Unexpected end of conversation'],
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

*✅ Task Management*
- *manage_tasks*: Create, list, update, complete, and search tasks for any entity
  - Supports natural language deadlines: "next Friday", "tomorrow", "in 2 weeks"
  - Create tasks: "create a task for Blackstone to send contract by next Friday"
  - List tasks: "show all tasks for Blackstone" or "list incomplete tasks for deals"
  - Complete tasks: "mark task [id] as complete"
  - Search tasks: "find tasks mentioning 'contract' for Blackstone"
  - Update tasks: "update task deadline to next Monday"
  - *ASSIGNMENT SUPPORT*: Full task assignment capabilities
    - "assign to me": Uses current user's Slack -> Attio mapping from persistent memory
    - "assign to [name]": Resolves user by name from stored user mappings
    - "create task for Company X and assign to me": Natural language assignment

*🖼️ Image Analysis*
- You can view and analyze images shared in Slack conversations
- Extract text from screenshots, documents, and other visual content
- Analyze business-related content in images (emails, contracts, presentations, etc.)
- Help users by reading and interpreting visual information
- When an image is shared, provide detailed analysis of what you see

*Behavioral Principles*

*🧠 Use Common Sense First*
- Interpret requests as a human would, not as a rigid parser
- When something could mean multiple things, consider which interpretation makes more sense
- If genuinely ambiguous, ask for clarification rather than making assumptions
- Examples:
  - "Create a task for Obama" → If Obama isn't in CRM but is a known team member, they probably mean assign to Obama
  - "Create a task for Apple" → If Apple is a company in CRM, they probably mean a task about Apple
  - When unclear: "I can create a task about Obama or assign a task to Obama. Which did you mean?"

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
Execute complete workflows in single responses by calling multiple tools. Use common sense to interpret requests:
- Note operations require finding the entity first
- Task creation needs context about what the task is for
- Updates need the specific entity or task to update
- When creating tasks, consider:
  - Is this task ABOUT an entity or FOR a person to do?
  - Does the context suggest assignment? (e.g., "for John to..." suggests John is assignee)
  - Would a human understand this as an assignment or a subject?
- *CRITICAL*: When user asks to "count notes" or "get notes", you MUST call get_notes tool after finding the entity
- *🚨 CRITICAL UUID RULE*: For create_note, get_notes, delete_note, update_entity_field, manage_tasks - ALWAYS use the exact "id" field from search_crm results (e.g., "ffc6013f-2148-4427-8c1f-fec7b3f36554"). NEVER use slugs, names, or made-up IDs!

*🧠 Intelligent Context*
- Automatically learn from user interactions to become more helpful over time
- Remember frequently accessed accounts and recent deals for better suggestions
- Build contextual awareness of advisors, team members, and important contacts
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

*✅ Task Management Guidelines*
When managing tasks:
- *Natural language deadlines*: Parse "next Friday", "tomorrow at 3pm", "in 2 weeks" intelligently
- *Task URLs*: Always use format \`https://app.attio.com/textql-data/{entity_type}/{entity_id}/tasks\`
- *Entity resolution*: Always search for entity by name if ID not provided
- *Default deadline*: If no deadline specified, default to 1 week from now
- *Task content*: Be descriptive but concise in task descriptions
- *Completion*: Use "complete" action or update with is_completed: true
- *Search functionality*: Search within task content for specific keywords
- *ASSIGNMENT HANDLING*: Process assignment requests intelligently
  - "assign to me" or "attach to me" → set assign_to: "me"
  - "assign to [person name]" → set assign_to: "[person name]"
  - "assign to ethan" → set assign_to: "Ethan Ding"
  - Natural language like "create task for Company X and give it to John" → parse assignment intent
  - If no user mapping exists for assignee, provide helpful error with suggestion to set up mapping
- *REASSIGNMENT LIMITATION*: Due to Attio API limitations, tasks CANNOT be reassigned after creation
  - The Attio API only supports updating deadline and completion status
  - Assignees must be set when the task is created and cannot be changed
  - When users ask to reassign: "I'm unable to reassign tasks after creation due to an Attio API limitation. Tasks can only have their assignee set during creation. Would you like me to create a new task assigned to [person] instead?"
  - DO NOT say "I had difficulty" or imply technical issues - clearly state it's an API limitation

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
- *Task URLs*: \`<https://app.attio.com/textql-data/{entity_type}/{entity_id}/tasks\|View Tasks>\`

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
- *Task operations*: Use manage_tasks with appropriate action (create, list, update, complete, search)
- *Complex queries*: Use advanced_search with proper filters

*🤔 Handling Ambiguous Requests*
When a request could be interpreted multiple ways, use common sense and context:
- *"Create a task for [name]"* - Could mean:
  1. Create a task ABOUT that entity (if it's a company/deal in CRM)
  2. Create a task and ASSIGN it to that person (if it's a team member name)
  - First check if the name matches a known team member in user mappings
  - If unclear, ask: "Did you mean create a task about [name] or assign a task to [name]?"
- *"Create a task for [name] to [action]"* - This pattern almost always means:
  - ASSIGN the task to [name]
  - The task content is to do [action]
  - Example: "task for Braxton to reach out to David" → Assign to Braxton, task is "reach out to David"
- *Common patterns*:
  - "for [person] to [action]" → Assignment pattern
  - "about [entity]" → Task linked to that entity
  - "regarding [entity]" → Task linked to that entity
- *Always clarify ambiguity* - When unsure, briefly ask for clarification rather than guessing
- *Use context clues* - If they mention "reach out to [client]", the task is likely FOR the assignee ABOUT the client

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

*🔄 Daily Deal Assessment Guidelines*

When conducting daily deal assessments (recognizable by prompts containing "comprehensive assessment" and "Goal: Get to Financing"), follow these CRITICAL formatting requirements:

*📊 Assessment Note Title Format:*
- Start with stock ticker-style change: "🔺+15% | 🔻-$50K | July 16, 2025 | Update"
- Use 🔺 for positive changes, 🔻 for negative changes
- Show the most significant change first (probability % or Year 3 EV $)

*📋 First Three Sections (MANDATORY ORDER):*

1. **PROBABILITY CHANGE**
   - If first assessment: "BASELINE: Setting initial probability at X% based on [reasoning]"  
   - If updating: "BAYESIAN UPDATE: Probability X% → Y% based on [specific Slack thread URL that caused change]"
   - Always cite the specific Slack activity/thread that led to the change

2. **YEAR 1 EV CHANGE**
   - Format: "Year 1 EV: $X → $Y (reason for change)"
   - Show clear before/after values with reasoning

3. **YEAR 3 EV CHANGE** 
   - Format: "Year 3 EV: $X → $Y (reason for change)"
   - This change determines the 🔺/🔻 direction in title
   - Most important for title ticker format

*🎯 Assessment Quality Standards:*
- Lead with quantitative changes (probability %, EV amounts)
- Reference specific Slack threads/activity that drove updates
- Use Bayesian reasoning language for probability updates
- Maintain comprehensive analysis after the three mandatory sections
- Always update the CRM fields (close_probability, year_1_run_rate_ev, year_3_run_rate_ev_5) using update_entity_field

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
      },
      {
        name: 'manage_memory',
        description: 'Internal memory system for intelligent context tracking (internal use - operates silently)',
        input_schema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['add_hot_account', 'add_recent_deal', 'add_advisor', 'add_teammate', 'add_user_mapping', 'get_user_mapping', 'get_all_user_mappings', 'remove_user_mapping', 'remove_entry', 'get_memory', 'search_memory', 'get_summary', 'clear_all'],
              description: 'Action to perform on memory system'
            },
            data: {
              type: 'object',
              description: 'Data for the action (structure depends on action type)',
              properties: {
                id: { type: 'string', description: 'Unique identifier for the entry' },
                name: { type: 'string', description: 'Name of the person/company/deal' },
                type: { type: 'string', description: 'Type of entity (company, person, deal)' },
                company: { type: 'string', description: 'Associated company name' },
                value: { type: 'number', description: 'Deal value (for deals)' },
                stage: { type: 'string', description: 'Deal stage (for deals)' },
                email: { type: 'string', description: 'Email address' },
                phone: { type: 'string', description: 'Phone number' },
                expertise: { type: 'string', description: 'Area of expertise (for advisors)' },
                role: { type: 'string', description: 'Job role (for teammates)' },
                department: { type: 'string', description: 'Department (for teammates)' },
                notes: { type: 'string', description: 'Additional notes' },
                url: { type: 'string', description: 'Attio URL for the entity' },
                queryCount: { type: 'number', description: 'Number of times queried (for hot accounts)' },
                slackUserId: { type: 'string', description: 'Slack User ID (for user mappings)' },
                slackUserName: { type: 'string', description: 'Slack username (for user mappings)' },
                slackDisplayName: { type: 'string', description: 'Slack display name (for user mappings)' },
                attioWorkspaceMemberId: { type: 'string', description: 'Attio Workspace Member ID (for user mappings)' },
                attioUserName: { type: 'string', description: 'Attio user name (for user mappings)' },
                discoveryMethod: { type: 'string', description: 'How the user mapping was discovered (manual, auto, etc.)' }
              }
            },
            section: {
              type: 'string',
              enum: ['hotAccounts', 'recentDeals', 'advisors', 'teammates', 'userMappings'],
              description: 'Section to query (for get_memory and search_memory)'
            },
            query: {
              type: 'string',
              description: 'Search query (for search_memory)'
            },
            entryId: {
              type: 'string',
              description: 'ID of entry to remove (for remove_entry)'
            },
            listName: {
              type: 'string',
              description: 'Name of list to remove from (for remove_entry)'
            },
            slackUserId: {
              type: 'string',
              description: 'Slack User ID (for user mapping operations)'
            },
            attioWorkspaceMemberId: {
              type: 'string',
              description: 'Attio Workspace Member ID (for user mapping operations)'
            }
          },
          required: ['action']
        }
      },
      {
        name: 'extract_channel_history',
        description: 'Extract message history from a Slack channel within a specified time period',
        input_schema: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: 'Slack channel name (e.g., "#go-to-market", "#crm-bot-test")'
            },
            hours_back: {
              type: 'number',
              description: 'Number of hours to look back (default: 24)',
              default: 24
            },
            format: {
              type: 'string',
              enum: ['json', 'text'],
              description: 'Output format - json for structured data, text for readable format',
              default: 'text'
            }
          },
          required: ['channel']
        }
      },
      {
        name: 'manage_tasks',
        description: 'Manage tasks for companies, people, or deals. Create, list, update, complete, and search tasks. NOTE: Due to Attio API limitations, tasks CANNOT be reassigned after creation - assignees must be set when creating the task. Only deadline and completion status can be updated.',
        input_schema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['create', 'list', 'update', 'complete', 'search'],
              description: 'Action to perform on tasks (NOTE: reassign is not supported by Attio API)'
            },
            entity_name: {
              type: 'string',
              description: 'Name of the company, person, or deal (for create/list/search actions). Not needed if entity_id is provided.'
            },
            entity_id: {
              type: 'string',
              description: 'ID of the company, person, or deal (if known). Will be auto-resolved from entity_name if not provided.'
            },
            entity_type: {
              type: 'string',
              enum: ['company', 'person', 'deal'],
              description: 'Type of entity the task is for'
            },
            task_content: {
              type: 'string',
              description: 'Content/description of the task (for create action)'
            },
            deadline: {
              type: 'string',
              description: 'Natural language deadline like "next Friday", "tomorrow at 3pm", "in 2 weeks" (for create/update)'
            },
            task_id: {
              type: 'string',
              description: 'ID of the task to update or complete'
            },
            search_term: {
              type: 'string',
              description: 'Term to search for in task content (for search action)'
            },
            is_completed: {
              type: 'boolean',
              description: 'Filter by completion status (for list action) or mark as complete (for update action)'
            },
            assign_to: {
              type: 'string',
              description: 'Who to assign the task to during creation. Can be: "me" (current user), a person\'s name (e.g., "John Smith"), or an Attio member ID. NOTE: Assignees cannot be changed after task creation due to Attio API limitations.'
            },
            assign_to_me: {
              type: 'boolean',
              description: '[DEPRECATED - use assign_to: "me" instead] Assign to current user'
            },
            assignee_id: {
              type: 'string',
              description: '[DEPRECATED - use assign_to with ID instead] Specific Attio Workspace Member ID'
            },
            assignee_name: {
              type: 'string',
              description: '[DEPRECATED - use assign_to with name instead] Name of person to assign to'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of tasks to return (for list action)',
              default: 10
            }
          },
          required: ['action']
        }
      },
      {
        name: 'manage_user_mappings',
        description: 'Manage user mappings between Slack and Attio for task assignments',
        input_schema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['list', 'add', 'remove', 'get'],
              description: 'Action to perform on user mappings'
            },
            slack_user_id: {
              type: 'string',
              description: 'Slack User ID (for add/remove/get actions)'
            },
            slack_user_name: {
              type: 'string',
              description: 'Slack username (for add action)'
            },
            slack_display_name: {
              type: 'string',
              description: 'Slack display name (for add action)'
            },
            attio_workspace_member_id: {
              type: 'string',
              description: 'Attio Workspace Member ID (for add action)'
            },
            attio_user_name: {
              type: 'string',
              description: 'Attio user name (for add action)'
            },
            email: {
              type: 'string',
              description: 'Email address (for add action)'
            }
          },
          required: ['action']
        }
      }
    ];
  }

  /**
   * Extract message history from a Slack channel
   */
  async extractChannelHistory(input, messageContext) {
    try {
      const { channel, hours_back = 24, format = 'text' } = input;
      
      // Calculate time cutoff
      const cutoffTime = new Date(Date.now() - (hours_back * 60 * 60 * 1000));
      const cutoffTimestamp = cutoffTime.getTime() / 1000; // Convert to Unix timestamp
      
      console.log(`Extracting ${hours_back} hours of history from ${channel} since ${cutoffTime.toISOString()}`);
      
      // Get channel ID from name if needed (remove # prefix)
      const channelName = channel.replace('#', '');
      
      // For now, we'll use a mock implementation since we need to set up the Slack client
      // In the real implementation, this would use the Slack Web API
      
      // Mock data for testing
      const mockMessages = [
        {
          type: 'message',
          user: 'U04HC95ENRY',
          text: 'Had a great call with Blackstone today. They seem very interested in the pilot program.',
          ts: Math.floor(Date.now() / 1000 - 3600).toString(), // 1 hour ago
          user_profile: { real_name: 'Ethan Ding' }
        },
        {
          type: 'message', 
          user: 'U04HC95ENRY',
          text: 'Blackstone mentioned they want to move forward with the evaluation phase next week.',
          ts: Math.floor(Date.now() / 1000 - 7200).toString(), // 2 hours ago
          user_profile: { real_name: 'Ethan Ding' }
        },
        {
          type: 'message',
          user: 'U04HC95ENRY', 
          text: 'Scheduled follow-up meeting with Blackstone for Friday to discuss timeline and requirements.',
          ts: Math.floor(Date.now() / 1000 - 10800).toString(), // 3 hours ago
          user_profile: { real_name: 'Ethan Ding' }
        }
      ];
      
      // Filter messages by time cutoff
      const filteredMessages = mockMessages.filter(msg => {
        const msgTime = parseFloat(msg.ts);
        return msgTime >= cutoffTimestamp;
      });
      
      if (format === 'json') {
        return {
          success: true,
          channel: channel,
          hours_back: hours_back,
          message_count: filteredMessages.length,
          cutoff_time: cutoffTime.toISOString(),
          messages: filteredMessages
        };
      } else {
        // Text format for easy reading
        let output = `## Channel History: ${channel} (Last ${hours_back} hours)\\n`;
        output += `**Time Range:** ${cutoffTime.toLocaleString()} - ${new Date().toLocaleString()}\\n`;
        output += `**Messages Found:** ${filteredMessages.length}\\n\\n`;
        
        if (filteredMessages.length === 0) {
          output += '*No messages found in this time period.*';
        } else {
          filteredMessages.reverse(); // Show oldest first
          filteredMessages.forEach((msg, index) => {
            const msgTime = new Date(parseFloat(msg.ts) * 1000);
            const userName = msg.user_profile?.real_name || msg.user;
            output += `**${index + 1}.** [${msgTime.toLocaleTimeString()}] **${userName}:** ${msg.text}\\n\\n`;
          });
        }
        
        return {
          success: true,
          channel: channel,
          hours_back: hours_back,
          message_count: filteredMessages.length,
          formatted_output: output,
          raw_messages: filteredMessages
        };
      }
      
    } catch (error) {
      console.error('Error extracting channel history:', error);
      return {
        success: false,
        error: error.message,
        channel: input.channel,
        hours_back: input.hours_back || 24
      };
    }
  }

  /**
   * Manage user mappings for task assignments
   */
  async manageUserMappings(input, messageContext) {
    try {
      const { action, slack_user_id, slack_user_name, slack_display_name, attio_workspace_member_id, attio_user_name, email } = input;
      
      console.log(`Managing user mappings - Action: ${action}`, input);
      
      const { MemoryService } = require('./memoryService');
      const memoryService = new MemoryService();
      
      let result;
      
      switch (action) {
        case 'list': {
          const allMappings = await memoryService.getAllUserMappings();
          
          if (allMappings.success && allMappings.mappings.length > 0) {
            result = {
              success: true,
              mappings: allMappings.mappings,
              count: allMappings.count,
              message: `Found ${allMappings.count} user mapping${allMappings.count !== 1 ? 's' : ''}`
            };
          } else {
            result = {
              success: true,
              mappings: [],
              count: 0,
              message: 'No user mappings found. Users can be added automatically when they interact with the bot, or manually by an admin.'
            };
          }
          break;
        }
        
        case 'get': {
          if (!slack_user_id) {
            throw new Error('slack_user_id is required for get action');
          }
          
          const mapping = await memoryService.getUserMappingBySlackId(slack_user_id);
          result = {
            success: mapping.success,
            mapping: mapping.mapping || null,
            message: mapping.success 
              ? `Found user mapping for ${slack_user_id}`
              : `No user mapping found for ${slack_user_id}`
          };
          break;
        }
        
        case 'add': {
          if (!slack_user_id || !attio_workspace_member_id) {
            throw new Error('slack_user_id and attio_workspace_member_id are required for add action');
          }
          
          const mappingData = {
            slackUserId: slack_user_id,
            slackUserName: slack_user_name,
            slackDisplayName: slack_display_name,
            attioWorkspaceMemberId: attio_workspace_member_id,
            attioUserName: attio_user_name,
            email: email,
            discoveryMethod: 'manual'
          };
          
          const addResult = await memoryService.addUserMapping(mappingData);
          result = {
            success: addResult.success,
            count: addResult.count,
            message: addResult.success 
              ? `Successfully added/updated user mapping: ${slack_user_id} -> ${attio_workspace_member_id}`
              : 'Failed to add user mapping'
          };
          break;
        }
        
        case 'remove': {
          if (!slack_user_id) {
            throw new Error('slack_user_id is required for remove action');
          }
          
          const removeResult = await memoryService.removeUserMapping(slack_user_id);
          result = {
            success: removeResult.success,
            message: removeResult.success 
              ? `Successfully removed user mapping for ${slack_user_id}`
              : `No user mapping found to remove for ${slack_user_id}`
          };
          break;
        }
        
        default:
          throw new Error(`Unknown user mapping action: ${action}. Valid actions are: list, get, add, remove`);
      }
      
      return result;
      
    } catch (error) {
      console.error('Error managing user mappings:', error);
      return {
        success: false,
        error: error.message,
        action: input.action
      };
    }
  }

  /**
   * Manage tasks for entities (create, list, update, complete, search)
   */
  async manageTasks(input, messageContext) {
    try {
      const { action, entity_name, entity_id, entity_type, task_content, deadline, task_id, search_term, is_completed, assign_to, assign_to_me, assignee_id, assignee_name, limit = 10 } = input;
      
      console.log(`Managing tasks - Action: ${action}`, input);
      
      // Helper function to parse natural language dates
      const parseNaturalDate = (dateStr) => {
        if (!dateStr) return null;
        
        const now = new Date();
        const lowerStr = dateStr.toLowerCase();
        
        // Handle relative dates
        if (lowerStr.includes('tomorrow')) {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(17, 0, 0, 0); // Default to 5 PM
          return tomorrow.toISOString();
        }
        
        if (lowerStr.includes('today')) {
          const today = new Date(now);
          today.setHours(17, 0, 0, 0); // Default to 5 PM
          return today.toISOString();
        }
        
        if (lowerStr.includes('next')) {
          const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const dayMatch = daysOfWeek.find(day => lowerStr.includes(day));
          
          if (dayMatch) {
            const targetDay = daysOfWeek.indexOf(dayMatch);
            const currentDay = now.getDay();
            let daysToAdd = targetDay - currentDay;
            
            if (daysToAdd <= 0) {
              daysToAdd += 7; // Next week
            }
            
            const nextDate = new Date(now);
            nextDate.setDate(nextDate.getDate() + daysToAdd);
            nextDate.setHours(17, 0, 0, 0); // Default to 5 PM
            return nextDate.toISOString();
          }
          
          // Handle "next week", "next month"
          if (lowerStr.includes('week')) {
            const nextWeek = new Date(now);
            nextWeek.setDate(nextWeek.getDate() + 7);
            nextWeek.setHours(17, 0, 0, 0);
            return nextWeek.toISOString();
          }
          
          if (lowerStr.includes('month')) {
            const nextMonth = new Date(now);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            nextMonth.setHours(17, 0, 0, 0);
            return nextMonth.toISOString();
          }
        }
        
        // Handle "in X days/weeks"
        const inMatch = lowerStr.match(/in\s+(\d+)\s+(day|week|month)s?/);
        if (inMatch) {
          const amount = parseInt(inMatch[1]);
          const unit = inMatch[2];
          const futureDate = new Date(now);
          
          switch (unit) {
            case 'day':
              futureDate.setDate(futureDate.getDate() + amount);
              break;
            case 'week':
              futureDate.setDate(futureDate.getDate() + (amount * 7));
              break;
            case 'month':
              futureDate.setMonth(futureDate.getMonth() + amount);
              break;
          }
          
          futureDate.setHours(17, 0, 0, 0);
          return futureDate.toISOString();
        }
        
        // Try to parse as a regular date
        try {
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
          }
        } catch (e) {
          // Fall through to default
        }
        
        // Default to 1 week from now
        const defaultDate = new Date(now);
        defaultDate.setDate(defaultDate.getDate() + 7);
        defaultDate.setHours(17, 0, 0, 0);
        return defaultDate.toISOString();
      };
      
      // Helper function to resolve entity
      const resolveEntity = async (name, type, id) => {
        if (id) {
          return { id, type };
        }
        
        if (!name) {
          throw new Error('Either entity_name or entity_id must be provided');
        }
        
        // Search for the entity
        const searchResult = await searchAttio(name, type);
        
        // Check if searchResult is an array (from searchAttio) or has results property
        const results = Array.isArray(searchResult) ? searchResult : (searchResult.results || []);
        
        if (results.length === 0) {
          throw new Error(`No ${type} found matching "${name}"`);
        }
        
        // Use the first result
        const entity = results[0];
        return {
          id: entity.id,
          type: type,
          name: entity.name || entity.title
        };
      };
      
      // Helper function to format entity type for Attio API
      const formatEntityType = (type) => {
        switch (type) {
          case 'company':
            return 'companies';
          case 'person':
            return 'people';
          case 'deal':
            return 'deals';
          default:
            return type;
        }
      };
      
      // Helper function to resolve assignees
      const resolveAssignees = async () => {
        const assignees = [];
        
        // Handle new assign_to parameter first
        if (assign_to) {
          const { MemoryService } = require('./memoryService');
          const memoryService = new MemoryService();
          
          if (assign_to.toLowerCase() === 'me' && messageContext.userId) {
            // Assign to current user
            const userMappingResult = await memoryService.getUserMappingBySlackId(messageContext.userId);
            
            if (userMappingResult.success) {
              assignees.push({
                workspace_member_id: userMappingResult.mapping.attioWorkspaceMemberId
              });
              console.log(`Assigning to current user: ${messageContext.userId} -> ${userMappingResult.mapping.attioWorkspaceMemberId}`);
            } else {
              throw new Error(`Cannot assign to you - no user mapping found for your Slack account. Please contact an admin to set up your user mapping.`);
            }
          } else if (assign_to.match(/^[a-f0-9-]{36}$/i)) {
            // Looks like a UUID - treat as direct Attio member ID
            assignees.push({
              workspace_member_id: assign_to
            });
            console.log(`Direct assignee ID: ${assign_to}`);
          } else {
            // Try to resolve as a person name
            const allMappingsResult = await memoryService.getAllUserMappings();
            
            if (allMappingsResult.success) {
              const nameMatch = allMappingsResult.mappings.find(mapping => 
                mapping.slackUserName?.toLowerCase().includes(assign_to.toLowerCase()) ||
                mapping.slackDisplayName?.toLowerCase().includes(assign_to.toLowerCase()) ||
                mapping.attioUserName?.toLowerCase().includes(assign_to.toLowerCase())
              );
              
              if (nameMatch) {
                assignees.push({
                  workspace_member_id: nameMatch.attioWorkspaceMemberId
                });
                console.log(`Resolved assignee name "${assign_to}" to: ${nameMatch.attioWorkspaceMemberId}`);
              } else {
                const availableNames = allMappingsResult.mappings.map(m => m.attioUserName || m.slackDisplayName).join(', ');
                throw new Error(`Could not find user "${assign_to}". Available users: ${availableNames}`);
              }
            }
          }
        }
        // Handle deprecated parameters for backwards compatibility
        else if (assign_to_me && messageContext.userId) {
          // Look up current user mapping
          const { MemoryService } = require('./memoryService');
          const memoryService = new MemoryService();
          const userMappingResult = await memoryService.getUserMappingBySlackId(messageContext.userId);
          
          if (userMappingResult.success) {
            assignees.push({
              workspace_member_id: userMappingResult.mapping.attioWorkspaceMemberId
            });
            console.log(`Assigning to current user: ${messageContext.userId} -> ${userMappingResult.mapping.attioWorkspaceMemberId}`);
          } else {
            console.warn(`Could not find user mapping for current user: ${messageContext.userId}`);
            throw new Error(`Cannot assign to you - no user mapping found for your Slack account. Please contact an admin to set up your user mapping.`);
          }
        }
        
        if (assignee_id) {
          // Direct Attio Workspace Member ID provided
          assignees.push({
            workspace_member_id: assignee_id
          });
          console.log(`Direct assignee ID: ${assignee_id}`);
        }
        
        if (assignee_name) {
          // Try to resolve assignee name from user mappings
          const { MemoryService } = require('./memoryService');
          const memoryService = new MemoryService();
          const allMappingsResult = await memoryService.getAllUserMappings();
          
          if (allMappingsResult.success) {
            const nameMatch = allMappingsResult.mappings.find(mapping => 
              mapping.slackUserName?.toLowerCase().includes(assignee_name.toLowerCase()) ||
              mapping.slackDisplayName?.toLowerCase().includes(assignee_name.toLowerCase()) ||
              mapping.attioUserName?.toLowerCase().includes(assignee_name.toLowerCase())
            );
            
            if (nameMatch) {
              assignees.push({
                workspace_member_id: nameMatch.attioWorkspaceMemberId
              });
              console.log(`Resolved assignee name "${assignee_name}" to: ${nameMatch.attioWorkspaceMemberId}`);
            } else {
              console.warn(`Could not resolve assignee name: ${assignee_name}`);
              
              // Get available user names for helpful error message
              const availableNames = allMappingsResult.mappings
                .map(m => m.slackDisplayName || m.slackUserName || m.attioUserName)
                .filter(Boolean)
                .join(', ');
              
              const errorMessage = availableNames.length > 0 
                ? `Cannot find user mapping for "${assignee_name}". Available users: ${availableNames}`
                : `Cannot find user mapping for "${assignee_name}". No user mappings are currently configured. Please contact an admin to set up user mappings.`;
              
              throw new Error(errorMessage);
            }
          }
        }
        
        return assignees;
      };
      
      let result;
      
      switch (action) {
        case 'create': {
          if (!task_content) {
            throw new Error('task_content is required for creating a task');
          }
          
          if (!entity_type) {
            throw new Error('entity_type is required for creating a task');
          }
          
          // Resolve entity
          const entity = await resolveEntity(entity_name, entity_type, entity_id);
          
          // Parse deadline
          const deadlineISO = parseNaturalDate(deadline || 'in 1 week');
          
          // Resolve assignees
          const assignees = await resolveAssignees();
          
          // Create the task
          const taskData = {
            content: task_content,
            deadline_at: deadlineISO,
            linked_records: [{
              target_object: formatEntityType(entity_type),
              target_record_id: entity.id
            }],
            assignees: assignees
          };
          
          result = await createTask(taskData);
          
          if (result.success) {
            let assignmentInfo = '';
            if (assignees.length > 0) {
              assignmentInfo = ` - Assigned to ${assignees.length} user${assignees.length > 1 ? 's' : ''}`;
            }
            result.message = `✅ Created task for *${entity.name || entity_type}*: "${task_content}" - Due ${new Date(deadlineISO).toLocaleDateString()}${assignmentInfo}`;
          }
          break;
        }
        
        case 'list': {
          if (!entity_type) {
            throw new Error('entity_type is required for listing tasks');
          }
          
          // Resolve entity if name provided
          let entityInfo = null;
          if (entity_name || entity_id) {
            entityInfo = await resolveEntity(entity_name, entity_type, entity_id);
          }
          
          // Get tasks
          const options = {
            limit: limit
          };
          
          if (entityInfo) {
            options.linkedRecordId = entityInfo.id;
            options.linkedRecordType = formatEntityType(entity_type);
          }
          
          if (typeof is_completed === 'boolean') {
            options.isCompleted = is_completed;
          }
          
          const tasks = await getTasks(options);
          
          result = {
            success: true,
            tasks: tasks,
            count: tasks.length,
            entity: entityInfo,
            message: entityInfo 
              ? `Found ${tasks.length} task${tasks.length !== 1 ? 's' : ''} for *${entityInfo.name || entity_type}*`
              : `Found ${tasks.length} ${entity_type} task${tasks.length !== 1 ? 's' : ''}`
          };
          break;
        }
        
        case 'update': {
          if (!task_id) {
            throw new Error('task_id is required for updating a task');
          }
          
          const updates = {};
          
          if (deadline) {
            updates.deadline_at = parseNaturalDate(deadline);
          }
          
          if (typeof is_completed === 'boolean') {
            updates.is_completed = is_completed;
          }
          
          if (Object.keys(updates).length === 0) {
            throw new Error('No updates provided. Specify deadline or is_completed');
          }
          
          result = await updateTask(task_id, updates);
          
          if (result.success) {
            const updateDescriptions = [];
            if (updates.deadline_at) {
              updateDescriptions.push(`deadline to ${new Date(updates.deadline_at).toLocaleDateString()}`);
            }
            if (typeof updates.is_completed === 'boolean') {
              updateDescriptions.push(updates.is_completed ? 'marked as complete' : 'marked as incomplete');
            }
            
            result.message = `✅ Updated task: ${updateDescriptions.join(', ')}`;
          }
          break;
        }
        
        case 'complete': {
          if (!task_id) {
            throw new Error('task_id is required for completing a task');
          }
          
          result = await updateTask(task_id, { is_completed: true });
          
          if (result.success) {
            result.message = `✅ Marked task as complete`;
          }
          break;
        }
        
        case 'search': {
          if (!entity_type) {
            throw new Error('entity_type is required for searching tasks');
          }
          
          if (!search_term) {
            throw new Error('search_term is required for searching tasks');
          }
          
          // Resolve entity
          const entity = await resolveEntity(entity_name, entity_type, entity_id);
          
          const linkedRecord = {
            target_object: formatEntityType(entity_type),
            target_record_id: entity.id
          };
          
          const matchingTasks = await searchTasksByContent(linkedRecord, search_term);
          
          result = {
            success: true,
            tasks: matchingTasks,
            count: matchingTasks.length,
            entity: entity,
            search_term: search_term,
            message: `Found ${matchingTasks.length} task${matchingTasks.length !== 1 ? 's' : ''} matching "${search_term}" for *${entity.name || entity_type}*`
          };
          break;
        }
        
        case 'reassign': {
          // Reassignment is not supported by the Attio API
          throw new Error('Task reassignment is not supported by the Attio API. Tasks can only have their assignee set during creation and cannot be changed afterwards. Only the deadline and completion status can be updated after a task is created. Would you like me to create a new task with the correct assignee instead?');
        }
        
        default:
          throw new Error(`Unknown task action: ${action}. Valid actions are: create, list, update, complete, search`);
      }
      
      return result;
      
    } catch (error) {
      console.error('Error managing tasks:', error);
      return {
        success: false,
        error: error.message,
        action: input.action
      };
    }
  }

  /**
   * Execute individual tool calls with error handling
   */
  async executeToolCall(action, messageContext) {
    const startTime = Date.now();
    
    try {
      let result;
      
      // Add timeout wrapper for long-running operations
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tool call timed out')), this.toolCallTimeout);
      });
      
      const toolPromise = (async () => {
      
      switch (action.tool) {
        case 'search_crm':
          result = await searchAttio(action.input.query, action.input.entity_type);
          break;
        case 'advanced_search':
          result = await advancedSearch(action.input);
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
        case 'manage_memory':
          const memoryService = new MemoryService();
          const actionType = action.input.action;
          
          switch (actionType) {
            case 'add_hot_account':
              result = await memoryService.addHotAccount(action.input.data);
              break;
            case 'add_recent_deal':
              result = await memoryService.addRecentDeal(action.input.data);
              break;
            case 'add_advisor':
              result = await memoryService.addAdvisor(action.input.data);
              break;
            case 'add_teammate':
              result = await memoryService.addTeammate(action.input.data);
              break;
            case 'add_user_mapping':
              result = await memoryService.addUserMapping(action.input.data);
              break;
            case 'get_user_mapping':
              if (action.input.slackUserId) {
                result = await memoryService.getUserMappingBySlackId(action.input.slackUserId);
              } else if (action.input.attioWorkspaceMemberId) {
                result = await memoryService.getUserMappingByAttioId(action.input.attioWorkspaceMemberId);
              } else {
                throw new Error('Either slackUserId or attioWorkspaceMemberId must be provided for get_user_mapping');
              }
              break;
            case 'get_all_user_mappings':
              result = await memoryService.getAllUserMappings();
              break;
            case 'remove_user_mapping':
              if (action.input.slackUserId) {
                result = await memoryService.removeUserMapping(action.input.slackUserId);
              } else {
                throw new Error('slackUserId must be provided for remove_user_mapping');
              }
              break;
            case 'remove_entry':
              result = await memoryService.removeEntry(action.input.listName, action.input.entryId);
              break;
            case 'get_memory':
              result = await memoryService.getMemory(action.input.section);
              break;
            case 'search_memory':
              result = await memoryService.searchMemory(action.input.query, action.input.section);
              break;
            case 'get_summary':
              result = await memoryService.getContextSummary();
              break;
            case 'clear_all':
              result = await memoryService.clearAllMemory();
              break;
            default:
              throw new Error(`Unknown memory action: ${actionType}`);
          }
          break;
        case 'manage_tasks':
          result = await this.manageTasks(action.input, messageContext);
          break;
        case 'manage_user_mappings':
          result = await this.manageUserMappings(action.input, messageContext);
          break;
        case 'extract_channel_history':
          result = await this.extractChannelHistory(action.input, messageContext);
          break;
        default:
          throw new Error(`Unknown tool: ${action.tool}`);
      }
      
      return result;
      })();
      
      // Race between tool execution and timeout
      result = await Promise.race([toolPromise, timeoutPromise]);
      
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