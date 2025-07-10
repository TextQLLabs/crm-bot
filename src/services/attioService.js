const axios = require('axios');

const ATTIO_API_BASE = 'https://api.attio.com/v2';

// Create axios client lazily to ensure env vars are loaded
let attioClient;
function getAttioClient() {
  if (!attioClient) {
    attioClient = axios.create({
      baseURL: ATTIO_API_BASE,
      headers: {
        'Authorization': `Bearer ${process.env.ATTIO_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
  }
  return attioClient;
}

async function searchAttio(query) {
  try {
    console.log(`\n=== Searching Attio for: "${query}" ===`);
    console.log('API Key status:', process.env.ATTIO_API_KEY ? `Present (length: ${process.env.ATTIO_API_KEY.length})` : 'MISSING');
    
    // Search across companies, deals, and people
    const [companies, deals, people] = await Promise.all([
      searchCompanies(query),
      searchDeals(query),
      searchPeople(query)
    ]);

    console.log(`Found: ${companies.length} companies, ${deals.length} deals, ${people.length} people`);

    // Combine and rank results
    const allResults = [
      ...companies.map(c => ({ ...c, type: 'company' })),
      ...deals.map(d => ({ ...d, type: 'deal' })),
      ...people.map(p => ({ ...p, type: 'person' }))
    ];

    // Log what we found with URLs
    if (allResults.length > 0) {
      console.log('Search results with links:');
      allResults.forEach(r => console.log(`  - ${r.name} (${r.type}) ${r.url ? `-> ${r.url}` : 'NO URL'}`));
    } else {
      console.log('No results found');
      // Provide search hints for the agent
      console.log('Hint: Try searching for just part of the name or without common words like "The", "Inc", etc.');
    }

    // Sort by relevance (you might want to implement a better ranking algorithm)
    return allResults.slice(0, 10);
  } catch (error) {
    console.error('Attio search error:', error);
    console.error('Error details:', error.response?.data || error.message);
    throw new Error(`Failed to search Attio: ${error.message}`);
  }
}

async function searchCompanies(query) {
  try {
    // Create multiple search variations for fuzzy matching
    const searchVariations = generateSearchVariations(query);
    console.log(`Searching companies with variations: ${searchVariations.join(', ')}`);
    
    // Build filters for each variation
    const filters = [];
    searchVariations.forEach(variation => {
      filters.push({
        name: {
          $contains: variation
        }
      });
      filters.push({
        domains: {
          $contains: variation.toLowerCase()
        }
      });
    });
    
    const response = await getAttioClient().post('/objects/companies/records/query', {
      filter: {
        $or: filters
      },
      limit: 20 // Increase limit for fuzzy search
    });
    
    console.log(`Company search found ${response.data?.data?.length || 0} results`);
    
    // Check if we have results
    if (!response.data || !response.data.data) {
      console.log('No company data in response');
      return [];
    }
    
    // Process and score results
    const results = response.data.data.map(company => {
      // Values are arrays with history, we need the current value
      const name = company.values?.name?.[0]?.value || 'Unnamed Company';
      const description = company.values?.description?.[0]?.value || 'No description';
      // Domains might be stored as array of objects with 'domain' property
      const domains = company.values?.domains?.map(d => d.domain || d.value || d) || [];
      
      // Calculate relevance score
      const score = calculateRelevanceScore(query, name, domains);
      
      return {
        id: company.id?.record_id,
        name: name,
        description: description,
        domains: domains,
        slug: domains[0] || '',
        score: score,
        url: `https://app.attio.com/textql-data/company/${company.id?.record_id}/overview`
      };
    });
    
    // Sort by relevance score and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ score, ...company }) => company); // Remove score from final results
  } catch (error) {
    console.error('Company search error:', error.response?.data || error.message);
    return []; // Return empty array on error
  }
}

