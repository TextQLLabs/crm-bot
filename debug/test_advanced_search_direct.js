#!/usr/bin/env node

require('dotenv').config();
const { advancedSearch } = require('./src/services/attioService');

async function testAdvancedSearch() {
  console.log('🔍 Testing advanced_search tool directly...\n');
  
  // Test 1: Basic structure to understand parameter format
  console.log('=== Test 1: Basic deals search ===');
  try {
    const result1 = await advancedSearch({
      entity_type: 'deal',
      filters: {},
      limit: 10
    });
    console.log(`✅ Basic deals search: Found ${result1.length} results`);
    if (result1.length > 0) {
      console.log('Sample result:', JSON.stringify(result1[0], null, 2));
    }
  } catch (error) {
    console.error('❌ Basic deals search failed:', error.message);
  }

  console.log('\n=== Test 2: All deals (to see stage values) ===');
  try {
    const result2 = await advancedSearch({
      entity_type: 'deal',
      filters: {},
      limit: 50
    });
    console.log(`✅ All deals search: Found ${result2.length} results`);
    
    // Extract unique stages to understand the format
    const stages = [...new Set(result2.map(deal => deal.stage).filter(Boolean))];
    console.log('Available stages:', stages);
    
    // Show a few sample deals with their stages
    console.log('\nSample deals with stages:');
    result2.slice(0, 5).forEach(deal => {
      console.log(`  - ${deal.name}: ${deal.stage || 'No stage'}`);
    });
  } catch (error) {
    console.error('❌ All deals search failed:', error.message);
  }

  console.log('\n=== Test 3: Search with stage filter (try "stage") ===');
  try {
    const result3 = await advancedSearch({
      entity_type: 'deal',
      filters: {
        stage: 'Goal: Get to Financing'
      },
      limit: 10
    });
    console.log(`✅ Stage filter search: Found ${result3.length} results`);
    result3.forEach(deal => {
      console.log(`  - ${deal.name}: ${deal.stage || 'No stage'}`);
    });
  } catch (error) {
    console.error('❌ Stage filter search failed:', error.message);
  }

  console.log('\n=== Test 4: Search with status filter (try "status") ===');
  try {
    const result4 = await advancedSearch({
      entity_type: 'deal',
      filters: {
        status: 'Goal: Get to Financing'
      },
      limit: 10
    });
    console.log(`✅ Status filter search: Found ${result4.length} results`);
    result4.forEach(deal => {
      console.log(`  - ${deal.name}: ${deal.status || 'No status'}`);
    });
  } catch (error) {
    console.error('❌ Status filter search failed:', error.message);
  }

  console.log('\n=== Test 5: Search with generic field filter ===');
  try {
    const result5 = await advancedSearch({
      entity_type: 'deal',
      filters: {
        'Goal: Get to Financing': 'Goal: Get to Financing'
      },
      limit: 10
    });
    console.log(`✅ Generic field filter search: Found ${result5.length} results`);
    result5.forEach(deal => {
      console.log(`  - ${deal.name}: ${deal.stage || 'No stage'}`);
    });
  } catch (error) {
    console.error('❌ Generic field filter search failed:', error.message);
  }

  console.log('\n=== Test 6: Try with query parameter ===');
  try {
    const result6 = await advancedSearch({
      entity_type: 'deal',
      query: 'Goal: Get to Financing',
      filters: {},
      limit: 10
    });
    console.log(`✅ Query parameter search: Found ${result6.length} results`);
    result6.forEach(deal => {
      console.log(`  - ${deal.name}: ${deal.stage || 'No stage'}`);
    });
  } catch (error) {
    console.error('❌ Query parameter search failed:', error.message);
  }

  console.log('\n=== Test 7: Explore raw deal data structure ===');
  try {
    const { getAttioClient } = require('./src/services/attioService');
    const client = getAttioClient();
    
    const response = await client.post('/objects/deals/records/query', {
      limit: 3
    });
    
    console.log('Raw deal data structure:');
    if (response.data?.data?.[0]) {
      const deal = response.data.data[0];
      console.log('Available fields in deal.values:', Object.keys(deal.values || {}));
      
      // Show stage/status related fields
      console.log('\nStage/Status related fields:');
      Object.entries(deal.values || {}).forEach(([key, value]) => {
        if (key.toLowerCase().includes('stage') || key.toLowerCase().includes('status')) {
          console.log(`  ${key}:`, value);
        }
      });
    }
  } catch (error) {
    console.error('❌ Raw data exploration failed:', error.message);
  }

  console.log('\n✅ Advanced search testing complete!');
}

testAdvancedSearch().catch(console.error);