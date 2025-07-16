# Daily Deal Assessment Cron Job

This document describes the automated daily deal assessment system implemented for the CRM Bot.

## Overview

The daily assessment system automatically evaluates all deals in the "Goal: Get to Financing" stage every day at 8:00 AM. It uses the Claude agent to provide comprehensive assessments of each deal's readiness for financing and suggests actionable next steps.

## Features

### 🕐 **Automated Scheduling**
- Runs daily at 8:00 AM (configurable timezone)
- Uses Railway's native cron job functionality
- Prevents overlapping executions
- Comprehensive logging and error handling

### 🎯 **Intelligent Processing**
- Finds all deals in "Goal: Get to Financing" stage using advanced_search
- Processes each deal sequentially with 10-minute delays
- Uses Claude agent directly (not via Slack)
- Generates comprehensive assessments with actionable recommendations

### 📊 **Robust Error Handling**
- Continues processing other deals if one fails
- Detailed error logging and reporting
- Graceful degradation and recovery
- Comprehensive job execution history

### 🔧 **Management & Monitoring**
- HTTP endpoints for job management
- Real-time status monitoring
- Manual trigger capability for testing
- Configurable schedule and settings

## Architecture

### Components

1. **DailyAssessmentJob** (`src/jobs/dailyAssessment.js`)
   - Core job logic
   - Deal finding and processing
   - Claude agent integration
   - Error handling and recovery

2. **CronScheduler** (`src/jobs/cronScheduler.js`)
   - Job scheduling and execution
   - Status tracking and history
   - HTTP endpoint integration
   - Configuration management

3. **Railway Cron Job** (`scripts/run-daily-assessment.js`)
   - Railway-specific execution script
   - Environment setup and error handling
   - Exit code management for Railway

### Data Flow

```
Railway Cron (8:00 AM) 
    ↓
run-daily-assessment.js
    ↓
CronScheduler.triggerDailyAssessment()
    ↓
DailyAssessmentJob.run()
    ↓
1. Find deals in "Goal: Get to Financing" stage
2. For each deal:
   - Generate assessment prompt
   - Process with Claude agent
   - Wait 10 minutes
   - Continue to next deal
3. Generate summary report
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DAILY_ASSESSMENT_ENABLED` | Enable/disable daily assessments | `true` |
| `DAILY_ASSESSMENT_HOUR` | Hour to run daily (0-23) | `8` |
| `DAILY_ASSESSMENT_MINUTE` | Minute to run daily (0-59) | `0` |
| `TIMEZONE` | Timezone for scheduling | `America/New_York` |

### Railway Configuration

The cron job is configured in `railway.json`:

```json
{
  "cron": [
    {
      "name": "daily-deal-assessment",
      "schedule": "0 8 * * *",
      "command": "node scripts/run-daily-assessment.js"
    }
  ]
}
```

**Schedule Format:** Standard cron format (minute hour day month weekday)
- `0 8 * * *` = Every day at 8:00 AM

## HTTP Endpoints

The following endpoints are available when the server is running:

### GET `/cron/status`
Get current cron scheduler status and job information.

**Response:**
```json
{
  "scheduler": {
    "enabled": true,
    "timezone": "America/New_York",
    "currentTime": "2025-07-16T14:30:00.000Z"
  },
  "jobs": [{
    "id": "daily-assessment",
    "name": "Daily Deal Assessment",
    "enabled": true,
    "lastRun": "2025-07-16T12:00:00.000Z",
    "nextRun": "2025-07-17T12:00:00.000Z",
    "schedule": "8:00 America/New_York"
  }],
  "currentJob": {
    "isRunning": false,
    "message": "No job currently running"
  },
  "recentHistory": [...],
  "totalHistoryEntries": 15
}
```

### GET `/cron/history?limit=10`
Get job execution history.

**Parameters:**
- `limit` (optional): Number of history entries to return (default: 10)

### POST `/cron/trigger-daily`
Manually trigger the daily assessment job.

**Response:**
```json
{
  "success": true,
  "jobCompleted": true,
  "runSummary": {
    "startTime": "2025-07-16T14:30:00.000Z",
    "endTime": "2025-07-16T15:45:00.000Z",
    "durationMinutes": 75,
    "totalDeals": 3,
    "processedDeals": 3,
    "successfulAssessments": 3,
    "failedAssessments": 0,
    "errors": [],
    "dealResults": [...]
  }
}
```

### POST `/cron/trigger-test?maxDeals=1`
Trigger a test assessment with limited deals.

**Parameters:**
- `maxDeals` (optional): Maximum number of deals to process (default: 1)

### PUT `/cron/schedule`
Update the daily assessment schedule.

