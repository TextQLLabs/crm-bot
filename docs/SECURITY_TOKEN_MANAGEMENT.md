# Security & Token Management

## Overview
This document outlines how we properly handle secrets and tokens in the CRM Bot project, following security best practices.

## Token Storage Strategy

### 1. Production Tokens
- **Storage**: Railway dashboard environment variables
- **Access**: Via Railway dashboard only (CLI is read-only)
- **Bot**: @crm-bot-ethan (U0944Q3F58B)
- **Security**: Never stored in git, only in Railway platform

### 2. Development Tokens  
- **Storage**: Local `.env.dev` file (git-ignored)
- **Access**: Available on Ethan's computer, recreate on other machines
- **Bot**: @crm-bot-ethan-dev (U0953GV1A8L)
- **Security**: Git-ignored, never committed

### 3. MCP Server Tokens
- **Storage**: Claude Code MCP configuration
- **Access**: `claude mcp get slack`
- **Bot**: @slack-mcp-textql-ethan (U0951TSB4P2)
- **Security**: Not stored in project files

## File Management

### Git-Ignored Files
```
.env
.env.dev
.env.local
.env.*.local
docs/DEV_BOT_ID.md
```

### Developer Setup

#### If you're on Ethan's computer
- `.env.dev` already exists with correct tokens
- `docs/DEV_BOT_ID.md` contains bot details

#### If you're on a different machine
```bash
# Copy template
cp .env.example .env.dev

# Get dev bot tokens from Slack app
# https://api.slack.com/apps/A0950KN8DPX

# Edit .env.dev with actual tokens
# File is automatically git-ignored
```

## Security Lessons Learned

### GitHub Push Protection
- GitHub blocks commits containing secrets
- Even removed secrets remain in git history
- Solution: Use git squash/rebase to create clean commits

### Emergency Response
If secrets are accidentally committed:

1. **Remove from current files**
   ```bash
   # Remove sensitive files from git tracking
   git rm --cached .env.dev
   ```

2. **Add to .gitignore**
   ```bash
   echo ".env.dev" >> .gitignore
   ```

3. **Clean git history**
   ```bash
   # Squash problematic commits
   git reset --soft HEAD~N
   git commit -m "Clean commit without secrets"
   ```

4. **Push clean history**
   ```bash
   git push
   ```

## Three Bot Configuration Summary

| Bot | User ID | Purpose | Token Storage |
|-----|---------|---------|---------------|
| @crm-bot-ethan | U0944Q3F58B | Production | Railway dashboard |
| @crm-bot-ethan-dev | U0953GV1A8L | Development | Local `.env.dev` |
| @slack-mcp-textql-ethan | U0951TSB4P2 | MCP testing | Claude MCP config |

## Best Practices

1. **Never commit secrets** - Always use `.gitignore`
2. **Use environment variables** - Never hardcode tokens
3. **Separate dev/prod** - Different tokens for different environments
4. **Document but don't expose** - Reference files without showing tokens
5. **Clean git history** - Remove accidental commits with secrets

## Related Documentation
- `/docs/DEV_BOT_ID.md` - Development bot details (git-ignored)
- `/.env.example` - Template for environment variables
- `/docs/LOCAL_DEVELOPMENT.md` - Local development setup guide