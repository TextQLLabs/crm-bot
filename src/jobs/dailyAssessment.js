const { ClaudeAgent } = require('../services/claudeAgent');
const { advancedSearch } = require('../services/attioService');
const { App } = require('@slack/bolt');

/**
 * Daily Deal Assessment Cron Job
 * 
 * Automatically runs daily at 8:00 AM to assess all deals in "Goal: Get to Financing" stage.
 * Each deal is processed one by one with a 10-minute wait between assessments.
 * 
 * Features:
 * - Finds all deals in "Goal: Get to Financing" stage using advanced_search
 * - Iterates through each deal sequentially
 * - Sends assessment request directly to Claude agent (not via Slack)
 * - Waits 10 minutes between each deal assessment
 * - Handles errors gracefully and continues processing other deals
 * - Comprehensive logging for monitoring and debugging
 */

class DailyAssessmentJob {
  constructor(slackClient = null) {
    this.claudeAgent = new ClaudeAgent();
    this.targetStage = "Goal: Get to Financing";
    this.waitTimeBetweenDeals = 2 * 60 * 1000; // 2 minutes in milliseconds (fallback only)
    this.useCompletionChaining = true; // Use completion-based chaining instead of fixed delays
    this.isRunning = false;
    this.currentRun = null;
    this.slackClient = slackClient;
    this.testChannelId = 'C0946T1T4CB'; // #crm-bot-test channel ID
  }

