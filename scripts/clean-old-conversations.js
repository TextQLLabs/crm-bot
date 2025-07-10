#!/usr/bin/env node

/**
 * Conversation Data Retention Script
 * 
 * Manages conversation data by:
 * 1. Moving conversations older than 30 days to archive
 * 2. Compressing archived data
 * 3. Removing conversations older than 90 days
 */

const fs = require('fs');
const path = require('path');

const CONVERSATIONS_DIR = path.join(__dirname, '../data/conversations');
const LOGS_DIR = path.join(__dirname, '../logs/conversations');
const RETENTION_DAYS = 30;
const ARCHIVE_DAYS = 90;

async function cleanOldConversations() {
  console.log('🧹 Starting conversation cleanup...');
  
  if (!fs.existsSync(CONVERSATIONS_DIR)) {
    console.log('ℹ️  No conversations directory found');
    return;
  }

  const files = fs.readdirSync(CONVERSATIONS_DIR);
  const now = new Date();
  const retentionDate = new Date(now.getTime() - (RETENTION_DAYS * 24 * 60 * 60 * 1000));
  const archiveDate = new Date(now.getTime() - (ARCHIVE_DAYS * 24 * 60 * 60 * 1000));
  
  let movedCount = 0;
  let deletedCount = 0;
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    const filePath = path.join(CONVERSATIONS_DIR, file);
    
    // Extract date from filename (format: 2025-07-08T11-04-08-066Z_...)
    let fileDate;
    const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      fileDate = new Date(dateMatch[1]);
    } else {
      // Fallback to file modification time
      const stats = fs.statSync(filePath);
      fileDate = stats.mtime;
    }
    
    // Delete files older than archive date
    if (fileDate < archiveDate) {
      fs.unlinkSync(filePath);
      deletedCount++;
      console.log(`🗑️  Deleted old conversation: ${file}`);
    }
    // Move files older than retention date to logs
    else if (fileDate < retentionDate) {
      const targetPath = path.join(LOGS_DIR, file);
      fs.renameSync(filePath, targetPath);
      movedCount++;
      console.log(`📦 Archived conversation: ${file}`);
    }
  }
  
  console.log(`✅ Cleanup complete: ${movedCount} archived, ${deletedCount} deleted`);
  
  // Report current state
  const remainingFiles = fs.readdirSync(CONVERSATIONS_DIR).filter(f => f.endsWith('.json'));
  console.log(`📊 Active conversations: ${remainingFiles.length}`);
}

// Self-executing if run directly
if (require.main === module) {
  cleanOldConversations().catch(console.error);
}

module.exports = { cleanOldConversations };