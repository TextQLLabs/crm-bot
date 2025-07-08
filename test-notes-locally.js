#!/usr/bin/env node

// Test the ReactAgent notes functionality locally
require('dotenv').config();
const { ReactAgent } = require('./src/services/reactAgent');

async function testNotesLocally() {
  console.log('🧪 Testing ReactAgent notes functionality locally\n');
  
  const agent = new ReactAgent();
  
  // Test 1: Search for The Raine Group
  console.log('Test 1: Search for The Raine Group');
  const searchMessage = {
    text: 'search for The Raine Group',
    userName: 'Test User',
    channel: '#test',
    userId: 'U123456',
    threadTs: '123456789.123456',
    messageTs: '123456789.123456'
  };
  
  try {
    const searchResult = await agent.processMessage(searchMessage);
    console.log('Search result:', searchResult.success ? '✅ Success' : '❌ Failed');
    if (searchResult.answer) {
      console.log('Answer preview:', searchResult.answer.substring(0, 200) + '...\n');
    }
  } catch (error) {
    console.error('Search error:', error);
  }
  
  // Test 2: Get notes on The Raine Group deal
  console.log('\nTest 2: Get notes on The Raine Group deal');
  const notesMessage = {
    text: 'can you find any notes on The Raine Group deal?',
    userName: 'Test User',
    channel: '#test',
    userId: 'U123456',
    threadTs: '123456789.123457',
    messageTs: '123456789.123457'
  };
  
  try {
    const notesResult = await agent.processMessage(notesMessage);
    console.log('Notes result:', notesResult.success ? '✅ Success' : '❌ Failed');
    
    if (notesResult.answer) {
      console.log('\n📝 Full answer:');
      console.log('-------------------');
      console.log(notesResult.answer);
      console.log('-------------------');
      
      // Check for problematic characters
      const problematicChars = notesResult.answer.match(/[<>&*]/g);
      if (problematicChars) {
        console.log('\n⚠️  Found potentially problematic characters:', [...new Set(problematicChars)]);
      }
      
      // Check for markdown issues
      const doubleAsterisks = notesResult.answer.match(/\*\*/g);
      if (doubleAsterisks) {
        console.log('⚠️  Found ** (double asterisks)');
      }
      
      // Check message length
      console.log('\n📏 Message length:', notesResult.answer.length, 'characters');
      
      // Check for excessive newlines
      const excessiveNewlines = notesResult.answer.match(/\n{3,}/g);
      if (excessiveNewlines) {
        console.log('⚠️  Found excessive newlines (3 or more in a row)');
      }
    }
    
    // Log the steps taken
    console.log('\n🔍 Steps taken:');
    notesResult.steps.forEach((step, i) => {
      if (step.action) {
        console.log(`${i + 1}. ${step.action} - ${step.thought || 'No thought'}`);
      }
    });
    
  } catch (error) {
    console.error('Notes error:', error);
  }
}

testNotesLocally().catch(console.error);