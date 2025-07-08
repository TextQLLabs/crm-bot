#!/usr/bin/env node
require('dotenv').config();
const { ReactAgent } = require('./src/services/reactAgent');
const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

class FeatureTester {
  constructor() {
    this.agent = new ReactAgent();
    this.testResults = [];
  }

  async runAllTests() {
    console.log(`${colors.cyan}🧪 Testing CRM Bot New Features${colors.reset}\n`);
    
    // Test 1: Image Processing
    await this.testImageProcessing();
    
    // Test 2: Note Deletion
    await this.testNoteDeletion();
    
    // Test 3: Combined Workflow
    await this.testCombinedWorkflow();
    
    // Summary
    this.printSummary();
  }

  async testImageProcessing() {
    console.log(`${colors.yellow}📸 Test 1: Image Processing Capability${colors.reset}`);
    
    try {
      // Read the test screenshot
      const imagePath = path.join(__dirname, 'test-screenshot.jpg');
      let imageBase64;
      
      try {
        const imageBuffer = fs.readFileSync(imagePath);
        imageBase64 = imageBuffer.toString('base64');
        console.log(`✅ Found test image: ${imagePath}`);
      } catch (err) {
        console.log(`❌ Test image not found at ${imagePath}`);
        this.testResults.push({ test: 'Image Loading', passed: false });
        return;
      }

      // Test transcription
      console.log('\n🔍 Testing image transcription...');
      const transcribeResult = await this.agent.processMessage({
        text: 'Transcribe the text from this screenshot',
        userName: 'Test User',
        channel: 'test',
        attachments: [{
          type: 'image',
          data: imageBase64,
          mime_type: 'image/jpeg',
          filename: 'test-screenshot.jpg'
        }]
      });

      if (transcribeResult.answer && transcribeResult.answer.length > 50) {
        console.log(`${colors.green}✅ Image transcription successful${colors.reset}`);
        console.log(`   Sample: ${transcribeResult.answer.substring(0, 100)}...`);
        this.testResults.push({ test: 'Image Transcription', passed: true });
      } else {
        console.log(`${colors.red}❌ Image transcription failed${colors.reset}`);
        this.testResults.push({ test: 'Image Transcription', passed: false });
      }

      // Test analysis
      console.log('\n🔍 Testing image analysis...');
      const analyzeResult = await this.agent.processMessage({
        text: 'Analyze this conversation screenshot and tell me the main topics discussed',
        userName: 'Test User',
        channel: 'test',
        attachments: [{
          type: 'image',
          data: imageBase64,
          mime_type: 'image/jpeg',
          filename: 'test-screenshot.jpg'
        }]
      });

      if (analyzeResult.answer && analyzeResult.answer.includes('conference') || analyzeResult.answer.includes('AWS')) {
        console.log(`${colors.green}✅ Image analysis successful${colors.reset}`);
        console.log(`   Key topics identified correctly`);
        this.testResults.push({ test: 'Image Analysis', passed: true });
      } else {
        console.log(`${colors.red}❌ Image analysis failed${colors.reset}`);
        this.testResults.push({ test: 'Image Analysis', passed: false });
      }

    } catch (error) {
      console.log(`${colors.red}❌ Image processing error: ${error.message}${colors.reset}`);
      this.testResults.push({ test: 'Image Processing', passed: false });
    }
  }

