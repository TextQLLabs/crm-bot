require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Test the complete flow of image processing in Slack
async function testCompleteImageFlow() {
  console.log('Testing complete image processing flow...\n');

  // Import necessary modules
  const { ReactAgent } = require('./src/services/reactAgent');
  const agent = new ReactAgent();

  // Read the test screenshot
  const imagePath = path.join(__dirname, 'test-screenshot.jpg');
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  // Test Case 1: Simple transcription request
  console.log('=== Test Case 1: Simple Transcription ===');
  const test1 = await agent.processMessage({
    text: 'Can you transcribe this screenshot?',
    userName: 'Ethan',
    channel: '#crm-bot-test',
    attachments: [{
      mimetype: 'image/jpeg',
      name: 'conversation-screenshot.jpg',
      data: base64Image
    }]
  });

  console.log('Result:', test1.answer);
  console.log('\n' + '='.repeat(50) + '\n');

  // Test Case 2: Analysis and action request
  console.log('=== Test Case 2: Analysis + CRM Action ===');
  const test2 = await agent.processMessage({
    text: 'Look at this screenshot of our conversation about the AWS reinvent conference. Can you create a note on The Raine Group (if they exist in our CRM) summarizing the key points?',
    userName: 'Ethan',
    channel: '#crm-bot-test',
    attachments: [{
      mimetype: 'image/jpeg',
      name: 'aws-discussion.jpg',
      data: base64Image
    }]
  }, { preview: true }); // Use preview mode to see what action would be taken

  if (test2.preview && test2.pendingAction) {
    console.log('Pending Action:', test2.pendingAction.action);
    console.log('Action Details:', JSON.stringify(test2.pendingAction.input, null, 2));
  } else {
    console.log('Result:', test2.answer);
  }
  console.log('\n' + '='.repeat(50) + '\n');

  // Test Case 3: Multiple images (simulated)
  console.log('=== Test Case 3: Multiple Images ===');
  const test3 = await agent.processMessage({
    text: 'I have two screenshots here. Can you transcribe both and tell me what they show?',
    userName: 'Ethan', 
    channel: '#crm-bot-test',
    attachments: [
      {
        mimetype: 'image/jpeg',
        name: 'screenshot1.jpg',
        data: base64Image
      },
      {
        mimetype: 'image/png',
        name: 'screenshot2.png',
        data: base64Image // Using same image for test
      }
    ]
  });

  console.log('Result:', test3.answer);
  console.log('\n' + '='.repeat(50) + '\n');

  // Test Case 4: Extract specific information
  console.log('=== Test Case 4: Extract Specific Info ===');
  const test4 = await agent.processMessage({
    text: 'From this screenshot, can you extract all the questions being asked and who is asking them?',
    userName: 'Ethan',
    channel: '#crm-bot-test',
    attachments: [{
      mimetype: 'image/jpeg',
      name: 'questions-screenshot.jpg',
      data: base64Image
    }]
  });

  console.log('Result:', test4.answer);
  console.log('\n' + '='.repeat(50) + '\n');

  // Test Case 5: Error handling - no image
  console.log('=== Test Case 5: Error Handling - No Image ===');
  const test5 = await agent.processMessage({
    text: 'Please analyze the attached image',
    userName: 'Ethan',
    channel: '#crm-bot-test',
    attachments: []
  });

  console.log('Result:', test5.answer);
}

// Run the complete test
testCompleteImageFlow().catch(console.error);