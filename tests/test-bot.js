#!/usr/bin/env node
require('dotenv').config();
const { ReactAgent } = require('./src/services/reactAgent');

// Test cases to run
const testCases = [
  // Basic search
  { input: "find The Raine Group", description: "Exact match search" },
  
  // Fuzzy searches
  { input: "search for rain group", description: "Misspelling: rain → raine" },
  { input: "find rayne group company", description: "Misspelling: rayne → raine" },
  { input: "search for rane", description: "Partial name search" },
  
  // Thread conversation
  { 
    input: "find companies with media in the name", 
    description: "Broad search",
    followUp: "tell me more about the first one"
  },
  
  // No results case
  { input: "find XYZ123 Corporation", description: "Non-existent company" }
];

async function runTests() {
  const agent = new ReactAgent();
  console.log('🧪 Running CRM Bot Tests\n');
  
  for (const test of testCases) {
    console.log('═'.repeat(60));
    console.log(`📝 Test: ${test.description}`);
    console.log(`💬 Input: "${test.input}"`);
    console.log('─'.repeat(60));
    
    try {
      // Run the main test
      const result = await agent.processMessage({
        text: test.input,
        userName: 'Test User',
        channel: 'test',
        attachments: []
      });
      
      if (result.success) {
        console.log(`✅ Success: ${result.answer || 'Completed'}`);
        
        // Show search attempts
        const searches = result.steps.filter(s => s.action === 'search_crm');
        if (searches.length > 0) {
          console.log(`🔍 Searches performed: ${searches.length}`);
          searches.forEach((s, i) => {
            const query = s.actionInput?.search_query || s.actionInput?.query;
            const count = Array.isArray(s.observation) ? s.observation.length : 0;
            console.log(`   ${i + 1}. "${query}" → ${count} results`);
          });
        }
        
        // Run follow-up if provided
        if (test.followUp) {
          console.log(`\n💬 Follow-up: "${test.followUp}"`);
          const followUpResult = await agent.processMessage({
            text: test.followUp,
            userName: 'Test User',
            channel: 'test',
            attachments: [],
            isThreaded: true,
            threadTs: 'test-thread'
          });
          console.log(`✅ Response: ${followUpResult.answer || 'Completed'}`);
        }
      } else {
        console.log(`❌ Failed: ${result.error}`);
      }
      
    } catch (error) {
      console.log(`💥 Error: ${error.message}`);
    }
    
    console.log('\n');
  }
  
  console.log('✨ All tests completed!');
}

// Run tests
runTests().catch(console.error);