// Generate common spelling variations
function generateSpellingVariations(query) {
  const variations = [];
  const lower = query.toLowerCase();
  
  // Handle specific known variations
  if (lower.includes('rain')) {
    // rain → raine
    variations.push(query.replace(/rain/gi, 'raine'));
  }
  if (lower.includes('rayne')) {
    // rayne → raine
    variations.push(query.replace(/rayne/gi, 'raine'));
  }
  if (lower.includes('rane')) {
    // rane → raine
    variations.push(query.replace(/rane/gi, 'raine'));
  }
  
  return variations;
}

// Generate search variations for fuzzy matching
function generateSearchVariations(query) {
  const variations = [];
  
  // PRIORITY 1: Exact match (most important)
  variations.push(query);
  
  // PRIORITY 2: Case insensitive exact match
  if (query.toLowerCase() !== query) {
    variations.push(query.toLowerCase());
  }
  
  // PRIORITY 3: Without common corporate suffixes (but keep "The" at start)
  const withoutCommon = query.replace(/\b(inc|llc|ltd|corporation|corp|company|co)\b/gi, '').trim();
  if (withoutCommon && withoutCommon !== query) {
    variations.push(withoutCommon);
  }
  
  // PRIORITY 4: Core name (remove both "The" and corporate suffixes)
  const coreName = query.replace(/^the\s+/i, '').replace(/\b(inc|llc|ltd|corporation|corp|company|co|group)\b/gi, '').trim();
  if (coreName && coreName !== query && coreName !== withoutCommon) {
    variations.push(coreName);
  }
  
  // PRIORITY 5: Only add individual words if they're substantial (avoid common words)
  const words = query.split(/\s+/).filter(word => 
    word.length > 3 && 
    !['the', 'and', 'for', 'inc', 'llc', 'ltd', 'corp', 'company'].includes(word.toLowerCase())
  );
  
  // Only add the most significant word (usually company name) not all words
  if (words.length > 0 && words[0] !== query) {
    variations.push(words[0]); // Usually the main company name
  }
  
  // PRIORITY 6: Handle common misspellings for fuzzy matching
  // This helps with cases like "rain" → "raine", "rayne" → "raine"
  const spellingVariations = generateSpellingVariations(query);
  spellingVariations.forEach(v => {
    if (!variations.includes(v)) {
      variations.push(v);
    }
  });
  
  // Remove duplicates while preserving order
  return [...new Set(variations)];
}

// Calculate relevance score for fuzzy matching
function calculateRelevanceScore(query, name, domains) {
  let score = 0;
  const queryLower = query.toLowerCase();
  const nameLower = name.toLowerCase();
  
  // Exact match
  if (nameLower === queryLower) {
    score += 100;
  }
  // Contains full query
  else if (nameLower.includes(queryLower)) {
    score += 50;
  }
  // Query contains name (partial match)
  else if (queryLower.includes(nameLower)) {
    score += 30;
  }
  
  // Check individual words
  const queryWords = queryLower.split(/\s+/);
  const nameWords = nameLower.split(/\s+/);
  
  queryWords.forEach(qWord => {
    if (nameWords.some(nWord => nWord.includes(qWord) || qWord.includes(nWord))) {
      score += 10;
    }
  });
  
  // Check domains
  domains.forEach(domain => {
    if (domain.toLowerCase().includes(queryLower)) {
      score += 20;
    }
  });
  
  return score;
}

async function searchDeals(query) {
  try {
    const response = await getAttioClient().post('/objects/deals/records/query', {
      filter: {
        name: {
          $contains: query
        }
      },
      limit: 5
    });
    
    console.log('Deal search response:', JSON.stringify(response.data, null, 2));
    
    if (!response.data || !response.data.data) {
      console.log('No deal data in response');
      return [];
    }
    
    return response.data.data.map(deal => {
      // Values are arrays with history
      const name = deal.values?.name?.[0]?.value || 'Unnamed Deal';
      const value = deal.values?.value?.[0]?.value || 'Unknown';
                    
      return {
        id: deal.id?.record_id,
        name: name,
        description: `Value: ${value}`,
        url: `https://app.attio.com/textql-data/deals/${deal.id?.record_id}/overview`
      };
    });
  } catch (error) {
    console.error('Deal search error:', error.response?.data || error.message);
    return []; // Return empty array on error
  }
}

