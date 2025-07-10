# CRM Bot Master Test Scenarios

## Core User Stories & Test Cases

This file contains all the critical user stories and scenarios that the CRM Bot must handle correctly.

### 🔍 Search & Discovery

#### Basic Search
- [ ] **Exact entity search**: "find The Raine Group" → Returns exact match
- [ ] **Fuzzy search**: "find rain group" → Returns "The Raine Group" 
- [ ] **Partial search**: "find raine" → Returns entities with "raine" in name
- [ ] **Multiple matches**: "search bmg" → Returns both BMG company and BMG deal
- [ ] **No results**: "find nonexistent company" → Helpful "no results" message

#### Search Variations  
- [ ] **Spelling corrections**: "rayn group" → suggests "The Raine Group"
- [ ] **Company variations**: "BMG", "BMG Inc", "BMG Company" → all find BMG
- [ ] **Case insensitive**: "bmg", "BMG", "Bmg" → all work the same

### 📝 Notes Management

#### Note Retrieval
- [ ] **Get all notes**: "summarize all notes on BMG deal" → Shows all notes with content
- [ ] **Note count**: "how many notes does The Raine Group have" → Shows exact count
- [ ] **Notes with content**: Notes display actual text content, not just titles
- [ ] **Note links**: Each note includes clickable Attio URL

#### Enhanced Note Queries
- [ ] **Search notes**: `get_notes(search="vacation")` → Finds notes containing "vacation"
- [ ] **Filter by content**: `get_notes(filters={content_contains: "test"})` → Test notes only
- [ ] **Filter by date**: `get_notes(filters={created_after: "2025-07-01"})` → Recent notes
- [ ] **Filter by creator**: `get_notes(filters={created_by: "Ethan"})` → Notes by specific person
- [ ] **Sort options**: `get_notes(sort_by="content_length", sort_order="desc")` → Longest first

#### Note Creation
- [ ] **Add note**: "add note to BMG saying 'Had great call today'" → Creates note with content
- [ ] **Note with context**: Notes include Slack thread link back to original conversation
- [ ] **Preview mode**: Write operations show preview before executing

#### Note Deletion  
- [ ] **Delete single note**: `delete_note(note_id="123")` → Removes specific note
- [ ] **Bulk delete preview**: `delete_note(preview=true, filters={content_contains: "test"})` → Shows what would be deleted
- [ ] **Bulk delete with confirmation**: `delete_note(confirm=true, filters={content_contains: "test"})` → Requires confirmation

### 🏢 Entity Management

#### Entity Details
- [ ] **Company details**: "tell me about The Raine Group" → Shows company information
- [ ] **Deal details**: "show BMG deal details" → Shows deal status, value, stage
- [ ] **Person details**: "who is John Smith" → Shows person information

#### Entity Creation
- [ ] **Create company**: "create company Acme Corp" → Creates new company record
- [ ] **Create deal**: "create deal for NewCo worth $50k" → Creates deal with details
- [ ] **Create person**: "add person Jane Doe at Acme" → Creates person record

### 🔧 Advanced Features

#### Multi-step Operations
- [ ] **Search then notes**: "summarize notes on BMG" → Finds entity, then gets notes
- [ ] **Search then create**: "add note to Raine Group" → Finds entity, then creates note
- [ ] **Continuation logic**: Multi-step operations complete all steps automatically

#### Error Handling
- [ ] **Ambiguous requests**: "find test notes" without entity → Asks for clarification
- [ ] **Invalid operations**: Trying to delete without confirmation → Safety checks
- [ ] **API failures**: Graceful handling of Attio API errors

#### Tool Tracking
- [ ] **Tool usage logged**: All operations record which tools were used
- [ ] **Performance metrics**: Response times and success rates tracked
- [ ] **Conversation history**: Full context preserved in database

### 📊 Response Quality

#### Response Format
- [ ] **Clean formatting**: Responses are well-structured and readable
- [ ] **Clickable links**: All Attio URLs are properly formatted
- [ ] **Appropriate length**: Responses are complete but not verbose
- [ ] **Status indicators**: Clear success/failure/preview indicators

#### Content Accuracy
- [ ] **Full note content**: Notes show actual text, not just metadata
- [ ] **Correct entity types**: Properly distinguishes companies/deals/people
- [ ] **Accurate counts**: Note counts and search results are correct
- [ ] **Date formatting**: Dates are human-readable

### 🚀 Performance & Reliability

#### Speed
- [ ] **Fast search**: Basic searches complete in <3 seconds
- [ ] **Reasonable multi-step**: Complex operations complete in <10 seconds
- [ ] **No hanging**: No operations hang indefinitely

#### Reliability  
- [ ] **Consistent results**: Same query produces same results
- [ ] **Tool execution**: All tools execute correctly when called
- [ ] **Error recovery**: Failed operations don't break subsequent requests

---

## Test Categories by Priority

### 🔴 Critical (Must Work)
1. Basic entity search (exact matches)
2. Note retrieval with content  
3. Note creation
4. Multi-step operations (search → notes)
5. Tool usage tracking

### 🟡 Important (Should Work)
1. Fuzzy search and spelling correction
2. Advanced note filtering
3. Bulk operations with safety checks
4. Error handling and user guidance
5. Response formatting and links

### 🟢 Nice to Have (Could Work)
1. Complex multi-filter queries
2. Cross-entity searches
3. Advanced sorting options
4. Performance optimizations
5. Enhanced error messages

---

## Usage Notes

- **For developers**: Add new scenarios here when implementing features
- **For testing**: Use this as a checklist before releases
- **For QA**: These are the critical paths that must work reliably
- **For planning**: Prioritize critical scenarios first

Update this file when:
- Adding new features to the bot
- Discovering edge cases that should be tested
- Changing core functionality that affects user workflows
- Adding new tool capabilities or parameters