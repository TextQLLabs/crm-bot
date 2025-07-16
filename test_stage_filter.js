#!/usr/bin/env node

require('dotenv').config();
const { getAttioClient } = require('./src/services/attioService');

async function testStageFilter() {
  console.log('🎯 Testing stage filter formats...\n');
  
  const client = getAttioClient();
  
  // Test 1: Get all deals to see stage format
  console.log('=== Test 1: Get all deals to understand stage structure ===');
  try {
    const response = await client.post('/objects/deals/records/query', {
      limit: 10
    });
    
    const deals = response.data.data || [];
    console.log(`Found ${deals.length} deals`);
    
    deals.forEach((deal, index) => {
      const name = deal.values?.name?.[0]?.value || 'Unnamed Deal';
      const stage = deal.values?.stage?.[0];
      console.log(`\n${index + 1}. ${name}`);
      if (stage) {
        console.log(`   Stage ID: ${stage.status?.id?.status_id}`);
        console.log(`   Stage Title: ${stage.status?.title}`);
        console.log(`   Stage Structure:`, JSON.stringify(stage.status, null, 2));
      } else {
        console.log('   No stage data');
      }
    });
  } catch (error) {
    console.error('❌ Failed to get deals:', error.message);
  }

  // Test 2: Try filtering by stage status ID
  console.log('\n=== Test 2: Filter by stage status title ===');
  try {
    const response = await client.post('/objects/deals/records/query', {
      filter: {
        stage: {
          $eq: 'Goal: Get to Financing'
        }
      },
      limit: 10
    });
    
    const deals = response.data.data || [];
    console.log(`✅ Found ${deals.length} deals with stage 'Goal: Get to Financing'`);
    
    deals.forEach(deal => {
      const name = deal.values?.name?.[0]?.value || 'Unnamed Deal';
      const stage = deal.values?.stage?.[0]?.status?.title || 'No stage';
      console.log(`  - ${name}: ${stage}`);
    });
  } catch (error) {
    console.error('❌ Stage filter failed:', error.response?.data || error.message);
  }

  // Test 3: Try different stage filter approaches
  console.log('\n=== Test 3: Try nested stage filter ===');
  try {
    const response = await client.post('/objects/deals/records/query', {
      filter: {
        'stage.status.title': {
          $eq: 'Goal: Get to Financing'
        }
      },
      limit: 10
    });
    
    const deals = response.data.data || [];
    console.log(`✅ Found ${deals.length} deals with nested stage filter`);
    
    deals.forEach(deal => {
      const name = deal.values?.name?.[0]?.value || 'Unnamed Deal';
      const stage = deal.values?.stage?.[0]?.status?.title || 'No stage';
      console.log(`  - ${name}: ${stage}`);
    });
  } catch (error) {
    console.error('❌ Nested stage filter failed:', error.response?.data || error.message);
  }

  // Test 4: Get stage options from the API
  console.log('\n=== Test 4: Get stage options from API ===');
  try {
    const response = await client.get('/objects/deals/attributes/stage');
    console.log('Stage attribute config:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Failed to get stage attribute:', error.response?.data || error.message);
  }

  // Test 5: List all possible statuses
  console.log('\n=== Test 5: Get all deal statuses ===');
  try {
    const response = await client.get('/objects/deals/attributes/stage/statuses');
    console.log('Available statuses:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Failed to get statuses:', error.response?.data || error.message);
  }

  console.log('\n✅ Stage filter testing complete!');
}

testStageFilter().catch(console.error);