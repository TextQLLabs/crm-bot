const { getAttioClient } = require('./src/services/attioService');

/**
 * Get detailed information about deal owners to identify team members
 */

async function getDealOwnerDetails() {
  console.log('🎯 Getting detailed deal information to identify team members...\n');
  
  const client = getAttioClient();
  
  try {
    // Get deals and look at their owners
    const dealsResponse = await client.post('/objects/deals/records/query', { limit: 10 });
    
    if (dealsResponse.data.data && dealsResponse.data.data.length > 0) {
      console.log('Deal owners found:');
      
      const uniqueOwners = new Map();
      
      dealsResponse.data.data.forEach(deal => {
        const dealName = deal.values?.name?.[0]?.value || 'Unknown Deal';
        const owner = deal.values?.owner?.[0];
        
        if (owner && owner.referenced_actor_id) {
          const ownerId = owner.referenced_actor_id;
          
          if (!uniqueOwners.has(ownerId)) {
            uniqueOwners.set(ownerId, {
              id: ownerId,
              type: owner.referenced_actor_type,
              deals: [dealName]
            });
          } else {
            uniqueOwners.get(ownerId).deals.push(dealName);
          }
        }
      });
      
      console.log('\n👥 Team Members Summary:');
      console.log('========================');
      
      uniqueOwners.forEach((owner, id) => {
        console.log(`\n🧑 Team Member ID: ${id}`);
        console.log(`   Type: ${owner.type}`);
        console.log(`   Owns ${owner.deals.length} deals:`);
        owner.deals.forEach(deal => console.log(`     - ${deal}`));
        
        // Check if this matches our email interaction IDs
        if (id === 'd42e3148-f0ad-4d78-bd51-caee94f0bfe6') {
          console.log('   📧 ➡️ This person had FIRST email interaction with aurbahn@raine.com (Apr 29, 2025)');
        }
        if (id === '2121a6f3-0a61-4148-b6d8-22216dced1fc') {
          console.log('   📧 ➡️ This person had LAST email interaction with aurbahn@raine.com (Jul 11, 2025)');
        }
      });
      
      return uniqueOwners;
      
    } else {
      console.log('No deals found');
      return new Map();
    }
    
  } catch (error) {
    console.log('Error getting deal details:', error.response?.status);
    return new Map();
  }
}

async function tryToGetUserNames() {
  console.log('\n🔍 Trying alternative methods to get user names...\n');
  
  const client = getAttioClient();
  
  const targetIds = [
    'd42e3148-f0ad-4d78-bd51-caee94f0bfe6',
    '2121a6f3-0a61-4148-b6d8-22216dced1fc'
  ];
  
  // Try to find user info in workspace settings or activity logs
  const attempts = [
    { endpoint: '/workspace', description: 'Workspace info' },
    { endpoint: '/activity', description: 'Activity logs' },
    { endpoint: '/audit', description: 'Audit logs' },
    { endpoint: '/members', description: 'Members list' },
  ];
  
  for (const attempt of attempts) {
    try {
      console.log(`Trying: ${attempt.description} (${attempt.endpoint})`);
      const response = await client.get(attempt.endpoint);
      
      console.log(`✅ SUCCESS: ${attempt.description}`);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log(`❌ ${error.response?.status}: ${attempt.description}`);
    }
  }
}

// Run the lookup
if (require.main === module) {
  (async () => {
    try {
      require('dotenv').config();
      
      const owners = await getDealOwnerDetails();
      await tryToGetUserNames();
      
      console.log('\n📋 SUMMARY:');
      console.log('===========');
      console.log('We can identify team members by their deal ownership:');
      console.log('- d42e3148-f0ad-4d78-bd51-caee94f0bfe6: Owns "Snackpass - New Business" + had first email contact');
      console.log('- 2121a6f3-0a61-4148-b6d8-22216dced1fc: Owns multiple deals + had most recent email contact');
      console.log('\nTo get actual names, you could:');
      console.log('1. Check who owns those deals in Attio web interface');
      console.log('2. Manually map IDs to names in the bot config');
      console.log('3. Ask team members to identify themselves');
      
    } catch (error) {
      console.error('Lookup failed:', error);
    }
  })();
}

module.exports = { getDealOwnerDetails };