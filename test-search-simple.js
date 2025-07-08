const dotenv = require('dotenv');
dotenv.config();

const { searchAttio } = require('./src/services/attioService');

async function testSearch() {
  console.log('Testing search for "The Raine Group"...\n');
  
  try {
    const results = await searchAttio('The Raine Group');
    
    console.log('Raw results:', JSON.stringify(results, null, 2));
    console.log('\nResults type:', typeof results);
    console.log('Is array?', Array.isArray(results));
    console.log('Results length:', results.length);
    
    if (results.length === 0) {
      console.log('\n❌ PROBLEM: Results array is empty!');
    } else {
      console.log('\n✅ Results found:', results.length);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSearch();