# CRM Bot User Stories - Extracted from claudeAgent.js

## Purpose
These user stories were extracted from the claudeAgent.js file before deletion to preserve the expected behavior patterns for rewriting the agent.

## Search Operations
- **User types**: "search for raine" **Expects**: Bot finds "The Raine Group" with clickable link
- **User types**: "find acme" **Expects**: Bot searches for ACME Corp and returns results with URLs  
- **User types**: "rayn group" **Expects**: Bot uses fuzzy search to find "The Raine Group" and clarifies the match
- **User types**: "microsft" **Expects**: Bot corrects spelling to "Microsoft" and finds results
- **User types**: "nba basketbal" **Expects**: Bot tries multiple variations (nba, basketball, full name)

## Note Operations
- **User types**: "create acme note: test" **Expects**: Bot immediately searches for ACME, finds it, creates note, returns note URL
- **User types**: "add note to Raine saying 'follow up needed'" **Expects**: Bot creates note with that content and Slack thread link
- **User types**: "get notes for Microsoft" **Expects**: Bot shows all notes with titles, content previews, creation info
- **User types**: "delete test notes from Raine" **Expects**: Bot finds notes containing "test", confirms which ones, then deletes
- **User types**: "show me notes from last week" **Expects**: Bot filters notes by creation date

## Advanced Search
- **User types**: "deals over $1M" **Expects**: Bot uses advanced_search with deal_value_min filter
- **User types**: "companies created this year" **Expects**: Bot uses date range filtering
- **User types**: "find people at Microsoft" **Expects**: Bot uses search_related_entities

## Conversational
- **User types**: "how do you work?" **Expects**: Plain explanation without using tools
- **User types**: "what can you do?" **Expects**: Description of CRM capabilities
- **User types**: "hi, search for raine" **Expects**: Greeting + search results

## Error Handling
- **User types**: "search for xyz123" **Expects**: Multiple search attempts, then web search fallback
- **User types**: Invalid entity name **Expects**: Helpful error message with suggestions

## Multi-Step Workflows
- **User types**: "find raine and count their notes" **Expects**: Search + note retrieval in single response
- **User types**: "create note for raine: meeting scheduled" **Expects**: Search + note creation with URLs

## Key Behavioral Patterns

### Fuzzy Search Protocol
- Try original query first
- Try shortened versions (remove "The", "Inc", etc.)
- Try spelling variations
- Try base name only
- Fall back to web search only if all direct searches fail

### Multi-Step Operations
- Execute all required tool calls in single response
- Don't just plan - DO IT immediately
- Always include result URLs in responses

### Note Creation Workflow
1. Search for entity immediately
2. Extract UUID from search results  
3. Create note with that UUID
4. Include note URL in response
5. Add Slack thread link to note content

### Response Formatting
- Entity names in **bold** with clickable links
- Clear confirmations for actions
- Always include "Show your working out" button
- Use fuzzy match clarification: "Found **Actual Name** - I believe this matches your search for 'original query'"

### Error Recovery
- Never give up after first failed search
- Try multiple variations automatically
- Provide helpful guidance for common issues
- Be patient with typos and fuzzy searches

## Tools Used
- `search_crm` - Basic CRM search
- `advanced_search` - Filtering and sorting
- `search_related_entities` - Relationship queries  
- `search_by_time_range` - Time-based queries
- `create_note` - Note creation with Slack links
- `get_notes` - Note retrieval with filtering
- `delete_note` - Note deletion with confirmation
- `web_search` - Fallback for spelling corrections

## System Prompt Key Points
- Uses Claude Sonnet 4 with native tool calling
- Conversational questions answered without tools
- CRM operations use proper tool calling
- Mandatory execution of multi-step operations
- Automatic CRUD status notifications
- Fuzzy search with multiple attempts required