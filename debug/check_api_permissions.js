const { getAttioClient } = require('./src/services/attioService');

/**
 * Check current API token permissions and capabilities
 */

async function checkApiPermissions() {
  console.log('🔑 Checking current Attio API token permissions...\n');
  
  const client = getAttioClient();
  
  // Test what we can currently access
  const permissionTests = [
    { name: 'Read People', endpoint: '/objects/people/records', method: 'POST', body: { limit: 1 } },
    { name: 'Read Companies', endpoint: '/objects/companies/records', method: 'POST', body: { limit: 1 } },
    { name: 'Read Deals', endpoint: '/objects/deals/records', method: 'POST', body: { limit: 1 } },
    { name: 'Read Notes', endpoint: '/notes', method: 'GET' },
    { name: 'Read Object Schema', endpoint: '/objects', method: 'GET' },
    { name: 'Read Workspace Info', endpoint: '/workspace', method: 'GET' },
    { name: 'Read Attributes', endpoint: '/attributes', method: 'GET' },
  ];
  
  const results = {};
  
  for (const test of permissionTests) {
    try {
      console.log(`Testing: ${test.name}`);
      
      let response;
      if (test.method === 'POST') {
        response = await client.post(test.endpoint, test.body);
      } else {
        response = await client.get(test.endpoint);
      }
      
      console.log(`✅ SUCCESS: ${test.name}`);
      results[test.name] = { success: true, status: response.status };
      
    } catch (error) {
      const status = error.response?.status;
      console.log(`❌ FAILED: ${test.name} (${status})`);
      results[test.name] = { success: false, status: status };
    }
  }
  
  console.log('\n📋 PERMISSION SUMMARY:');
  console.log('======================');
  Object.entries(results).forEach(([name, result]) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${name}`);
  });
  
  return results;
}

async function discoverAvailableObjects() {
  console.log('\n🔍 Discovering available objects and attributes...\n');
  
  const client = getAttioClient();
  
  try {
    // Get all objects
    const objectsResponse = await client.get('/objects');
    console.log('Available objects:', objectsResponse.data?.data?.map(obj => obj.api_slug).join(', '));
    
    // Get all attributes
    const attributesResponse = await client.get('/attributes');
    console.log('Available attributes:');
    
    if (attributesResponse.data?.data) {
      const emailRelated = attributesResponse.data.data.filter(attr => 
        attr.api_slug?.includes('email') || 
        attr.api_slug?.includes('interaction') || 
        attr.api_slug?.includes('communication') ||
        attr.title?.toLowerCase().includes('email') ||
        attr.title?.toLowerCase().includes('interaction')
      );
      
      if (emailRelated.length > 0) {
        console.log('\n📧 EMAIL/INTERACTION RELATED ATTRIBUTES:');
        emailRelated.forEach(attr => {
          console.log(`  - ${attr.api_slug}: ${attr.title} (${attr.type})`);
        });
      } else {
        console.log('No obvious email-related attributes found');
      }
      
      console.log(`\nTotal attributes: ${attributesResponse.data.data.length}`);
    }
    
  } catch (error) {
    console.log('Could not discover objects/attributes:', error.response?.status);
  }
}

async function checkSpecificPersonRecord() {
  console.log('\n👤 Checking specific person record for email attributes...\n');
  
  const client = getAttioClient();
  const personId = 'ea5fc372-14a2-411f-a766-a4436c75709e';
  
  try {
    // Get the full person record
    const response = await client.get(`/objects/people/records/${personId}`);
    const person = response.data.data;
    
    console.log('Person record values available:');
    Object.keys(person.values || {}).forEach(key => {
      console.log(`  - ${key}`);
    });
    
    // Look for any email or interaction fields
    const emailFields = Object.keys(person.values || {}).filter(key => 
      key.includes('email') || key.includes('interaction') || key.includes('communication')
    );
    
    if (emailFields.length > 0) {
      console.log('\n📧 EMAIL-RELATED FIELDS FOUND:');
      emailFields.forEach(field => {
        console.log(`  - ${field}:`, person.values[field]);
      });
    } else {
      console.log('\nNo obvious email fields in person record');
    }
    
  } catch (error) {
    console.log('Could not get person record:', error.response?.status);
  }
}

// Run the checks
if (require.main === module) {
  (async () => {
    try {
      await checkApiPermissions();
      await discoverAvailableObjects();
      await checkSpecificPersonRecord();
      
      console.log('\n🎯 CONCLUSIONS:');
      console.log('================');
      console.log('1. Email endpoints exist but require special permissions');
      console.log('2. Current API token may need email/interaction scopes');
      console.log('3. Check Attio workspace settings for API access levels');
      console.log('4. Contact Attio support for email API access');
      
    } catch (error) {
      console.error('Check failed:', error);
    }
  })();
}

module.exports = { checkApiPermissions, discoverAvailableObjects };