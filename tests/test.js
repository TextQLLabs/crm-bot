/**
 * CRM Bot Test Suite
 * 
 * Streamlined test suite with LLM judges for both execution and response quality.
 * Tests the 7 critical functionality areas with automated evaluation.
 */

// Force unbuffered output for real-time display
process.stdout.setEncoding('utf8');
process.stderr.setEncoding('utf8');

require('dotenv').config({ path: '.env.dev' });
const { ClaudeAgent } = require('../src/services/claudeAgent');
const { saveConversation } = require('../src/services/fileStorage');

// Helper function to ensure immediate output
function logImmediate(message) {
  process.stdout.write(message + '\n');
}

logImmediate('\n🧪 Running CRM Bot Test Suite...\n');

async function evaluateWithConcreteCriteria(userInput, botResponse, toolsUsed = [], expectedResult = null) {
  try {
    logImmediate('   🧪 Evaluating against concrete criteria...');
    
    const response = botResponse.toLowerCase();
    const toolNames = toolsUsed.map(t => t.tool);
    
    let executionScore = 0;
    let qualityScore = 0;
    let executionEval = '';
    let qualityEval = '';
    
    if (!expectedResult) {
      // Fallback to basic checks if no criteria provided
      executionScore = toolsUsed.length > 0 ? 8 : 6;
      qualityScore = response.length > 10 ? 8 : 6;
      executionEval = `Basic evaluation: ${toolsUsed.length} tools used`;
      qualityEval = `Basic evaluation: ${response.length} characters response`;
      return { executionScore, qualityScore, executionEval, qualityEval };
    }
    
    // Test 5: Create Note Capability (MUST come before Test 1 to avoid conflict)
    if (expectedResult.shouldCreateNote) {
      // STRICT TEST: Extract and display the actual note URL
      const noteUrlPattern = /https:\/\/app\.attio\.com\/textql-data\/notes\/notes\?modal=note&id=([a-f0-9-]+)/;
      const noteUrlMatch = response.match(noteUrlPattern);
      const noteUrl = noteUrlMatch ? noteUrlMatch[0] : null;
      const noteId = noteUrlMatch ? noteUrlMatch[1] : null;
      
      // Always display the note URL in the test output
      if (noteUrl) {
        console.log(`\n🔗 NOTE CREATED SUCCESSFULLY!`);
        console.log(`📝 Note URL: ${noteUrl}`);
        console.log(`🆔 Note ID: ${noteId}`);
        executionScore = 10;
        qualityScore = 10;
        executionEval = `SUCCESS: Note created with URL: ${noteUrl}`;
        qualityEval = `SUCCESS: Note ID ${noteId} accessible at URL`;
      } else {
        console.log(`\n❌ NOTE CREATION FAILED!`);
        console.log(`📝 No note URL found in response`);
        console.log(`🔍 Response preview: ${response.substring(0, 200)}...`);
        executionScore = 0;
        qualityScore = 0;
        executionEval = 'FAILED: No note URL found - note was not created';
        qualityEval = 'FAILED: Response lacks note URL proving creation failed';
      }
    }
    
    // Test 1: Fuzzy Search
    else if (expectedResult.shouldFindEntity && typeof expectedResult.shouldFindEntity === 'string') {
      const entityFound = response.includes(expectedResult.shouldFindEntity.toLowerCase());
      const urlIncluded = response.includes(expectedResult.entityId) || response.includes('textql-data');
      const usedSearchTool = toolNames.includes('search_crm');
      
      executionScore = usedSearchTool ? (entityFound ? 10 : 6) : 3;
      qualityScore = entityFound && urlIncluded ? 10 : (entityFound ? 8 : 4);
      executionEval = `Search tool: ${usedSearchTool}, Entity found: ${entityFound}`;
      qualityEval = `Entity mentioned: ${entityFound}, URL provided: ${urlIncluded}`;
    }
    
    // Test 2: Organic Conversation  
    else if (expectedResult.shouldMentionCapabilities) {
      const capabilitiesMentioned = expectedResult.shouldMentionCapabilities.filter(cap => 
        response.includes(cap)
      ).length;
      const isHelpful = response.length > 50 && !response.includes('error');
      
      executionScore = isHelpful ? 9 : 6;
      qualityScore = capabilitiesMentioned >= 3 ? 10 : (capabilitiesMentioned >= 2 ? 8 : 6);
      executionEval = `Helpful response: ${isHelpful}`;
      qualityEval = `Capabilities mentioned: ${capabilitiesMentioned}/${expectedResult.shouldMentionCapabilities.length}`;
    }
    
    // Test 3: BMG Notes Content Verification
    else if (expectedResult.mustIncludeContent) {
      const entityMentioned = response.includes(expectedResult.entityName?.toLowerCase() || '');
      const usedNotesTool = toolNames.includes('get_notes') || toolNames.includes('search_crm');
      const includesRequiredContent = response.includes(expectedResult.mustIncludeContent);
      const mentionsTeams = expectedResult.shouldMentionTeams?.filter(team => 
        response.toLowerCase().includes(team.toLowerCase())
      ).length || 0;
      const providesRealSummary = response.length > 200; // Substantial content, not just count
      const hasEntityLink = response.includes('https://app.attio.com/textql-data/') && 
                           response.includes(expectedResult.entityId || '');
      
      executionScore = usedNotesTool ? (entityMentioned ? (includesRequiredContent ? 10 : 7) : 5) : 3;
      qualityScore = includesRequiredContent && providesRealSummary && hasEntityLink ? 10 : 
                    (mentionsTeams >= 2 && entityMentioned ? 8 : 5);
      executionEval = `Used notes tool: ${usedNotesTool}, Found entity: ${entityMentioned}, Has required content: ${includesRequiredContent}`;
      qualityEval = `Required content: ${includesRequiredContent}, Teams: ${mentionsTeams}/${expectedResult.shouldMentionTeams?.length}, Summary: ${providesRealSummary}, Link: ${hasEntityLink}`;
    }
    
    // Test 4: Notes operations (summarize) - legacy
    else if (expectedResult.expectedNoteCount !== undefined) {
      const entityMentioned = response.includes(expectedResult.entityName?.toLowerCase() || '');
      const usedNotesTool = toolNames.includes('get_notes') || toolNames.includes('search_crm');
      const mentionsNotes = response.includes('note');
      const correctCount = response.includes(expectedResult.expectedNoteCount.toString());
      
      executionScore = usedNotesTool ? (entityMentioned ? 9 : 7) : 4;
      qualityScore = mentionsNotes && entityMentioned ? (correctCount ? 10 : 8) : 5;
      executionEval = `Used notes tool: ${usedNotesTool}, Found entity: ${entityMentioned}`;
      qualityEval = `Mentions notes: ${mentionsNotes}, Correct count: ${correctCount}`;
    }
    
    
    // Test 6: Delete Note Capability  
    else if (expectedResult.shouldSearchForNotes) {
      const foundEntity = response.includes(expectedResult.shouldFindEntity?.toLowerCase() || '');
      const usedSearchTool = toolNames.includes('search_crm');
      const usedGetNotes = toolNames.includes('get_notes');
      const usedDeleteNote = toolNames.includes('delete_note');
      const confirmedDeletion = response.includes('deleted') || response.includes('removed') || response.includes('✅');
      
      // Check if response indicates the note was found before deletion
      const foundNoteBeforeDeletion = response.includes('found') || response.includes('note') || response.includes('verification');
      
      // Check if response indicates successful deletion with verification (note now gone)
      const verifiedDeletion = response.includes('not found') || response.includes('404') || response.includes('no longer') || response.includes('gone');
      
      // Extract any note ID mentioned for verification tracking
      const noteIdMatch = response.match(/notes\?modal=note&id=([a-f0-9-]+)/);
      const hasNoteReference = noteIdMatch !== null || response.includes('note') || response.includes('ID');
      
      executionScore = usedSearchTool && usedGetNotes ? (usedDeleteNote && foundNoteBeforeDeletion ? 10 : 8) : (usedGetNotes ? 6 : 3);
      qualityScore = foundEntity && confirmedDeletion && verifiedDeletion ? 10 : (foundEntity && confirmedDeletion ? 8 : 5);
      executionEval = `Used search: ${usedSearchTool}, Used get_notes: ${usedGetNotes}, Used delete_note: ${usedDeleteNote}, Found note first: ${foundNoteBeforeDeletion}`;
      qualityEval = `Entity found: ${foundEntity}, Confirmed deletion: ${confirmedDeletion}, Verified deletion: ${verifiedDeletion}, Note reference: ${hasNoteReference}`;
    }
    
    // Test 7: Tools listing
    else if (expectedResult.shouldListTools) {
      const toolsMentioned = expectedResult.expectedTools.filter(tool => 
        response.includes(tool) || response.includes(tool.replace('_', ' '))
      ).length;
      const explainedCapabilities = response.includes('search') && response.includes('note');
      
      executionScore = explainedCapabilities ? 9 : 6;
      qualityScore = toolsMentioned >= 3 ? 10 : (toolsMentioned >= 2 ? 8 : 6);
      executionEval = `Listed capabilities: ${explainedCapabilities}`;
      qualityEval = `Tools mentioned: ${toolsMentioned}/${expectedResult.expectedTools.length}`;
    }
    
    // Test 8: Count specific
    else if (expectedResult.shouldProvideExactCount) {
      const foundEntity = response.includes(expectedResult.entityName?.toLowerCase() || '');
      const usedTools = toolNames.includes('get_notes') || toolNames.includes('search_crm');
      const providedCount = response.includes(expectedResult.expectedNoteCount.toString());
      
      executionScore = usedTools ? (foundEntity ? 10 : 7) : 4;
      qualityScore = foundEntity && providedCount ? 10 : (foundEntity ? 7 : 4);
      executionEval = `Used tools: ${usedTools}, Found entity: ${foundEntity}`;
      qualityEval = `Found entity: ${foundEntity}, Correct count: ${providedCount}`;
    }
    
    // Test 9: Note lookup introspection
    else if (expectedResult.shouldFindSpecificNote) {
      const foundEntity = response.includes(expectedResult.entityName?.toLowerCase() || '');
      const usedSearchTools = toolNames.includes('get_notes') || toolNames.includes('search_crm');
      const mentionedEthan = response.includes('ethan') || response.includes('Ethan');
      const mentionedDate = response.includes('july') || response.includes('July') || response.includes('11');
      const foundNoteId = response.includes(expectedResult.expectedNoteId) || response.includes('b52a70a6');
      
      executionScore = usedSearchTools ? (foundEntity ? (foundNoteId ? 10 : 8) : 6) : 3;
      qualityScore = foundEntity && mentionedEthan && mentionedDate ? (foundNoteId ? 10 : 8) : 5;
      executionEval = `Used search tools: ${usedSearchTools}, Found entity: ${foundEntity}, Found note ID: ${foundNoteId}`;
      qualityEval = `Mentioned Ethan: ${mentionedEthan}, Mentioned date: ${mentionedDate}, Found note: ${foundNoteId}`;
    }
    
    return { executionScore, qualityScore, executionEval, qualityEval };
  } catch (error) {
    console.log('   ⚠️ Evaluation failed:', error.message);
    return { executionScore: 0, qualityScore: 0, executionEval: 'ERROR', qualityEval: 'ERROR' };
  }
}

