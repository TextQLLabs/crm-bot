const { getAttioClient } = require('./src/services/attioService');

/**
 * Find user information by examining existing data
 */

async function findUsersInExistingData() {
  console.log('🔍 Searching for user info in existing CRM data...\n');
  
  const client = getAttioClient();
  
  try {
    // Get objects to see what's available
    const objectsResponse = await client.get('/objects');
    const objects = objectsResponse.data.data;
    
    console.log('Available objects:');
    objects.forEach(obj => {
      console.log(`  - ${obj.api_slug}: ${obj.title}`);
    });
    
    // Look for user-related objects
    const userObjects = objects.filter(obj => 
      obj.api_slug.includes('user') || 
      obj.api_slug.includes('member') ||
      obj.api_slug.includes('workspace')
    );
    
    if (userObjects.length > 0) {
      console.log('\n👤 User-related objects found:');
      for (const obj of userObjects) {
        console.log(`\n📋 ${obj.api_slug}: ${obj.title}`);
        
        try {
          // Try to get records from this object
          const recordsResponse = await client.post(`/objects/${obj.api_slug}/records/query`, {
            limit: 10
          });
          
          if (recordsResponse.data.data && recordsResponse.data.data.length > 0) {
            console.log(`   Found ${recordsResponse.data.data.length} records`);
            
            recordsResponse.data.data.forEach(record => {
              const id = record.id?.record_id;
              const values = record.values || {};
              
              console.log(`   Record ${id}:`);
              Object.keys(values).forEach(key => {
                if (values[key] && values[key][0]) {
                  const value = values[key][0].value || values[key][0];
                  console.log(`     ${key}: ${JSON.stringify(value).substring(0, 100)}`);
                }
              });
            });
          } else {
            console.log('   No records found');
          }
        } catch (error) {
          console.log(`   Error getting records: ${error.response?.status}`);
        }
      }
    } else {
      console.log('\n❌ No user-related objects found');
    }
    
  } catch (error) {
    console.log('Error getting objects:', error.response?.status);
  }
}

async function searchForTeamMembersByID() {
  console.log('\n🎯 Searching for our specific team member IDs in deals/notes...\n');
  
  const client = getAttioClient();
  
  const targetIds = [
    'd42e3148-f0ad-4d78-bd51-caee94f0bfe6',
    '2121a6f3-0a61-4148-b6d8-22216dced1fc'
  ];
  
  try {
    // Search in deals for owner fields
    console.log('Checking deals for owner information...');
    const dealsResponse = await client.post('/objects/deals/records/query', { limit: 5 });
    
    if (dealsResponse.data.data && dealsResponse.data.data.length > 0) {
      dealsResponse.data.data.forEach(deal => {
        const dealName = deal.values?.name?.[0]?.value || 'Unknown Deal';
        const owner = deal.values?.owner?.[0];
        
        if (owner && targetIds.includes(owner.referenced_actor_id)) {
          console.log(`   ✅ Found in deal "${dealName}": ${owner.referenced_actor_id}`);
          console.log(`      Owner type: ${owner.referenced_actor_type}`);
        }
      });
    }
    
    // Search in notes for created_by
    console.log('\nChecking notes for creator information...');
    const notesResponse = await client.get('/notes?limit=10');
    
    if (notesResponse.data.data && notesResponse.data.data.length > 0) {
      notesResponse.data.data.forEach(note => {
        const noteTitle = note.title || 'Untitled';
        const createdBy = note.created_by_actor;
        
        if (createdBy && targetIds.includes(createdBy.id)) {
          console.log(`   ✅ Found in note "${noteTitle}": ${createdBy.id}`);
          console.log(`      Creator type: ${createdBy.type}`);
          console.log(`      Creator name: ${createdBy.name || 'Unknown'}`);
        }
      });
    }
    
  } catch (error) {
    console.log('Error searching in data:', error.response?.status);
  }
}

// Run the search
if (require.main === module) {
  (async () => {
    try {
      require('dotenv').config();
      
      await findUsersInExistingData();
      await searchForTeamMembersByID();
      
      console.log('\n💡 If we can\'t find user names directly, we can:');
      console.log('1. Track interactions by ID only');
      console.log('2. Ask you to manually map IDs to names');
      console.log('3. Display interactions with "Team Member X" labels');
      
    } catch (error) {
      console.error('Search failed:', error);
    }
  })();
}

module.exports = { findUsersInExistingData };