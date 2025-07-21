#!/usr/bin/env node

require('dotenv').config();
const { getAttioClient } = require('./src/services/attioService');

async function getBlackstoneDetails() {
  console.log('🔍 Getting detailed Blackstone deal information...\n');
  
  try {
    const client = getAttioClient();
    const dealId = 'f2fb2437-f573-4fbd-90bc-f7eaf8e50aa7';
    
    // Get full deal details
    const response = await client.get(`/objects/deals/records/${dealId}`);
    const deal = response.data.data;
    
    console.log('📋 BLACKSTONE DEAL DETAILS:');
    console.log('=' * 50);
    console.log(`Deal ID: ${dealId}`);
    console.log(`Deal Name: ${deal.values?.name?.[0]?.value || 'N/A'}`);
    
    // Core probability and value fields
    console.log('\n💰 KEY FINANCIAL FIELDS:');
    console.log(`Probability of Closing: ${deal.values?.close_probability?.[0]?.value || 'N/A'}%`);
    
    const year1Target = deal.values?.year_1_run_rate_target?.[0];
    if (year1Target) {
      console.log(`Year 1 Run Rate Target: ${year1Target.currency_value ? `$${(year1Target.currency_value / 100).toLocaleString()} ${year1Target.currency_code}` : JSON.stringify(year1Target)}`);
    } else {
      console.log('Year 1 Run Rate Target: N/A');
    }
    
    const year1EV = deal.values?.year_1_run_rate_ev?.[0];
    if (year1EV) {
      console.log(`Year 1 Run Rate EV: ${year1EV.currency_value ? `$${(year1EV.currency_value / 100).toLocaleString()} ${year1EV.currency_code}` : JSON.stringify(year1EV)}`);
    } else {
      console.log('Year 1 Run Rate EV: N/A');
    }
    
    const threeYearEV = deal.values?.['3_year_expected_value']?.[0];
    if (threeYearEV) {
      console.log(`3 Year Expected Value: ${threeYearEV.currency_value ? `$${(threeYearEV.currency_value / 100).toLocaleString()} ${threeYearEV.currency_code}` : JSON.stringify(threeYearEV)}`);
    } else {
      console.log('3 Year Expected Value: N/A');
    }
    
    // Other relevant fields
    console.log('\n📊 OTHER DETAILS:');
    console.log(`Stage: ${deal.values?.stage?.[0]?.status?.title || 'N/A'}`);
    console.log(`Owner: ${deal.values?.owner?.[0]?.referenced_actor_name || 'N/A'}`);
    console.log(`Created: ${deal.values?.created_at?.[0]?.value || 'N/A'}`);
    
    const totalValue = deal.values?.value?.[0];
    if (totalValue) {
      console.log(`Total Value: ${totalValue.currency_value ? `$${(totalValue.currency_value / 100).toLocaleString()} ${totalValue.currency_code}` : JSON.stringify(totalValue)}`);
    } else {
      console.log('Total Value: N/A');
    }
    
    // Show all available fields for reference
    console.log('\n🔍 ALL POPULATED FIELDS:');
    Object.entries(deal.values || {}).forEach(([key, value]) => {
      if (value && value.length > 0 && value[0] !== null && value[0] !== undefined) {
        let displayValue = value[0];
        if (typeof displayValue === 'object' && displayValue.value) {
          displayValue = displayValue.value;
        } else if (typeof displayValue === 'object' && displayValue.currency_value) {
          displayValue = `$${(displayValue.currency_value / 100).toLocaleString()} ${displayValue.currency_code}`;
        } else if (typeof displayValue === 'object') {
          displayValue = JSON.stringify(displayValue);
        }
        console.log(`  ${key}: ${displayValue}`);
      }
    });
    
    console.log('\n✅ Summary for baseline assessment note:');
    console.log(`Deal ID: ${dealId}`);
    console.log(`Name: ${deal.values?.name?.[0]?.value || 'N/A'}`);
    console.log(`Current Probability: ${deal.values?.close_probability?.[0]?.value || 'N/A'}%`);
    console.log(`Current Year 1 Run Rate EV: ${year1EV ? (year1EV.currency_value ? `$${(year1EV.currency_value / 100).toLocaleString()} ${year1EV.currency_code}` : 'Set but no currency value') : 'Not set'}`);
    console.log(`Current 3 Year Expected Value: ${threeYearEV ? (threeYearEV.currency_value ? `$${(threeYearEV.currency_value / 100).toLocaleString()} ${threeYearEV.currency_code}` : 'Set but no currency value') : 'Not set'}`);
    
  } catch (error) {
    console.error('❌ Error getting Blackstone deal details:', error.message);
    if (error.response?.data) {
      console.error('API Error:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

getBlackstoneDetails().catch(console.error);