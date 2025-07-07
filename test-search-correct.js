require('dotenv').config();

const axios = require('axios');

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;
const ATTIO_API_URL = 'https://api.attio.com/v2';

async function testSearch() {
  try {
    console.log('Testing Attio search for "The Raine Group" with correct API format...\n');
    
    const query = 'The Raine Group';
    const url = `${ATTIO_API_URL}/objects/companies/records/query`;
    
    // Generate search variations
    const variations = [query, query.toLowerCase()];
    const words = query.split(' ');
    if (words.length > 1) {
      variations.push(words[0]); // "The"
      variations.push(words.slice(1).join(' ')); // "Raine Group"
      variations.push(words[1]); // "Raine"
    }
    
    console.log('Search variations:', variations);
    
    // Build filters
    const filters = [];
    variations.forEach(variation => {
      filters.push({
        name: {
          $contains: variation
        }
      });
      filters.push({
        domains: {
          $contains: variation.toLowerCase()
        }
      });
    });
    
    console.log('\nRequest body:', JSON.stringify({
      filter: {
        $or: filters
      },
      limit: 20
    }, null, 2));
    
    const response = await axios.post(url, {
      filter: {
        $or: filters
      },
      limit: 20
    }, {
      headers: {
        'Authorization': `Bearer ${ATTIO_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\nSearch response:');
    console.log('Status:', response.status);
    console.log('Number of results:', response.data.data?.length || 0);
    
    if (response.data.data && response.data.data.length > 0) {
      console.log('\nResults found:');
      response.data.data.forEach((company, i) => {
        const name = company.values?.name?.[0]?.value || 'No name';
        const id = company.id?.record_id;
        console.log(`${i + 1}. ${name} (ID: ${id})`);
        console.log(`   URL: https://app.attio.com/textql-data/companies/record/${id}`);
      });
    } else {
      console.log('\nNo results found!');
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.error('\nAPI Key issue - check if the key is valid!');
    }
  }
}

testSearch();