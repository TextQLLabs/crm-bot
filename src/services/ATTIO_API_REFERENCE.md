# Attio API Reference & Debugging Guide

## 🎯 Purpose
This document provides comprehensive Attio API documentation for debugging and understanding implementation issues vs API issues in the CRM bot.

---

## 📚 Table of Contents
- [API Basics](#api-basics)
- [Authentication](#authentication)
- [Core Endpoints](#core-endpoints)
- [Data Formats](#data-formats)
- [Common Patterns](#common-patterns)
- [Error Handling](#error-handling)
- [Debugging Guide](#debugging-guide)
- [Known Issues & Workarounds](#known-issues--workarounds)

---

## 🔧 API Basics

### Base Configuration
```javascript
const ATTIO_API_BASE = 'https://api.attio.com/v2';
const headers = {
  'Authorization': `Bearer ${ATTIO_API_KEY}`,
  'Content-Type': 'application/json'
};
```

### Workspace Context
- **TextQL Workspace**: `textql-data`
- **URL Pattern**: `https://app.attio.com/textql-data/...`
- **API Access**: Via Bearer token authentication

---

## 🔐 Authentication

### Token Format
```
Bearer attio_pat_[long-string-of-characters]
```

### Required Scopes
- **Read**: Access to companies, deals, people, notes
- **Write**: Create/update records and notes
- **Search**: Query across object types

### Environment Variable
```bash
ATTIO_API_KEY=attio_pat_your_token_here
```

---

## 🛠 Core Endpoints

### 1. Search & Query

#### Search Companies
```javascript
POST /objects/companies/records/query
{
  "filter": {
    "$or": [
      { "name": { "$contains": "search_term" } },
      { "domains": { "$contains": "search_term" } }
    ]
  },
  "limit": 20
}
```

#### Search Deals
```javascript
POST /objects/deals/records/query
{
  "filter": {
    "$or": [
      { "name": { "$contains": "search_term" } },
      { "description": { "$contains": "search_term" } }
    ]
  },
  "limit": 20
}
```

#### Search People
```javascript
POST /objects/people/records/query
{
  "filter": {
    "$or": [
      { "first_name": { "$contains": "search_term" } },
      { "last_name": { "$contains": "search_term" } },
      { "email_address": { "$contains": "search_term" } }
    ]
  },
  "limit": 20
}
```

### 2. Notes Management

#### Get Notes for Record
```javascript
GET /notes?filter[parent_object]={object_type}&filter[parent_record_id]={record_id}&limit={limit}
```

**Example:**
```javascript
GET /notes?filter[parent_object]=companies&filter[parent_record_id]=a41e73b9-5dac-493f-bb2d-d38bb166c330&limit=50
```

#### Create Note
```javascript
POST /notes
{
  "data": {
    "parent_object": "companies", // or "deals", "people"
    "parent_record_id": "uuid-here",
    "title": "Note from Slack",
    "content": "Note content as plain string", // STRING not object!
    "format": "plaintext",
    "created_by_actor": {
      "type": "api-token"
    }
  }
}
```

#### Get Specific Note
```javascript
GET /notes/{note_id}
```

#### Delete Note
```javascript
DELETE /notes/{note_id}
```

### 3. Record Management

#### Get Record Details
```javascript
GET /objects/{object_type}/records/{record_id}
```

#### Create Record
```javascript
POST /objects/{object_type}/records
{
  "data": {
    "values": {
      "name": [{ "value": "Company Name" }],
      "description": [{ "value": "Description text" }]
    }
  }
}
```

#### Update Record
```javascript
PATCH /objects/{object_type}/records/{record_id}
{
  "data": {
    "values": {
      "field_name": [{ "value": "new_value" }]
    }
  }
}
```

---

## 📊 Data Formats

### Record Value Format
Attio uses a versioned value system:
```javascript
{
  "name": [
    {
      "value": "The Raine Group",
      "created_at": "2024-01-01T00:00:00.000Z",
      "created_by_actor": {...}
    }
  ]
}
```

**Key Points:**
- Values are arrays (even for single values)
- Current value is typically `[0].value`
- Historical values are preserved

### Note Response Format
```javascript
{
  "data": {
    "id": {
      "note_id": "05649629-8d0c-4b6a-a2b6-a0f9d95effa6"
    },
    "title": "Note from Slack",
    "content": {
      "content": "Actual note text here",
      "format": "plaintext"
    },
    "parent_object": "companies",
    "parent_record_id": "a41e73b9-5dac-493f-bb2d-d38bb166c330",
    "created_at": "2024-07-10T15:30:00.000Z",
    "created_by_actor": {
      "type": "api-token",
      "name": "API Token"
    }
  }
}
```

### Search Response Format
```javascript
{
  "data": [
    {
      "id": {
        "record_id": "a41e73b9-5dac-493f-bb2d-d38bb166c330"
      },
      "values": {
        "name": [{ "value": "The Raine Group" }],
        "description": [{ "value": "Investment bank" }],
        "domains": [{ "value": "therainegroup.com" }]
      }
    }
  ]
}
```

---

## 🎯 Common Patterns

### 1. Fuzzy Search Implementation
```javascript
function generateSearchVariations(query) {
  const variations = [query];
  
  // Remove common prefixes/suffixes
  const withoutThe = query.replace(/^the\s+/i, '');
  if (withoutThe !== query) variations.push(withoutThe);
  
  const withoutSuffixes = query.replace(/\s+(inc|llc|corp|group|ltd)$/i, '');
  if (withoutSuffixes !== query) variations.push(withoutSuffixes);
  
  // Add partial matches
  if (query.length > 4) {
    variations.push(query.substring(0, query.length - 1));
  }
  
  return [...new Set(variations)];
}
```

### 2. URL Generation
```javascript
function generateRecordUrl(type, recordId, workspace = 'textql-data') {
  const typeMap = {
    'company': 'company',     // Singular
    'deal': 'deals',          // Plural!
    'person': 'person'        // Singular
  };
  
  return `https://app.attio.com/${workspace}/${typeMap[type]}/${recordId}/overview`;
}

function generateNoteUrl(parentObject, parentRecordId, noteId, workspace = 'textql-data') {
  return `https://app.attio.com/${workspace}/${parentObject}/record/${parentRecordId}/notes?modal=note&id=${noteId}`;
}
```

### 3. Error Recovery
```javascript
async function robustSearch(query) {
  // Try exact search first
  let results = await searchAttio(query);
  
  if (results.length === 0) {
    // Try variations
    const variations = generateSearchVariations(query);
    for (const variation of variations) {
      results = await searchAttio(variation);
      if (results.length > 0) break;
    }
  }
  
  return results;
}
```

---

## ⚠️ Error Handling

### Common HTTP Status Codes
- **200**: Success
- **400**: Bad Request (invalid filter syntax)
- **401**: Unauthorized (invalid API key)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found (record/note doesn't exist)
- **429**: Rate Limited
- **500**: Internal Server Error

### Error Response Format
```javascript
{
  "error": {
    "message": "Record not found",
    "code": "RECORD_NOT_FOUND",
    "details": {...}
  }
}
```

### Rate Limiting
- **Limit**: Approximately 1000 requests per minute
- **Headers**: Check `X-RateLimit-*` headers
- **Strategy**: Implement exponential backoff

### Retry Strategy
```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429 && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        continue;
      }
      throw error;
    }
  }
}
```

---

## 🔍 Debugging Guide

### 1. Issue Classification

#### **Attio API Issues** 
- 401/403 errors → Authentication problem
- 429 errors → Rate limiting
- 500 errors → Attio service issue
- Unexpected response format → API change

#### **Implementation Issues**
- Search returns no results but entity exists → Search logic problem
- Notes not appearing → Query filter issue  
- URLs broken → URL generation logic
- Data not saving → Request format issue

#### **Tool Calling Issues**
- Wrong parameters passed → Claude tool schema problem
- Missing required fields → Tool validation issue
- Unexpected tool sequence → Agent logic problem

### 2. Debugging Checklist

#### API Connection
```bash
# Test basic API access
curl -H "Authorization: Bearer $ATTIO_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.attio.com/v2/objects/companies/records/query \
     -d '{"limit": 1}'
```

#### Search Debugging
```javascript
// Log search variations
console.log('Search variations:', generateSearchVariations(query));

// Log actual API calls
console.log('API Request:', {
  url: '/objects/companies/records/query',
  filter: requestBody.filter
});

// Log response
console.log('API Response:', {
  count: response.data?.data?.length,
  firstResult: response.data?.data?.[0]?.values?.name?.[0]?.value
});
```

#### Note Operations
```javascript
// Verify note creation payload
console.log('Creating note:', {
  parent_object: parentObject,
  parent_record_id: entityId,
  title: 'Note from Slack',
  content: noteContent // Should be string!
});

// Verify note retrieval
console.log('Note URL filter:', {
  parent_object: recordType,
  parent_record_id: recordId,
  limit: options.limit
});
```

### 3. Common Debug Scenarios

#### "Search finds nothing but I know it exists"
1. **Check exact name**: Compare search term with actual Attio record name
2. **Try variations**: Test without "The", "Inc", etc.
3. **Check object type**: Ensure searching in correct object (companies/deals/people)
4. **Verify permissions**: Confirm API key has read access

#### "Note creation fails"
1. **Content format**: Ensure `content` is string, not object
2. **Parent object**: Use plural form (`companies`, `deals`, `people`)
3. **Record ID**: Verify the parent record exists
4. **Permissions**: Confirm API key has write access

#### "URLs don't work"
1. **Type mapping**: Check singular vs plural (company vs deals)
2. **Record ID format**: Ensure using correct UUID format
3. **Workspace**: Verify `textql-data` workspace name
4. **Note URLs**: Include `/record/` for note links

---

## 🐛 Known Issues & Workarounds

### 1. Search Inconsistencies
**Issue**: Fuzzy search sometimes misses obvious matches
**Workaround**: Generate multiple search variations and try each

### 2. Note Content Format
**Issue**: API documentation suggests content can be object, but only string works
**Workaround**: Always pass content as plain string

### 3. Rate Limiting
**Issue**: Aggressive rate limiting during bulk operations
**Workaround**: Implement exponential backoff and batch requests

### 4. URL Generation Complexity
**Issue**: Inconsistent singular/plural patterns across object types
**Workaround**: Use explicit type mapping

### 5. Nested Value Access
**Issue**: Values are arrays with version history
**Workaround**: Always access `[0].value` for current value

---

## 🎨 Implementation Examples

### Complete Search Function
```javascript
async function searchWithFallback(query) {
  try {
    // Primary search
    const results = await searchAttio(query);
    if (results.length > 0) return results;
    
    // Fallback with variations
    const variations = generateSearchVariations(query);
    for (const variation of variations) {
      const fallbackResults = await searchAttio(variation);
      if (fallbackResults.length > 0) {
        console.log(`Found results with variation: "${variation}"`);
        return fallbackResults;
      }
    }
    
    return [];
  } catch (error) {
    console.error('Search error:', error.response?.data || error.message);
    throw error;
  }
}
```

### Robust Note Creation
```javascript
async function createNoteWithRetry(entityType, entityId, content) {
  const parentObject = {
    'company': 'companies',
    'deal': 'deals', 
    'person': 'people'
  }[entityType];
  
  const payload = {
    data: {
      parent_object: parentObject,
      parent_record_id: entityId,
      title: 'Note from Slack',
      content: content, // Plain string
      format: 'plaintext',
      created_by_actor: { type: 'api-token' }
    }
  };
  
  return await retryWithBackoff(async () => {
    const response = await getAttioClient().post('/notes', payload);
    return response.data;
  });
}
```

---

## 📞 Support & Resources

### Official Attio Documentation
- **API Docs**: https://docs.attio.com/reference
- **Authentication**: https://docs.attio.com/reference/authentication
- **Rate Limits**: https://docs.attio.com/reference/rate-limits

### Internal Resources
- **CRM Bot Code**: `/src/services/attioService.js`
- **Test Suite**: `/tests/test-suite.js`
- **Local Testing**: `npm run dev` with `@crm-bot-ethan-dev`

### Debugging Commands
```bash
# Test individual functions
node -e "const {searchAttio} = require('./src/services/attioService'); searchAttio('raine').then(console.log);"

# Run test suite
npm run test:suite

# View recent API calls
npm run conversations:view
```

---

*Last Updated: January 2025*
*For questions or issues, check the CRM Bot CLAUDE.md context documentation.*