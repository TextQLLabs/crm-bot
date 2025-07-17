# Session Documentation

## How It Works
Each session gets its own file with a simple naming convention: `YYYY-MM-DD_topic-name.md`

## Session Status
- **ACTIVE**: Currently working on this
- **PAUSED**: Temporarily stopped, can resume
- **COMPLETED**: Finished and deployed

## File Format
```markdown
# Session: [Title]
**Date**: YYYY-MM-DD
**Status**: ACTIVE | PAUSED | COMPLETED
**Started**: HH:MM

## What We Did
- Bullet points of what happened

## Key Changes
- Technical changes made

## Next Steps (if active)
- [ ] Todo items

## Context Links
- Previous: filename.md
- Next: filename.md
```

## Current Sessions
- `2025-07-16_railway-deployment.md` - Railway testing (ACTIVE)
- `2025-07-16_system-prompts.md` - Note formatting (COMPLETED)
- `2025-07-15_search-improvements.md` - Search fixes (COMPLETED)

## Usage
Claude automatically updates these files and the Current Work section in CLAUDE.md as sessions progress.