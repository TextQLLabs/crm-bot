# CRM Bot Documentation

## 📁 Directory Structure

### 📅 `daily-logs/`
**Date-based session logs and migration records**
- `2025-07-17_socket-to-http-migration.md` - Socket Mode → HTTP Mode migration
- `2025-07-16_railway-deployment.md` - Railway deployment session
- `2025-07-16_system-prompts.md` - System prompt improvements
- `2025-07-15_search-improvements.md` - Search functionality enhancements

### 📚 `general-docs/`
**Core documentation and guides**
- `ARCHITECTURE.md` - System architecture overview
- `ATTIO_API.md` - Attio CRM API integration
- `SETUP_INSTRUCTIONS.md` - Initial setup guide
- `TESTING_STRATEGY.md` - Testing approach and methods
- `ENVIRONMENT_VARIABLES.md` - Environment configuration
- `DEVELOPMENT_WORKFLOW.md` - Development process
- `DEBUGGING_METHODOLOGY.md` - Debugging approaches
- `AUTOMATED_DEAL_ASSESSMENT_STATUS.md` - Deal assessment feature
- `DAILY_ASSESSMENT_CRON.md` - Cron job configuration
- `DEV_BOT_ID.md` - Development bot information
- `LOCAL_TESTING.md` - Local testing procedures
- `NOTE_MANAGEMENT.md` - Note management features
- `delete-note-feature.md` - Note deletion functionality
- `multimodal-support.md` - Image and file handling
- `slack-image-integration.md` - Slack image processing
- `slack-mcp-crm-bot-context.md` - MCP integration context

### 🗄️ `archived-docs/`
**Historical and legacy documentation**
- `ANTI_PATTERNS.md` - Code anti-patterns to avoid
- `MIGRATION.md` - Previous migration notes
- `MONGODB_SETUP.md` - MongoDB configuration (legacy)
- `NEXT_STEPS.md` - Historical next steps
- `PERFORMANCE_OPTIMIZATION.md` - Performance notes
- `PRODUCTION_INCIDENT_RESPONSE.md` - Incident response procedures
- `RAILWAY_DEPLOYMENT.md` - Railway deployment notes
- `SECURITY_TOKEN_MANAGEMENT.md` - Token management
- `SLACK_INTEGRATION_PATTERNS.md` - Slack integration patterns
- `TROUBLESHOOTING_INVALID_BLOCKS.md` - Troubleshooting guide

### 📋 `archive/`
**System-generated archives**
- `REORGANIZATION_SUMMARY.md` - Previous reorganization notes
- `SESSION_CONTEXT.md` - Session context information

### 🔐 `credentials/`
**Credential documentation**
- `slack-app-info.md` - Slack app configuration details

## 🚀 Quick Start

1. **Setup**: Read `general-docs/SETUP_INSTRUCTIONS.md`
2. **Architecture**: Review `general-docs/ARCHITECTURE.md`
3. **Latest Changes**: Check `daily-logs/` for recent updates
4. **Development**: Follow `general-docs/DEVELOPMENT_WORKFLOW.md`

## 📈 Recent Updates

### July 17, 2025 - Socket Mode to HTTP Mode Migration
- **Status**: ✅ Completed Successfully
- **Impact**: Production now uses HTTP webhooks for improved reliability
- **Details**: See `daily-logs/2025-07-17_socket-to-http-migration.md`

### July 16, 2025 - Railway Deployment & System Prompts
- **Railway**: Deployment configuration optimized
- **System Prompts**: Enhanced bot behavior and responses
- **Details**: See respective files in `daily-logs/`

### July 15, 2025 - Search Improvements
- **Search**: Enhanced search functionality and performance
- **Details**: See `daily-logs/2025-07-15_search-improvements.md`

## 🛠️ Current Status

- **Production Environment**: Railway HTTP Mode ✅
- **Development Environment**: Socket Mode (with warnings) ✅
- **Bot Functionality**: Fully operational ✅
- **Cron Jobs**: Supported and working ✅

## 📞 Support

For questions or issues:
1. Check `daily-logs/` for recent changes
2. Review `archived-docs/TROUBLESHOOTING_INVALID_BLOCKS.md`
3. Consult `general-docs/DEBUGGING_METHODOLOGY.md`

## 🔗 Related Documentation

- [../CLAUDE.md](../CLAUDE.md) - Project context and instructions
- [../CHANGELOG.md](../CHANGELOG.md) - Version history and changes
- [../README.md](../README.md) - Project overview
- [../tests/README.md](../tests/README.md) - Testing documentation
- [../logs/README.md](../logs/README.md) - Logging structure

---

*Documentation last updated: July 17, 2025*