**Request Body:**
```json
{
  "hour": 9,
  "minute": 30
}
```

### PUT `/cron/enabled`
Enable or disable daily assessments.

**Request Body:**
```json
{
  "enabled": false
}
```

## Testing

### Test Scripts

1. **Basic System Test:**
   ```bash
   npm run test:daily-assessment
   ```
   Tests environment, deal search, prompt generation, and scheduler initialization.

2. **Real Assessment Test:**
   ```bash
   npm run test:daily-assessment:real
   ```
   Runs a real assessment with 1 deal (requires confirmation).

3. **Manual Cron Execution:**
   ```bash
   npm run cron:daily
   ```
   Executes the same script that Railway runs.

### Test Safely

The system includes multiple safety mechanisms:

1. **Test Mode:** Limits processing to 1 deal with reduced wait times
2. **Status Checking:** Prevents overlapping job executions
3. **Error Isolation:** Failed deals don't stop processing of others
4. **Comprehensive Logging:** Detailed logs for debugging and monitoring

## Assessment Prompt Template

Each deal receives a comprehensive assessment prompt that includes:

### 1. **Deal Information**
- Deal name, ID, value, company, stage, creation date

### 2. **Assessment Requirements**
- Current status analysis
- Financing readiness evaluation
- Next steps recommendations
- Risk assessment

### 3. **Tool Instructions**
- Get existing notes for the deal
- Review related company and contact information
- Create a comprehensive assessment note

### 4. **Expected Output**
- Clear sections with actionable recommendations
- Practical next steps for financing approach
- Risk highlights and timing considerations

## Monitoring & Troubleshooting

### Log Locations

- **Railway Logs:** View via Railway dashboard or `railway logs`
- **Application Logs:** Console output includes detailed execution info
- **Job History:** Available via `/cron/history` endpoint

### Common Issues

1. **No Deals Found**
   - Check if any deals are in "Goal: Get to Financing" stage
   - Verify Attio API connectivity
   - Review advanced_search filters

2. **Claude Agent Errors**
   - Check ANTHROPIC_API_KEY validity
   - Verify API rate limits
   - Review prompt length and complexity

3. **Cron Job Not Running**
   - Check Railway cron job configuration
   - Verify environment variables in Railway
   - Check job status via endpoints

### Debugging Steps

1. **Test Locally:**
   ```bash
   npm run test:daily-assessment:real
   ```

2. **Check Status:**
   ```bash
   curl https://your-app.railway.app/cron/status
   ```

3. **Review History:**
   ```bash
   curl https://your-app.railway.app/cron/history
   ```

4. **Manual Trigger:**
   ```bash
   curl -X POST https://your-app.railway.app/cron/trigger-test?maxDeals=1
   ```

## Security Considerations

- **API Keys:** All sensitive credentials stored as Railway environment variables
- **Error Handling:** No sensitive information exposed in logs or responses
- **Rate Limiting:** 10-minute delays between deal assessments to respect API limits
- **Isolation:** Failed assessments don't impact other deals or system stability

## Performance

### Timing Estimates

- **Per Deal:** ~2-5 minutes assessment + 10 minutes wait = ~12-15 minutes total
- **5 Deals:** ~60-75 minutes total execution time
- **10 Deals:** ~120-150 minutes total execution time

### Resource Usage

- **Memory:** Minimal overhead, single-threaded execution
- **API Calls:** 1-3 Claude API calls per deal + Attio API calls
- **Network:** Sequential processing minimizes concurrent load

## Future Enhancements

Potential improvements for future versions:

1. **Configurable Assessment Templates** - Custom prompts per deal type
2. **Slack Notifications** - Summary reports posted to specific channels
3. **Assessment Scoring** - Numerical readiness scores for deals
4. **Custom Scheduling** - Per-deal or per-company assessment schedules
5. **Integration Webhooks** - External system notifications
6. **Dashboard UI** - Web interface for job management

## Deployment

The daily assessment system is automatically deployed with the main CRM Bot application. No additional deployment steps are required.

### Railway Deployment

1. **Automatic:** The cron job is configured in `railway.json` and will be automatically set up
2. **Environment Variables:** Ensure all required variables are set in Railway dashboard
3. **Monitoring:** Use Railway logs and the `/cron/status` endpoint to monitor execution

### Verification

After deployment, verify the system is working:

1. Check cron job status: `GET /cron/status`
2. Review next scheduled run time
3. Optional: Trigger a test run: `POST /cron/trigger-test`
4. Monitor Railway logs for execution confirmation

---

**Note:** This system is designed to be robust and self-healing. It will automatically handle most error conditions and continue processing. Regular monitoring via the provided endpoints is recommended to ensure optimal performance.