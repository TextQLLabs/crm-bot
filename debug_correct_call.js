const { getNotes } = require('./src/services/attioService.js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.dev' });

(async () => {
  try {
    console.log('Testing correct getNotes call...');
    
    // Call the way claudeAgent does it (incorrect signature)
    console.log('\n1. Calling getNotes with individual parameters (claudeAgent way):');
    const result1 = await getNotes('company', 'a41e73b9-5dac-493f-bb2d-d38bb166c330', null, null);
    const count1 = Object.keys(result1).filter(k => k !== 'timing' && !isNaN(k)).length;
    console.log(`   Result: ${count1} notes`);
    
    // Call the correct way (with options object)
    console.log('\n2. Calling getNotes with options object (correct way):');
    const result2 = await getNotes({
      recordId: 'a41e73b9-5dac-493f-bb2d-d38bb166c330',
      recordType: 'companies'
    });
    const count2 = Object.keys(result2).filter(k => k !== 'timing' && !isNaN(k)).length;
    console.log(`   Result: ${count2} notes`);
    
    console.log('\n📊 Comparison:');
    console.log(`   Incorrect call: ${count1} notes`);
    console.log(`   Correct call:   ${count2} notes`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();