async function searchPeople(query) {
  try {
    const response = await getAttioClient().post('/objects/people/records/query', {
      filter: {
        name: {
          $contains: query
        }
      },
      limit: 5
    });
    
    console.log('People search response:', JSON.stringify(response.data, null, 2));
    
    if (!response.data || !response.data.data) {
      console.log('No people data in response');
      return [];
    }
    
    return response.data.data.map(person => {
      // Handle the complex name structure
      let name = 'Unnamed Person';
      if (person.values?.name?.[0]) {
        const nameData = person.values.name[0];
        name = nameData.full_name || nameData.value || `${nameData.first_name || ''} ${nameData.last_name || ''}`.trim();
      }
      
      // Handle email addresses array
      let email = 'No email';
      if (person.values?.email_addresses?.[0]) {
        const emailData = person.values.email_addresses[0];
        email = emailData.email_address || emailData.value || emailData.original_email_address || 'No email';
      }
                    
      const personId = person.id?.record_id || person.id || person.record_id;
      return {
        id: personId,
        name: name,
        description: email,
        url: `https://app.attio.com/textql-data/person/${personId}/overview`
      };
    });
  } catch (error) {
    console.error('People search error:', error.response?.data || error.message);
    return []; // Return empty array on error
  }
}

async function createOrUpdateRecord(aiResult) {
  try {
    if (aiResult.action === 'create') {
      return await createRecord(aiResult);
    } else {
      return await updateRecord(aiResult);
    }
  } catch (error) {
    console.error('Attio create/update error:', error);
    throw new Error('Failed to update Attio');
  }
}

async function createRecord(aiResult) {
  const endpoint = `/objects/${aiResult.entityType}s/records`;
  
  const recordData = {
    data: {
      values: {
        name: [{ value: aiResult.entityName }],
        ...aiResult.updates
      }
    }
  };

  const response = await getAttioClient().post(endpoint, recordData);
  const record = response.data.data;

  // Create note if provided
  if (aiResult.notes) {
    await createNote(record.id.record_id, aiResult.entityType, aiResult.notes);
  }

  return {
    action: 'create',
    type: aiResult.entityType,
    name: aiResult.entityName,
    recordId: record.id.record_id,
    notes: aiResult.notes,
    attioUrl: `https://app.attio.com/${aiResult.entityType}s/${record.id.record_id}`
  };
}

async function updateRecord(aiResult) {
  const endpoint = `/objects/${aiResult.entityType}s/records/${aiResult.targetId}`;
  
  // First, get the current record
  const currentRecord = await getAttioClient().get(endpoint);
  
  // Merge updates
  const updates = {
    data: {
      values: {
        ...currentRecord.data.data.values,
        ...aiResult.updates
      }
    }
  };

  // Update the record
  await getAttioClient().patch(endpoint, updates);

  // Create note if provided
  if (aiResult.notes) {
    await createNote(aiResult.targetId, aiResult.entityType, aiResult.notes);
  }

  return {
    action: 'update',
    type: aiResult.entityType,
    name: aiResult.entityName,
    recordId: aiResult.targetId,
    notes: aiResult.notes,
    updates: Object.keys(aiResult.updates).map(key => `Updated ${key}`),
    attioUrl: `https://app.attio.com/${aiResult.entityType}s/${aiResult.targetId}`
  };
}

async function createNote(recordId, recordType, content) {
  const response = await getAttioClient().post('/notes', {
    parent_object: `${recordType}s`,
    parent_record_id: recordId,
    title: 'Update from Slack',
    content: {
      content: content,
      format: 'plaintext'
    },
    created_by_actor: {
      type: 'api-token'
    }
  });
  
  return response.data.data;
}

