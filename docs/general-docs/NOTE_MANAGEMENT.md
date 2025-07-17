# Note Management Features

## Overview
The CRM Bot automatically manages note creation with:
- **Intelligent note titles** based on content and context
- **Deterministic Slack thread tracking** implemented outside the AI decision loop
- **Automatic content enhancement** for traceability

## Intelligent Note Titles

### How It Works
The Claude Agent automatically generates appropriate note titles based on context and content:

**Examples**:
- **Meeting notes**: "Meeting with [Person/Company] - [Date]"
- **Follow-ups**: "Follow-up: [Topic]" 
- **General updates**: "[Company] Update - [Brief Summary]"
- **Action items**: "Action Items: [Brief Description]"
- **Test notes**: "Test Note" (for verification purposes)
- **Default fallback**: "Update from Slack"

### Implementation
- **AI-driven**: Claude Agent decides appropriate titles using `note_title` parameter
- **Context-aware**: Considers note content, entity type, and user intent
- **Fallback safe**: Defaults to "Update from Slack" if no title specified

## Automatic Slack Thread Tracking

### How It Works
When notes are created via the bot, the system **automatically** appends thread context:

**For Real Slack Threads**:
```
User's note content here

---
Created from Slack: https://textql.slack.com/archives/C1234567890/p1234567890123456
```

**For Test Runs**:
```
User's note content here

---
Created by a test run
```

### Implementation Details
- **Deterministic**: Logic runs outside Claude Agent awareness
- **Context-aware**: Detects test vs production environments automatically
- **Transparent**: AI has no knowledge this is happening
- **Thread-safe**: Uses messageContext to generate proper Slack URLs

### Code Location
- **Function**: `createNote()` in `/src/services/attioService.js`
- **Detection**: Checks for test context markers (`channel: 'test'`, `userId: 'test-user-id'`)
- **URL Generation**: Constructs proper Slack thread URLs from messageContext

## Note Operations Testing

### Create Note Test (Test 5)
**Input**: "create a note on Silver Lake saying 'Test note for verification'"

**Verification Strategy**:
1. Claude Agent finds entity using `search_crm`
2. Creates note using `create_note` 
3. System automatically appends "Created by a test run"
4. Provides note URL for manual verification
5. Test validates tools used and URL provided

### Delete Note Test (Test 6)  
**Input**: "delete the test note on Silver Lake"

**Verification Strategy**:
1. Claude Agent finds entity using `search_crm`
2. Searches for notes using `get_notes`
3. Deletes specific note using `delete_note`
4. System confirms deletion (note URL returns 404)
5. Test validates workflow completion

### Direct ID Verification
**Why this works better than list-based verification**:
- No indexing delays when fetching by specific note ID
- Immediate verification possible with `GET /notes/{noteId}`
- Deletion confirmed by 404 response on same endpoint
- Avoids timing issues with note list updates

## Best Practices

### For Development
- Always test note operations with `npm run test 5 6`
- Use direct note ID verification over list checking
- Check both creation and deletion in sequence

### For Production
- Real Slack thread URLs are automatically included
- Notes maintain full traceability to conversations
- Thread context preserved even if Slack messages deleted

### For Testing
- Test context automatically detected
- No fake Slack URLs generated
- Clear indication of test-generated notes

## Troubleshooting

### Common Issues
1. **400 Errors on Creation**: Check parameter order in Claude Agent calls
2. **404 "Object not found"**: Verify correct pluralization (companies/people/deals)
3. **Missing Thread URLs**: Ensure messageContext properly passed to createNote()

### Verification Steps
1. Check note was created: GET `/notes/{noteId}` returns 200
2. Check note content includes thread info
3. Check note URL is accessible in Attio UI
4. For deletion: Verify GET `/notes/{noteId}` returns 404

## Related Documentation
- [ATTIO_API.md](./ATTIO_API.md) - API implementation details
- [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) - Testing approach
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design