#!/usr/bin/env node
require('dotenv').config();

// Run test suite in CI mode with simple output
process.env.SIMPLE_OUTPUT = '1';
process.env.CI = '1';

// Capture console.log to prevent EPIPE errors
const originalLog = console.log;
console.log = function(...args) {
  try {
    originalLog.apply(console, args);
  } catch (err) {
    // Ignore EPIPE errors when output is piped
    if (err.code !== 'EPIPE') throw err;
  }
};

// Run the test suite
require('./test-suite');