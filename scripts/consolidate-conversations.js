#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data/conversations');
const LOG_FILE = path.join(DATA_DIR, 'conversations_2025-07-10.log');

async function consolidateConversations() {
  try {
    // Check if log file exists
    if (!fs.existsSync(LOG_FILE)) {
      console.log('No log file found to consolidate');
      return;
    }

    // Read the log file
    const logContent = fs.readFileSync(LOG_FILE, 'utf8');
    const logEntries = logContent.trim().split('\n').filter(line => line.trim());

    console.log(`Found ${logEntries.length} entries in log file`);

    // Process each log entry
    let consolidatedCount = 0;
    let skippedCount = 0;

    for (const entry of logEntries) {
      try {
        const data = JSON.parse(entry);
        
        // Create filename from timestamp and conversation ID
        const timestamp = data.timestamp || new Date().toISOString();
        const conversationId = data.conversationId || 'unknown';
        const filename = `${timestamp.replace(/[:.]/g, '-').replace('Z', 'Z')}_${conversationId}.json`;
        const filepath = path.join(DATA_DIR, filename);

        // Check if file already exists
        if (fs.existsSync(filepath)) {
          console.log(`Skipping ${filename} - already exists`);
          skippedCount++;
          continue;
        }

        // Write the JSON data to individual file
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        console.log(`Created ${filename}`);
        consolidatedCount++;

      } catch (error) {
        console.error(`Error processing log entry: ${error.message}`);
      }
    }

    console.log(`\nConsolidation complete:`);
    console.log(`- Created: ${consolidatedCount} files`);
    console.log(`- Skipped: ${skippedCount} files (already existed)`);

    // Create backup of log file before removing
    const backupPath = `${LOG_FILE}.backup`;
    fs.copyFileSync(LOG_FILE, backupPath);
    console.log(`- Backed up log file to: ${backupPath}`);

    // Remove the original log file
    fs.unlinkSync(LOG_FILE);
    console.log(`- Removed original log file`);

  } catch (error) {
    console.error('Error consolidating conversations:', error);
  }
}

// Run the consolidation
consolidateConversations();