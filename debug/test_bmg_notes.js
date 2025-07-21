/**
 * Test create_note and delete_note on BMG deal entity
 */

const axios = require('axios');
require('dotenv').config({ path: '.env.dev' });

const ATTIO_API_BASE = 'https://api.attio.com/v2';
const ATTIO_API_KEY = process.env.ATTIO_API_KEY;

const attioClient = axios.create({
  baseURL: ATTIO_API_BASE,
  headers: {
    'Authorization': `Bearer ${ATTIO_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

const BMG_DEAL = {
  id: 'cd30b453-3dd8-420a-b32f-84968b7c5155',
  type: 'deal',
  name: 'BMG'
};

async function testBMGNotes() {
  console.log('🧪 Testing notes on BMG deal entity');
  console.log(`Entity: ${BMG_DEAL.name} (${BMG_DEAL.type})`);
  console.log(`ID: ${BMG_DEAL.id}`);
  
  // 1. Get existing notes
  try {
    const url = `/notes?parent_record_id=${BMG_DEAL.id}&parent_object=deals&limit=5&sort=-created_at`;
    const response = await attioClient.get(url);
    const notes = response.data.data || [];
    
    console.log(`\n📊 Found ${notes.length} existing notes:`);
    notes.forEach((note, index) => {
      const noteId = note.id?.note_id || note.id;
      const title = note.title || 'Untitled';
      const content = note.content_plaintext || note.content?.content || 'No content';
      const created = note.created_at ? new Date(note.created_at).toLocaleString() : 'Unknown';
      
      console.log(`  ${index + 1}. ${title} (ID: ${noteId})`);
      console.log(`     Created: ${created}`);
      console.log(`     Content: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
    });
  } catch (error) {
    console.error('❌ Failed to get existing notes:', error.response?.data || error.message);
  }
  
  // 2. Create a test note
  const testContent = `Test note on BMG deal created at ${new Date().toISOString()}`;
  
  try {
    console.log('\n🔧 Creating test note...');
    const createPayload = {
      data: {
        parent_object: 'deals',
        parent_record_id: BMG_DEAL.id,
        title: 'BMG Test Note',
        content: testContent,
        format: 'plaintext',
        created_by_actor: {
          type: 'api-token'
        }
      }
    };
    
    const createResponse = await attioClient.post('/notes', createPayload);
    const noteId = createResponse.data.data?.id?.note_id;
    
    console.log('✅ Note created successfully!');
    console.log(`🆔 Note ID: ${noteId}`);
    console.log(`🔗 View BMG Deal: https://app.attio.com/textql-data/deals/record/${BMG_DEAL.id}/overview`);
    
    // 3. Delete the test note
    console.log('\n🗑️ Deleting test note...');
    await attioClient.delete(`/notes/${noteId}`);
    console.log('✅ Note deleted successfully!');
    
  } catch (error) {
    console.error('❌ Note creation/deletion failed:', error.response?.data || error.message);
  }
}

testBMGNotes().catch(console.error);