  async testNoteDeletion() {
    console.log(`\n${colors.yellow}🗑️  Test 2: Note Deletion Capability${colors.reset}`);
    
    try {
      // Test with invalid note ID
      console.log('\n🔍 Testing deletion with invalid ID...');
      const invalidResult = await this.agent.processMessage({
        text: 'Delete note invalid-id-123',
        userName: 'Test User',
        channel: 'test',
        attachments: [],
        preview: true // Use preview mode for safety
      });

      if (invalidResult.answer && invalidResult.answer.includes('Invalid note ID format')) {
        console.log(`${colors.green}✅ Invalid ID handling correct${colors.reset}`);
        this.testResults.push({ test: 'Invalid Note ID', passed: true });
      } else {
        console.log(`${colors.red}❌ Invalid ID not handled properly${colors.reset}`);
        this.testResults.push({ test: 'Invalid Note ID', passed: false });
      }

      // Test with valid UUID format (non-existent)
      console.log('\n🔍 Testing deletion with non-existent note...');
      const nonExistentResult = await this.agent.processMessage({
        text: 'Delete note 550e8400-e29b-41d4-a716-446655440000',
        userName: 'Test User',
        channel: 'test',
        attachments: [],
        preview: true
      });

      if (nonExistentResult.preview && nonExistentResult.pendingAction) {
        console.log(`${colors.green}✅ Preview mode working correctly${colors.reset}`);
        console.log(`   Action: ${nonExistentResult.pendingAction.action}`);
        this.testResults.push({ test: 'Delete Preview Mode', passed: true });
      } else {
        console.log(`${colors.red}❌ Preview mode not working${colors.reset}`);
        this.testResults.push({ test: 'Delete Preview Mode', passed: false });
      }

    } catch (error) {
      console.log(`${colors.red}❌ Note deletion error: ${error.message}${colors.reset}`);
      this.testResults.push({ test: 'Note Deletion', passed: false });
    }
  }

  async testCombinedWorkflow() {
    console.log(`\n${colors.yellow}🔄 Test 3: Combined Workflow${colors.reset}`);
    
    try {
      // Read the test screenshot
      const imagePath = path.join(__dirname, 'test-screenshot.jpg');
      const imageBuffer = fs.readFileSync(imagePath);
      const imageBase64 = imageBuffer.toString('base64');

      console.log('\n🔍 Testing: Analyze screenshot and create note...');
      const result = await this.agent.processMessage({
        text: 'Look at this screenshot of a conversation with Brian Denker about reinvent conference. Create a note in Attio for any relevant company or person mentioned.',
        userName: 'Test User',
        channel: 'test',
        attachments: [{
          type: 'image',
          data: imageBase64,
          mime_type: 'image/jpeg',
          filename: 'conversation-screenshot.jpg'
        }],
        preview: true // Preview mode for safety
      });

      if (result.answer && (result.answer.includes('Brian Denker') || result.answer.includes('Dillon'))) {
        console.log(`${colors.green}✅ Combined workflow successful${colors.reset}`);
        console.log(`   Bot understood the screenshot and prepared appropriate action`);
        this.testResults.push({ test: 'Combined Workflow', passed: true });
        
        if (result.preview && result.pendingAction) {
          console.log(`   Pending action: ${result.pendingAction.action}`);
          console.log(`   Would create note with: ${JSON.stringify(result.pendingAction.params.title || result.pendingAction.params.content).substring(0, 50)}...`);
        }
      } else {
        console.log(`${colors.red}❌ Combined workflow failed${colors.reset}`);
        this.testResults.push({ test: 'Combined Workflow', passed: false });
      }

    } catch (error) {
      console.log(`${colors.red}❌ Combined workflow error: ${error.message}${colors.reset}`);
      this.testResults.push({ test: 'Combined Workflow', passed: false });
    }
  }

  printSummary() {
    console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}📊 Test Summary${colors.reset}\n`);
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    const successRate = ((passed / total) * 100).toFixed(0);
    
    this.testResults.forEach(result => {
      const status = result.passed ? `${colors.green}✅` : `${colors.red}❌`;
      console.log(`${status} ${result.test}${colors.reset}`);
    });
    
    console.log(`\n📈 Success Rate: ${successRate}% (${passed}/${total})`);
    
    if (passed === total) {
      console.log(`\n${colors.green}🎉 All tests passed! Both features are working correctly.${colors.reset}`);
    } else {
      console.log(`\n${colors.yellow}⚠️  Some tests failed. Check the output above for details.${colors.reset}`);
    }
  }
}

// Run tests
async function main() {
  const tester = new FeatureTester();
  await tester.runAllTests();
}

main().catch(console.error);