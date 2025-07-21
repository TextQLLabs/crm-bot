# CRM Bot Specification

## 1. Product Overview

### Purpose
Automate CRM updates from Slack conversations in the #gtm channel, reducing manual data entry and ensuring all customer interactions are captured in Attio.

### Target Users
- Sales team members
- Customer Success managers
- Account Executives
- GTM leadership

## 2. User Experience Flows

### Flow 1: Mention Bot with Deal Update
```
User: @crm-bot Just had a great call with Acme Corp. They're interested in the Enterprise plan. Budget is $50k/year.

Bot: ✅ Updated Deal: Acme Corp - Enterprise Plan
- Added note about call and interest
- Updated deal value to $50,000
- Stage moved to "Negotiation"
[View in Attio →]
```

### Flow 2: Mention Bot with Company Update
```
User: @crm-bot Met the new CTO at TechCo, Sarah Johnson. She's replacing Mike Smith who left last month.

Bot: ✅ Updated Company: TechCo
- Added Sarah Johnson as CTO contact
- Marked Mike Smith as former employee
- Created note about leadership change
[View in Attio →]
```

### Flow 3: Attach Screenshot
```
User: @crm-bot Customer sent this pricing comparison [screenshot.png]

Bot: ✅ Added to Deal: Customer ABC
- Uploaded screenshot to timeline
- Created note: "Pricing comparison from customer"
- Tagged as "Competitive Intelligence"
[View in Attio →]
```

### Flow 4: Ambiguous Company Reference
```
User: @crm-bot Spoke with the Microsoft team about renewal

Bot: 🤔 Found multiple matches for "Microsoft":
1. Microsoft Corp (Enterprise Deal - $500k)
2. Microsoft Azure Team (Cloud Deal - $200k)
3. Microsoft 365 Division (License Deal - $100k)

Reply with the number to update, or provide more context.
```

### Flow 5: Auto-Create New Entry
```
User: @crm-bot New lead from Startup XYZ, they need our solution ASAP

Bot: ✅ Created New Company: Startup XYZ
- Added to "New Leads" list
- Created note about urgent need
- Assigned to you
[View in Attio →]
```

## 3. Bot Commands

### Supported Patterns
- `@crm-bot [update message]` - Process update
- `@crm-bot status [company/deal name]` - Get current status
- `@crm-bot create deal [details]` - Explicitly create deal
- `@crm-bot add note [company] [note]` - Add note to specific record
- `@crm-bot find [search term]` - Search Attio records

### Natural Language Processing
The bot understands:
- Company/deal names (fuzzy matching)
- Action verbs (met, called, emailed, signed, closed)
- Deal stages (interested, negotiating, closed won/lost)
- Monetary values ($50k, 50000, fifty thousand)
- Time references (today, yesterday, last week)

## 4. Technical Requirements

### Performance
- Response time: < 3 seconds
- Uptime: 99.9% (Cloudflare Workers)
- Message processing: Real-time
- Concurrent requests: 100+

### Data Handling
- Message history: 90 days
- Attachment size: Up to 10MB
- Batch operations: Up to 10 updates per message
- Cache refresh: Every 5 minutes

### Integration Points
1. **Slack**
   - Event subscriptions (app_mention, message.im)
   - Socket mode for real-time
   - File upload API

2. **Attio**
   - Objects: Companies, People, Deals
   - Operations: Create, Read, Update
   - Attachments: Notes with files
   - Search: Full-text search

3. **File-based Storage**
   - Files: messages.json, cache.json, errors.json
   - Indexes: timestamp, company_id, user_id
   - Rotation: 90 days for messages

### Security & Compliance
- All secrets in environment variables
- Slack signature verification
- API rate limiting (100 req/min)
- No PII in logs
- GDPR compliant data handling

## 5. Error Handling

### User-Facing Errors
- "I couldn't find that company/deal. Try being more specific."
- "I'm having trouble connecting to Attio. Please try again."
- "That file is too large. Maximum size is 10MB."

### System Errors
- Retry with exponential backoff
- Dead letter queue for failed messages
- Alert admins for critical failures
- Graceful degradation

## 6. Deployment & Monitoring

### Environments
- Development: Local with ngrok
- Staging: Cloudflare Workers (staging subdomain)
- Production: Cloudflare Workers (production)

### Metrics to Track
- Messages processed/day
- Average response time
- Error rate
- Most active users
- Most updated companies/deals

### Alerts
- Error rate > 5%
- Response time > 5 seconds
- File system access failure
- API quota warnings

## 7. Future Enhancements
- [ ] Bulk updates from CSV
- [ ] Scheduled reports
- [ ] Two-way sync (Attio → Slack notifications)
- [ ] Voice memo transcription
- [ ] Meeting note extraction
- [ ] Email forwarding integration