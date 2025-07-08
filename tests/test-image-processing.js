require('dotenv').config();
const { ReactAgent } = require('./src/services/reactAgent');
const fs = require('fs');
const path = require('path');

async function testImageProcessing() {
  console.log('Testing image processing capabilities...\n');

  // Create an instance of ReactAgent
  const agent = new ReactAgent();

  // Read the test screenshot
  const imagePath = path.join(__dirname, 'test-screenshot.jpg');
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  // Test 1: Process image with transcription request
  console.log('Test 1: Transcribe text from screenshot');
  const test1Result = await agent.processMessage({
    text: 'Please transcribe all the text you can see in this screenshot of a text message conversation',
    userName: 'Test User',
    channel: 'test-channel',
    attachments: [{
      mimetype: 'image/jpeg',
      name: 'test-screenshot.jpg',
      data: base64Image
    }]
  });

  console.log('Test 1 Result:', JSON.stringify(test1Result, null, 2));
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Process image with analysis request
  console.log('Test 2: Analyze the conversation in the screenshot');
  const test2Result = await agent.processMessage({
    text: 'Look at this screenshot and tell me: 1) Who is in the conversation? 2) What are they discussing? 3) What specific questions are being asked?',
    userName: 'Test User',
    channel: 'test-channel',
    attachments: [{
      mimetype: 'image/jpeg',
      name: 'test-screenshot.jpg',
      data: base64Image
    }]
  });

  console.log('Test 2 Result:', JSON.stringify(test2Result, null, 2));
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Test without image (should work normally)
  console.log('Test 3: Normal text processing without image');
  const test3Result = await agent.processMessage({
    text: 'Search for a company called Acme Corp',
    userName: 'Test User',
    channel: 'test-channel',
    attachments: []
  });

  console.log('Test 3 Result:', JSON.stringify(test3Result, null, 2));
}

// Run the test
testImageProcessing().catch(console.error);