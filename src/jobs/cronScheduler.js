const { DailyAssessmentJob } = require('./dailyAssessment');

/**
 * Cron Scheduler for Daily Deal Assessments
 * 
 * Manages the scheduling and execution of daily deal assessment jobs.
 * Designed to run on Railway with proper error handling and logging.
 * 
 * Features:
 * - Runs daily at 8:00 AM (configurable timezone)
 * - Prevents overlapping job executions
 * - Comprehensive logging and error handling
 * - Health check endpoint for monitoring
 * - Manual trigger capability for testing
 */

class CronScheduler {
  constructor(slackClient = null) {
    this.slackClient = slackClient;
    this.dailyAssessmentJob = new DailyAssessmentJob(slackClient);
    this.scheduledJobs = new Map();
    this.jobHistory = [];
    this.maxHistoryEntries = 30; // Keep last 30 job runs
    
    // Configuration
    this.config = {
      // Default to 8:00 AM in EST (UTC-5), adjust for your timezone
      dailyRunHour: parseInt(process.env.DAILY_ASSESSMENT_HOUR) || 8,
      dailyRunMinute: parseInt(process.env.DAILY_ASSESSMENT_MINUTE) || 0,
      timezone: process.env.TIMEZONE || 'America/New_York',
      enabled: process.env.DAILY_ASSESSMENT_ENABLED !== 'false'
    };
    
    console.log('CronScheduler initialized with config:', this.config);
  }

  /**
   * Start the cron scheduler
   */
  start() {
    if (!this.config.enabled) {
      console.log('Daily assessment cron is disabled via DAILY_ASSESSMENT_ENABLED=false');
      return;
    }

    console.log('Starting CronScheduler...');
    console.log(`Daily assessments scheduled for ${this.config.dailyRunHour}:${this.config.dailyRunMinute.toString().padStart(2, '0')} ${this.config.timezone}`);
    
    // Schedule the daily job
    this.scheduleDailyAssessment();
    
    // Set up interval to check for scheduled jobs (every minute)
    setInterval(() => {
      this.checkScheduledJobs();
    }, 60000); // 60 seconds
    
    console.log('CronScheduler started successfully');
  }

  /**
   * Schedule the daily assessment job
   */
  scheduleDailyAssessment() {
    const jobId = 'daily-assessment';
    
    this.scheduledJobs.set(jobId, {
      id: jobId,
      name: 'Daily Deal Assessment',
      hour: this.config.dailyRunHour,
      minute: this.config.dailyRunMinute,
      timezone: this.config.timezone,
      handler: () => this.runDailyAssessment(),
      lastRun: null,
      nextRun: this.getNextRunTime(this.config.dailyRunHour, this.config.dailyRunMinute),
      enabled: true
    });
    
    console.log(`Scheduled daily assessment job for ${this.config.dailyRunHour}:${this.config.dailyRunMinute.toString().padStart(2, '0')}`);
    console.log(`Next run: ${this.scheduledJobs.get(jobId).nextRun.toISOString()}`);
  }

  /**
   * Check if any scheduled jobs should run
   */
  checkScheduledJobs() {
    const now = new Date();
    
    for (const [jobId, job] of this.scheduledJobs) {
      if (!job.enabled) continue;
      
      // Check if it's time to run this job
      if (now >= job.nextRun) {
        console.log(`\n=== Triggering scheduled job: ${job.name} ===`);
        console.log(`Scheduled time: ${job.nextRun.toISOString()}`);
        console.log(`Actual time: ${now.toISOString()}`);
        
        this.executeJob(job);
      }
    }
  }

  /**
   * Execute a scheduled job
   */
  async executeJob(job) {
    const startTime = new Date();
    
    try {
      console.log(`Starting job execution: ${job.name}`);
      
      // Update job status
      job.lastRun = startTime;
      job.nextRun = this.getNextRunTime(job.hour, job.minute);
      
      // Execute the job handler
      const result = await job.handler();
      
      const endTime = new Date();
      const duration = endTime - startTime;
      
      // Record in history
      this.addToHistory({
        jobId: job.id,
        jobName: job.name,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: Math.round(duration / 1000 / 60), // minutes
        success: result.success,
        result: result
      });
      
      console.log(`Job completed: ${job.name}`);
      console.log(`Duration: ${Math.round(duration / 1000 / 60)} minutes`);
      console.log(`Success: ${result.success}`);
      console.log(`Next run: ${job.nextRun.toISOString()}`);
      
    } catch (error) {
      console.error(`Job execution failed: ${job.name}`, error);
      
      // Record failed execution in history
      this.addToHistory({
        jobId: job.id,
        jobName: job.name,
        startTime: startTime.toISOString(),
        endTime: new Date().toISOString(),
        duration: Math.round((Date.now() - startTime) / 1000 / 60),
        success: false,
        error: error.message,
        result: null
      });
      
      // Schedule next run anyway
      job.nextRun = this.getNextRunTime(job.hour, job.minute);
      console.log(`Next run scheduled despite error: ${job.nextRun.toISOString()}`);
    }
  }

