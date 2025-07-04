#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Looking for MongoDB connection string...\n');

// Try to find MongoDB connection in various places
const possibleLocations = [
  // Check Claude MCP configuration
  () => {
    try {
      const result = execSync('claude mcp list', { encoding: 'utf8' });
      if (result.includes('mongodb')) {
        console.log('✓ Found MongoDB in Claude MCP configuration');
        console.log('\nTo get your connection string:');
        console.log('1. Check your MongoDB Atlas dashboard: https://cloud.mongodb.com');
        console.log('2. Or check where you initially configured the MongoDB MCP server');
        return true;
      }
    } catch (e) {
      // Claude CLI might not be available
    }
    return false;
  },
  
  // Check environment variables
  () => {
    if (process.env.MDB_MCP_CONNECTION_STRING) {
      console.log('✓ Found MDB_MCP_CONNECTION_STRING in environment');
      console.log('\nConnection string:', process.env.MDB_MCP_CONNECTION_STRING);
      return true;
    }
    return false;
  },
  
  // Check parent .env files
  () => {
    const parentEnv = path.join(__dirname, '../../.env');
    if (fs.existsSync(parentEnv)) {
      const content = fs.readFileSync(parentEnv, 'utf8');
      const match = content.match(/MDB_MCP_CONNECTION_STRING=(.+)/);
      if (match) {
        console.log('✓ Found connection string in parent .env file');
        console.log('\nConnection string:', match[1]);
        return true;
      }
    }
    return false;
  }
];

let found = false;
for (const check of possibleLocations) {
  if (check()) {
    found = true;
    break;
  }
}

if (!found) {
  console.log('❌ Could not find MongoDB connection string automatically.\n');
  console.log('Please get your MongoDB connection string from:');
  console.log('1. MongoDB Atlas: https://cloud.mongodb.com');
  console.log('2. Click on your cluster → Connect → Connect your application');
  console.log('3. Copy the connection string');
}

console.log('\n📝 Once you have the connection string, update your .env file:');
console.log('MONGODB_URI=<your-connection-string-here>');
console.log('\nMake sure to use database name "crm-bot" in the connection string.');