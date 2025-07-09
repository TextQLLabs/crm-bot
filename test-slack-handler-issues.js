// Test 10 different possible issues in the Slack handler response format

const testCases = [
  {
    name: "1. Empty blocks array",
    test: () => ({
      channel: "test",
      ts: "123",
      text: "Test message",
      blocks: []  // Empty blocks might cause issues
    })
  },
  
  {
    name: "2. Null blocks",
    test: () => ({
      channel: "test",
      ts: "123",
      text: "Test message",
      blocks: null
    })
  },
  
  {
    name: "3. Undefined blocks",
    test: () => ({
      channel: "test",
      ts: "123",
      text: "Test message",
      blocks: undefined
    })
  },
  
  {
    name: "4. Text with special characters",
    test: () => ({
      channel: "test",
      ts: "123",
      text: "Found 3 notes:\n\n1. **Created Documentation** (5/13/2025)\n   <Content here>\n2. \"Note from Slack\" & more"
    })
  },
  
  {
    name: "5. Very long text (over 3000 chars)",
    test: () => ({
      channel: "test",
      ts: "123",
      text: "A".repeat(3500)
    })
  },
  
  {
    name: "6. Text with null/undefined",
    test: () => ({
      channel: "test",
      ts: "123",
      text: null
    })
  },
  
  {
    name: "7. Missing required fields",
    test: () => ({
      ts: "123",
      text: "Test"
      // Missing channel
    })
  },
  
  {
    name: "8. Block with invalid structure",
    test: () => ({
      channel: "test",
      ts: "123",
      text: "Test",
      blocks: [
        {
          type: "section",
          // Missing required text field
        }
      ]
    })
  },
  
  {
    name: "9. Block text exceeding limits",
    test: () => ({
      channel: "test",
      ts: "123",
      text: "Test",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "B".repeat(3001)  // Slack block text limit is 3000
          }
        }
      ]
    })
  },
  
  {
    name: "10. Invalid block type",
    test: () => ({
      channel: "test",
      ts: "123",
      text: "Test",
      blocks: [
        {
          type: "invalid_type",
          text: {
            type: "mrkdwn",
            text: "Test"
          }
        }
      ]
    })
  }
];

// Additional edge cases specific to notes responses
const notesSpecificCases = [
  {
    name: "Notes with markdown bold (**)",
    text: "Found 3 notes:\n\n1. **Created Documentation** (5/13/2025)"
  },
  {
    name: "Notes with URLs",
    text: "View deal: https://app.attio.com/textql-data/deals/637f050b-409d-4fdf-b401-b85d48a5e9df/overview"
  },
  {
    name: "Notes with special chars in content",
    text: "Note content: \"This & that\" with <brackets> and *asterisks*"
  },
  {
    name: "Empty note content",
    text: "Found 3 notes:\n1. Note 1\n   \n2. Note 2\n   "
  }
];

console.log("=== Slack Handler Response Format Issues ===\n");

// Test each case
testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  const payload = testCase.test();
  console.log("Payload:", JSON.stringify(payload, null, 2));
  
  // Check for potential issues
  if (!payload.channel) console.log("❌ Missing channel");
  if (!payload.ts) console.log("❌ Missing ts");
  if (!payload.text && !payload.blocks) console.log("❌ Missing both text and blocks");
  if (payload.blocks === null) console.log("⚠️  Blocks is null");
  if (payload.blocks && payload.blocks.length === 0) console.log("⚠️  Empty blocks array");
  if (payload.text && payload.text.length > 3000) console.log("❌ Text exceeds 3000 chars");
  
  console.log("\n");
});

console.log("\n=== Notes-Specific Text Patterns ===\n");

notesSpecificCases.forEach((testCase, index) => {
  console.log(`Notes Test ${index + 1}: ${testCase.name}`);
  console.log(`Text: "${testCase.text}"`);
  
  // Check for problematic patterns
  if (testCase.text.includes("**")) console.log("⚠️  Contains ** markdown");
  if (testCase.text.includes("<") || testCase.text.includes(">")) console.log("⚠️  Contains < or >");
  if (testCase.text.includes("&")) console.log("⚠️  Contains &");
  
  console.log("\n");
});

console.log("\n=== Most Likely Issue ===");
console.log("Based on the error 'invalid_blocks', the issue is likely:");
console.log("1. We're still somehow sending blocks even with text-only update");
console.log("2. The error happens AFTER our update (perhaps in a subsequent handler)");
console.log("3. There's a race condition or timing issue");
console.log("4. The simplified code still has a path that adds blocks");
console.log("\nNext step: Add more logging to see exactly what's being sent to Slack");