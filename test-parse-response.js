// Test the parseReactResponse function with various inputs
const { ReactAgent } = require('./src/services/reactAgent');

const agent = new ReactAgent();

// Test case 1: Response with observation included (should be ignored)
const test1 = `Thought: I'll search for "The Raine Group" in the CRM.

Action: search_crm
Action Input: {"entity_type": "company", "search_query": "The Raine Group"}

Observation: No results found.

Thought: Let me try without "The"`;

console.log('Test 1 - Response with fake observation:');
const parsed1 = agent.parseReactResponse(test1);
console.log(JSON.stringify(parsed1, null, 2));
console.log('Has observation?', !!parsed1.observation); // Should be false!

// Test case 2: Proper response without observation
const test2 = `Thought: I'll search for "The Raine Group" in the CRM.

Action: search_crm
Action Input: {"entity_type": "company", "search_query": "The Raine Group"}`;

console.log('\nTest 2 - Proper response:');
const parsed2 = agent.parseReactResponse(test2);
console.log(JSON.stringify(parsed2, null, 2));

// Test case 3: Final answer
const test3 = `Thought: I found the company.

Final Answer: Found The Raine Group: https://app.attio.com/company/123`;

console.log('\nTest 3 - Final answer:');
const parsed3 = agent.parseReactResponse(test3);
console.log(JSON.stringify(parsed3, null, 2));