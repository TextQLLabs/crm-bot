require('dotenv').config();

const axios = require('axios');

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;
const ATTIO_API_URL = 'https://api.attio.com/v2';

async function getSpecificCompany() {
  try {
    console.log('Getting specific company by ID: a41e73b9-5dac-493f-bb2d-d38bb166c330\n');
    
    const companyId = 'a41e73b9-5dac-493f-bb2d-d38bb166c330';
    const url = `${ATTIO_API_URL}/objects/companies/records/${companyId}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${ATTIO_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    
    if (response.data.data) {
      const company = response.data.data;
      const name = company.values?.name?.[0]?.value || 'No name';
      const description = company.values?.description?.[0]?.value || 'No description';
      const domains = company.values?.domains?.map(d => d.domain || d.value || d) || [];
      
      console.log('\nCompany details:');
      console.log('Name:', name);
      console.log('ID:', company.id?.record_id);
      console.log('Description:', description);
      console.log('Domains:', domains);
      console.log('URL:', `https://app.attio.com/textql-data/companies/record/${company.id?.record_id}`);
      
      // Now search for this exact name
      console.log('\n\nNow searching for this exact name:', name);
      
      const searchResponse = await axios.post(`${ATTIO_API_URL}/objects/companies/records/query`, {
        filter: {
          name: {
            $contains: name
          }
        },
        limit: 10
      }, {
        headers: {
          'Authorization': `Bearer ${ATTIO_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('\nSearch results for exact name:');
      console.log('Number of results:', searchResponse.data.data?.length || 0);
      
      if (searchResponse.data.data?.length > 0) {
        searchResponse.data.data.forEach((c, i) => {
          const cName = c.values?.name?.[0]?.value || 'No name';
          const cId = c.id?.record_id;
          console.log(`${i + 1}. ${cName} (ID: ${cId})`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    if (error.response?.status === 404) {
      console.error('\nCompany with that ID does not exist!');
    }
  }
}

getSpecificCompany();