async function getNoteDetails(noteId) {
  try {
    console.log(`\n=== Getting Attio note details: ${noteId} ===`);
    
    const response = await getAttioClient().get(`/notes/${noteId}`);
    const note = response.data.data;
    
    // Extract note details
    const details = {
      success: true,
      noteId: noteId,
      title: note.title || 'Untitled',
      content: note.content_plaintext || note.content_markdown || note.content?.content || 'No content',
      parentType: note.parent_object?.replace(/s$/, ''), // Remove 's' from 'companies' -> 'company'
      parentId: note.parent_record_id,
      createdAt: note.created_at,
      createdBy: note.created_by_actor
    };
    
    // Try to get parent record details for context
    if (details.parentType && details.parentId) {
      try {
        const parentResponse = await getAttioClient().get(`/objects/${note.parent_object}/records/${note.parent_record_id}`);
        const parentData = parentResponse.data.data;
        details.parentName = parentData.values?.name?.[0]?.value || 'Unknown';
        details.parentUrl = `https://app.attio.com/textql-data/${details.parentType}/${details.parentId}/overview`;
      } catch (parentError) {
        console.log('Could not fetch parent record details:', parentError.message);
      }
    }
    
    return details;
  } catch (error) {
    if (error.response?.status === 404) {
      return {
        success: false,
        error: 'Note not found',
        noteId: noteId
      };
    }
    console.error('Get note details error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      noteId: noteId
    };
  }
}

async function deleteNote(noteId) {
  try {
    console.log(`\n=== Deleting Attio note: ${noteId} ===`);
    
    // First, get note details for logging
    const noteDetails = await getNoteDetails(noteId);
    if (!noteDetails.success) {
      return noteDetails; // Return the error from getNoteDetails
    }
    
    console.log(`Deleting note: "${noteDetails.title}" from ${noteDetails.parentType} "${noteDetails.parentName}"`);
    
    // Delete the note
    const response = await getAttioClient().delete(`/notes/${noteId}`);
    
    console.log('Note deleted successfully');
    
    return {
      success: true,
      noteId: noteId,
      noteDetails: noteDetails,
      message: `Deleted note "${noteDetails.title}" from ${noteDetails.parentType} "${noteDetails.parentName}"`
    };
  } catch (error) {
    console.error('Delete note error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      noteId: noteId
    };
  }
}

async function getNotes(options = {}) {
  try {
    let url = '/notes';
    const params = new URLSearchParams();
    
    // Add filters if provided
    if (options.recordId) {
      params.append('parent_record_id', options.recordId);
    }
    if (options.recordType) {
      params.append('parent_object', options.recordType);
    }
    if (options.limit) {
      params.append('limit', options.limit);
    }
    
    // Add sorting to get most recent notes first
    params.append('sort', '-created_at');
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    console.log('Getting notes with URL:', url);
    const response = await getAttioClient().get(url);
    
    if (!response.data || !response.data.data) {
      console.log('No notes data in response');
      return [];
    }
    
    // Format notes for display
    const notes = await Promise.all(response.data.data.map(async note => {
      // Get parent record info
      let parentInfo = 'Unknown record';
      if (note.parent_object && note.parent_record_id) {
        parentInfo = `${note.parent_object}/${note.parent_record_id}`;
      }
      
      // Format created date
      const createdDate = note.created_at ? new Date(note.created_at).toLocaleString() : 'Unknown date';
      
      // Extract content from the note, prioritizing plaintext over markdown
      let content = note.content_plaintext || note.content_markdown || note.content?.content || note.content || '';
      
      // If content is missing or seems incomplete and includeContent is requested, fetch full details
      if (options.includeContent && (!content || content.length < 10) && note.id) {
        try {
          const noteId = note.id?.note_id || note.id;
          console.log(`Fetching full content for note ${noteId}`);
          const fullNote = await getAttioClient().get(`/notes/${noteId}`);
          if (fullNote.data?.data) {
            const noteData = fullNote.data.data;
            content = noteData.content_plaintext || noteData.content_markdown || noteData.content?.content || noteData.content || content;
          }
        } catch (fetchError) {
          console.log(`Could not fetch full content for note ${note.id}:`, fetchError.message);
        }
      }
      
      return {
        id: note.id?.note_id || note.id,
        title: note.title || 'Untitled Note',
        content: content,
        parentObject: note.parent_object,
        parentRecordId: note.parent_record_id,
        parentInfo: parentInfo,
        createdAt: createdDate,
        createdBy: note.created_by_actor?.name || 'Unknown',
        tags: note.tags || []
      };
    }));
    
    console.log(`Found ${notes.length} notes`);
    return notes;
  } catch (error) {
    console.error('Get notes error:', error.response?.data || error.message);
    throw error;
  }
}

