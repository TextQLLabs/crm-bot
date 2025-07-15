const fs = require('fs').promises;
const path = require('path');

/**
 * Memory Service
 * 
 * Provides silent background intelligence for the bot by maintaining:
 * - Hot accounts (frequently queried entities)
 * - Recent deals and their context
 * - Advisor contacts for quick reference
 * - Team member information
 * 
 * This service operates invisibly - users never see or interact with it directly.
 * It simply makes the bot smarter over time by remembering important context.
 */

class MemoryService {
  constructor() {
    // Use persistent volume path in production, local path in development
    const isProduction = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
    this.memoryPath = isProduction 
      ? '/data/bot-memory.json'  // Railway persistent volume
      : path.join(__dirname, '../../data/bot-memory.json');  // Local development
    this.defaultStructure = {
      hotAccounts: [],
      recentDeals: [],
      advisors: [],
      teammates: [],
      lastUpdated: null,
      metadata: {
        version: '1.0.0',
        description: 'Bot memory for intelligent context tracking'
      }
    };
  }

  /**
   * Initialize memory file if it doesn't exist
   */
  async initializeMemory() {
    try {
      // Ensure directory exists (important for persistent volumes)
      const dir = path.dirname(this.memoryPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Check if file exists
      await fs.access(this.memoryPath);
      console.log(`✅ Bot memory file found at: ${this.memoryPath}`);
    } catch (error) {
      // File doesn't exist, create it
      console.log(`📝 Creating bot memory file at: ${this.memoryPath}`);
      await this.saveMemory(this.defaultStructure);
    }
  }

  /**
   * Load memory from file
   */
  async loadMemory() {
    try {
      await this.initializeMemory();
      const data = await fs.readFile(this.memoryPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading bot memory:', error);
      return this.defaultStructure;
    }
  }

  /**
   * Save memory to file
   */
  async saveMemory(memory) {
    try {
      memory.lastUpdated = new Date().toISOString();
      await fs.writeFile(this.memoryPath, JSON.stringify(memory, null, 2));
      console.log(`💾 Bot memory saved to: ${this.memoryPath}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error saving bot memory:', error);
      console.error('Memory path:', this.memoryPath);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add or update a hot account
   */
  async addHotAccount(accountInfo) {
    const memory = await this.loadMemory();
    
    // Remove existing entry if it exists
    memory.hotAccounts = memory.hotAccounts.filter(acc => acc.id !== accountInfo.id);
    
    // Add new entry with query count and timestamp
    memory.hotAccounts.unshift({
      id: accountInfo.id,
      name: accountInfo.name,
      type: accountInfo.type || 'company',
      queryCount: (accountInfo.queryCount || 0) + 1,
      lastQueried: new Date().toISOString(),
      url: accountInfo.url
    });

    // Keep only top 20 hot accounts
    if (memory.hotAccounts.length > 20) {
      memory.hotAccounts = memory.hotAccounts.slice(0, 20);
    }

    await this.saveMemory(memory);
    return { success: true, count: memory.hotAccounts.length };
  }

  /**
   * Add a recent deal to the cache
   */
  async addRecentDeal(dealInfo) {
    const memory = await this.loadMemory();
    
    // Remove existing entry if it exists
    memory.recentDeals = memory.recentDeals.filter(deal => deal.id !== dealInfo.id);
    
    // Add new entry at the beginning
    memory.recentDeals.unshift({
      id: dealInfo.id,
      name: dealInfo.name,
      company: dealInfo.company,
      value: dealInfo.value,
      stage: dealInfo.stage,
      lastAccessed: new Date().toISOString(),
      url: dealInfo.url
    });

    // Keep only last 10 deals
    if (memory.recentDeals.length > 10) {
      memory.recentDeals = memory.recentDeals.slice(0, 10);
    }

    await this.saveMemory(memory);
    return { success: true, count: memory.recentDeals.length };
  }

  /**
   * Add an advisor contact
   */
  async addAdvisor(advisorInfo) {
    const memory = await this.loadMemory();
    
    // Check if advisor already exists
    const existingIndex = memory.advisors.findIndex(adv => adv.id === advisorInfo.id);
    
    if (existingIndex !== -1) {
      // Update existing advisor
      memory.advisors[existingIndex] = {
        ...memory.advisors[existingIndex],
        ...advisorInfo,
        lastUpdated: new Date().toISOString()
      };
    } else {
      // Add new advisor
      memory.advisors.push({
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

    await this.saveMemory(memory);
    return { success: true, count: memory.advisors.length };
  }

  /**
   * Add a teammate
   */
  async addTeammate(teammateInfo) {
    const memory = await this.loadMemory();
    
    // Check if teammate already exists
    const existingIndex = memory.teammates.findIndex(tm => tm.id === teammateInfo.id);
    
    if (existingIndex !== -1) {
      // Update existing teammate
      memory.teammates[existingIndex] = {
        ...memory.teammates[existingIndex],
        ...teammateInfo,
        lastUpdated: new Date().toISOString()
      };
    } else {
      // Add new teammate
      memory.teammates.push({
        id: teammateInfo.id,
        name: teammateInfo.name,
        email: teammateInfo.email,
        role: teammateInfo.role,
        department: teammateInfo.department,
        addedOn: new Date().toISOString(),
        url: teammateInfo.url
      });
    }

    await this.saveMemory(memory);
    return { success: true, count: memory.teammates.length };
  }

  /**
   * Remove an entry from any list
   */
  async removeEntry(listName, entryId) {
    const memory = await this.loadMemory();
    
    if (!memory[listName]) {
      return { success: false, error: `List ${listName} not found` };
    }

    const originalLength = memory[listName].length;
    memory[listName] = memory[listName].filter(item => item.id !== entryId);
    
    if (memory[listName].length === originalLength) {
      return { success: false, error: 'Entry not found' };
    }

    await this.saveMemory(memory);
    return { success: true, removed: true };
  }

  /**
   * Get all memory or specific section
   */
  async getMemory(section = null) {
    const memory = await this.loadMemory();
    
    if (section) {
      return {
        success: true,
        data: memory[section] || [],
        section: section,
        lastUpdated: memory.lastUpdated
      };
    }

    return {
      success: true,
      data: memory,
      lastUpdated: memory.lastUpdated
    };
  }

  /**
   * Search within memory
   */
  async searchMemory(query, section = null) {
    const memory = await this.loadMemory();
    const results = [];
    
    const searchInArray = (arr, sectionName) => {
      return arr.filter(item => {
        const searchText = JSON.stringify(item).toLowerCase();
        return searchText.includes(query.toLowerCase());
      }).map(item => ({ ...item, section: sectionName }));
    };

    if (section) {
      if (memory[section]) {
        results.push(...searchInArray(memory[section], section));
      }
    } else {
      // Search all sections
      results.push(...searchInArray(memory.hotAccounts, 'hotAccounts'));
      results.push(...searchInArray(memory.recentDeals, 'recentDeals'));
      results.push(...searchInArray(memory.advisors, 'advisors'));
      results.push(...searchInArray(memory.teammates, 'teammates'));
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
    const memory = await this.loadMemory();
    
    const summary = {
      hotAccounts: memory.hotAccounts.slice(0, 5).map(acc => ({
        name: acc.name,
        type: acc.type,
        queryCount: acc.queryCount
      })),
      recentDeals: memory.recentDeals.slice(0, 5).map(deal => ({
        name: deal.name,
        company: deal.company,
        value: deal.value
      })),
      advisorCount: memory.advisors.length,
      teammateCount: memory.teammates.length,
      lastUpdated: memory.lastUpdated
    };

    return summary;
  }

  /**
   * Clear all memory (for testing/reset)
   */
  async clearAllMemory() {
    await this.saveMemory(this.defaultStructure);
    return { success: true, message: 'All memory cleared' };
  }
}

module.exports = { MemoryService };