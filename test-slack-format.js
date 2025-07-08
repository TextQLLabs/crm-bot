#!/usr/bin/env node

// Test what happens when we add version info
const pkg = require('./package.json');

const originalMessage = `Found 3 notes on the Raine deal (https://app.attio.com/textql-data/deals/637f050b-409d-4fdf-b401-b85d48a5e9df/overview): 1) "Created Documentation" from May 13, 2025, 2) Two "Note from Slack" entries from July 4, 2025. All notes were created by Unknown users.`;

console.log('Original message:');
console.log(originalMessage);
console.log('\nLength:', originalMessage.length);

// Add version like the bot does
const withVersion = originalMessage + `\n\n🚂 v${pkg.version}`;

console.log('\n\nWith version:');
console.log(withVersion);
console.log('\nLength:', withVersion.length);

// Check for issues
console.log('\n\nChecking for issues:');
console.log('Contains train emoji:', withVersion.includes('🚂'));
console.log('Version:', pkg.version);

// Try escaping
const escaped = withVersion
  .replace(/\n{3,}/g, '\n\n')
  .trim();

console.log('\n\nAfter validation:');
console.log(escaped);

// Create the block structure
const blocks = [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: escaped
    }
  }
];

console.log('\n\nBlocks structure:');
console.log(JSON.stringify(blocks, null, 2));