// Advanced search with attribute filtering
async function advancedSearch(options = {}) {
  try {
    console.log(`\n=== Advanced Search with filters ===`, options);
    
    const { entity_type, query, filters = {}, limit = 20, sort_by, sort_order = 'desc' } = options;
    
    if (!entity_type) {
      throw new Error('entity_type is required for advanced search');
    }
    
    // Build the filter object
    const searchFilter = buildAdvancedFilter(query, filters, entity_type);
    
    // Map entity types to API endpoints
    const objectType = {
      'company': 'companies',
      'deal': 'deals', 
      'person': 'people'
    }[entity_type];
    
    if (!objectType) {
      throw new Error(`Unsupported entity type: ${entity_type}`);
    }
    
    const requestBody = {
      filter: searchFilter,
      limit: limit
    };
    
    // Add sorting if specified
    if (sort_by) {
      requestBody.sorts = [{
        attribute: sort_by,
        direction: sort_order === 'asc' ? 'asc' : 'desc'
      }];
    }
    
    console.log('Advanced search request:', JSON.stringify(requestBody, null, 2));
    
    const response = await getAttioClient().post(`/objects/${objectType}/records/query`, requestBody);
    
    if (!response.data || !response.data.data) {
      console.log('No data in advanced search response');
      return [];
    }
    
    console.log(`Advanced search found ${response.data.data.length} results`);
    
    // Format results based on entity type
    return response.data.data.map(record => formatSearchResult(record, entity_type));
    
  } catch (error) {
    console.error('Advanced search error:', error.response?.data || error.message);
    throw error;
  }
}

// Build advanced filter based on query and attribute filters
function buildAdvancedFilter(query, filters, entityType) {
  const conditions = [];
  
  // Add basic text search if query provided
  if (query) {
    const textConditions = [];
    
    if (entityType === 'company') {
      textConditions.push({ name: { $contains: query } });
      textConditions.push({ domains: { $contains: query.toLowerCase() } });
    } else if (entityType === 'deal') {
      textConditions.push({ name: { $contains: query } });
    } else if (entityType === 'person') {
      textConditions.push({ name: { $contains: query } });
      textConditions.push({ email_addresses: { $contains: query.toLowerCase() } });
    }
    
    if (textConditions.length > 0) {
      conditions.push({ $or: textConditions });
    }
  }
  
  // Add attribute-based filters
  Object.entries(filters).forEach(([field, filterValue]) => {
    if (filterValue === undefined || filterValue === null) return;
    
    switch (field) {
      case 'deal_value_min':
        if (entityType === 'deal') {
          conditions.push({ value: { $gte: filterValue } });
        }
        break;
      case 'deal_value_max':
        if (entityType === 'deal') {
          conditions.push({ value: { $lte: filterValue } });
        }
        break;
      case 'status':
        conditions.push({ status: { $eq: filterValue } });
        break;
      case 'created_after':
        conditions.push({ created_at: { $gte: filterValue } });
        break;
      case 'created_before':
        conditions.push({ created_at: { $lte: filterValue } });
        break;
      case 'updated_after':
        conditions.push({ updated_at: { $gte: filterValue } });
        break;
      case 'updated_before':
        conditions.push({ updated_at: { $lte: filterValue } });
        break;
      case 'tags_include':
        if (Array.isArray(filterValue)) {
          conditions.push({ tags: { $in: filterValue } });
        }
        break;
      case 'industry':
        if (entityType === 'company') {
          conditions.push({ industry: { $eq: filterValue } });
        }
        break;
      case 'location':
        conditions.push({ location: { $contains: filterValue } });
        break;
      default:
        // Generic field filter
        if (typeof filterValue === 'string') {
          conditions.push({ [field]: { $contains: filterValue } });
        } else {
          conditions.push({ [field]: { $eq: filterValue } });
        }
    }
  });
  
  // Return combined filter
  if (conditions.length === 0) {
    return {}; // No filters - return all
  } else if (conditions.length === 1) {
    return conditions[0];
  } else {
    return { $and: conditions };
  }
}

