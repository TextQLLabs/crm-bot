/**
 * ReactAgent for Cloudflare Workers
 * Uses fetch() and Web APIs instead of Node.js dependencies
 */

export class ReactAgentWorker {
  constructor(env) {
    this.anthropicApiKey = env.ANTHROPIC_API_KEY;
    this.attioApiKey = env.ATTIO_API_KEY;
    
    // Define available tools
    this.tools = {
      search_crm: {
        description: "Search for companies, people, or deals in Attio CRM",
        parameters: ["entity_type", "search_query"],
        execute: this.searchAttio.bind(this)
      },
      create_note: {
        description: "Add a note to a CRM record",
        parameters: ["entity_type", "entity_id", "note_content"],
        execute: this.createNote.bind(this)
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

    const previewMode = options.preview || false;

    // ReAct loop
    for (let i = 0; i < this.maxIterations; i++) {
      const step = await this.reactStep(context, { previewMode });
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
    }

    return {
      success: false,
      error: 'Max iterations reached',
      steps: context.iterations
    };
  }

  isWriteAction(action) {
    return ['create_note', 'create_entity', 'update_entity'].includes(action);
  }

  async reactStep(context, options = {}) {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(context);

    try {
      // Call Anthropic API using fetch
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-opus-20240229',
          max_tokens: 1000,
          temperature: 0.3,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: userPrompt
          }]
        })
      });

      const data = await response.json();
      const responseText = data.content[0].text;
      console.log('ReAct Response:', responseText);

      // Parse the response
      const parsed = this.parseReactResponse(responseText);
      
      // Execute action if present
      if (parsed.action && parsed.actionInput) {
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

Follow the ReAct format:
Thought: [Your reasoning]
Action: [Tool name]
Action Input: {"param": "value"}

When you have the final answer:
Thought: I have the information needed
Final Answer: [Your response]`;
  }

  buildUserPrompt(context) {
    let prompt = `User message: "${context.message}"\n`;
    prompt += `User: ${context.user}\n\n`;

    if (context.iterations.length > 0) {
      prompt += 'Previous steps:\n';
      context.iterations.forEach((step, i) => {
        prompt += `\nStep ${i + 1}:\n`;
        if (step.thought) prompt += `Thought: ${step.thought}\n`;
        if (step.action) prompt += `Action: ${step.action}\n`;
        if (step.actionInput) prompt += `Action Input: ${JSON.stringify(step.actionInput)}\n`;
        if (step.observation) prompt += `Observation: ${JSON.stringify(step.observation)}\n`;
      });
      prompt += '\nContinue:';
    } else {
      prompt += 'Begin:';
    }

    return prompt;
  }

  parseReactResponse(text) {
    const result = {};
    
    const thoughtMatch = text.match(/Thought:\s*(.+?)(?=\n(?:Action:|Final Answer:|$))/s);
    if (thoughtMatch) result.thought = thoughtMatch[1].trim();
    
    const finalAnswerMatch = text.match(/Final Answer:\s*(.+)/s);
    if (finalAnswerMatch) {
      result.finalAnswer = finalAnswerMatch[1].trim();
      return result;
    }
    
    const actionMatch = text.match(/Action:\s*(\w+)/);
    if (actionMatch) result.action = actionMatch[1].trim();
    
    const actionInputMatch = text.match(/Action Input:\s*({.+?})(?=\s*(?:Observation:|$))/s);
    if (actionInputMatch) {
      try {
        result.actionInput = JSON.parse(actionInputMatch[1]);
      } catch (e) {
        console.error('Failed to parse action input:', actionInputMatch[1]);
        result.actionInput = {};
      }
    }
    
    return result;
  }

  async executeAction(action, input) {
    const tool = this.tools[action];
    if (!tool) {
      throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Executing ${action} with input:`, input);
    return await tool.execute(input);
  }

  // Attio API methods using fetch
  async searchAttio(input) {
    const query = input.search_query || input.query;
    
    const response = await fetch('https://api.attio.com/v2/objects/companies/records/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.attioApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          $or: [
            { name: { $contains: query } }
          ]
        },
        limit: 10
      })
    });

    const data = await response.json();
    return data.data || [];
  }

  async createNote(input) {
    const response = await fetch('https://api.attio.com/v2/notes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.attioApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          parent_object: `${input.entity_type}s`,
          parent_record_id: input.entity_id,
          title: 'Note from Slack',
          content: input.note_content || input.note,
          format: 'plaintext',
          created_by_actor: {
            type: 'api-token'
          }
        }
      })
    });

    const data = await response.json();
    if (response.ok) {
      return {
        success: true,
        noteId: data.data.id,
        message: 'Note created successfully'
      };
    } else {
      throw new Error(data.message || 'Failed to create note');
    }
  }

  async getEntityDetails(input) {
    const response = await fetch(
      `https://api.attio.com/v2/objects/${input.entity_type}s/records/${input.entity_id}`,
      {
        headers: {
          'Authorization': `Bearer ${this.attioApiKey}`
        }
      }
    );

    const data = await response.json();
    return data.data || null;
  }
}