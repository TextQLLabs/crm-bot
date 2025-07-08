# CRM Bot Changelog

## v1.11.0 (2025-01-08)

### Major Changes
- **Upgraded to Claude 3.5 Sonnet**: Updated from Claude 3 Opus to Claude 3.5 Sonnet for better performance and capabilities
- **Improved Note Deletion UX**: 
  - Bot no longer shows raw UUIDs to users
  - Provides helpful context about notes before deletion
  - Guides users to identify notes by their content and parent record
  - Shows note preview with title, content snippet, and parent record link
  - Requires safer confirmation flow for deletions

### Technical Updates
- Added `getNoteDetails()` function to fetch note context before deletion
- Updated system prompt to emphasize never showing raw IDs to users
- Enhanced delete note flow to be more user-friendly and safer

### Previous Versions

## v1.10.0
- Added delete note capability
- Added multimodal image analysis support
- Fixed Slack attachment format for images

## v1.9.0
- Added "Show Search Details" button
- Fixed Attio URL format to include /overview
- Improved fuzzy search capabilities

## v1.8.0
- Added comprehensive test suite with MongoDB logging
- Created GUI for test visualization
- Added metrics tracking for tool usage

## v1.7.0
- Reorganized project structure
- Moved test files to /tests directory
- Created proper documentation structure
- Removed unused Cloudflare code

## v1.6.0
- Fixed environment variable organization
- Created comprehensive env var documentation
- Distinguished shared vs project-specific variables