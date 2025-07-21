#!/usr/bin/env node

require('dotenv').config();
const { getAttioClient } = require('./src/services/attioService');

async function debugAttioConnection() {
  console.log('🔧 Debugging Attio connection...\n');
  
  try {
    const client = getAttioClient();
    
    // Test deals endpoint directly
    console.log('\n=== Testing deals endpoint ===');
    const dealsResponse = await client.post('/objects/deals/records/query', {
      limit: 50
    });
    
    console.log(`✅ Deals query successful: Found ${dealsResponse.data?.data?.length || 0} deals`);
    
    if (dealsResponse.data?.data?.length > 0) {
      console.log('\n📋 All deal names found:');
      dealsResponse.data.data.forEach((deal, index) => {
        const dealName = deal.values?.name?.[0]?.value || 'No name';
        const dealId = deal.id?.record_id || deal.id;
        console.log(`${index + 1}. "${dealName}" (ID: ${dealId})`);
        
        // Check for Blackstone in name
        if (dealName.toLowerCase().includes('blackstone')) {
          console.log('   ⭐ FOUND BLACKSTONE DEAL!');
          console.log('   Deal ID:', dealId);
          console.log('   All values for this deal:');
          console.log(JSON.stringify(deal.values, null, 4));
        }
      });
      
      // Also show structure of first deal
      console.log('\n🔍 Sample deal structure:');
      const sampleDeal = dealsResponse.data.data[0];
      console.log('Available attributes:', Object.keys(sampleDeal.values || {}));
    }
    
    // Try searching for Blackstone specifically
    console.log('\n=== Searching for Blackstone deals ===');
    const blackstoneSearch = await client.post('/objects/deals/records/query', {
      filter: {
        name: {
          $contains: "Blackstone"
        }
      },
      limit: 10
    });
    
    console.log(`✅ Blackstone search: Found ${blackstoneSearch.data?.data?.length || 0} deals`);
    
    if (blackstoneSearch.data?.data?.length > 0) {
      console.log('\n⭐ BLACKSTONE DEALS FOUND:');
      blackstoneSearch.data.data.forEach((deal, index) => {
        const dealName = deal.values?.name?.[0]?.value || 'No name';
        const dealId = deal.id?.record_id;
        const probability = deal.values?.close_probability?.[0]?.value || 'N/A';
        const year1EV = deal.values?.year_1_run_rate_ev?.[0] || null;
        const threeYearEV = deal.values?.['3_year_expected_value']?.[0] || null;
        
        console.log(`${index + 1}. "${dealName}" (ID: ${dealId})`);
        console.log(`   Probability: ${probability}`);
        console.log(`   Year 1 Run Rate EV: ${year1EV ? JSON.stringify(year1EV) : 'N/A'}`);
        console.log(`   3 Year Expected Value: ${threeYearEV ? JSON.stringify(threeYearEV) : 'N/A'}`);
        console.log('   ---');
      });
    } else {
      console.log('❌ No Blackstone deals found');
      
      // Try case-insensitive search variations
      const variations = ['blackstone', 'Blackstone', 'BLACKSTONE', 'Black Stone'];
      
      for (const variation of variations) {
        console.log(`\n   Trying variation: "${variation}"`);
        const varSearch = await client.post('/objects/deals/records/query', {
          filter: {
            name: {
              $contains: variation
            }
          },
          limit: 5
        });
        
        if (varSearch.data?.data?.length > 0) {
          console.log(`   ✅ Found ${varSearch.data.data.length} deals with "${variation}"`);
          varSearch.data.data.forEach(deal => {
            console.log(`      - ${deal.values?.name?.[0]?.value}`);
          });
        } else {
          console.log(`   ❌ No deals found with "${variation}"`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error debugging Attio connection:', error.message);
    if (error.response?.data) {
      console.error('API Error details:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.response?.status) {
      console.error('HTTP Status:', error.response.status);
    }
  }
}

debugAttioConnection().catch(console.error);