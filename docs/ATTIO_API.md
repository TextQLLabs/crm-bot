# Attio API Reference

## Overview
Attio API integration patterns and URL formats for the CRM Bot.

## URL Formats

### Overview URLs (for viewing records)
- **Companies**: `https://app.attio.com/textql-data/company/{id}/overview`
- **Deals**: `https://app.attio.com/textql-data/deals/{id}/overview`
- **People**: `https://app.attio.com/textql-data/person/{id}/overview`

### Key Rules
- Use singular form for companies and people (company, person)
- Use PLURAL form for deals (deals, not deal)
- No `/record/` in overview paths
- Must include `/overview` at the end

### Note URLs (for viewing specific notes)
- **Format**: `https://app.attio.com/textql-data/{type}/record/{record_id}/notes?modal=note&id={note_id}`
- **Example**: `https://app.attio.com/textql-data/deals/record/637f050b-409d-4fdf-b401-b85d48a5e9df/notes?modal=note&id=05649629-8d0c-4b6a-a2b6-a0f9d95effa6`
- Note URLs DO include `/record/` in the path

### Examples
- ✅ **Correct company overview**: `https://app.attio.com/textql-data/company/a41e73b9-5dac-493f-bb2d-d38bb166c330/overview`
- ✅ **Correct deal overview**: `https://app.attio.com/textql-data/deals/637f050b-409d-4fdf-b401-b85d48a5e9df/overview`
- ✅ **Correct note URL**: `https://app.attio.com/textql-data/deals/record/637f050b-409d-4fdf-b401-b85d48a5e9df/notes?modal=note&id={note_id}`
- ❌ **Wrong**: `https://app.attio.com/textql-data/deal/637f050b-409d-4fdf-b401-b85d48a5e9df/overview` (must be "deals" not "deal")

## API Endpoints

### Base URL
- `https://api.attio.com/v2`

### Authentication
- Uses Bearer token in Authorization header
- Token stored in `ATTIO_API_KEY` environment variable

### Note Creation
**Working format** (as of July 2025):
```json
{
  "data": {
    "parent_object": "companies", // API requires plural: "companies", "people", "deals"
    "parent_record_id": "uuid-here",
    "title": "Intelligent title or 'Update from Slack'",
    "content": "Note text here", // CRITICAL: String, not object!
    "format": "plaintext",
    "created_by_actor": {
      "type": "api-token"
    }
  }
}
```

### Critical Bug Fixes (July 2025)

**🚨 FIXED: Parameter Order Bug in Claude Agent**
- **Issue**: `createNote(entity_type, entity_id, content)` was wrong parameter order
- **Fix**: Changed to `createNote(entity_id, entity_type, content, messageContext)`
- **Impact**: Notes were failing with 400 errors until this was fixed

**🚨 FIXED: Content Format Bug** 
- **Issue**: Sending `content: { content: string, format: "plaintext" }` (nested object)
- **Fix**: Send `content: string, format: "plaintext"` (separate fields)
- **Impact**: API was rejecting all note creation requests

**🚨 FIXED: Pluralization Bug in API Calls**
- **Issue**: Using `parent_object: "companys"` (wrong pluralization in API payloads)
- **Fix**: Use correct plurals in API calls: "companies", "people", "deals"  
- **Impact**: API returning 404 "Object not found" errors
- **Note**: Entity URLs still use singular (company/person, except deals)

### Note URL Format
**Correct note URL format**:
```
https://app.attio.com/textql-data/notes/notes?modal=note&id={note_id}
```

### Supported Operations
- ✅ **POST /notes** - Create note (with data wrapper and intelligent titles)
- ✅ **GET /notes/{id}** - Get specific note  
- ✅ **GET /notes** - List notes with filters
- ✅ **DELETE /notes/{id}** - Delete note
- ❌ **PATCH/PUT /notes/{id}** - **NOT SUPPORTED** (notes are immutable)

### Note Title Generation
The bot automatically generates intelligent note titles:
- **Claude Agent decides**: Uses context and content to create appropriate titles
- **Parameter**: `note_title` in create_note tool (optional)
- **Fallback**: "Update from Slack" when no specific title provided
- **Examples**: "Test Note", "Meeting with Silver Lake - 2025-07-11", "Follow-up: Contract Discussion"

### Direct ID Verification Strategy
**For testing note operations**:
1. Create note → Get note_id from response
2. Immediately verify with `GET /notes/{note_id}` (no indexing delay)
3. Delete note → Use note_id
4. Verify deletion → Confirm `GET /notes/{note_id}` returns 404

**Important**: Content must be a string, not nested object

### Search
- Supports fuzzy search via query parameter
- Built-in spelling correction
- Returns entity IDs that can be used for note creation

## Company-Specific Configuration

### Workspace Configuration
- **Workspace ID**: `textql-data` (hardcoded in URLs)
- **Organization**: TextQL
- **Impact**: All URLs and API calls are specific to TextQL's Attio workspace

### For Different Organizations
If deploying for a different organization:
1. Update workspace ID in URL patterns
2. Update hardcoded references in system prompts
3. Update API base URLs if using different Attio instance
4. Consider moving workspace ID to environment variable for easier configuration