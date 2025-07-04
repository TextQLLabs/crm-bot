const Anthropic = require('@anthropic-ai/sdk');

class ReactAgent {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    // Define available tools
    this.tools = {
      search_crm: {
        description: "Search for companies, people, or deals in Attio CRM",
        parameters: ["entity_type", "search_query"],
        execute: require('./attioService').searchAttio
      },
      create_note: {
        description: "Add a note to a CRM record",
        parameters: ["entity_type", "entity_id", "note_content"],
        execute: this.createNote.bind(this)
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
      }
    };
    
    this.maxIterations = 10;
  }

  async processMessage(message, options = {}) {
    const context = {
      message: message.text,
      user: message.userName,
      channel: message.channel,
      iterations: []
    };

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
        return {
          success: true,
          answer: step.finalAnswer,
          steps: context.iterations
        };
      }

      if (step.error) {
        console.error('ReAct step error:', step.error);
        // Continue to next iteration to try recovery
      }
    }

    return {
      success: false,
      error: 'Max iterations reached',
      steps: context.iterations
    };
  }

  isWriteAction(action) {
    const writeActions = ['create_note', 'create_entity', 'update_entity'];
    return writeActions.includes(action);
  }

  async reactStep(context, options = {}) {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(context);

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
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

    return `You are a CRM assistant using the ReAct (Reasoning and Acting) framework.
You help users manage their CRM data in Attio by searching, creating, and updating records.

You have access to these tools:
${toolDescriptions}

You must follow this EXACT format for EVERY response:

Thought: [Your reasoning about what to do next]
Action: [One of: ${Object.keys(this.tools).join(', ')}]
Action Input: {"param1": "value1", "param2": "value2"}

After I provide an Observation, continue with:

Thought: [Reflect on the observation]
Action: [Next action or none]
Action Input: [Input for action or none]

When you have the final answer:

Thought: I now have enough information to provide the final answer
Final Answer: [Your complete response to the user]

IMPORTANT:
- Always start with a Thought
- Use EXACT tool names from the list
- Action Input must be valid JSON
- Continue until you have a Final Answer
- If you need more information, use tools to get it
- When the user provides additional context (marked with "Additional context:"), incorporate it into your understanding
- Be aware that users may provide clarifications or additional details in follow-up messages`;
  }

  buildUserPrompt(context) {
    let prompt = `User message: "${context.message}"\n`;
    prompt += `User: ${context.user}\n`;
    prompt += `Channel: ${context.channel}\n\n`;

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
        
      case 'create_note':
        return await this.createNote(
          input.entity_type,
          input.entity_id,
          input.note_content || input.note
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
      const attioUrl = `https://app.attio.com/${workspace}/${entityType}s/record/${entityId}`;
      
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
}

module.exports = { ReactAgent };