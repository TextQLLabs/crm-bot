const { getAttioClient } = require('./src/services/attioService');

/**
 * Look up team member information by their IDs
 */

async function lookupTeamMembers() {
  console.log('👥 Looking up team members from email interactions...\n');
  
  const client = getAttioClient();
  
  // Team member IDs from the email interactions
  const teamMemberIds = [
    'd42e3148-f0ad-4d78-bd51-caee94f0bfe6', // First email interaction
    '2121a6f3-0a61-4148-b6d8-22216dced1fc'  // Last email interaction
  ];
  
  for (const memberId of teamMemberIds) {
    console.log(`🔍 Looking up team member: ${memberId}`);
    
    // Try different endpoints to get user info
    const endpoints = [
      `/users/${memberId}`,
      `/workspace-members/${memberId}`,
      `/actors/${memberId}`,
      `/objects/users/records/${memberId}`,
      `/objects/workspace-members/records/${memberId}`
    ];
    
    let found = false;
    
    for (const endpoint of endpoints) {
      try {
        const response = await client.get(endpoint);
        
        console.log(`✅ SUCCESS: Found via ${endpoint}`);
        
        const userData = response.data.data || response.data;
        console.log('User data:', JSON.stringify(userData, null, 2));
        
        // Extract key info
        const name = userData.name || userData.full_name || userData.first_name + ' ' + userData.last_name || 'Unknown';
        const email = userData.email || userData.email_address || 'Unknown';
        
        console.log(`   Name: ${name}`);
        console.log(`   Email: ${email}`);
        console.log('');
        
        found = true;
        break;
        
      } catch (error) {
        const status = error.response?.status;
        if (status !== 404) {
          console.log(`   ❌ Error ${status}: ${endpoint}`);
        }
      }
    }
    
    if (!found) {
      console.log('   ❌ Could not find user info via any endpoint');
      console.log('');
    }
  }
}

async function getAllWorkspaceMembers() {
  console.log('👥 Trying to get all workspace members...\n');
  
  const client = getAttioClient();
  
  const endpoints = [
    '/users',
    '/workspace-members', 
    '/actors',
    '/objects/users/records',
    '/objects/workspace-members/records'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing: ${endpoint}`);
      
      let response;
      if (endpoint.includes('/records')) {
        // Use query endpoint for records
        response = await client.post(endpoint.replace('/records', '/records/query'), { limit: 50 });
      } else {
        response = await client.get(endpoint);
      }
      
      console.log(`✅ SUCCESS: ${endpoint}`);
      
      const users = response.data.data || response.data;
      console.log(`Found ${Array.isArray(users) ? users.length : 1} users`);
      
      if (Array.isArray(users)) {
        users.forEach(user => {
          const id = user.id?.record_id || user.id || user.user_id;
          const name = user.name || user.full_name || user.values?.name?.[0]?.value || 'Unknown';
          const email = user.email || user.email_address || user.values?.email?.[0]?.value || 'Unknown';
          
          console.log(`  - ${id}: ${name} (${email})`);
        });
      }
      
      return users;
      
    } catch (error) {
      const status = error.response?.status;
      console.log(`   ❌ ${status}: ${endpoint}`);
    }
  }
  
  return null;
}

// Run the lookup
if (require.main === module) {
  (async () => {
    try {
      require('dotenv').config();
      
      await lookupTeamMembers();
      await getAllWorkspaceMembers();
      
    } catch (error) {
      console.error('Lookup failed:', error);
    }
  })();
}

module.exports = { lookupTeamMembers, getAllWorkspaceMembers };