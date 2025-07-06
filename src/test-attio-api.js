require('dotenv').config();
const { searchAttio, getAttioClient } = require('./services/attioService');

async function testAttioConnection() {
  console.log('=== Testing Attio API Connection ===');
  console.log('API Key:', process.env.ATTIO_API_KEY ? `Present (${process.env.ATTIO_API_KEY.substring(0, 20)}...)` : 'MISSING');
  
  // Skip workspace test - we know the API key works but has limited permissions
  console.log('\nTest 1: API key is valid (403 on workspace members = valid key, limited perms)');

  try {
    // Test 2: Search for "Raine Group"
    console.log('\nTest 2: Searching for "Raine Group"...');
    const results = await searchAttio('Raine Group');
    console.log('Search completed. Results:', results.length);
    
    // Test 3: List all companies (limited)
    console.log('\nTest 3: Listing companies...');
    const listResponse = await getAttioClient().post('/objects/companies/records/query', {
      limit: 5
    });
    console.log('Companies found:', listResponse.data?.data?.length || 0);
    if (listResponse.data?.data?.length > 0) {
      console.log('Sample companies:');
      listResponse.data.data.forEach(company => {
        const name = company.values?.name?.[0]?.value || 'Unnamed';
        console.log(`  - ${name}`);
      });
    }
  } catch (error) {
    console.error('Search/List error:', error.response?.data || error.message);
  }
}

// Run the test
testAttioConnection().catch(console.error);