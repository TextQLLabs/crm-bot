/**
 * Manual Attio API Testing Script
 * Tests create_note and delete_note directly against the Attio API
 * to verify ground truth understanding
 */

const axios = require('axios');
require('dotenv').config({ path: '.env.dev' });

const ATTIO_API_BASE = 'https://api.attio.com/v2';
const ATTIO_API_KEY = process.env.ATTIO_API_KEY;

if (!ATTIO_API_KEY) {
  console.error('❌ ATTIO_API_KEY not found in environment variables');
  process.exit(1);
}

// Create axios client
const attioClient = axios.create({
  baseURL: ATTIO_API_BASE,
  headers: {
    'Authorization': `Bearer ${ATTIO_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Test entities (from the test suite)
const TEST_ENTITIES = {
  raine: {
    id: 'a41e73b9-5dac-493f-bb2d-d38bb166c330',
    type: 'company',
    name: 'The Raine Group'
  },
  bmg: {
    id: 'cd30b453-3dd8-420a-b32f-84968b7c5155', 
    type: 'deal',
    name: 'BMG'
  }
};

async function manualCreateNote(entityId, entityType, content, title = 'Manual API Test Note') {
  console.log(`\n🔧 Creating note manually via Attio API...`);
  console.log(`Entity: ${entityType} ${entityId}`);
  console.log(`Content: "${content}"`);
  
  const parentObject = {
    'company': 'companies',
    'deal': 'deals',
    'person': 'people'
  }[entityType];
  
  // Try API Reference format first (content as string)
  const payload = {
    data: {
      parent_object: parentObject,
      parent_record_id: entityId,
      title: title,
      content: content,  // Direct string, not nested object
      format: 'plaintext',  // Separate field
      created_by_actor: {
        type: 'api-token'
      }
    }
  };
  
  console.log('📤 Request payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await attioClient.post('/notes', payload);
    console.log('✅ Note created successfully!');
    console.log('📥 Response:', JSON.stringify(response.data, null, 2));
    
    const noteId = response.data.data?.id?.note_id || response.data.data?.id;
    console.log(`🆔 Note ID: ${noteId}`);
    
    // Generate note URL for verification
    const noteUrl = `https://app.attio.com/textql-data/${entityType}/${entityId}/overview`;
    console.log(`🔗 View in Attio: ${noteUrl}`);
    
    return {
      success: true,
      noteId: noteId,
      noteData: response.data.data,
      url: noteUrl
    };
  } catch (error) {
    console.error('❌ Create note failed:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

async function manualDeleteNote(noteId) {
  console.log(`\n🗑️ Deleting note manually via Attio API...`);
  console.log(`Note ID: ${noteId}`);
  
  try {
    // First, get note details for verification
    console.log('📋 Getting note details first...');
    const detailsResponse = await attioClient.get(`/notes/${noteId}`);
    const noteDetails = detailsResponse.data.data;
    
    console.log('📝 Note details:');
    console.log(`  Title: ${noteDetails.title}`);
    console.log(`  Content: ${noteDetails.content_plaintext || noteDetails.content?.content || 'No content'}`);
    console.log(`  Parent: ${noteDetails.parent_object}/${noteDetails.parent_record_id}`);
    console.log(`  Created: ${noteDetails.created_at}`);
    
    // Now delete the note
    console.log('🗑️ Deleting note...');
    const deleteResponse = await attioClient.delete(`/notes/${noteId}`);
    
    console.log('✅ Note deleted successfully!');
    console.log('📥 Delete response status:', deleteResponse.status);
    console.log('📥 Delete response data:', deleteResponse.data);
    
    return {
      success: true,
      deletedNoteDetails: noteDetails,
      deleteResponse: deleteResponse.data
    };
  } catch (error) {
    console.error('❌ Delete note failed:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

async function manualGetNotes(entityId, entityType, limit = 10) {
  console.log(`\n📋 Getting notes manually via Attio API...`);
  console.log(`Entity: ${entityType} ${entityId}`);
  
  const parentObject = {
    'company': 'companies',
    'deal': 'deals', 
    'person': 'people'
  }[entityType];
  
  try {
    const url = `/notes?parent_record_id=${entityId}&parent_object=${parentObject}&limit=${limit}&sort=-created_at`;
    console.log('📤 Request URL:', ATTIO_API_BASE + url);
    
    const response = await attioClient.get(url);
    console.log('✅ Notes retrieved successfully!');
    
    const notes = response.data.data || [];
    console.log(`📊 Found ${notes.length} notes:`);
    
    notes.forEach((note, index) => {
      const noteId = note.id?.note_id || note.id;
      const title = note.title || 'Untitled';
      const content = note.content_plaintext || note.content?.content || 'No content';
      const created = note.created_at ? new Date(note.created_at).toLocaleString() : 'Unknown';
      
      console.log(`  ${index + 1}. ${title} (ID: ${noteId})`);
      console.log(`     Created: ${created}`);
      console.log(`     Content: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
    });
    
    return {
      success: true,
      notes: notes,
      count: notes.length
    };
  } catch (error) {
    console.error('❌ Get notes failed:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

async function testCreateAndDeleteCycle() {
  console.log('🧪 Testing Complete Create → Verify → Delete → Verify Cycle');
  console.log('=' .repeat(60));
  
  const testEntity = TEST_ENTITIES.raine; // Use Raine Group for testing
  const testContent = `Test note created at ${new Date().toISOString()} via manual API testing`;
  
  // Step 1: Create note
  const createResult = await manualCreateNote(
    testEntity.id, 
    testEntity.type, 
    testContent,
    'Manual API Test Note'
  );
  
  if (!createResult.success) {
    console.error('❌ Create test failed, stopping cycle');
    return;
  }
  
  const noteId = createResult.noteId;
  console.log(`\n✅ Note created with ID: ${noteId}`);
  
  // Step 2: Verify note exists by getting all notes
  console.log('\n🔍 Verifying note exists...');
  const getResult = await manualGetNotes(testEntity.id, testEntity.type);
  
  if (getResult.success) {
    const foundNote = getResult.notes.find(note => 
      (note.id?.note_id || note.id) === noteId
    );
    
    if (foundNote) {
      console.log('✅ Note verified in notes list');
      console.log(`   Title: ${foundNote.title}`);
      console.log(`   Content matches: ${foundNote.content_plaintext?.includes(testContent) ? 'Yes' : 'No'}`);
    } else {
      console.log('❌ Note not found in notes list');
    }
  }
  
  // Step 3: Wait a moment then delete
  console.log('\n⏳ Waiting 2 seconds before deletion...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const deleteResult = await manualDeleteNote(noteId);
  
  if (!deleteResult.success) {
    console.error('❌ Delete test failed');
    console.log(`⚠️ Note ${noteId} may still exist and need manual cleanup`);
    return;
  }
  
  // Step 4: Verify note is gone
  console.log('\n🔍 Verifying note is deleted...');
  try {
    await attioClient.get(`/notes/${noteId}`);
    console.log('❌ Note still exists after deletion!');
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('✅ Note successfully deleted (404 as expected)');
    } else {
      console.log('❓ Unexpected error checking deleted note:', error.message);
    }
  }
  
  console.log('\n🎉 Create → Delete cycle test completed!');
}

async function demonstrateAPIUsage() {
  console.log('🚀 Manual Attio API Testing');
  console.log('Testing create_note and delete_note functionality directly');
  console.log('=' .repeat(60));
  
  console.log('🔑 API Configuration:');
  console.log(`  Base URL: ${ATTIO_API_BASE}`);
  console.log(`  API Key: ${ATTIO_API_KEY ? `${ATTIO_API_KEY.substring(0, 20)}...` : 'MISSING'}`);
  console.log(`  Test Entity: ${TEST_ENTITIES.raine.name} (${TEST_ENTITIES.raine.type})`);
  
  // Test 1: Show existing notes
  console.log('\n📋 Step 1: Get existing notes');
  await manualGetNotes(TEST_ENTITIES.raine.id, TEST_ENTITIES.raine.type, 5);
  
  // Test 2: Full create/delete cycle
  console.log('\n🔄 Step 2: Create and Delete Cycle');
  await testCreateAndDeleteCycle();
  
  console.log('\n📖 Usage Summary:');
  console.log('  create_note parameters: (entityId, entityType, content, title?)');
  console.log('  delete_note parameters: (noteId)');
  console.log('  get_notes parameters: (entityId, entityType, limit?)');
  console.log('\n🔗 Key insights:');
  console.log('  • parent_object must be plural: "companies", "deals", "people"');
  console.log('  • content is wrapped in object: { content: string, format: "plaintext" }');
  console.log('  • created_by_actor should be { type: "api-token" }');
  console.log('  • note URLs follow pattern: /textql-data/{type}/{entityId}/overview');
}

// Run the demonstration
demonstrateAPIUsage().catch(error => {
  console.error('💥 Test suite crashed:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});