#!/usr/bin/env node

require('dotenv').config();
const { advancedSearch, getAttioClient } = require('./src/services/attioService');

async function findBlackstoneDeal() {
  console.log('🔍 Searching for Blackstone deal...\n');
  
  try {
    // First, let's try a general search for all deals and filter for Blackstone
    console.log('=== Searching all deals for Blackstone ===');
    const allDeals = await advancedSearch({
      entity_type: 'deal',
      filters: {},
      limit: 100
    });
    
    console.log(`Found ${allDeals.length} total deals`);
    
    // Filter for deals containing "Blackstone" in the name
    const blackstoneDeals = allDeals.filter(deal => 
      deal.name && deal.name.toLowerCase().includes('blackstone')
    );
    
    console.log(`\n📍 Found ${blackstoneDeals.length} deals containing "Blackstone":`);
    
    if (blackstoneDeals.length > 0) {
      blackstoneDeals.forEach((deal, index) => {
        console.log(`\n--- Deal ${index + 1} ---`);
        console.log(`ID: ${deal.id}`);
        console.log(`Name: ${deal.name}`);
        console.log(`Stage: ${deal.stage || 'N/A'}`);
        console.log(`Probability: ${deal.probability_of_closing || 'N/A'}`);
        console.log(`Year 1 Run Rate EV: ${deal.year_1_run_rate_ev || 'N/A'}`);
        console.log(`3 Year Expected Value: ${deal['3_year_expected_value'] || deal.three_year_expected_value || 'N/A'}`);
        
        // Show all available fields for the first deal
        if (index === 0) {
          console.log('\n📋 All available fields:');
          Object.keys(deal).forEach(key => {
            if (deal[key] !== null && deal[key] !== undefined && deal[key] !== '') {
              console.log(`  ${key}: ${deal[key]}`);
            }
          });
        }
      });
    } else {
      console.log('❌ No deals found containing "Blackstone"');
      
      // Let's also try a more general search
      console.log('\n=== Trying broader search patterns ===');
      const patterns = ['black', 'stone', 'blackstone'];
      
      for (const pattern of patterns) {
        const matches = allDeals.filter(deal => 
          deal.name && deal.name.toLowerCase().includes(pattern.toLowerCase())
        );
        if (matches.length > 0) {
          console.log(`\nFound ${matches.length} deals containing "${pattern}":`);
          matches.forEach(deal => console.log(`  - ${deal.name}`));
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error searching for Blackstone deal:', error.message);
    if (error.response?.data) {
      console.error('API Error:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

findBlackstoneDeal().catch(console.error);