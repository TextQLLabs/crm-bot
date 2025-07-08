const dotenv = require('dotenv');
dotenv.config();

const { searchAttio } = require('./src/services/attioService');

async function testSearchVariations() {
  console.log('=== Testing Search Variations ===\n');
  
  const searchQueries = [
    'The Raine Group',
    'Raine Group', 
    'Raine',
    'raine',
    'rain group',
    'the raine'
  ];
  
  for (const query of searchQueries) {
    console.log(`\n📍 Testing: "${query}"`);
    console.log('─'.repeat(50));
    
    try {
      const results = await searchAttio(query);
      
      if (results && results.length > 0) {
        console.log(`✅ Found ${results.length} results:`);
        results.forEach(r => {
          console.log(`   - ${r.name} (${r.type}) - ${r.url || 'No URL'}`);
        });
      } else {
        console.log('❌ No results found');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
  
  console.log('\n=== Test Complete ===');
}

// Run the test
testSearchVariations().catch(console.error);