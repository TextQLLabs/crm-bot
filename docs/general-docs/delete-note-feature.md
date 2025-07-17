# Delete Note Feature Documentation

## Overview
The `delete_note` tool has been added to the ReactAgent, allowing users to delete notes from Attio CRM records through the Slack bot interface. This feature includes several safety mechanisms to prevent accidental deletions.

## Implementation Details

### 1. Attio API Endpoint
- **Endpoint**: `DELETE /v2/notes/{note_id}`
- **Required Scope**: `note:read-write`
- **Description**: Permanently deletes a single note by ID

### 2. Code Changes

#### attioService.js
Added the `deleteNote` function that:
- Validates the note exists before attempting deletion
- Returns clear error messages if the note is not found
- Provides success confirmation when deletion completes

```javascript
async function deleteNote(noteId) {
  // Implementation in src/services/attioService.js
}
```

#### reactAgent.js
1. Added `delete_note` to the tools object
2. Marked `delete_note` as a write action for preview mode safety
3. Implemented the `deleteNote` method to call the attioService function
4. Updated system prompt with delete note safety guidelines

### 3. Safety Features

1. **Preview Mode**: The `delete_note` action is classified as a write action, meaning it will be previewed before execution when the bot is in preview mode.

2. **UUID Validation**: The Attio API requires note IDs to be in UUID format. Invalid formats are rejected automatically.

3. **Existence Check**: The implementation first attempts to GET the note to verify it exists before deletion.

4. **Clear Warnings**: The system prompt instructs the agent to:
   - Confirm the note ID before deletion
   - Warn users that deletion is permanent
   - Ask for specific note IDs when given vague requests

## Usage Examples

### Basic Delete Request
```
User: Delete note 550e8400-e29b-41d4-a716-446655440000
Bot: I want to confirm - are you sure you want me to permanently delete the note with ID 550e8400-e29b-41d4-a716-446655440000? This action cannot be undone.
```

### Vague Request
```
User: Delete the note I just created
Bot: I don't have enough information to safely delete the note. Please provide the specific note ID.
```

### Invalid Note ID
```
User: Delete note abc123
Bot: "abc123" does not appear to be a valid note identifier. Note IDs are typically UUIDs.
```

## Testing

Three test scripts have been created:

1. **test-delete-note.js**: Basic functionality testing
2. **test-delete-note-safety.js**: Safety feature verification
3. **test-delete-note-flow.js**: Complete user flow simulation

Run tests with:
```bash
node test/test-delete-note.js
node test/test-delete-note-safety.js
node test/test-delete-note-flow.js
```

## Finding Note IDs in Attio

Users can find note IDs by:
1. Opening the record (company, person, or deal) in Attio
2. Clicking on the note they want to delete
3. The note ID will be visible in the URL or note details

## Error Handling

The implementation handles several error cases:
- Invalid UUID format
- Non-existent notes
- Network errors
- API permission errors

Each error returns a clear message to help users understand what went wrong.

## Future Enhancements

Potential improvements for the future:
1. Add ability to list recent notes for a record
2. Implement bulk deletion with safety checks
3. Add "undo" functionality by implementing soft deletes
4. Integrate with Attio webhooks to track deleted notes

## Security Considerations

- Only users with appropriate Attio API permissions can delete notes
- The bot requires the `note:read-write` scope
- All deletions are logged for audit purposes
- Preview mode prevents accidental deletions in production