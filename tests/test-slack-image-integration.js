#!/usr/bin/env node
require('dotenv').config();
const { handleSlackMessage } = require('./src/handlers/slackHandlerReact');
const fs = require('fs');

console.log('🧪 Testing Slack Image Integration\n');

// Mock Slack client
const mockClient = {
  users: {
    info: async ({ user }) => ({
      user: {
        real_name: 'Test User',
        name: 'testuser'
      }
    })
  },
  conversations: {
    history: async ({ channel, latest }) => ({
      messages: []
    })
  }
};

// Mock say function
const mockSay = async (response) => {
  console.log('Bot would say:', response.text || 'Action preview');
  if (response.blocks) {
    console.log('With blocks:', JSON.stringify(response.blocks, null, 2));
  }
  return { ts: '1234567890.123456' };
};

async function testImageIntegration() {
  // Read test image
  const imageData = fs.readFileSync('./test-screenshot.jpg');
  const base64Data = imageData.toString('base64');
  
  // Create mock Slack message with image
  const mockMessage = {
    type: 'app_mention',
    user: 'U12345',
    text: '<@BOT123> Can you analyze this screenshot and tell me what conference they are discussing?',
    ts: '1234567890.123456',
    channel: 'C12345',
    files: [{
      id: 'F12345',
      name: 'screenshot.jpg',
      mimetype: 'image/jpeg',
      url_private_download: 'https://files.slack.com/files-pri/T12345/F12345/screenshot.jpg'
    }],
    // Inject test data to avoid actual download
    _testImageData: base64Data
  };
  
  console.log('📤 Simulating Slack message with image attachment...\n');
  
  try {
    await handleSlackMessage({
      message: mockMessage,
      say: mockSay,
      client: mockClient
    });
    
    console.log('\n✅ Integration test completed!');
    console.log('The bot should have:');
    console.log('1. Downloaded the image (simulated with test data)');
    console.log('2. Analyzed it using Claude\'s vision API');
    console.log('3. Identified the AWS re:Invent conference discussion');
    console.log('4. Responded appropriately in Slack');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  }
}

// Test different scenarios
async function testMultipleScenarios() {
  console.log('\n📋 Testing Multiple Scenarios:\n');
  
  // Scenario 1: Transcribe request
  console.log('1️⃣ Transcribe Request:');
  const transcribeMsg = {
    ...mockMessage,
    text: '<@BOT123> Please transcribe the text in this image'
  };
  
  await handleSlackMessage({
    message: transcribeMsg,
    say: mockSay,
    client: mockClient
  });
  
  // Scenario 2: Analysis + Action request
  console.log('\n2️⃣ Analysis + Action Request:');
  const actionMsg = {
    ...mockMessage,
    text: '<@BOT123> Look at this conversation screenshot and create a note about it for Brian Denker'
  };
  
  await handleSlackMessage({
    message: actionMsg,
    say: mockSay,
    client: mockClient
  });
  
  // Scenario 3: Multiple images
  console.log('\n3️⃣ Multiple Images:');
  const multiMsg = {
    ...mockMessage,
    text: '<@BOT123> Compare these two screenshots',
    files: [
      {
        id: 'F12345',
        name: 'screenshot1.jpg',
        mimetype: 'image/jpeg',
        url_private_download: 'https://files.slack.com/files-pri/T12345/F12345/screenshot1.jpg'
      },
      {
        id: 'F67890',
        name: 'screenshot2.jpg',
        mimetype: 'image/jpeg',
        url_private_download: 'https://files.slack.com/files-pri/T12345/F67890/screenshot2.jpg'
      }
    ]
  };
  
  await handleSlackMessage({
    message: multiMsg,
    say: mockSay,
    client: mockClient
  });
}

// Run tests
async function main() {
  await testImageIntegration();
  // Uncomment to test more scenarios:
  // await testMultipleScenarios();
}

main().catch(console.error);