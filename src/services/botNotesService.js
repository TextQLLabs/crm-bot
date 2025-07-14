const fs = require('fs').promises;
const path = require('path');

/**
 * Bot Notes Service
 * 
 * Manages persistent bot notes in JSON format for tracking:
 * - Hot accounts (frequently queried)
 * - Recent deals and their IDs
 * - Advisor contacts
 * - Other reference lists
 */

class BotNotesService {
  constructor() {
    // Use persistent volume path in production, local path in development
    const isProduction = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
    this.notesPath = isProduction 
      ? '/data/bot-notes.json'  // Railway persistent volume
      : path.join(__dirname, '../../data/bot-notes.json');  // Local development
    this.defaultStructure = {
      hotAccounts: [],
      recentDeals: [],
      advisors: [],
      teammates: [],
      lastUpdated: null,
      metadata: {
        version: '1.0.0',
        description: 'Bot persistent notes for CRM operations'
      }
    };
  }

  /**
   * Initialize notes file if it doesn't exist
   */
  async initializeNotes() {
    try {
      // Ensure directory exists (important for persistent volumes)
      const dir = path.dirname(this.notesPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Check if file exists
      await fs.access(this.notesPath);
      console.log(`✅ Bot notes file found at: ${this.notesPath}`);
    } catch (error) {
      // File doesn't exist, create it
      console.log(`📝 Creating bot notes file at: ${this.notesPath}`);
      await this.saveNotes(this.defaultStructure);
    }
  }

  /**
   * Load notes from file
   */
  async loadNotes() {
    try {
      await this.initializeNotes();
      const data = await fs.readFile(this.notesPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading bot notes:', error);
      return this.defaultStructure;
    }
  }

  /**
   * Save notes to file
   */
  async saveNotes(notes) {
    try {
      notes.lastUpdated = new Date().toISOString();
      await fs.writeFile(this.notesPath, JSON.stringify(notes, null, 2));
      console.log(`💾 Bot notes saved to: ${this.notesPath}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error saving bot notes:', error);
      console.error('Notes path:', this.notesPath);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add or update a hot account
   */
  async addHotAccount(accountInfo) {
    const notes = await this.loadNotes();
    
    // Remove existing entry if it exists
    notes.hotAccounts = notes.hotAccounts.filter(acc => acc.id !== accountInfo.id);
    
    // Add new entry with query count and timestamp
    notes.hotAccounts.unshift({
      id: accountInfo.id,
      name: accountInfo.name,
      type: accountInfo.type || 'company',
      queryCount: (accountInfo.queryCount || 0) + 1,
      lastQueried: new Date().toISOString(),
      url: accountInfo.url
    });

    // Keep only top 20 hot accounts
    if (notes.hotAccounts.length > 20) {
      notes.hotAccounts = notes.hotAccounts.slice(0, 20);
    }

    await this.saveNotes(notes);
    return { success: true, count: notes.hotAccounts.length };
  }

  /**
   * Add a recent deal to the cache
   */
  async addRecentDeal(dealInfo) {
    const notes = await this.loadNotes();
    
    // Remove existing entry if it exists
    notes.recentDeals = notes.recentDeals.filter(deal => deal.id !== dealInfo.id);
    
    // Add new entry at the beginning
    notes.recentDeals.unshift({
      id: dealInfo.id,
      name: dealInfo.name,
      company: dealInfo.company,
      value: dealInfo.value,
      stage: dealInfo.stage,
      lastAccessed: new Date().toISOString(),
      url: dealInfo.url
    });

    // Keep only last 10 deals
    if (notes.recentDeals.length > 10) {
      notes.recentDeals = notes.recentDeals.slice(0, 10);
    }

    await this.saveNotes(notes);
    return { success: true, count: notes.recentDeals.length };
  }

  /**
   * Add an advisor contact
   */
  async addAdvisor(advisorInfo) {
    const notes = await this.loadNotes();
    
    // Check if advisor already exists
    const existingIndex = notes.advisors.findIndex(adv => adv.id === advisorInfo.id);
    
    if (existingIndex !== -1) {
      // Update existing advisor
      notes.advisors[existingIndex] = {
        ...notes.advisors[existingIndex],
        ...advisorInfo,
        lastUpdated: new Date().toISOString()
      };
    } else {
      // Add new advisor
      notes.advisors.push({
        id: advisorInfo.id,
        name: advisorInfo.name,
        company: advisorInfo.company,
        email: advisorInfo.email,
        phone: advisorInfo.phone,
        expertise: advisorInfo.expertise,
        notes: advisorInfo.notes,
        addedOn: new Date().toISOString(),
        url: advisorInfo.url
      });
    }

    await this.saveNotes(notes);
    return { success: true, count: notes.advisors.length };
  }

  /**
   * Add a teammate
   */
  async addTeammate(teammateInfo) {
    const notes = await this.loadNotes();
    
    // Check if teammate already exists
    const existingIndex = notes.teammates.findIndex(tm => tm.id === teammateInfo.id);
    
    if (existingIndex !== -1) {
      // Update existing teammate
      notes.teammates[existingIndex] = {
        ...notes.teammates[existingIndex],
        ...teammateInfo,
        lastUpdated: new Date().toISOString()
      };
    } else {
      // Add new teammate
      notes.teammates.push({
        id: teammateInfo.id,
        name: teammateInfo.name,
        email: teammateInfo.email,
        role: teammateInfo.role,
        department: teammateInfo.department,
        addedOn: new Date().toISOString(),
        url: teammateInfo.url
      });
    }

    await this.saveNotes(notes);
    return { success: true, count: notes.teammates.length };
  }

  /**
   * Remove an entry from any list
   */
  async removeEntry(listName, entryId) {
    const notes = await this.loadNotes();
    
    if (!notes[listName]) {
      return { success: false, error: `List ${listName} not found` };
    }

    const originalLength = notes[listName].length;
    notes[listName] = notes[listName].filter(item => item.id !== entryId);
    
    if (notes[listName].length === originalLength) {
      return { success: false, error: 'Entry not found' };
    }

    await this.saveNotes(notes);
    return { success: true, removed: true };
  }

  /**
   * Get all notes or specific section
   */
  async getNotes(section = null) {
    const notes = await this.loadNotes();
    
    if (section) {
      return {
        success: true,
        data: notes[section] || [],
        section: section,
        lastUpdated: notes.lastUpdated
      };
    }

    return {
      success: true,
      data: notes,
      lastUpdated: notes.lastUpdated
    };
  }

  /**
   * Search within notes
   */
  async searchNotes(query, section = null) {
    const notes = await this.loadNotes();
    const results = [];
    
    const searchInArray = (arr, sectionName) => {
      return arr.filter(item => {
        const searchText = JSON.stringify(item).toLowerCase();
        return searchText.includes(query.toLowerCase());
      }).map(item => ({ ...item, section: sectionName }));
    };

    if (section) {
      if (notes[section]) {
        results.push(...searchInArray(notes[section], section));
      }
    } else {
      // Search all sections
      results.push(...searchInArray(notes.hotAccounts, 'hotAccounts'));
      results.push(...searchInArray(notes.recentDeals, 'recentDeals'));
      results.push(...searchInArray(notes.advisors, 'advisors'));
      results.push(...searchInArray(notes.teammates, 'teammates'));
    }

    return {
      success: true,
      results: results,
      query: query,
      totalFound: results.length
    };
  }

  /**
   * Get formatted summary for bot context
   */
  async getContextSummary() {
    const notes = await this.loadNotes();
    
    const summary = {
      hotAccounts: notes.hotAccounts.slice(0, 5).map(acc => ({
        name: acc.name,
        type: acc.type,
        queryCount: acc.queryCount
      })),
      recentDeals: notes.recentDeals.slice(0, 5).map(deal => ({
        name: deal.name,
        company: deal.company,
        value: deal.value
      })),
      advisorCount: notes.advisors.length,
      teammateCount: notes.teammates.length,
      lastUpdated: notes.lastUpdated
    };

    return summary;
  }

  /**
   * Clear all notes (for testing/reset)
   */
  async clearAllNotes() {
    await this.saveNotes(this.defaultStructure);
    return { success: true, message: 'All notes cleared' };
  }
}

module.exports = { BotNotesService };