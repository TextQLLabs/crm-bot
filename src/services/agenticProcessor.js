const Anthropic = require('@anthropic-ai/sdk');
const { searchAttio, createOrUpdateRecord, getAttioSchema } = require('./attioService');

// Create an agentic AI processor that can explore and learn
class AgenticProcessor {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    // Store learned patterns and API knowledge
    this.apiKnowledge = {
      endpoints: {},
      successfulPatterns: [],
      failedAttempts: []
    };
  }

  async processWithAgenticLoop(message, maxIterations = 5) {
    let iteration = 0;
    let context = {
      originalMessage: message,
      discoveries: [],
      actions: [],
      currentGoal: 'understand_message',
      apiResponses: []
    };

    while (iteration < maxIterations) {
      iteration++;
      
      // Step 1: Ask AI what to do next
      const decision = await this.makeDecision(context);
      
      // Step 2: Execute the decision
      const result = await this.executeAction(decision, context);
      
      // Step 3: Update context with results
      context.actions.push({ decision, result });
      context.apiResponses.push(result);
      
      // Step 4: Check if goal is achieved
      if (decision.isComplete || result.error) {
        break;
      }
      
      // Step 5: Update goal based on results
      context.currentGoal = decision.nextGoal;
    }

    return this.summarizeActions(context);
  }

  async makeDecision(context) {
    const systemPrompt = `You are an agentic CRM assistant that can explore APIs and make decisions.

You have access to these tools:
1. search_entities(type, query) - Search for companies, people, or deals
2. get_entity_details(type, id) - Get full details of an entity
3. create_entity(type, data) - Create new entity
4. update_entity(type, id, data) - Update existing entity
5. add_note(entityType, entityId, note) - Add note to entity
6. explore_api(endpoint) - Explore what fields/operations are available
7. complete(summary) - Task is complete

Current context:
${JSON.stringify(context, null, 2)}

Decide what to do next. Return JSON:
{
  "action": "tool_name",
  "parameters": { ... },
  "reasoning": "why this action",
  "nextGoal": "what to achieve next",
  "confidence": 0.0-1.0,
  "isComplete": false
}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Decide next action for: ${context.originalMessage.text}`
      }]
    });

    return JSON.parse(response.content[0].text);
  }

  async executeAction(decision, context) {
    try {
      switch (decision.action) {
        case 'search_entities':
          return await this.searchEntities(
            decision.parameters.type, 
            decision.parameters.query
          );
          
        case 'get_entity_details':
          return await this.getEntityDetails(
            decision.parameters.type,
            decision.parameters.id
          );
          
        case 'create_entity':
          return await this.createEntity(
            decision.parameters.type,
            decision.parameters.data
          );
          
        case 'update_entity':
          return await this.updateEntity(
            decision.parameters.type,
            decision.parameters.id,
            decision.parameters.data
          );
          
        case 'add_note':
          return await this.addNote(
            decision.parameters.entityType,
            decision.parameters.entityId,
            decision.parameters.note
          );
          
        case 'explore_api':
          return await this.exploreAPI(decision.parameters.endpoint);
          
        case 'complete':
          return { complete: true, summary: decision.parameters.summary };
          
        default:
          return { error: `Unknown action: ${decision.action}` };
      }
    } catch (error) {
      return { 
        error: error.message, 
        details: error.response?.data,
        action: decision.action 
      };
    }
  }

  // Tool implementations that wrap Attio API
  async searchEntities(type, query) {
    // This would call the Attio search with proper error handling
    const results = await searchAttio(query);
    return { 
      action: 'search',
      type,
      query,
      results,
      count: results.length 
    };
  }

  async getEntityDetails(type, id) {
    // Would implement full entity fetch
    return {
      action: 'get_details',
      type,
      id,
      details: {} // Would fetch from Attio
    };
  }

  async createEntity(type, data) {
    // Would create entity in Attio
    return {
      action: 'create',
      type,
      data,
      created: true,
      id: 'new-id'
    };
  }

  async exploreAPI(endpoint) {
    // This would explore Attio API capabilities
    // Could even make OPTIONS requests or check documentation
    return {
      action: 'explore',
      endpoint,
      available_fields: [],
      available_operations: []
    };
  }

  async addNote(entityType, entityId, note) {
    // Add note to entity
    return {
      action: 'add_note',
      entityType,
      entityId,
      note,
      success: true
    };
  }

  summarizeActions(context) {
    // Summarize what was done
    const actions = context.actions.map(a => a.decision.action);
    const lastResult = context.actions[context.actions.length - 1]?.result;
    
    return {
      success: !lastResult?.error,
      actionsPerformed: actions,
      finalResult: lastResult,
      iterations: context.actions.length,
      summary: lastResult?.summary || 'Processed message'
    };
  }
}

module.exports = { AgenticProcessor };