// Search for entities related to another entity
async function searchRelatedEntities(options = {}) {
  try {
    console.log(`\n=== Searching Related Entities ===`, options);
    
    const { source_entity_type, source_entity_id, target_entity_type, relationship_type } = options;
    
    if (!source_entity_type || !source_entity_id || !target_entity_type) {
      throw new Error('source_entity_type, source_entity_id, and target_entity_type are required');
    }
    
    // Map entity types to API endpoints
    const sourceObjectType = {
      'company': 'companies',
      'deal': 'deals',
      'person': 'people'
    }[source_entity_type];
    
    const targetObjectType = {
      'company': 'companies', 
      'deal': 'deals',
      'person': 'people'
    }[target_entity_type];
    
    // Get the source entity to understand relationships
    const sourceResponse = await getAttioClient().get(`/objects/${sourceObjectType}/records/${source_entity_id}`);
    const sourceEntity = sourceResponse.data.data;
    
    console.log('Source entity values:', Object.keys(sourceEntity.values || {}));
    
    // Build relationship filter based on common patterns
    let relationshipFilter = {};
    
    if (source_entity_type === 'company' && target_entity_type === 'deal') {
      // Find deals for this company
      relationshipFilter = {
        primary_company: { $eq: source_entity_id }
      };
    } else if (source_entity_type === 'company' && target_entity_type === 'person') {
      // Find people at this company
      relationshipFilter = {
        primary_company: { $eq: source_entity_id }
      };
    } else if (source_entity_type === 'person' && target_entity_type === 'deal') {
      // Find deals involving this person
      relationshipFilter = {
        $or: [
          { primary_contact: { $eq: source_entity_id } },
          { deal_team: { $contains: source_entity_id } }
        ]
      };
    } else if (source_entity_type === 'deal' && target_entity_type === 'company') {
      // Find the company for this deal
      const companyId = sourceEntity.values?.primary_company?.[0]?.value;
      if (companyId) {
        return [await getEntityById('company', companyId)];
      } else {
        return [];
      }
    }
    
    // Override with specific relationship type if provided
    if (relationship_type) {
      relationshipFilter = {
        [relationship_type]: { $eq: source_entity_id }
      };
    }
    
    console.log('Relationship filter:', JSON.stringify(relationshipFilter, null, 2));
    
    // Search for related entities
    const response = await getAttioClient().post(`/objects/${targetObjectType}/records/query`, {
      filter: relationshipFilter,
      limit: 50
    });
    
    if (!response.data || !response.data.data) {
      console.log('No related entities found');
      return [];
    }
    
    console.log(`Found ${response.data.data.length} related ${target_entity_type}s`);
    
    return response.data.data.map(record => formatSearchResult(record, target_entity_type));
    
  } catch (error) {
    console.error('Related entities search error:', error.response?.data || error.message);
    throw error;
  }
}

// Get entity by ID (helper function)
async function getEntityById(entityType, entityId) {
  try {
    const objectType = {
      'company': 'companies',
      'deal': 'deals',
      'person': 'people'
    }[entityType];
    
    const response = await getAttioClient().get(`/objects/${objectType}/records/${entityId}`);
    return formatSearchResult(response.data.data, entityType);
  } catch (error) {
    console.error(`Error getting ${entityType} ${entityId}:`, error.message);
    return null;
  }
}

