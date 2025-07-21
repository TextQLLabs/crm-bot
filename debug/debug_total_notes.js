const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.dev' });

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;
const ATTIO_WORKSPACE_ID = process.env.ATTIO_WORKSPACE_ID;

function getAttioClient() {
  return axios.create({
    baseURL: `https://api.attio.com/v2/workspaces/${ATTIO_WORKSPACE_ID}`,
    headers: {
      'Authorization': `Bearer ${ATTIO_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
}

async function getTotalNoteCount(entityType, entityId) {
  try {
    let allNotes = [];
    let hasMore = true;
    let offset = 0;
    const limit = 50; // Max allowed by Attio
    
    console.log(`Getting total notes for ${entityType} ${entityId}...`);
    
    while (hasMore) {
      const params = new URLSearchParams();
      params.append('parent_record_id', entityId);
      params.append('parent_object', `${entityType}s`); // companies, deals, persons
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      params.append('sort', '-created_at');
      
      const url = `/notes?${params.toString()}`;
      console.log(`Fetching: ${url}`);
      
      const response = await getAttioClient().get(url);
      const notes = response.data.data || [];
      
      console.log(`  Page ${Math.floor(offset/limit) + 1}: ${notes.length} notes`);
      allNotes.push(...notes);
      
      // Check if there are more notes
      hasMore = notes.length === limit;
      offset += limit;
      
      // Safety break to avoid infinite loops
      if (offset > 1000) {
        console.log('  Safety break at 1000 notes');
        break;
      }
    }
    
    return allNotes.length;
  } catch (error) {
    console.error('Error getting total note count:', error.message);
    return -1;
  }
}

(async () => {
  console.log('Testing total note count for The Raine Group...');
  const totalNotes = await getTotalNoteCount('company', 'a41e73b9-5dac-493f-bb2d-d38bb166c330');
  console.log(`\nTOTAL NOTES: ${totalNotes}`);
  
  console.log('\n📊 Summary:');
  console.log(`  • Test expects: 17 notes`);
  console.log(`  • Bot reports: 50 notes (pagination limit)`);
  console.log(`  • Actual total: ${totalNotes} notes`);
  
  if (totalNotes === 17) {
    console.log('  • ✅ Test expectation is correct, API pagination issue');
  } else if (totalNotes > 50) {
    console.log('  • ❌ Test expectation is wrong, The Raine Group has more notes than expected');
  } else {
    console.log('  • 🤔 Unexpected result, needs investigation');
  }
})();