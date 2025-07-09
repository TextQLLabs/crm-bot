const { WebClient } = require('@slack/web-api');
require('dotenv').config();

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function testUpdate() {
  try {
    // Update the message
    const result = await client.chat.update({
      channel: 'C0946T1T4CB',
      ts: '1752076714.676069',
      text: 'I found 3 notes on the Raine deal (https://app.attio.com/textql-data/deals/637f050b-409d-4fdf-b401-b85d48a5e9df/overview):\n1. "Created Documentation" from 5/13/2025\n2. "Note from Slack" from 7/4/2025 3:04 AM\n3. "Note from Slack" from 7/4/2025 3:14 AM\nNote: All notes appear to have empty content.'
    });
    console.log('Update successful:', result.ok);
  } catch (error) {
    console.error('Update failed:', error);
    console.error('Error data:', error.data);
  }
}

testUpdate();