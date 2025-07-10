#!/usr/bin/env node

/**
 * Documentation Consolidation Script
 * 
 * Consolidates overlapping documentation by:
 * 1. Removing obsolete Cloudflare documentation (project moved to Railway)
 * 2. Consolidating duplicate files
 * 3. Organizing documentation into clear categories
 * 4. Moving outdated files to archive
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');
const ARCHIVE_DIR = path.join(DOCS_DIR, 'archive');

// Files to remove (obsolete)
const OBSOLETE_FILES = [
  'docs/CLOUDFLARE_DEPLOYMENT.md',
  'docs/CLOUDFLARE_SETUP.md',
  'docs/CHANGELOG.md', // Duplicate of root-level one
];

// Files to move to archive (outdated but preserve)
const ARCHIVE_FILES = [
  'docs/REORGANIZATION_SUMMARY.md', // Historical context
  'docs/SESSION_CONTEXT.md', // May be outdated
];

// Documentation categories for organization
const DOC_CATEGORIES = {
  setup: [
    'docs/SETUP_INSTRUCTIONS.md',
    'docs/ENVIRONMENT_VARIABLES.md',
    'docs/LOCAL_TESTING.md'
  ],
  deployment: [
    'docs/RAILWAY_DEPLOYMENT.md'
  ],
  development: [
    'docs/DEVELOPMENT_WORKFLOW.md',
    'docs/DEBUGGING_METHODOLOGY.md',
    'docs/PERFORMANCE_OPTIMIZATION.md'
  ],
  features: [
    'docs/delete-note-feature.md',
    'docs/multimodal-support.md',
    'docs/slack-image-integration.md'
  ],
  reference: [
    'docs/SPEC.md',
    'docs/SLACK_INTEGRATION_PATTERNS.md',
    'docs/TROUBLESHOOTING_INVALID_BLOCKS.md'
  ]
};

async function consolidateDocs() {
  console.log('📚 Starting documentation consolidation...');
  
  // Create archive directory if it doesn't exist
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    console.log('📁 Created archive directory');
  }
  
  let removedCount = 0;
  let archivedCount = 0;
  
  // Remove obsolete files
  for (const file of OBSOLETE_FILES) {
    const filePath = path.join(PROJECT_ROOT, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      removedCount++;
      console.log(`🗑️  Removed obsolete: ${file}`);
    }
  }
  
  // Move files to archive
  for (const file of ARCHIVE_FILES) {
    const sourcePath = path.join(PROJECT_ROOT, file);
    const fileName = path.basename(file);
    const targetPath = path.join(ARCHIVE_DIR, fileName);
    
    if (fs.existsSync(sourcePath)) {
      fs.renameSync(sourcePath, targetPath);
      archivedCount++;
      console.log(`📦 Archived: ${file} → archive/${fileName}`);
    }
  }
  
  // Create category README files
  await createCategoryReadmes();
  
  console.log(`✅ Documentation consolidation complete:`);
  console.log(`   📄 ${removedCount} obsolete files removed`);
  console.log(`   📦 ${archivedCount} files archived`);
  console.log(`   📁 Documentation organized by category`);
}

async function createCategoryReadmes() {
  // Create a comprehensive docs README
  const docsReadme = `# CRM Bot Documentation

This directory contains comprehensive documentation for the CRM Bot project.

## 📁 Documentation Structure

### Setup & Configuration
- [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) - Complete setup guide
- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) - Environment variable configuration
- [LOCAL_TESTING.md](LOCAL_TESTING.md) - Local development and testing

### Deployment
- [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) - Production deployment on Railway

### Development
- [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) - Development process and workflows
- [DEBUGGING_METHODOLOGY.md](DEBUGGING_METHODOLOGY.md) - Debugging strategies
- [PERFORMANCE_OPTIMIZATION.md](PERFORMANCE_OPTIMIZATION.md) - Performance tuning

### Features & Integrations
- [delete-note-feature.md](delete-note-feature.md) - Note deletion functionality
- [multimodal-support.md](multimodal-support.md) - Image processing capabilities
- [slack-image-integration.md](slack-image-integration.md) - Slack image handling
- [slack-mcp-crm-bot-context.md](slack-mcp-crm-bot-context.md) - MCP server context

### Reference
- [SPEC.md](SPEC.md) - Technical specifications
- [SLACK_INTEGRATION_PATTERNS.md](SLACK_INTEGRATION_PATTERNS.md) - Slack integration patterns
- [TROUBLESHOOTING_INVALID_BLOCKS.md](TROUBLESHOOTING_INVALID_BLOCKS.md) - Troubleshooting guide

### Archive
- [archive/](archive/) - Historical and outdated documentation

## 🔗 Related Documentation

- [../CLAUDE.md](../CLAUDE.md) - Project context and instructions
- [../CHANGELOG.md](../CHANGELOG.md) - Version history and changes
- [../MIGRATION.md](../MIGRATION.md) - Migration guide (ReAct → Claude)
- [../README.md](../README.md) - Project overview
- [../tests/README.md](../tests/README.md) - Testing documentation
- [../logs/README.md](../logs/README.md) - Logging structure

## 📝 Documentation Guidelines

1. **Keep docs current**: Update documentation when making changes
2. **Use clear structure**: Follow the established category organization
3. **Archive outdated content**: Move obsolete docs to archive/ folder
4. **Link related content**: Cross-reference related documentation
5. **Include examples**: Provide concrete examples where possible
`;

  fs.writeFileSync(path.join(DOCS_DIR, 'README.md'), docsReadme);
  console.log('📝 Created comprehensive docs README.md');
}

// Self-executing if run directly
if (require.main === module) {
  consolidateDocs().catch(console.error);
}

module.exports = { consolidateDocs };