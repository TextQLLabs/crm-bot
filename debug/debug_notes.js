const { getNotes } = require('./src/services/attioService.js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.dev' });

(async () => {
  try {
    console.log('Testing getNotes for The Raine Group...');
    const result = await getNotes('company', 'a41e73b9-5dac-493f-bb2d-d38bb166c330');
    console.log('Raw result keys:', Object.keys(result));
    const noteCount = Object.keys(result).filter(k => k !== 'timing' && !isNaN(k)).length;
    console.log('Actual note count from getNotes:', noteCount);
    
    // Show first few notes
    console.log('\nFirst 3 notes:');
    for (let i = 0; i < Math.min(3, noteCount); i++) {
      if (result[i]) {
        console.log(`  Note ${i}: ${result[i].title || 'No title'} - ${result[i].createdAt}`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
})();