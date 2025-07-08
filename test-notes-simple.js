#!/usr/bin/env node

// Simple test to check the final notes output
require('dotenv').config();
const { ReactAgent } = require('./src/services/reactAgent');

async function testNotesSimple() {
  console.log('🧪 Testing notes output...\n');
  
  const agent = new ReactAgent();
  
  const notesMessage = {
    text: 'can you find any notes on The Raine Group deal?',
    userName: 'Test User',
    channel: '#test',
    userId: 'U123456',
    threadTs: '123456789.123457',
    messageTs: '123456789.123457'
  };
  
  try {
    const result = await agent.processMessage(notesMessage);
    
    if (result.success && result.answer) {
      console.log('✅ Success! Here\'s the formatted answer:\n');
      console.log('━'.repeat(80));
      console.log(result.answer);
      console.log('━'.repeat(80));
      
      // Analyze the output
      console.log('\n📊 Analysis:');
      console.log('- Length:', result.answer.length, 'characters');
      console.log('- Lines:', result.answer.split('\n').length);
      
      // Check for potential issues
      const issues = [];
      
      if (result.answer.includes('**')) {
        issues.push('Contains ** (double asterisks)');
      }
      
      if (result.answer.match(/\*\*[^*]+\*\*/)) {
        issues.push('Contains **bold** markdown');
      }
      
      const unescapedChars = result.answer.match(/[<>&](?![a-z]+;)/g);
      if (unescapedChars) {
        issues.push(`Unescaped characters: ${[...new Set(unescapedChars)].join(', ')}`);
      }
      
      if (result.answer.match(/\n{3,}/)) {
        issues.push('Contains 3+ consecutive newlines');
      }
      
      if (issues.length > 0) {
        console.log('\n⚠️  Potential issues found:');
        issues.forEach(issue => console.log('  -', issue));
      } else {
        console.log('\n✅ No formatting issues detected');
      }
      
    } else {
      console.log('❌ Failed:', result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testNotesSimple().catch(console.error);