  /**
   * Main entry point for the daily assessment job
   */
  async run() {
    if (this.isRunning) {
      console.log('Daily assessment job is already running, skipping this execution');
      return {
        success: false,
        reason: 'Job already running',
        timestamp: new Date().toISOString()
      };
    }

    this.isRunning = true;
    const startTime = new Date();
    
    console.log(`\n=== Daily Deal Assessment Job Started ===`);
    console.log(`Start Time: ${startTime.toISOString()}`);
    console.log(`Target Stage: "${this.targetStage}"`);
    const waitTimeSeconds = this.waitTimeBetweenDeals / 1000;
    if (waitTimeSeconds >= 60) {
      console.log(`Wait Time Between Deals: ${waitTimeSeconds / 60} minutes`);
    } else {
      console.log(`Wait Time Between Deals: ${waitTimeSeconds} seconds`);
    }

    this.currentRun = {
      startTime,
      totalDeals: 0,
      processedDeals: 0,
      successfulAssessments: 0,
      failedAssessments: 0,
      errors: [],
      dealResults: []
    };

    try {
      // Step 1: Find all deals in target stage
      const deals = await this.findTargetDeals();
      
      if (!deals || deals.length === 0) {
        console.log('No deals found in target stage');
        this.currentRun.totalDeals = 0;
        // Post start notification even with no deals
        await this.postStartNotification(0);
        return this.finishRun();
      }

      this.currentRun.totalDeals = deals.length;
      console.log(`Found ${deals.length} deals in "${this.targetStage}" stage`);
      
      // Post start notification to Slack
      await this.postStartNotification(deals.length);

      // Step 2: Process each deal sequentially with delays
      for (let i = 0; i < deals.length; i++) {
        const deal = deals[i];
        console.log(`\n--- Processing Deal ${i + 1}/${deals.length}: ${deal.name} ---`);

        try {
          // Capture current values before assessment
          const beforeValues = await this.captureDealValues(deal.id);
          
          // Generate assessment prompt for this deal
          const assessmentPrompt = this.generateAssessmentPrompt(deal);
          
          // Process with Claude agent directly
          const result = await this.processDealAssessment(deal, assessmentPrompt);
          
          // Capture values after assessment to calculate changes
          const afterValues = await this.captureDealValues(deal.id);
          const changes = this.calculateChanges(beforeValues, afterValues);
          
          this.currentRun.dealResults.push({
            dealId: deal.id,
            dealName: deal.name,
            success: result.success,
            timestamp: new Date().toISOString(),
            result: result.success ? result.answer : result.error,
            toolsUsed: result.toolsUsed || [],
            beforeValues,
            afterValues,
            changes,
            noteUrl: this.extractNoteUrl(result)
          });

          if (result.success) {
            this.currentRun.successfulAssessments++;
            console.log(`✅ Successfully processed assessment for ${deal.name}`);
          } else {
            this.currentRun.failedAssessments++;
            console.log(`❌ Failed to process assessment for ${deal.name}: ${result.error}`);
            this.currentRun.errors.push({
              dealId: deal.id,
              dealName: deal.name,
              error: result.error,
              timestamp: new Date().toISOString()
            });
          }

        } catch (error) {
          console.error(`Error processing deal ${deal.name}:`, error);
          this.currentRun.failedAssessments++;
          this.currentRun.errors.push({
            dealId: deal.id,
            dealName: deal.name,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }

        this.currentRun.processedDeals++;

        // Post heartbeat update
        await this.postHeartbeat(i + 1, deals.length, deal.name);

        // Use completion-based chaining instead of fixed delays
        if (this.useCompletionChaining) {
          // Start next assessment immediately after completion
          if (i < deals.length - 1) {
            console.log(`✅ Assessment complete for ${deal.name}. Starting next deal immediately...`);
            // Small buffer to prevent API rate limiting
            await this.sleep(5000); // 5 seconds only
          }
        } else {
          // Fallback to fixed delays if needed
          if (i < deals.length - 1) {
            const waitTimeSeconds = this.waitTimeBetweenDeals / 1000;
            if (waitTimeSeconds >= 60) {
              console.log(`Waiting ${waitTimeSeconds / 60} minutes before next deal...`);
            } else {
              console.log(`Waiting ${waitTimeSeconds} seconds before next deal...`);
            }
            await this.sleep(this.waitTimeBetweenDeals);
          }
        }
      }

      const result = this.finishRun();
      
      // Post Slack summary after job completion
      if (this.slackClient) {
        await this.postAssessmentSummary(result);
      }
      
      return result;

    } catch (error) {
      console.error('Critical error in daily assessment job:', error);
      this.currentRun.errors.push({
        type: 'critical',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      const result = this.finishRun();
      
      // Post Slack summary even on failure
      if (this.slackClient) {
        await this.postAssessmentSummary(result);
      }
      
      return result;
    }
  }

  /**
   * Find all deals in the target stage using advanced_search
   */
  async findTargetDeals() {
    try {
      console.log(`Searching for deals in stage: "${this.targetStage}"`);
      
      const searchOptions = {
        entity_type: 'deal',
        filters: {
          stage: this.targetStage
        },
        limit: 100, // Adjust limit as needed
        sort_by: 'created_at',
        sort_order: 'desc'
      };

      const deals = await advancedSearch(searchOptions);
      
      console.log(`Advanced search returned ${deals.length} deals`);
      
      // Log deal details for transparency
      if (deals.length > 0) {
        console.log('Found deals:');
        deals.forEach((deal, index) => {
          console.log(`  ${index + 1}. ${deal.name} (ID: ${deal.id}) - Value: ${deal.value || 'N/A'}`);
        });
      }

      return deals;

    } catch (error) {
      console.error('Error finding target deals:', error);
      throw new Error(`Failed to find deals in stage "${this.targetStage}": ${error.message}`);
    }
  }

  /**
   * Capture current deal values before assessment
   */
  async captureDealValues(dealId) {
    try {
      const attioService = require('../services/attioService');
      const deal = await attioService.getEntityById('deal', dealId);
      
      if (!deal?.values) return null;
      
      return {
        close_probability: deal.values.close_probability?.[0]?.value || 0,
        year_1_run_rate_ev: deal.values.year_1_run_rate_ev?.[0]?.currency_value || 0,
        year_3_run_rate_ev_5: deal.values.year_3_run_rate_ev_5?.[0]?.currency_value || 0,
        year_1_run_rate_target: deal.values.year_1_run_rate_target?.[0]?.currency_value || 0,
        year_3_run_rate_target: deal.values.year_3_run_rate_target?.[0]?.currency_value || 0
      };
    } catch (error) {
      console.error(`Error capturing values for deal ${dealId}:`, error);
      return null;
    }
  }

  /**
   * Calculate changes between before and after values
   */
  calculateChanges(beforeValues, afterValues) {
    if (!beforeValues || !afterValues) return null;
    
    const changes = {};
    const fields = ['close_probability', 'year_1_run_rate_ev', 'year_3_run_rate_ev_5', 'year_1_run_rate_target', 'year_3_run_rate_target'];
    
    for (const field of fields) {
      const before = beforeValues[field] || 0;
      const after = afterValues[field] || 0;
      const delta = after - before;
      const percentChange = before !== 0 ? ((delta / before) * 100) : (after > 0 ? 100 : 0);
      
      changes[field] = {
        before,
        after,
        delta,
        percentChange: Math.round(percentChange * 10) / 10 // Round to 1 decimal
      };
    }
    
    return changes;
  }

  /**
   * Extract note URL from Claude agent result
   */
  extractNoteUrl(result) {
    if (!result.success || !result.answer) return null;
    
    // Look for note URLs in the response
    const noteUrlMatch = result.answer.match(/https:\/\/app\.attio\.com\/textql-data\/[^\/]+\/record\/[^\/]+\/notes\?modal=note&id=([a-f0-9-]+)/);
    return noteUrlMatch ? noteUrlMatch[0] : null;
  }

  /**
   * Generate assessment prompt for a specific deal
   */
  generateAssessmentPrompt(deal) {
    return `Please provide a comprehensive assessment for the following deal that is currently in "Goal: Get to Financing" stage:

**Deal Details:**
- Deal Name: ${deal.name}
- Deal ID: ${deal.id}
- Deal Value: ${deal.value ? `$${deal.value.toLocaleString()}` : 'Not specified'}
- Company: ${deal.company_name || 'Not specified'}
- Stage: ${deal.stage}
- Created: ${deal.created_at || 'Not specified'}

**Assessment Requirements:**

Please conduct a thorough assessment of this deal and provide insights on:

1. **Current Status Analysis**
   - Review any existing notes and recent activity
   - Assess progress towards financing goals
   - Identify any blockers or challenges

2. **Financing Readiness**
   - Evaluate the deal's readiness for financing discussions
   - Assess required documentation and materials
   - Identify missing components needed for financing

3. **Next Steps Recommendations**
   - Suggest immediate action items
   - Recommend timeline for financing approach
   - Identify key stakeholders to engage

4. **Risk Assessment**
   - Highlight potential risks or concerns
   - Assess competitive landscape
   - Evaluate timing considerations

Please use the available CRM tools to:
- Get existing notes for this deal
- Review related company and contact information
- Create a comprehensive assessment note with your findings

Format your response with clear sections and actionable recommendations. Focus on practical next steps that can help move this deal closer to successful financing.`;
  }

  /**
   * Process deal assessment using Claude agent directly
   */
  async processDealAssessment(deal, assessmentPrompt) {
    try {
      console.log(`Sending assessment request to Claude agent for deal: ${deal.name}`);
      
      // Create message context for Claude agent
      const messageContext = {
        text: assessmentPrompt,
        userMessage: assessmentPrompt,
        userId: 'cron-job-system',
        channel: 'daily-assessment',
        threadTs: `daily-assessment-${Date.now()}`,
        conversationHistory: [],
        attachments: []
      };

      // Process with Claude agent
      const result = await this.claudeAgent.processMessage(messageContext);
      
      console.log(`Claude agent processing complete for ${deal.name}`);
      console.log(`Success: ${result.success}`);
      console.log(`Tools used: ${result.toolsUsed?.length || 0}`);
      
      return result;

    } catch (error) {
      console.error(`Error processing assessment for deal ${deal.name}:`, error);
      return {
        success: false,
        error: error.message,
        toolsUsed: []
      };
    }
  }

  /**
   * Finish the job run and generate summary
   */
  finishRun() {
    const endTime = new Date();
    const duration = endTime - this.currentRun.startTime;
    
    this.currentRun.endTime = endTime;
    this.currentRun.duration = duration;

    console.log(`\n=== Daily Deal Assessment Job Completed ===`);
    console.log(`End Time: ${endTime.toISOString()}`);
    console.log(`Duration: ${Math.round(duration / 1000 / 60)} minutes`);
    console.log(`Total Deals Found: ${this.currentRun.totalDeals}`);
    console.log(`Deals Processed: ${this.currentRun.processedDeals}`);
    console.log(`Successful Assessments: ${this.currentRun.successfulAssessments}`);
    console.log(`Failed Assessments: ${this.currentRun.failedAssessments}`);
    
    if (this.currentRun.errors.length > 0) {
      console.log(`\nErrors Encountered: ${this.currentRun.errors.length}`);
      this.currentRun.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.dealName || 'Unknown'}: ${error.error}`);
      });
    }

    const summary = {
      success: this.currentRun.failedAssessments === 0,
      jobCompleted: true,
      runSummary: {
        startTime: this.currentRun.startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMinutes: Math.round(duration / 1000 / 60),
        totalDeals: this.currentRun.totalDeals,
        processedDeals: this.currentRun.processedDeals,
        successfulAssessments: this.currentRun.successfulAssessments,
        failedAssessments: this.currentRun.failedAssessments,
        errors: this.currentRun.errors,
        dealResults: this.currentRun.dealResults
      }
    };

    this.isRunning = false;
    this.currentRun = null;

    return summary;
  }

  /**
   * Get current job status
   */
  getStatus() {
    if (!this.isRunning || !this.currentRun) {
      return {
        isRunning: false,
        message: 'No job currently running'
      };
    }

    const currentTime = new Date();
    const elapsedTime = currentTime - this.currentRun.startTime;

    return {
      isRunning: true,
      startTime: this.currentRun.startTime.toISOString(),
      elapsedTimeMinutes: Math.round(elapsedTime / 1000 / 60),
      totalDeals: this.currentRun.totalDeals,
      processedDeals: this.currentRun.processedDeals,
      successfulAssessments: this.currentRun.successfulAssessments,
      failedAssessments: this.currentRun.failedAssessments,
      currentProgress: this.currentRun.totalDeals > 0 ? 
        `${this.currentRun.processedDeals}/${this.currentRun.totalDeals} (${Math.round((this.currentRun.processedDeals / this.currentRun.totalDeals) * 100)}%)` :
        'Initializing...'
    };
  }

  /**
   * Test the job with a smaller subset (for development/testing)
   */
  async runTest(maxDeals = 2) {
    console.log(`\n=== Daily Assessment Job - TEST MODE ===`);
    console.log(`Max deals to process: ${maxDeals}`);
    
    const originalWaitTime = this.waitTimeBetweenDeals;
    // Use 30 seconds for testing to speed up the process
    this.waitTimeBetweenDeals = 30 * 1000; // 30 seconds for testing (much faster than 5 minutes)
    
    try {
      // Temporarily override the findTargetDeals method to limit results
      const originalMethod = this.findTargetDeals;
      this.findTargetDeals = async () => {
        const allDeals = await originalMethod.call(this);
        return allDeals.slice(0, maxDeals);
      };
      
      const result = await this.run();
      
      // Restore original method
      this.findTargetDeals = originalMethod;
      
      return result;
    } finally {
      this.waitTimeBetweenDeals = originalWaitTime;
    }
  }

  /**
   * Post daily assessment start notification to Slack
   */
  async postStartNotification(dealCount) {
    if (!this.slackClient || !this.testChannelId) {
      console.log('Slack client or channel ID not configured, skipping start notification');
      return;
    }

    try {
      console.log('Posting assessment start notification to Slack...');
      
      // Determine environment
      const environment = this.getEnvironment();
      const isTest = dealCount <= 2; // Assume test mode if 2 or fewer deals
      
      // Calculate expected completion time
      const expectedDurationMinutes = this.calculateExpectedDuration(dealCount);
      const expectedCompletionTime = new Date(Date.now() + expectedDurationMinutes * 60 * 1000);
      
      // Create formatted message
      const messageText = `🧪 Testing daily assessment run - processing ${dealCount} deals

🌍 Environment: ${environment}
⏱️ Expected completion: ${expectedCompletionTime.toLocaleTimeString()} (${expectedDurationMinutes} minutes)
📊 Deals to process: ${dealCount}
${isTest ? '🔬 Test Mode: Accelerated timing (30s between deals)' : this.useCompletionChaining ? '⚡ Completion-Based: Each deal starts when previous completes (+5s buffer)' : '⏳ Production Mode: 2 minutes between deals'}

Starting assessment process now...`;

      // Post to Slack
      await this.slackClient.chat.postMessage({
        channel: this.testChannelId,
        text: messageText,
        unfurl_links: false,
        unfurl_media: false
      });
      
      console.log('✅ Assessment start notification posted to Slack successfully');
      
    } catch (error) {
      console.error('❌ Failed to post assessment start notification to Slack:', error);
      // Don't throw error - notification failure shouldn't fail the whole job
    }
  }

  /**
   * Get current environment (dev/prod)
   */
  getEnvironment() {
    if (process.env.RAILWAY_ENVIRONMENT) {
      return `Railway (${process.env.RAILWAY_ENVIRONMENT})`;
    } else if (process.env.NODE_ENV === 'development') {
      return 'Local Development';
    } else {
      return 'Unknown';
    }
  }

  /**
   * Calculate expected duration based on deal count and wait times
   */
  calculateExpectedDuration(dealCount) {
    if (dealCount === 0) {
      return 1; // Just a few minutes for cleanup
    }
    
    // Estimate 3 minutes per deal processing
    const processingTimePerDeal = 3; // minutes
    
    if (this.useCompletionChaining) {
      // Completion-based: minimal wait time (5 seconds between deals)
      const bufferTimePerDeal = 5 / 60; // 5 seconds converted to minutes
      const totalProcessingTime = dealCount * processingTimePerDeal;
      const totalBufferTime = Math.max(0, dealCount - 1) * bufferTimePerDeal;
      
      return Math.ceil(totalProcessingTime + totalBufferTime);
    } else {
      // Fixed delay mode
      const waitTimeBetweenDeals = this.waitTimeBetweenDeals / (1000 * 60); // convert to minutes
      
      // Total time = (deal count * processing time) + ((deal count - 1) * wait time)
      const totalProcessingTime = dealCount * processingTimePerDeal;
      const totalWaitTime = Math.max(0, dealCount - 1) * waitTimeBetweenDeals;
      
      return Math.ceil(totalProcessingTime + totalWaitTime);
    }
  }

  /**
   * Post heartbeat update to show progress
   */
  async postHeartbeat(completed, total, currentDeal) {
    if (!this.slackClient || !this.testChannelId) return;

    try {
      const percentage = Math.round((completed / total) * 100);
      const progressBar = this.generateProgressBar(completed, total);
      
      const heartbeatMessage = `⚡ Assessment Progress: ${completed}/${total} (${percentage}%)
${progressBar}
🔄 Just completed: ${currentDeal}
${completed < total ? `⏭️ Next: Starting assessment ${completed + 1}` : '🏁 All assessments complete'}`;

      // Use thread or update message to avoid spam
      await this.slackClient.chat.postMessage({
        channel: this.testChannelId,
        text: heartbeatMessage,
        unfurl_links: false,
        unfurl_media: false
      });
      
    } catch (error) {
      console.error('Failed to post heartbeat:', error);
      // Don't throw - heartbeat failures shouldn't stop the job
    }
  }

  /**
   * Generate ASCII progress bar
   */
  generateProgressBar(current, total, length = 20) {
    const percentage = current / total;
    const filledLength = Math.round(length * percentage);
    const emptyLength = length - filledLength;
    
    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(emptyLength);
    
    return `[${filled}${empty}] ${Math.round(percentage * 100)}%`;
  }

  /**
   * Post assessment summary to Slack
   */
  async postAssessmentSummary(result) {
    if (!this.slackClient || !this.testChannelId) {
      console.log('Slack client or channel ID not configured, skipping summary post');
      return;
    }

    try {
      console.log('Posting assessment summary to Slack...');
      
      const summary = result.runSummary;
      const isTestMode = summary.totalDeals <= 2;
      const today = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      // Calculate top 3 biggest changes and pipeline impact
      const { topChanges, pipelineImpact, dealsUpdated } = this.analyzeAssessmentImpact(summary.dealResults);
      
      // Format biggest changes section
      let biggestChangesText = '';
      if (topChanges.length > 0) {
        biggestChangesText = topChanges.map(change => {
          const noteLink = change.noteUrl ? `<${change.noteUrl}|Assessment Note>` : 'Assessment Note';
          return `• ${change.dealName}: ${change.description} → ${noteLink}`;
        }).join('\n');
      } else {
        biggestChangesText = '• No significant changes detected';
      }
      
      // Format pipeline impact
      const pipelineText = pipelineImpact.totalDelta !== 0 
        ? `${pipelineImpact.totalDelta > 0 ? '+' : ''}$${Math.abs(pipelineImpact.totalDelta).toLocaleString()}K total (${pipelineImpact.y1Delta > 0 ? '+' : ''}$${Math.abs(pipelineImpact.y1Delta).toLocaleString()}K Y1 EV, ${pipelineImpact.y3Delta > 0 ? '+' : ''}$${Math.abs(pipelineImpact.y3Delta).toLocaleString()}K Y3 EV)`
        : 'No net pipeline value change';
      
      // Create formatted message
      const messageText = `🏁 ${isTestMode ? 'TEST - ' : ''}Assessment Complete for ${today}

🚀 Biggest Changes:
${biggestChangesText}

💰 Pipeline Impact: ${pipelineText}

📋 Deals Updated: ${dealsUpdated}`;
      
      // Post to Slack
      await this.slackClient.chat.postMessage({
        channel: this.testChannelId,
        text: messageText,
        unfurl_links: false,
        unfurl_media: false
      });
      
      console.log('✅ Assessment summary posted to Slack successfully');
      
    } catch (error) {
      console.error('❌ Failed to post assessment summary to Slack:', error);
      // Don't throw error - summary posting failure shouldn't fail the whole job
    }
  }

  /**
   * Analyze assessment impact to find biggest changes and pipeline value changes
   */
  analyzeAssessmentImpact(dealResults) {
    const allChanges = [];
    let totalY1Delta = 0;
    let totalY3Delta = 0;
    const updatedDeals = [];
    
    // Process each deal's changes
    for (const deal of dealResults) {
      if (!deal.success || !deal.changes) continue;
      
      updatedDeals.push(deal.dealName);
      
      // Track pipeline value changes
      totalY1Delta += (deal.changes.year_1_run_rate_ev?.delta || 0);
      totalY3Delta += (deal.changes.year_3_run_rate_ev_5?.delta || 0);
      
      // Find the most significant change for this deal
      const dealChanges = [];
      
      // Probability changes
      if (Math.abs(deal.changes.close_probability?.percentChange || 0) >= 5) {
        const change = deal.changes.close_probability;
        dealChanges.push({
          dealName: deal.dealName,
          type: 'probability',
          magnitude: Math.abs(change.percentChange),
          description: `${change.percentChange > 0 ? '+' : ''}${change.percentChange}% probability (${change.before}% → ${change.after}%)`,
          noteUrl: deal.noteUrl
        });
      }
      
      // EV changes (convert from cents to thousands)
      if (Math.abs(deal.changes.year_1_run_rate_ev?.delta || 0) >= 100000) { // $1K+ change
        const change = deal.changes.year_1_run_rate_ev;
        const deltaK = Math.round(change.delta / 100000); // Convert cents to $K
        dealChanges.push({
          dealName: deal.dealName,
          type: 'y1_ev',
          magnitude: Math.abs(deltaK),
          description: `${deltaK > 0 ? '+' : ''}$${Math.abs(deltaK)}K Year 1 EV`,
          noteUrl: deal.noteUrl
        });
      }
      
      if (Math.abs(deal.changes.year_3_run_rate_ev_5?.delta || 0) >= 100000) { // $1K+ change
        const change = deal.changes.year_3_run_rate_ev_5;
        const deltaK = Math.round(change.delta / 100000); // Convert cents to $K
        dealChanges.push({
          dealName: deal.dealName,
          type: 'y3_ev',
          magnitude: Math.abs(deltaK),
          description: `${deltaK > 0 ? '+' : ''}$${Math.abs(deltaK)}K Year 3 EV`,
          noteUrl: deal.noteUrl
        });
      }
      
      // Add the biggest change for this deal
      if (dealChanges.length > 0) {
        const biggestChange = dealChanges.sort((a, b) => b.magnitude - a.magnitude)[0];
        allChanges.push(biggestChange);
      }
    }
    
    // Get top 3 changes overall
    const topChanges = allChanges
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, 3);
    
    return {
      topChanges,
      pipelineImpact: {
        totalDelta: Math.round((totalY1Delta + totalY3Delta) / 100000), // Convert to $K
        y1Delta: Math.round(totalY1Delta / 100000),
        y3Delta: Math.round(totalY3Delta / 100000)
      },
      dealsUpdated: updatedDeals.length > 0 ? updatedDeals.join(', ') : 'None'
    };
  }

  /**
   * Set Slack client for posting summaries
   */
  setSlackClient(slackClient) {
    this.slackClient = slackClient;
  }

  /**
   * Utility method to sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { DailyAssessmentJob };