// Format search result consistently across entity types
function formatSearchResult(record, entityType) {
  const baseUrl = 'https://app.attio.com/textql-data';
  
  if (entityType === 'company') {
    const name = record.values?.name?.[0]?.value || 'Unnamed Company';
    const description = record.values?.description?.[0]?.value || 'No description';
    const domains = record.values?.domains?.map(d => d.domain || d.value || d) || [];
    
    return {
      id: record.id?.record_id,
      name: name,
      description: description,
      domains: domains,
      type: 'company',
      url: `${baseUrl}/company/${record.id?.record_id}/overview`
    };
  } else if (entityType === 'deal') {
    const name = record.values?.name?.[0]?.value || 'Unnamed Deal';
    const value = record.values?.value?.[0]?.value || 'Unknown';
    const status = record.values?.status?.[0]?.value || 'Unknown status';
    
    return {
      id: record.id?.record_id,
      name: name,
      description: `Value: ${value}, Status: ${status}`,
      value: value,
      status: status,
      type: 'deal',
      url: `${baseUrl}/deals/${record.id?.record_id}/overview`
    };
  } else if (entityType === 'person') {
    let name = 'Unnamed Person';
    if (record.values?.name?.[0]) {
      const nameData = record.values.name[0];
      name = nameData.full_name || nameData.value || `${nameData.first_name || ''} ${nameData.last_name || ''}`.trim();
    }
    
    let email = 'No email';
    if (record.values?.email_addresses?.[0]) {
      const emailData = record.values.email_addresses[0];
      email = emailData.email_address || emailData.value || emailData.original_email_address || 'No email';
    }
    
    return {
      id: record.id?.record_id,
      name: name,
      description: email,
      email: email,
      type: 'person',
      url: `${baseUrl}/person/${record.id?.record_id}/overview`
    };
  }
  
  return record;
}

// Time-based entity search
async function searchByTimeRange(options = {}) {
  try {
    console.log(`\n=== Time-based Search ===`, options);
    
    const { entity_type, start_date, end_date, time_field = 'created_at', limit = 20 } = options;
    
    if (!entity_type) {
      throw new Error('entity_type is required for time-based search');
    }
    
    const objectType = {
      'company': 'companies',
      'deal': 'deals',
      'person': 'people'
    }[entity_type];
    
    // Build time filter with proper ISO format
    const timeFilter = {};
    if (start_date) {
      // Ensure ISO format with timezone
      const startISO = start_date.includes('T') ? start_date : `${start_date}T00:00:00.000Z`;
      timeFilter[time_field] = { $gte: startISO };
    }
    if (end_date) {
      // Ensure ISO format with timezone  
      const endISO = end_date.includes('T') ? end_date : `${end_date}T23:59:59.999Z`;
      if (timeFilter[time_field]) {
        timeFilter[time_field].$lte = endISO;
      } else {
        timeFilter[time_field] = { $lte: endISO };
      }
    }
    
    console.log('Time filter:', JSON.stringify(timeFilter, null, 2));
    
    const response = await getAttioClient().post(`/objects/${objectType}/records/query`, {
      filter: timeFilter,
      limit: limit,
      sorts: [{
        attribute: time_field,
        direction: 'desc'
      }]
    });
    
    if (!response.data || !response.data.data) {
      console.log('No data in time-based search response');
      return [];
    }
    
    console.log(`Time-based search found ${response.data.data.length} results`);
    
    return response.data.data.map(record => formatSearchResult(record, entity_type));
    
  } catch (error) {
    console.error('Time-based search error:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { 
  searchAttio, 
  createOrUpdateRecord, 
  getAttioClient, 
  deleteNote, 
  getNoteDetails, 
  getNotes,
  advancedSearch,
  searchRelatedEntities,
  searchByTimeRange,
  getEntityById
};