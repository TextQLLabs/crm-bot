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
        url: `https://app.attio.com/textql-data/companies/record/${company.id?.record_id}`
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

// Generate search variations for fuzzy matching
function generateSearchVariations(query) {
  const variations = new Set([query]);
  
  // Add original query
  variations.add(query);
  
  // Add lowercase version
  variations.add(query.toLowerCase());
  
  // Add without common words
  const withoutCommon = query.replace(/\b(the|inc|llc|ltd|corporation|corp|company|co|group)\b/gi, '').trim();
  if (withoutCommon && withoutCommon !== query) {
    variations.add(withoutCommon);
  }
  
  // Add individual words (for multi-word queries)
  const words = query.split(/\s+/).filter(word => word.length > 2);
  words.forEach(word => variations.add(word));
  
  // Add partial matches (first word, last word)
  if (words.length > 1) {
    variations.add(words[0]);
    variations.add(words[words.length - 1]);
  }
  
  return Array.from(variations);
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
        url: `https://app.attio.com/textql-data/deals/record/${deal.id?.record_id}`
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
        url: `https://app.attio.com/textql-data/people/record/${personId}`
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

module.exports = { searchAttio, createOrUpdateRecord, getAttioClient };