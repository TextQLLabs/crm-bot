#!/usr/bin/env node

// Simple wrapper to run tests with proper output flushing
process.env.NODE_ENV = 'development';

// Disable output buffering
process.stdout.setEncoding('utf8');
process.stderr.setEncoding('utf8');

// Load environment
require('dotenv').config({ path: '.env.dev' });

// Run the test
require('./tests/test.js');