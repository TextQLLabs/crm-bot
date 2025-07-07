require('dotenv').config();

const axios = require('axios');

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;
const ATTIO_API_URL = 'https://api.attio.com/v2';

async function testSearch() {
  try {
    console.log('Testing Attio search for "The Raine Group"...\n');
    
    const searchQuery = 'The Raine Group';
    const url = `${ATTIO_API_URL}/objects/companies/records/query`;
    
    console.log('Request URL:', url);
    console.log('Search query:', searchQuery);
    
    const response = await axios.post(url, {
      filter: {
        any_of: [
          {
            attribute: "name",
            relation: "contains_insensitive",
            value: searchQuery
          }
        ]
      }
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
      
      // Try alternative searches
      console.log('\nTrying alternative searches...');
      
      // Search for just "Raine"
      const altResponse = await axios.post(url, {
        filter: {
          any_of: [
            {
              attribute: "name",
              relation: "contains_insensitive",
              value: "Raine"
            }
          ]
        }
      }, {
        headers: {
          'Authorization': `Bearer ${ATTIO_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('\nSearch for "Raine":');
      console.log('Number of results:', altResponse.data.data?.length || 0);
      
      if (altResponse.data.data && altResponse.data.data.length > 0) {
        altResponse.data.data.forEach((company, i) => {
          const name = company.values?.name?.[0]?.value || 'No name';
          const id = company.id?.record_id;
          console.log(`${i + 1}. ${name} (ID: ${id})`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testSearch();