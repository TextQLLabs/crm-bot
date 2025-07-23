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

async function searchAttio(query, entityType = 'all') {
  try {
    console.log(`\n=== Searching Attio for: "${query}" (type: ${entityType}) ===`);
    console.log('API Key status:', process.env.ATTIO_API_KEY ? `Present (length: ${process.env.ATTIO_API_KEY.length})` : 'MISSING');
    
    let allResults = [];
    
    // Search based on entity type
    if (entityType === 'deal') {
      const deals = await searchDeals(query);
      allResults = deals.map(d => ({ ...d, type: 'deal' }));
      console.log(`Found: ${deals.length} deals`);
    } else if (entityType === 'company') {
      const companies = await searchCompanies(query);
      allResults = companies.map(c => ({ ...c, type: 'company' }));
      console.log(`Found: ${companies.length} companies`);
    } else if (entityType === 'person') {
      const people = await searchPeople(query);
      allResults = people.map(p => ({ ...p, type: 'person' }));
      console.log(`Found: ${people.length} people`);
    } else {
      // Default: search all entity types
      const [companies, deals, people] = await Promise.all([
        searchCompanies(query),
        searchDeals(query),
        searchPeople(query)
      ]);

      console.log(`Found: ${companies.length} companies, ${deals.length} deals, ${people.length} people`);

      // Combine and rank results
      allResults = [
        ...companies.map(c => ({ ...c, type: 'company' })),
        ...deals.map(d => ({ ...d, type: 'deal' })),
        ...people.map(p => ({ ...p, type: 'person' }))
      ];
    }

    // Log what we found with URLs
    if (allResults.length > 0) {
      console.log('Search results with links:');
      allResults.forEach(r => console.log(`  - ${r.name} (${r.type}) ${r.url ? `-> ${r.url}` : 'NO URL'}`));
    } else {
      console.log('No results found');
      // Provide search hints for the agent
      console.log('Hint: Try searching for just part of the name or without common words like "The", "Inc", etc.');
    }

    // Return more results when filtering by type, fewer when searching all
    const maxResults = entityType === 'all' ? 10 : 20;
    return allResults.slice(0, maxResults);
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
      limit: 20
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
      // Domains are stored as array with 'domain' property
      const domains = company.values?.domains?.map(d => d.domain) || [];
      const categories = company.values?.categories?.map(c => c.option?.title).filter(Boolean) || [];
      const location = company.values?.primary_location?.[0] || null;
      const employeeRange = company.values?.employee_range?.[0]?.option?.title || 'Unknown Size';
      const fundingRaised = company.values?.funding_raised_usd?.[0] || null;
      const createdAt = company.values?.created_at?.[0]?.value || 'Unknown Date';
      
      // Format location
      const formattedLocation = location ? 
        `${location.locality || ''}, ${location.region || ''}, ${location.country_code || ''}`.replace(/,\s*$/, '') : 
        'Unknown Location';
      
      // Format funding
      const formattedFunding = fundingRaised ? 
        `$${(fundingRaised.currency_value / 100).toLocaleString()} ${fundingRaised.currency_code}` : 
        'Unknown Funding';
      
      // Calculate relevance score
      const score = calculateRelevanceScore(query, name, domains);
      
      return {
        id: company.id?.record_id,
        name: name,
        description: description,
        domains: domains,
        categories: categories,
        location: formattedLocation,
        employee_range: employeeRange,
        funding_raised: formattedFunding,
        created_at: createdAt,
        slug: domains[0] || '',
        score: score,
        url: company.web_url
      };
    });
    
    // Sort by relevance score and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
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
      limit: 20
    });
    
    console.log(`Deal search API returned ${response.data?.data?.length || 0} results`);
    
    if (!response.data || !response.data.data) {
      console.log('No deal data in response');
      return [];
    }
    
    return response.data.data.map(deal => {
      // Values are arrays with history - get the latest value
      const name = deal.values?.name?.[0]?.value || 'Unnamed Deal';
      const value = deal.values?.value?.[0] || null;
      const stage = deal.values?.stage?.[0]?.status?.title || 'Unknown Stage';
      const useCase = deal.values?.use_case?.[0]?.option?.title || 'Unknown Use Case';
      const createdAt = deal.values?.created_at?.[0]?.value || 'Unknown Date';
      
      // Format currency value
      const formattedValue = value ? 
        `$${(value.currency_value / 100).toLocaleString()} ${value.currency_code}` : 
        'Unknown Value';
      
      return {
        id: deal.id?.record_id,
        name: name,
        description: `Value: ${formattedValue}`,
        stage: stage,
        use_case: useCase,
        value: formattedValue,
        created_at: createdAt,
        url: deal.web_url
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
      limit: 20
    });
    
    console.log(`People search API returned ${response.data?.data?.length || 0} results`);
    
    if (!response.data || !response.data.data) {
      console.log('No people data in response');
      return [];
    }
    
    return response.data.data.map(person => {
      // Handle the complex name structure
      let name = 'Unnamed Person';
      if (person.values?.name?.[0]) {
        const nameData = person.values.name[0];
        name = nameData.full_name || `${nameData.first_name || ''} ${nameData.last_name || ''}`.trim();
      }
      
      // Handle email addresses array
      let email = 'No email';
      if (person.values?.email_addresses?.[0]) {
        const emailData = person.values.email_addresses[0];
        email = emailData.email_address || emailData.original_email_address || 'No email';
      }
      
      // Get additional attributes
      const jobTitle = person.values?.job_title?.[0]?.value || 'Unknown Title';
      const companyId = person.values?.company?.[0]?.target_record_id || null;
      const phone = person.values?.phone_numbers?.[0]?.phone_number || 'No phone';
      const location = person.values?.primary_location?.[0] || null;
      const createdAt = person.values?.created_at?.[0]?.value || 'Unknown Date';
      
      // Format location
      const formattedLocation = location ? 
        `${location.locality || ''}, ${location.region || ''}, ${location.country_code || ''}`.replace(/,\s*$/, '') : 
        'Unknown Location';
                    
      const personId = person.id?.record_id;
      return {
        id: personId,
        name: name,
        description: email,
        email: email,
        job_title: jobTitle,
        company_id: companyId,
        phone: phone,
        location: formattedLocation,
        created_at: createdAt,
        url: person.web_url
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
    attioUrl: aiResult.entityType === 'deal' 
      ? `https://app.attio.com/textql-data/deals/record/${record.id.record_id}/overview`
      : aiResult.entityType === 'person'
      ? `https://app.attio.com/textql-data/person/${record.id.record_id}/overview`
      : `https://app.attio.com/textql-data/company/${record.id.record_id}/overview`
  };
}

async function updateRecord(aiResult) {
  const entityType = aiResult.entityType;
  const recordId = aiResult.targetId;
  const updates = aiResult.updates || {};
  
  // Map entity types to API endpoints with proper pluralization
  const objectType = {
    'company': 'companies',
    'deal': 'deals', 
    'person': 'people'
  }[entityType];
  
  if (!objectType) {
    throw new Error(`Unsupported entity type: ${entityType}`);
  }
  
  const endpoint = `/objects/${objectType}/records/${recordId}`;
  
  console.log(`\n=== Updating ${entityType} record: ${recordId} ===`);
  console.log('Updates to apply:', JSON.stringify(updates, null, 2));
  
  try {
    // Build the update payload with proper Attio API format
    const updatePayload = {
      data: {
        values: updates
      }
    };
    
    console.log('Update payload:', JSON.stringify(updatePayload, null, 2));
    
    // Update the record using PUT (which overwrites values)
    const response = await getAttioClient().put(endpoint, updatePayload);
    
    console.log('Update successful');
    
    // Extract the updated record name for response
    const updatedRecord = response.data.data;
    const recordName = updatedRecord.values?.name?.[0]?.value || 'Unnamed Record';
    
    // Create note if provided
    if (aiResult.notes) {
      await createNote(recordId, entityType, aiResult.notes);
    }

    return {
      action: 'update',
      type: entityType,
      name: recordName,
      recordId: recordId,
      notes: aiResult.notes,
      updates: Object.keys(updates).map(key => `Updated ${key}`),
      attioUrl: entityType === 'deal' 
        ? `https://app.attio.com/textql-data/deals/record/${recordId}/overview`
        : entityType === 'person'
        ? `https://app.attio.com/textql-data/person/${recordId}/overview`
        : `https://app.attio.com/textql-data/company/${recordId}/overview`
    };
  } catch (error) {
    console.error('Update record error:', error.response?.data || error.message);
    throw new Error(`Failed to update ${entityType}: ${error.response?.data?.message || error.message}`);
  }
}

function generateSlackThreadUrl(messageContext) {
  // Check for required fields
  if (!messageContext.channel || !messageContext.threadTs) {
    return null;
  }
  
  // Detect test context and return null
  if (messageContext.channel === 'test' || 
      messageContext.threadTs === 'test-thread' || 
      messageContext.userId === 'test-user-id') {
    return null;
  }
  
  // Convert timestamp format: "1752177859.983139" -> "1752177859983139"
  const timestamp = messageContext.threadTs.replace('.', '');
  
  // Return formatted URL
  return `https://textql.slack.com/archives/${messageContext.channel}/p${timestamp}`;
}

async function createNote(recordId, recordType, content, messageContext = null, noteTitle = null) {
  // Correct pluralization for Attio API
  const pluralType = recordType === 'person' ? 'people' : 
                     recordType === 'company' ? 'companies' :
                     recordType === 'deal' ? 'deals' : 
                     `${recordType}s`; // fallback to simple pluralization
  
  // Add Slack thread link if messageContext is provided
  let finalContent = content;
  if (messageContext && messageContext.channel && messageContext.threadTs) {
    const slackThreadUrl = generateSlackThreadUrl(messageContext);
    if (slackThreadUrl) {
      finalContent = `${content}\n\n---\nGo back to Slack thread: ${slackThreadUrl}`;
    }
  }
  
  const response = await getAttioClient().post('/notes', {
    data: {
      parent_object: pluralType,
      parent_record_id: recordId,
      title: noteTitle || 'Update from Slack',
      content: finalContent, // Content with optional Slack thread link
      format: 'plaintext',
      created_by_actor: {
        type: 'api-token'
      }
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
      case 'stage':
        conditions.push({ stage: { $eq: filterValue } });
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
      url: `${baseUrl}/deals/record/${record.id?.record_id}/overview`
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

// Simple update function for Claude agent to use
async function updateEntityField(entityType, recordId, fieldName, value, noteText = null) {
  try {
    console.log(`\n=== Updating ${entityType} ${recordId}: ${fieldName} = ${value} ===`);
    
    // Map entity types to API endpoints with proper pluralization
    const objectType = {
      'company': 'companies',
      'deal': 'deals', 
      'person': 'people'
    }[entityType];
    
    if (!objectType) {
      throw new Error(`Unsupported entity type: ${entityType}. Supported: company, deal, person`);
    }
    
    // Build the update payload
    const updatePayload = {
      data: {
        values: {
          [fieldName]: value
        }
      }
    };
    
    console.log('Update payload:', JSON.stringify(updatePayload, null, 2));
    
    // Update the record
    const response = await getAttioClient().put(`/objects/${objectType}/records/${recordId}`, updatePayload);
    
    // Extract the updated record info
    const updatedRecord = response.data.data;
    const recordName = updatedRecord.values?.name?.[0]?.value || 'Unnamed Record';
    
    console.log(`Successfully updated ${entityType} "${recordName}"`);
    
    // Create a note if requested
    let noteResult = null;
    if (noteText) {
      noteResult = await createNote(recordId, entityType, noteText, null, `Updated ${fieldName}`);
    }
    
    // Generate the appropriate URL
    const urlPath = entityType === 'deal' ? 'deals/record' : entityType;
    const attioUrl = `https://app.attio.com/textql-data/${urlPath}/${recordId}/overview`;
    
    return {
      success: true,
      action: 'update_field',
      entityType: entityType,
      recordId: recordId,
      recordName: recordName,
      fieldName: fieldName,
      newValue: value,
      noteCreated: noteResult ? true : false,
      attioUrl: attioUrl
    };
    
  } catch (error) {
    console.error('Update entity field error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      entityType: entityType,
      recordId: recordId,
      fieldName: fieldName,
      attemptedValue: value
    };
  }
}

/**
 * Create a new person record
 */
async function createPerson(personData) {
  try {
    console.log(`Creating person: ${personData.name}`);
    
    const payload = {
      data: {
        values: {
          name: personData.name
        }
      }
    };

    // Add optional fields if provided
    if (personData.email) {
      payload.data.values.email_addresses = [personData.email];
    }
    if (personData.phone) {
      payload.data.values.phone_numbers = [personData.phone];
    }
    if (personData.jobTitle) {
      payload.data.values.job_title = personData.jobTitle;
    }

    const response = await getAttioClient().post('/objects/people/records', payload);
    
    const recordId = response.data.data.id.record_id;
    const recordName = response.data.data.values.name[0].full_name;
    const attioUrl = `https://app.attio.com/textql-data/person/${recordId}/overview`;
    
    console.log(`Successfully created person: ${recordName} (${recordId})`);
    
    return {
      success: true,
      action: 'create_person',
      recordId: recordId,
      recordName: recordName,
      attioUrl: attioUrl,
      data: response.data.data
    };
    
  } catch (error) {
    console.error('Create person error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      attemptedName: personData.name
    };
  }
}

/**
 * Create a new company record
 */
async function createCompany(companyData) {
  try {
    console.log(`Creating company: ${companyData.name}`);
    
    const payload = {
      data: {
        values: {
          name: companyData.name
        }
      }
    };

    // Add optional fields if provided
    if (companyData.description) {
      payload.data.values.description = companyData.description;
    }
    if (companyData.domain) {
      payload.data.values.domains = [companyData.domain];
    }

    const response = await getAttioClient().post('/objects/companies/records', payload);
    
    const recordId = response.data.data.id.record_id;
    const recordName = response.data.data.values.name[0].value;
    const attioUrl = `https://app.attio.com/textql-data/company/${recordId}/overview`;
    
    console.log(`Successfully created company: ${recordName} (${recordId})`);
    
    return {
      success: true,
      action: 'create_company',
      recordId: recordId,
      recordName: recordName,
      attioUrl: attioUrl,
      data: response.data.data
    };
    
  } catch (error) {
    console.error('Create company error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      attemptedName: companyData.name
    };
  }
}

/**
 * Create a new deal record
 */
async function createDeal(dealData) {
  try {
    console.log(`Creating deal: ${dealData.name}`);
    
    // Deal requires an owner - use the default workspace member we found
    const defaultOwnerId = "2121a6f3-0a61-4148-b6d8-22216dced1fc"; // Ethan's ID from existing deals
    
    const payload = {
      data: {
        values: {
          name: dealData.name,
          owner: {
            referenced_actor_type: "workspace-member",
            referenced_actor_id: dealData.ownerId || defaultOwnerId
          }
        }
      }
    };

    // Add optional fields if provided
    if (dealData.value) {
      payload.data.values.total_contract_value = dealData.value;
    }
    if (dealData.companyId) {
      payload.data.values.associated_company = {
        target_object: "companies",
        target_record_id: dealData.companyId
      };
    }

    const response = await getAttioClient().post('/objects/deals/records', payload);
    
    const recordId = response.data.data.id.record_id;
    const recordName = response.data.data.values.name[0].value;
    const attioUrl = `https://app.attio.com/textql-data/deals/record/${recordId}/overview`;
    
    console.log(`Successfully created deal: ${recordName} (${recordId})`);
    
    return {
      success: true,
      action: 'create_deal',
      recordId: recordId,
      recordName: recordName,
      attioUrl: attioUrl,
      data: response.data.data
    };
    
  } catch (error) {
    console.error('Create deal error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      attemptedName: dealData.name
    };
  }
}

/**
 * Get tasks with optional filters
 * @param {Object} options - Filter options
 * @param {string} options.linkedRecordId - Filter by linked record ID
 * @param {string} options.linkedRecordType - Filter by linked record type (companies, people, deals)
 * @param {boolean} options.isCompleted - Filter by completion status
 * @param {number} options.limit - Maximum number of tasks to return
 * @param {string} options.sort - Sort field (e.g., '-deadline_at' for newest first)
 * @returns {Promise<Array>} Array of task objects
 */
async function getTasks(options = {}) {
  try {
    console.log(`\n=== Getting tasks with options: ===`, options);
    
    const params = new URLSearchParams();
    const filters = [];
    
    // Build combined filter object
    if (options.linkedRecordId && options.linkedRecordType) {
      // Build filter for linked records
      filters.push({
        linked_records: {
          $includes: {
            target_object: options.linkedRecordType,
            target_record_id: options.linkedRecordId
          }
        }
      });
    }
    
    if (typeof options.isCompleted === 'boolean') {
      filters.push({ is_completed: options.isCompleted });
    }
    
    // Combine filters with $and if multiple
    if (filters.length > 0) {
      const combinedFilter = filters.length === 1 ? filters[0] : { $and: filters };
      params.append('filter', JSON.stringify(combinedFilter));
    }
    
    if (options.limit) {
      params.append('limit', options.limit);
    }
    
    if (options.sort) {
      params.append('sort', options.sort);
    } else {
      // Default sort by deadline
      params.append('sort', '-deadline_at');
    }
    
    const url = `/tasks${params.toString() ? `?${params.toString()}` : ''}`;
    console.log('Getting tasks with URL:', url);
    
    const response = await getAttioClient().get(url);
    
    if (!response.data || !response.data.data) {
      console.log('No tasks data in response');
      return [];
    }
    
    console.log(`Found ${response.data.data.length} tasks`);
    
    // Format tasks for display
    return response.data.data.map(task => {
      const linkedRecords = task.linked_records || [];
      const assignees = task.assignees || [];
      
      // Generate task URL based on first linked record
      let taskUrl = null;
      if (linkedRecords.length > 0) {
        const firstLinked = linkedRecords[0];
        const entityType = firstLinked.target_object.replace(/s$/, ''); // Remove plural 's'
        taskUrl = `https://app.attio.com/textql-data/${entityType}/${firstLinked.target_record_id}/tasks`;
      }
      
      return {
        id: task.id?.task_id || task.id,
        content: task.content || '',
        format: task.format || 'plaintext',
        deadline_at: task.deadline_at,
        is_completed: task.is_completed || false,
        completed_at: task.completed_at,
        created_at: task.created_at,
        linked_records: linkedRecords,
        assignees: assignees,
        url: taskUrl
      };
    });
    
  } catch (error) {
    console.error('Get tasks error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Format assignees for the Attio API
 * @param {Array} assignees - Array of assignee objects or null
 * @returns {Array} Formatted assignees array
 */
function formatAssignees(assignees) {
  if (!assignees || !Array.isArray(assignees) || assignees.length === 0) {
    return [];
  }
  
  // Handle different input formats
  return assignees.map(assignee => {
    // If it's already in the correct format
    if (assignee.referenced_actor_type && assignee.referenced_actor_id) {
      return assignee;
    }
    
    // If it's an object with workspace_member_id
    if (assignee.workspace_member_id) {
      return {
        referenced_actor_type: 'workspace-member',
        referenced_actor_id: assignee.workspace_member_id
      };
    }
    
    // If it's just a string ID
    if (typeof assignee === 'string') {
      return {
        referenced_actor_type: 'workspace-member',
        referenced_actor_id: assignee
      };
    }
    
    // Unknown format - skip
    console.warn('Unknown assignee format:', assignee);
    return null;
  }).filter(Boolean); // Remove any null values
}

/**
 * Create a new task
 * @param {Object} taskData - Task data
 * @param {string} taskData.content - Task content (required)
 * @param {string} taskData.format - Content format (default: 'plaintext')
 * @param {string} taskData.deadline_at - Deadline in ISO format (required)
 * @param {Array} taskData.linked_records - Array of linked record objects (required)
 * @param {Array} taskData.assignees - Array of assignee objects with workspace_member_id, or array of string IDs (optional)
 * @returns {Promise<Object>} Created task object
 */
async function createTask(taskData) {
  try {
    console.log(`\n=== Creating task ===`);
    console.log('Task data:', JSON.stringify(taskData, null, 2));
    
    // Validate required fields
    if (!taskData.content) {
      throw new Error('Task content is required');
    }
    if (!taskData.deadline_at) {
      throw new Error('Task deadline_at is required');
    }
    if (!taskData.linked_records || !Array.isArray(taskData.linked_records) || taskData.linked_records.length === 0) {
      throw new Error('Task must have at least one linked record');
    }
    
    // Build task payload
    const payload = {
      data: {
        content: taskData.content,
        format: taskData.format || 'plaintext',
        deadline_at: taskData.deadline_at,
        is_completed: false,  // Required boolean field - new tasks start as incomplete
        linked_records: taskData.linked_records,
        assignees: formatAssignees(taskData.assignees)
      }
    };
    
    console.log('Create task payload:', JSON.stringify(payload, null, 2));
    
    const response = await getAttioClient().post('/tasks', payload);
    
    const createdTask = response.data.data;
    console.log('Task created successfully:', createdTask.id);
    
    // Generate task URL based on first linked record
    let taskUrl = null;
    if (createdTask.linked_records && createdTask.linked_records.length > 0) {
      const firstLinked = createdTask.linked_records[0];
      if (firstLinked && firstLinked.target_object && firstLinked.target_record_id) {
        const entityType = firstLinked.target_object.replace(/s$/, ''); // Remove plural 's'
        taskUrl = `https://app.attio.com/textql-data/${entityType}/${firstLinked.target_record_id}/tasks`;
      }
    }
    
    return {
      success: true,
      action: 'create_task',
      taskId: createdTask.id?.task_id || createdTask.id,
      content: createdTask.content,
      deadline_at: createdTask.deadline_at,
      linked_records: createdTask.linked_records,
      url: taskUrl
    };
    
  } catch (error) {
    console.error('Create task error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      attemptedData: taskData
    };
  }
}

/**
 * Update an existing task
 * @param {string} taskId - Task ID to update
 * @param {Object} updates - Updates to apply (ONLY deadline_at and is_completed are supported by Attio API)
 * @param {string} updates.deadline_at - New deadline in ISO format
 * @param {boolean} updates.is_completed - Completion status
 * @param {Array} updates.assignees - [NOT SUPPORTED BY API] Assignees cannot be changed after task creation
 * @returns {Promise<Object>} Updated task object
 */
async function updateTask(taskId, updates) {
  try {
    console.log(`\n=== Updating task ${taskId} ===`);
    console.log('Updates:', JSON.stringify(updates, null, 2));
    
    // Validate that only supported fields are being updated
    const supportedFields = ['deadline_at', 'is_completed'];
    const updateFields = Object.keys(updates);
    const unsupportedFields = updateFields.filter(field => !supportedFields.includes(field));
    
    if (updateFields.includes('assignees')) {
      console.error('ERROR: Attempting to update assignees, which is NOT supported by the Attio API after task creation');
      throw new Error('Cannot update task assignees after creation. This is an Attio API limitation. Tasks must be deleted and recreated to change assignees.');
    }
    
    if (unsupportedFields.length > 0) {
      console.warn(`Warning: Unsupported fields will be ignored: ${unsupportedFields.join(', ')}`);
    }
    
    // Build update payload with only supported fields
    const updatePayload = {
      data: {}
    };
    
    if ('deadline_at' in updates) {
      updatePayload.data.deadline_at = updates.deadline_at;
    }
    if ('is_completed' in updates) {
      updatePayload.data.is_completed = updates.is_completed;
    }
    
    if (Object.keys(updatePayload.data).length === 0) {
      throw new Error('No valid fields to update. The Attio API only supports updating deadline_at and is_completed. Assignees cannot be changed after task creation.');
    }
    
    console.log('Update payload:', JSON.stringify(updatePayload, null, 2));
    
    const response = await getAttioClient().patch(`/tasks/${taskId}`, updatePayload);
    
    const updatedTask = response.data.data;
    console.log('Task updated successfully');
    
    // Generate task URL based on first linked record
    let taskUrl = null;
    if (updatedTask.linked_records && updatedTask.linked_records.length > 0) {
      const firstLinked = updatedTask.linked_records[0];
      if (firstLinked && firstLinked.target_object && firstLinked.target_record_id) {
        const entityType = firstLinked.target_object.replace(/s$/, ''); // Remove plural 's'
        taskUrl = `https://app.attio.com/textql-data/${entityType}/${firstLinked.target_record_id}/tasks`;
      }
    }
    
    return {
      success: true,
      action: 'update_task',
      taskId: taskId,
      updates: updatePayload.data,
      content: updatedTask.content,
      deadline_at: updatedTask.deadline_at,
      is_completed: updatedTask.is_completed,
      url: taskUrl
    };
    
  } catch (error) {
    console.error('Update task error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      taskId: taskId,
      attemptedUpdates: updates
    };
  }
}

/**
 * Search tasks by content for a specific linked record
 * @param {Object} linkedRecord - Linked record to search tasks for
 * @param {string} linkedRecord.target_object - Object type (e.g., 'companies', 'people', 'deals')
 * @param {string} linkedRecord.target_record_id - Record ID
 * @param {string} searchTerm - Term to search for in task content
 * @returns {Promise<Array>} Array of matching tasks
 */
async function searchTasksByContent(linkedRecord, searchTerm) {
  try {
    console.log(`\n=== Searching tasks by content ===`);
    console.log('Linked record:', linkedRecord);
    console.log('Search term:', searchTerm);
    
    if (!linkedRecord || !linkedRecord.target_object || !linkedRecord.target_record_id) {
      throw new Error('Valid linked record with target_object and target_record_id is required');
    }
    
    if (!searchTerm) {
      throw new Error('Search term is required');
    }
    
    // First, get all tasks for the linked record
    const tasks = await getTasks({
      linkedRecordId: linkedRecord.target_record_id,
      linkedRecordType: linkedRecord.target_object,
      limit: 100 // Get more tasks for searching
    });
    
    console.log(`Found ${tasks.length} total tasks for record`);
    
    // Filter tasks by content
    const searchTermLower = searchTerm.toLowerCase();
    const matchingTasks = tasks.filter(task => {
      const content = (task.content || '').toLowerCase();
      return content.includes(searchTermLower);
    });
    
    console.log(`Found ${matchingTasks.length} tasks matching "${searchTerm}"`);
    
    return matchingTasks;
    
  } catch (error) {
    console.error('Search tasks by content error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get all workspace members from Attio
 * @returns {Promise<Object>} List of workspace members
 */
async function getWorkspaceMembers() {
  try {
    console.log('\n=== Getting all workspace members ===');
    
    const response = await getAttioClient().get('/workspace_members');
    
    const members = response.data.data || [];
    console.log(`Found ${members.length} workspace members`);
    
    return members.map(member => {
      const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Unknown';
      
      return {
        id: member.id?.workspace_member_id || member.id,
        name: fullName,
        firstName: member.first_name,
        lastName: member.last_name,
        email: member.email_address || 'No email',
        avatar: member.avatar_url,
        accessLevel: member.access_level,
        created_at: member.created_at
      };
    });
    
  } catch (error) {
    console.error('Get workspace members error:', error.response?.data || error.message);
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
  createNote,
  advancedSearch,
  searchRelatedEntities,
  searchByTimeRange,
  getEntityById,
  updateEntityField,
  createPerson,
  createCompany,
  createDeal,
  getTasks,
  createTask,
  updateTask,
  searchTasksByContent,
  getWorkspaceMembers
};