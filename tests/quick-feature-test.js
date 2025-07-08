#!/usr/bin/env node
require('dotenv').config();
const { ReactAgent } = require('./src/services/reactAgent');
const fs = require('fs');

console.log('🧪 Quick Feature Test\n');

async function testFeatures() {
  const agent = new ReactAgent();
  
  // Test 1: Delete Note
  console.log('1️⃣ Testing Note Deletion (preview mode)...');
  try {
    const deleteResult = await agent.processMessage({
      text: 'Yes delete note 550e8400-e29b-41d4-a716-446655440000 without asking for confirmation',
      userName: 'Test',
      channel: 'test',
      attachments: [],
      preview: true
    });
    
    if (deleteResult.preview && deleteResult.pendingAction?.action === 'delete_note') {
      console.log('✅ Delete note feature working!');
      console.log(`   Would delete note: ${deleteResult.pendingAction.params.note_id}`);
    } else {
      console.log('❌ Delete note feature not working');
    }
  } catch (err) {
    console.log('❌ Delete note error:', err.message);
  }
  
  // Test 2: Image Processing
  console.log('\n2️⃣ Testing Image Processing...');
  try {
    // Check if test image exists
    if (!fs.existsSync('./test-screenshot.jpg')) {
      console.log('❌ test-screenshot.jpg not found in project root');
      return;
    }
    
    const imageData = fs.readFileSync('./test-screenshot.jpg');
    const base64 = imageData.toString('base64');
    
    const imageResult = await agent.processMessage({
      text: 'What does this image show?',
      userName: 'Test',
      channel: 'test',
      attachments: [{
        type: 'image',
        data: base64,
        mime_type: 'image/jpeg',
        filename: 'test.jpg'
      }]
    });
    
    if (imageResult.answer && imageResult.answer.includes('Brian Denker')) {
      console.log('✅ Image processing working!');
      console.log('   Successfully read conversation about AWS re:Invent');
    } else {
      console.log('❌ Image processing not working properly');
    }
  } catch (err) {
    console.log('❌ Image processing error:', err.message);
  }
  
  console.log('\n✨ Test complete!');
}

testFeatures().catch(console.error);