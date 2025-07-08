# Slack Image Integration Guide

## Overview
The CRM bot can now process images sent via Slack, including screenshots of conversations, documents, or any visual content that needs to be analyzed or transcribed.

## How It Works

### 1. Slack File Upload Flow
When a user uploads an image to Slack and mentions the bot:

```
User: @crm-bot-ethan Can you analyze this screenshot?
[Attached: screenshot.jpg]
```

### 2. Slack Payload Structure
Slack sends the file information in the message event:

```javascript
{
  type: 'app_mention',
  user: 'U12345',
  text: '<@BOT_ID> analyze this screenshot',
  files: [{
    id: 'F12345',
    name: 'screenshot.jpg',
    mimetype: 'image/jpeg',
    url_private_download: 'https://files.slack.com/...',
    // Other metadata
  }]
}
```

### 3. Bot Processing Steps

1. **File Detection**: The handler checks for `files` array in the message
2. **Image Filter**: Only processes files with `mimetype` starting with `image/`
3. **Download**: Uses Slack Bot token to download from `url_private_download`
4. **Convert**: Converts image to base64 format
5. **Format**: Creates attachment object with proper structure:

```javascript
{
  type: 'image',
  mime_type: 'image/jpeg',  // Note: mime_type not mimetype
  filename: 'screenshot.jpg', // Note: filename not name
  data: 'base64_encoded_data_here'
}
```

### 4. ReactAgent Processing
The agent receives attachments and can:
- Transcribe text from images
- Analyze image content
- Take actions based on image content

## Usage Examples

### Basic Transcription
```
@crm-bot-ethan Please transcribe this screenshot
[Attach image]
```

### Analysis Request
```
@crm-bot-ethan What's being discussed in this conversation?
[Attach screenshot]
```

### Action Based on Image
```
@crm-bot-ethan Create a note from this email screenshot for the relevant contact
[Attach email screenshot]
```

### Multiple Images
```
@crm-bot-ethan Compare these two screenshots
[Attach multiple images]
```

## Technical Details

### Supported Image Formats
- JPEG/JPG (`image/jpeg`)
- PNG (`image/png`)
- GIF (`image/gif`)
- WebP (`image/webp`)

### Size Limitations
- Slack file size limits apply (usually 1GB for paid workspaces)
- Base64 encoding increases size by ~33%
- Claude API has its own limits for image processing

### Error Handling
- Invalid image formats are skipped
- Download failures are logged but don't crash the bot
- Missing permissions show appropriate error messages

## Implementation Notes

### Key Code Locations
- **Handler**: `/src/handlers/slackHandlerReact.js` (lines 120-159)
- **ReactAgent**: `/src/services/reactAgent.js` (analyze_image tool)
- **Image Processing**: Uses Claude's vision capabilities

### Security Considerations
- Images are downloaded using the bot's OAuth token
- Images are not stored permanently (only in memory during processing)
- Base64 data is passed securely to Claude API

## Troubleshooting

### Image Not Processing
1. Check if file has correct mimetype
2. Verify bot has `files:read` permission
3. Check logs for download errors

### Poor Transcription Quality
1. Ensure image is clear and readable
2. Text should be reasonably sized
3. Avoid heavily compressed images

### Bot Not Responding to Images
1. Verify the bot was mentioned in the message
2. Check that files array exists in payload
3. Ensure image mimetype is supported

## Testing

Use the test script to verify integration:
```bash
node test-slack-image-integration.js
```

This simulates Slack messages with images without needing actual Slack interaction.