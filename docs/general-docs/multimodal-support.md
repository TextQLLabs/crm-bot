# Multimodal Support for ReactAgent

The CRM bot now supports processing images through Slack, enabling users to share screenshots and have the bot analyze, transcribe, and take actions based on the image content.

## Features

### 1. Image Analysis Tool
The ReactAgent has a new `analyze_image` tool that can:
- **Transcribe**: Extract all visible text from images
- **Analyze**: Understand and summarize image content
- **Both**: Perform both transcription and analysis

### 2. Slack Integration
When users upload images to Slack and mention the bot:
- Images are automatically downloaded using the Slack API
- Converted to base64 format for processing
- Passed to the ReactAgent with the message

### 3. Claude Vision API
Uses Claude's multimodal capabilities to:
- Process screenshots of conversations
- Extract text from UI elements
- Understand context and content

## Usage Examples

### Basic Transcription
```
@crm-bot Please transcribe this screenshot
[Attach image]
```

### Analysis Request
```
@crm-bot What is this conversation about?
[Attach image]
```

### Extract Specific Information
```
@crm-bot Can you extract all the questions from this screenshot?
[Attach image]
```

### Combine with CRM Actions
```
@crm-bot Look at this screenshot and create a note on the mentioned company
[Attach image]
```

## Technical Implementation

### 1. ReactAgent Updates
- Added `analyze_image` tool to the tools registry
- Stores attachments in the processing context
- Supports multiple images with index-based access

### 2. Slack Handler Updates
- Downloads images from Slack's private URLs
- Converts to base64 for Claude API
- Passes attachment data to ReactAgent

### 3. Image Processing Flow
1. User uploads image and mentions bot
2. Slack handler downloads the image
3. ReactAgent detects attached images
4. Uses `analyze_image` tool to process
5. Returns transcription/analysis results

## Supported Image Formats
- JPEG/JPG
- PNG
- Other formats supported by Claude Vision API

## Limitations
- Maximum image size determined by Claude API limits
- Only processes images (not videos or other file types)
- Requires proper Slack bot permissions to download files

## Testing
Run the test scripts to verify functionality:
```bash
# Test basic image processing
node test-image-processing.js

# Test complete Slack flow
node test-complete-image-flow.js

# Test with actual Slack integration
node test-slack-image.js
```

## Error Handling
The bot handles various error cases:
- No image attached when requesting analysis
- Invalid image index specified
- Failed image downloads from Slack
- Claude API processing errors

## Future Enhancements
- Support for PDF processing
- Batch processing of multiple images
- Image comparison capabilities
- OCR for complex documents