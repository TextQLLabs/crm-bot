#!/usr/bin/env node

require('dotenv').config();
const { ClaudeAgent } = require('./src/services/claudeAgent');

async function testAdvancedSearchFixed() {
  console.log('🔧 Testing advanced_search tool after understanding the correct format...\n');
  
  const agent = new ClaudeAgent();
  
  // Test 1: Direct tool call with correct stage filter
  console.log('=== Test 1: Direct tool call with stage filter ===');
  try {
    const result = await agent.executeToolCall({
      tool: 'advanced_search',
      input: {
        entity_type: 'deal',
        filters: {
          stage: 'Goal: Get to Financing'
        }
      }
    }, { threadTs: 'test-thread' });
    
    console.log('✅ Direct tool call succeeded!');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Direct tool call failed:', error);
  }

  // Test 2: Full message processing
  console.log('\n=== Test 2: Full message processing ===');
  try {
    const result = await agent.processMessage({
      text: 'find deals in stage "Goal: Get to Financing"',
      userName: 'Test User',
      userId: 'test-user',
      channel: 'test',
      attachments: [],
      threadTs: 'test-thread',
      messageTs: Date.now().toString()
    });
    
    console.log('✅ Full message processing succeeded!');
    console.log('Answer:', result.answer);
    console.log('Tools used:', result.toolsUsed?.map(t => t.tool));
  } catch (error) {
    console.error('❌ Full message processing failed:', error);
  }

  // Test 3: Try multiple stage filter approaches
  console.log('\n=== Test 3: Multiple stage filter approaches ===');
  
  const testCases = [
    {
      name: 'stage filter',
      input: {
        entity_type: 'deal',
        filters: {
          stage: 'Goal: Get to Financing'
        }
      }
    },
    {
      name: 'status filter (should fail)',
      input: {
        entity_type: 'deal',
        filters: {
          status: 'Goal: Get to Financing'
        }
      }
    },
    {
      name: 'dealstage filter (should fail)',
      input: {
        entity_type: 'deal',
        filters: {
          dealstage: 'Goal: Get to Financing'
        }
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n--- Testing: ${testCase.name} ---`);
    try {
      const result = await agent.executeToolCall({
        tool: 'advanced_search',
        input: testCase.input
      }, { threadTs: 'test-thread' });
      
      console.log(`✅ ${testCase.name} succeeded!`);
      if (result.length) {
        console.log(`Found ${result.length} deals`);
        console.log('First deal:', result[0].name);
      }
    } catch (error) {
      console.error(`❌ ${testCase.name} failed:`, error.message);
    }
  }

  console.log('\n✅ Advanced search testing complete!');
}

testAdvancedSearchFixed().catch(console.error);