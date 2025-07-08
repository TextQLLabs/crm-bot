require('dotenv').config();
const { App } = require('@slack/bolt');
const fs = require('fs');
const path = require('path');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

async function testSlackImageUpload() {
  console.log('Testing Slack image upload simulation...\n');

  // Read the test screenshot
  const imagePath = path.join(__dirname, 'test-screenshot.jpg');
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  // Simulate a Slack message event with an image attachment
  const mockEvent = {
    type: 'message',
    user: 'U04HC95ENRY', // Ethan's user ID
    text: '<@U0944Q3F58B> Please transcribe the text in this screenshot',
    ts: '1234567890.123456',
    channel: 'C0946T1T4CB', // #crm-bot-test channel
    files: [{
      id: 'F12345678',
      name: 'test-screenshot.jpg',
      mimetype: 'image/jpeg',
      url_private: 'https://files.slack.com/files-pri/test/test-screenshot.jpg',
      url_private_download: 'https://files.slack.com/files-pri/test/download/test-screenshot.jpg',
      thumb_360: 'https://files.slack.com/files-tmb/test/test-screenshot_360.jpg',
      size: imageBuffer.length
    }]
  };

  // Import the handler
  const { handleMention } = require('./src/handlers/slackHandlerReact');

  // Create mock functions
  const mockSay = async (message) => {
    console.log('Bot would say:', message);
    return { ts: '1234567890.123457' };
  };

  const mockClient = {
    users: {
      info: async ({ user }) => ({
        user: {
          real_name: 'Test User',
          name: 'testuser'
        }
      })
    },
    chat: {
      update: async ({ channel, ts, text, blocks }) => {
        console.log('Bot would update message:', { text, blocks: blocks?.length || 0 });
      }
    },
    conversations: {
      replies: async ({ channel, ts }) => ({
        messages: []
      })
    }
  };

  // Test the handler with our mock event
  console.log('Processing mock Slack event with image...');
  
  // We need to modify the event to include the base64 data
  // In real Slack, we'd download the file, but for testing we'll inject it
  const modifiedEvent = {
    ...mockEvent,
    // Add a way to pass the image data through
    _testImageData: base64Image
  };

  try {
    await handleMention({
      event: modifiedEvent,
      say: mockSay,
      client: mockClient
    });
    
    console.log('\nTest completed!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Also test direct ReactAgent usage
async function testDirectReactAgent() {
  console.log('\n' + '='.repeat(50));
  console.log('Testing ReactAgent directly with image...\n');

  const { ReactAgent } = require('./src/services/reactAgent');
  const agent = new ReactAgent();

  // Read the test screenshot
  const imagePath = path.join(__dirname, 'test-screenshot.jpg');
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const result = await agent.processMessage({
    text: 'Please transcribe all the text from this screenshot and tell me what the conversation is about',
    userName: 'Test User',
    channel: 'test-channel',
    attachments: [{
      mimetype: 'image/jpeg',
      name: 'test-screenshot.jpg',
      data: base64Image
    }]
  });

  console.log('ReactAgent Result:', JSON.stringify(result, null, 2));
}

// Run both tests
async function runTests() {
  await testSlackImageUpload();
  await testDirectReactAgent();
}

runTests().catch(console.error);