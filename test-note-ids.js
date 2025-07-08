require('dotenv').config();
const { getNotes } = require('./src/services/attioService');

async function testNoteIds() {
  console.log('\n=== Testing Note IDs from Attio API ===\n');
  
  try {
    // Test 1: Get notes for The Raine Group
    console.log('Fetching notes for The Raine Group...');
    const notes = await getNotes({
      recordId: 'a41e73b9-5dac-493f-bb2d-d38bb166c330',
      recordType: 'companies',
      limit: 5
    });
    
    console.log(`\nFound ${notes.length} notes\n`);
    
    if (notes.length > 0) {
      notes.forEach((note, index) => {
        console.log(`Note ${index + 1}:`);
        console.log('  ID:', note.id);
        console.log('  Title:', note.title);
        console.log('  Parent Object:', note.parentObject);
        console.log('  Parent Record ID:', note.parentRecordId);
        console.log('  Created At:', note.createdAt);
        console.log('  Created By:', note.createdBy);
        
        // Check if we can construct a note URL
        if (note.id && note.parentObject && note.parentRecordId) {
          const noteUrl = `https://app.attio.com/textql-data/${note.parentObject}/record/${note.parentRecordId}/notes?modal=note&id=${note.id}`;
          console.log('  Constructed URL:', noteUrl);
        }
        console.log();
      });
    } else {
      console.log('No notes found for this record.');
    }
    
    // Test 2: Get all recent notes to see more examples
    console.log('\n--- Testing all recent notes ---\n');
    const allNotes = await getNotes({ limit: 5 });
    
    console.log(`Found ${allNotes.length} recent notes\n`);
    
    allNotes.forEach((note, index) => {
      console.log(`Note ${index + 1}:`);
      console.log('  ID:', note.id);
      console.log('  Parent:', `${note.parentObject}/${note.parentRecordId}`);
      
      if (note.id && note.parentObject && note.parentRecordId) {
        const noteUrl = `https://app.attio.com/textql-data/${note.parentObject}/record/${note.parentRecordId}/notes?modal=note&id=${note.id}`;
        console.log('  URL:', noteUrl);
      }
      console.log();
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testNoteIds().catch(console.error);