  /**
   * Run the daily assessment job
   */
  async runDailyAssessment() {
    console.log('Executing daily deal assessment job...');
    
    try {
      const result = await this.dailyAssessmentJob.run();
      return result;
    } catch (error) {
      console.error('Daily assessment job failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Manually trigger the daily assessment job (for testing)
   */
  async triggerDailyAssessment() {
    console.log('Manually triggering daily assessment job...');
    
    if (this.dailyAssessmentJob.isRunning) {
      return {
        success: false,
        error: 'Daily assessment job is already running',
        timestamp: new Date().toISOString()
      };
    }
    
    return await this.runDailyAssessment();
  }

  /**
   * Run a test version of the daily assessment job
   */
  async triggerTestAssessment(maxDeals = 2) {
    console.log(`Manually triggering test assessment job (max ${maxDeals} deals)...`);
    
    if (this.dailyAssessmentJob.isRunning) {
      return {
        success: false,
        error: 'Daily assessment job is already running',
        timestamp: new Date().toISOString()
      };
    }
    
    try {
      const result = await this.dailyAssessmentJob.runTest(maxDeals);
      return result;
    } catch (error) {
      console.error('Test assessment job failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get next run time for a daily job
   */
  getNextRunTime(hour, minute) {
    const now = new Date();
    const nextRun = new Date();
    
    nextRun.setHours(hour, minute, 0, 0);
    
    // If the time has already passed today, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    return nextRun;
  }

  /**
   * Add execution to history
   */
  addToHistory(entry) {
    this.jobHistory.unshift(entry); // Add to beginning
    
    // Keep only the most recent entries
    if (this.jobHistory.length > this.maxHistoryEntries) {
      this.jobHistory = this.jobHistory.slice(0, this.maxHistoryEntries);
    }
  }

  /**
   * Get scheduler status and statistics
   */
  getStatus() {
    const scheduledJobsStatus = Array.from(this.scheduledJobs.values()).map(job => ({
      id: job.id,
      name: job.name,
      enabled: job.enabled,
      lastRun: job.lastRun?.toISOString() || 'Never',
      nextRun: job.nextRun?.toISOString() || 'Not scheduled',
      schedule: `${job.hour}:${job.minute.toString().padStart(2, '0')} ${job.timezone}`
    }));

    const recentHistory = this.jobHistory.slice(0, 5); // Last 5 executions

    return {
      scheduler: {
        enabled: this.config.enabled,
        timezone: this.config.timezone,
        currentTime: new Date().toISOString()
      },
      jobs: scheduledJobsStatus,
      currentJob: this.dailyAssessmentJob.getStatus(),
      recentHistory: recentHistory,
      totalHistoryEntries: this.jobHistory.length
    };
  }

  /**
   * Get detailed job history
   */
  getHistory(limit = 10) {
    return {
      history: this.jobHistory.slice(0, limit),
      totalEntries: this.jobHistory.length,
      oldestEntry: this.jobHistory.length > 0 ? this.jobHistory[this.jobHistory.length - 1].startTime : null,
      newestEntry: this.jobHistory.length > 0 ? this.jobHistory[0].startTime : null
    };
  }

  /**
   * Enable or disable the daily assessment job
   */
  setDailyAssessmentEnabled(enabled) {
    const job = this.scheduledJobs.get('daily-assessment');
    if (job) {
      job.enabled = enabled;
      this.config.enabled = enabled;
      
      if (enabled && !job.nextRun) {
        job.nextRun = this.getNextRunTime(job.hour, job.minute);
      }
      
      console.log(`Daily assessment job ${enabled ? 'enabled' : 'disabled'}`);
      if (enabled) {
        console.log(`Next run: ${job.nextRun.toISOString()}`);
      }
      
      return { success: true, enabled, nextRun: enabled ? job.nextRun.toISOString() : null };
    }
    
    return { success: false, error: 'Daily assessment job not found' };
  }

  /**
   * Update the schedule for daily assessments
   */
  updateDailySchedule(hour, minute) {
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return { success: false, error: 'Invalid time format' };
    }
    
    const job = this.scheduledJobs.get('daily-assessment');
    if (job) {
      job.hour = hour;
      job.minute = minute;
      job.nextRun = this.getNextRunTime(hour, minute);
      
      this.config.dailyRunHour = hour;
      this.config.dailyRunMinute = minute;
      
      console.log(`Daily assessment schedule updated to ${hour}:${minute.toString().padStart(2, '0')}`);
      console.log(`Next run: ${job.nextRun.toISOString()}`);
      
      return { 
        success: true, 
        schedule: `${hour}:${minute.toString().padStart(2, '0')}`,
        nextRun: job.nextRun.toISOString()
      };
    }
    
    return { success: false, error: 'Daily assessment job not found' };
  }

  /**
   * Set or update the Slack client for the job
   */
  setSlackClient(slackClient) {
    this.slackClient = slackClient;
    if (this.dailyAssessmentJob) {
      this.dailyAssessmentJob.setSlackClient(slackClient);
    }
  }
}

module.exports = { CronScheduler };