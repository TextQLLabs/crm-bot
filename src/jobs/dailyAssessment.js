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
    this.waitTimeBetweenDeals = 10 * 60 * 1000; // 10 minutes in milliseconds
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
        return this.finishRun();
      }

      this.currentRun.totalDeals = deals.length;
      console.log(`Found ${deals.length} deals in "${this.targetStage}" stage`);

      // Step 2: Process each deal sequentially with delays
      for (let i = 0; i < deals.length; i++) {
        const deal = deals[i];
        console.log(`\n--- Processing Deal ${i + 1}/${deals.length}: ${deal.name} ---`);

        try {
          // Generate assessment prompt for this deal
          const assessmentPrompt = this.generateAssessmentPrompt(deal);
          
          // Process with Claude agent directly
          const result = await this.processDealAssessment(deal, assessmentPrompt);
          
          this.currentRun.dealResults.push({
            dealId: deal.id,
            dealName: deal.name,
            success: result.success,
            timestamp: new Date().toISOString(),
            result: result.success ? result.answer : result.error,
            toolsUsed: result.toolsUsed || []
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

        // Wait between deals (except after the last one)
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
      const isTestMode = summary.totalDeals <= 2; // Assume test mode if 2 or fewer deals
      
      // Generate deal results with Attio links
      let dealResultsText = '';
      if (summary.dealResults && summary.dealResults.length > 0) {
        dealResultsText = summary.dealResults.map(deal => {
          const status = deal.success ? '✅' : '❌';
          const attioLink = `https://app.attio.com/objects/deal/${deal.dealId}`;
          return `• ${deal.dealName} - ${deal.success ? 'Assessment updated' : 'Failed'} → <${attioLink}|View in Attio>`;
        }).join('\n');
      } else {
        dealResultsText = '• No deals processed';
      }
      
      // Create formatted message
      const messageText = `📊 ${isTestMode ? 'TEST - ' : ''}DAILY DEAL ASSESSMENT COMPLETE

${result.success ? '✅' : '❌'} ${summary.successfulAssessments}/${summary.totalDeals} deals processed successfully
⏱️ Total time: ${summary.durationMinutes} minutes

📋 Deals Updated:
${dealResultsText}

🎯 Next assessment: ${isTestMode ? 'On demand (test mode)' : 'Tomorrow 8:00 AM'}`;
      
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