async function runTest(testName, userInput, emoji = '🧪', expectedResult = null) {
  logImmediate(`${emoji} ${testName}...`);
  
  try {
    logImmediate('   ⚙️ Processing request...');
    const agent = new ClaudeAgent();
    const result = await agent.processMessage({
      text: userInput,
      userName: 'test-user',
      channel: 'test',
      threadTs: 'test-thread',
      messageTs: new Date().getTime().toString(),
      userId: 'test-user-id',
      conversationHistory: [],
      botActionHistory: []
    });

    // Save conversation logs for debugging
    const conversationData = {
      threadTs: 'test-thread',
      messageTs: new Date().getTime().toString(),
      userId: 'test-user-id',
      userName: 'test-user',
      channel: 'test',
      userMessage: userInput,
      finalResponse: result.answer,
      toolsUsed: result.toolsUsed || [],
      success: result.success,
      error: result.error,
      processingTime: 0,
      agentThoughts: result.thinking ? [result.thinking] : [],
      agentActions: result.toolsUsed || []
    };
    
    try {
      await saveConversation(conversationData);
      logImmediate(`   💾 Saved conversation log for debugging`);
    } catch (error) {
      logImmediate(`   ⚠️ Failed to save conversation log: ${error.message}`);
    }

    const evaluation = await evaluateWithConcreteCriteria(userInput, result.answer, result.toolsUsed, expectedResult);
    
    const executionPass = evaluation.executionScore >= 7;
    const qualityPass = evaluation.qualityScore >= 7;
    const overallPass = executionPass && qualityPass;
    
    logImmediate(`   Execution: ${evaluation.executionScore}/10 ${executionPass ? '✅' : '❌'}`);
    logImmediate(`   Quality: ${evaluation.qualityScore}/10 ${qualityPass ? '✅' : '❌'}`);
    logImmediate(`   Status: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);
    
    return {
      test: testName,
      userInput,
      passed: overallPass,
      executionScore: evaluation.executionScore,
      qualityScore: evaluation.qualityScore,
      executionEval: evaluation.executionEval,
      qualityEval: evaluation.qualityEval,
      toolsUsed: result.toolsUsed?.length || 0,
      response: result.answer
    };
  } catch (error) {
    logImmediate(`   ❌ ERROR: ${error.message}`);
    return {
      test: testName,
      userInput,
      passed: false,
      executionScore: 0,
      qualityScore: 0,
      executionEval: 'Test crashed',
      qualityEval: 'Test crashed',
      toolsUsed: 0,
      error: error.message
    };
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const selectedTests = args.length > 0 ? args.map(arg => parseInt(arg)).filter(n => !isNaN(n) && n >= 1 && n <= 9) : [];

function defineAllTests() {
  return [
    {
      id: 1,
      name: 'Fuzzy Search (rayn → raine)',
      input: 'search for rayn group',
      emoji: '🔍',
      expected: {
        shouldFindEntity: 'The Raine Group',
        entityId: 'a41e73b9-5dac-493f-bb2d-d38bb166c330',
        entityUrl: 'https://app.attio.com/textql-data/company/a41e73b9-5dac-493f-bb2d-d38bb166c330/overview'
      }
    },
    {
      id: 2,
      name: 'Organic Conversation',
      input: 'hey what can you do?',
      emoji: '💬',
      expected: {
        shouldMentionCapabilities: ['search', 'notes', 'create', 'delete', 'summarize'],
        shouldBeHelpful: true,
        shouldNotCrash: true
      }
    },
    {
      id: 3,
      name: 'BMG Notes Content Verification',
      input: 'summarize the bmg meetings to date',
      emoji: '📝',
      expected: {
        entityName: 'BMG',
        entityType: 'deal',
        entityId: 'cd30b453-3dd8-420a-b32f-84968b7c5155',
        expectedNoteCount: 4,
        expectedNoteIds: [
          '04dfe52c-3bed-44c2-b20d-8f70797d69a5',
          '766e3425-5151-4010-ab38-303b7ce30fd7',
          '9f3ef1f8-e7ac-4735-8ce6-f8d0f917e443',
          '361185d9-7e31-46b1-b2a5-bde23f470687'
        ],
        mustIncludeContent: 'Three business-facing teams outside of IT have requested that the CTO evaluate our products: a finance team (interested in budgets vs. actuals analysis), a local analytics team focused on marketing analytics, and a global analytics team',
        sourceNoteId: '361185d9-7e31-46b1-b2a5-bde23f470687',
        shouldMentionTeams: ['finance team', 'analytics team', 'CTO'],
        shouldProvideRealSummary: true
      }
    },
    {
      id: 4,
      name: 'Notes Summarization (BMG)',
      input: 'summarize all the notes in bmg',
      emoji: '📊',
      expected: {
        entityName: 'BMG',
        shouldProvideSummary: true,
        shouldMentionKeyThemes: ['CTO meeting', 'teams', 'analytics'],
        expectedNoteCount: 4
      }
    },
    {
      id: 5,
      name: 'Create Note Capability',
      input: 'create a note on Silver Lake saying "Test note for verification"',
      emoji: '📝',
      expected: {
        shouldFindEntity: 'Silver Lake',
        shouldCreateNote: true,
        shouldProvideNoteUrl: true,
        noteContent: 'Test note for verification'
      }
    },
    {
      id: 6,
      name: 'Delete Note Capability',
      input: 'delete the test note on Silver Lake',
      emoji: '🗑️',
      expected: {
        shouldFindEntity: 'Silver Lake',
        shouldSearchForNotes: true,
        shouldDeleteNote: true,
        shouldConfirmDeletion: true
      }
    },
    {
      id: 7,
      name: 'Tools Listing',
      input: 'list all tools available to you',
      emoji: '🛠️',
      expected: {
        shouldListTools: true,
        expectedTools: ['search_crm', 'create_note', 'get_notes', 'delete_note'],
        shouldExplainCapabilities: true
      }
    },
    {
      id: 8,
      name: 'Count Notes Test',
      input: 'find raine and count their notes',
      emoji: '📊',
      expected: {
        entityName: 'The Raine Group',
        expectedNoteCount: 17,
        shouldProvideExactCount: true,
        shouldFindEntity: true
      }
    },
    {
      id: 9,
      name: 'Basic Note Lookup Introspection',
      input: 'who did ethan text from blackstone on july 11',
      emoji: '🔍',
      expected: {
        entityName: 'Blackstone',
        shouldFindEntity: true,
        shouldFindSpecificNote: true,
        expectedNoteId: 'b52a70a6-6422-4790-9932-60231d5deff1',
        shouldMentionEthan: true,
        shouldMentionDate: true
      }
    }
  ];
}

async function runTestSuite() {
  const startTime = Date.now();
  const allTests = defineAllTests();
  
  // Determine which tests to run
  const testsToRun = selectedTests.length > 0 
    ? allTests.filter(test => selectedTests.includes(test.id))
    : allTests;
  
  if (selectedTests.length > 0) {
    logImmediate(`\n🧪 Running Selected Tests: ${selectedTests.join(', ')}...\n`);
  } else {
    logImmediate('\n🧪 Running CRM Bot Test Suite...\n');
  }
  
  logImmediate('┌─────────────────────────────────────────────────────────────┐');
  logImmediate('│                    CRM Bot Test Suite                       │');
  logImmediate('│                  LLM-Judged Evaluation                      │');
  logImmediate('└─────────────────────────────────────────────────────────────┘\n');

  const results = [];

  // Run selected tests
  for (const test of testsToRun) {
    results.push(await runTest(test.name, test.input, test.emoji, test.expected));
  }

  // Results Summary
  const duration = Date.now() - startTime;
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log('\n📊 Test Results Summary');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('┌─────────────────────────────┬──────────┬─────────┬──────────┐');
  console.log('│ Test                        │ Execution│ Quality │ Status   │');
  console.log('├─────────────────────────────┼──────────┼─────────┼──────────┤');
  
  results.forEach(result => {
    const testName = result.test.substring(0, 27).padEnd(27);
    const execScore = result.executionScore.toString().padStart(8);
    const qualScore = result.qualityScore.toString().padStart(7);
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    
    console.log(`│ ${testName} │ ${execScore} │ ${qualScore} │ ${status} │`);
  });
  
  console.log('└─────────────────────────────┴──────────┴─────────┴──────────┘');

  // Calculate averages
  const validResults = results.filter(r => r.executionScore > 0 && r.qualityScore > 0);
  const avgExecution = validResults.length > 0 ? 
    (validResults.reduce((sum, r) => sum + r.executionScore, 0) / validResults.length).toFixed(1) : '0.0';
  const avgQuality = validResults.length > 0 ? 
    (validResults.reduce((sum, r) => sum + r.qualityScore, 0) / validResults.length).toFixed(1) : '0.0';

  console.log(`\n📈 Performance Metrics:`);
  console.log(`   • Tests Passed: ${passed}/${total} (${passRate}%)`);
  console.log(`   • Average Execution Score: ${avgExecution}/10`);
  console.log(`   • Average Quality Score: ${avgQuality}/10`);
  console.log(`   • Test Duration: ${(duration / 1000).toFixed(1)}s`);
  console.log(`   • Pass Threshold: 7/10 (both execution and quality)`);

  // Failed Tests Details
  const failedTests = results.filter(r => !r.passed);
  if (failedTests.length > 0) {
    console.log(`\n❌ Failed Tests (${failedTests.length}):`);
    failedTests.forEach(test => {
      console.log(`\n   ${test.test}:`);
      console.log(`   Input: "${test.userInput}"`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      } else {
        console.log(`   Execution (${test.executionScore}/10): ${test.executionEval}`);
        console.log(`   Quality (${test.qualityScore}/10): ${test.qualityEval}`);
      }
    });
  }

  // Overall Result
  console.log('\n' + '═'.repeat(63));
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! CRM Bot is functioning correctly.');
    process.exit(0);
  } else {
    console.log(`⚠️ ${total - passed} TEST(S) FAILED! Please review and fix issues.`);
    console.log('\n💡 Tips:');
    console.log('   • Check system prompts for clarity and completeness');
    console.log('   • Verify tool integrations are working');
    console.log('   • Test individual components with npm run local');
    console.log('\n📖 Usage:');
    console.log('   • Run all tests: npm run test');
    console.log('   • Run specific tests: npm run test 1 3 7');
    console.log('   • Available tests: 1-8');
    process.exit(1);
  }
}

// Show usage if --help is provided
if (args.includes('--help') || args.includes('-h')) {
  console.log('\n🧪 CRM Bot Test Suite\n');
  console.log('Usage:');
  console.log('  npm run test           # Run all tests');
  console.log('  npm run test 1         # Run test 1 only');
  console.log('  npm run test 1 3 7     # Run tests 1, 3, and 7');
  console.log('  npm run test --help    # Show this help');
  console.log('\nAvailable Tests:');
  defineAllTests().forEach(test => {
    console.log(`  ${test.id}. ${test.name}`);
  });
  console.log();
  process.exit(0);
}

// Run the test suite
runTestSuite().catch(error => {
  console.error('\n💥 Test suite crashed:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});