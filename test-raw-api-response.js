require('dotenv').config();
const { getAttioClient } = require('./src/services/attioService');

async function testRawApiResponse() {
  console.log('\n=== Testing Raw Attio API Response for Notes ===\n');
  
  try {
    const client = getAttioClient();
    
    // Get notes for The Raine Group
    const url = '/notes?parent_record_id=a41e73b9-5dac-493f-bb2d-d38bb166c330&parent_object=companies&limit=2&sort=-created_at';
    console.log('Calling API:', url);
    
    const response = await client.get(url);
    
    console.log('\n=== RAW API RESPONSE ===');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Check the structure
    if (response.data && response.data.data && response.data.data[0]) {
      const firstNote = response.data.data[0];
      console.log('\n=== FIRST NOTE STRUCTURE ===');
      console.log('Keys:', Object.keys(firstNote));
      
      if (firstNote.id) {
        console.log('\nID field structure:');
        console.log(JSON.stringify(firstNote.id, null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('API Error Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testRawApiResponse().catch(console.error);