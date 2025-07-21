const { getAttioClient } = require('./src/services/attioService');

/**
 * Test script to discover email endpoints in Attio API
 * Based on URL structure: /person/{person_id}/emails?modal=email&id={email_id}
 */

async function testEmailEndpoints() {
  console.log('🔍 Testing potential email endpoints in Attio API...\n');
  
  const client = getAttioClient();
  
  // Test person and email IDs from the URL you provided
  const personId = 'ea5fc372-14a2-411f-a766-a4436c75709e';
  const emailId = 'f2d50998-3ea2-428a-96a3-df126d3d733b';
  
  const endpoints = [
    // Direct email endpoints
    `/emails`,
    `/emails/${emailId}`,
    
    // Person-specific email endpoints  
    `/objects/people/records/${personId}/emails`,
    `/objects/people/records/${personId}/interactions`,
    `/objects/people/records/${personId}/communications`,
    
    // Generic interaction endpoints
    `/interactions`,
    `/interactions/${emailId}`,
    `/communications`,
    `/communications/${emailId}`,
    
    // Attribute-based approaches
    `/objects/people/records/${personId}/attributes/emails/values`,
    `/objects/people/records/${personId}/attributes/interactions/values`,
    `/objects/people/records/${personId}/attributes/communications/values`,
    
    // Alternative patterns
    `/people/${personId}/emails`,
    `/people/${personId}/interactions`,
    `/records/${personId}/emails`,
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing: GET ${endpoint}`);
      const response = await client.get(endpoint);
      
      console.log(`✅ SUCCESS: ${endpoint}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Data length: ${JSON.stringify(response.data).length} chars`);
      
      if (response.data && response.data.data) {
        console.log(`   Records found: ${Array.isArray(response.data.data) ? response.data.data.length : 'single record'}`);
      }
      
      results.push({
        endpoint,
        success: true,
        status: response.status,
        data: response.data
      });
      
      console.log(''); // spacing
      
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      if (status === 404) {
        console.log(`❌ 404 Not Found: ${endpoint}`);
      } else if (status === 403) {
        console.log(`🔒 403 Forbidden: ${endpoint} (might exist but no permission)`);
      } else if (status === 401) {
        console.log(`🔑 401 Unauthorized: ${endpoint}`);
      } else {
        console.log(`❌ Error ${status}: ${endpoint} - ${message}`);
      }
      
      results.push({
        endpoint,
        success: false,
        status: status,
        error: message
      });
    }
  }
  
  console.log('\n📊 SUMMARY:');
  console.log('====================');
  
  const successful = results.filter(r => r.success);
  const forbidden = results.filter(r => r.status === 403);
  const notFound = results.filter(r => r.status === 404);
  
  console.log(`✅ Successful endpoints: ${successful.length}`);
  console.log(`🔒 Forbidden (might exist): ${forbidden.length}`);
  console.log(`❌ Not found: ${notFound.length}`);
  
  if (successful.length > 0) {
    console.log('\n🎉 WORKING ENDPOINTS:');
    successful.forEach(result => {
      console.log(`   ${result.endpoint}`);
    });
  }
  
  if (forbidden.length > 0) {
    console.log('\n🔒 FORBIDDEN ENDPOINTS (might need different permissions):');
    forbidden.forEach(result => {
      console.log(`   ${result.endpoint}`);
    });
  }
  
  return results;
}

async function testSpecificEmailRetrieval() {
  console.log('\n🎯 Testing specific email retrieval...\n');
  
  const client = getAttioClient();
  const emailId = 'f2d50998-3ea2-428a-96a3-df126d3d733b';
  
  // Try different ways to get this specific email
  const specificTests = [
    { method: 'GET', endpoint: `/emails/${emailId}` },
    { method: 'GET', endpoint: `/interactions/${emailId}` },
    { method: 'GET', endpoint: `/communications/${emailId}` },
    { method: 'POST', endpoint: '/emails/query', body: { filter: { id: emailId } } },
    { method: 'POST', endpoint: '/interactions/query', body: { filter: { id: emailId } } },
  ];
  
  for (const test of specificTests) {
    try {
      console.log(`Testing: ${test.method} ${test.endpoint}`);
      
      let response;
      if (test.method === 'POST') {
        response = await client.post(test.endpoint, test.body);
      } else {
        response = await client.get(test.endpoint);
      }
      
      console.log(`✅ SUCCESS: Found email data!`);
      console.log(`   Content preview: ${JSON.stringify(response.data).substring(0, 200)}...`);
      
      return response.data;
      
    } catch (error) {
      console.log(`❌ ${error.response?.status || 'Error'}: ${test.method} ${test.endpoint}`);
    }
  }
  
  return null;
}

// Run the tests
if (require.main === module) {
  (async () => {
    try {
      console.log('🚀 Starting Attio Email API Discovery...\n');
      
      const results = await testEmailEndpoints();
      const emailData = await testSpecificEmailRetrieval();
      
      if (emailData) {
        console.log('\n🎉 BREAKTHROUGH: Found email data access method!');
        console.log('We can proceed with building email tools for the CRM bot.');
      } else {
        console.log('\n💡 RECOMMENDATION:');
        console.log('Email endpoints may exist but require special permissions.');
        console.log('Contact Attio support about email API access.');
      }
      
    } catch (error) {
      console.error('Script error:', error);
    }
  })();
}

module.exports = { testEmailEndpoints, testSpecificEmailRetrieval };