// Dashboard with integrated API routes
const express = require('express');

function createDashboardRouter() {
  const router = express.Router();

  // API Routes
  router.get('/api/prompts/system', async (req, res) => {
    try {
      const { ClaudeAgent } = require('./services/claudeAgent');
      const agent = new ClaudeAgent();
      const systemPrompt = agent.buildSystemPrompt();
      
      res.json({
        type: 'system_prompt',
        content: systemPrompt,
        timestamp: new Date().toISOString(),
        source: 'src/services/claudeAgent.js:buildSystemPrompt()',
        lines: '407-607'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/prompts/assessment', async (req, res) => {
    try {
      const { DailyAssessmentJob } = require('./jobs/dailyAssessment');
      
      const sampleDeal = {
        id: 'sample-deal-id',
        name: 'Sample Deal',
        values: { 'Deal value': [{ value: 5000000 }] },
        company: { name: 'Sample Company' },
        stage: 'Goal: Get to Financing',
        created_at: new Date().toISOString()
      };
      
      const dailyAssessment = new DailyAssessmentJob();
      const assessmentPrompt = dailyAssessment.generateAssessmentPrompt(sampleDeal);
      
      res.json({
        type: 'assessment_prompt',
        content: assessmentPrompt,
        timestamp: new Date().toISOString(),
        source: 'src/jobs/dailyAssessment.js:generateAssessmentPrompt()',
        lines: '298-339'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/api/prompts/tools', async (req, res) => {
    try {
      const { ClaudeAgent } = require('./services/claudeAgent');
      const agent = new ClaudeAgent();
      const toolDefinitions = agent.getToolDefinitions();
      
      res.json({
        type: 'tool_definitions',
        content: toolDefinitions,
        timestamp: new Date().toISOString(),
        source: 'src/services/claudeAgent.js:getToolDefinitions()',
        lines: '691-1041',
        tool_count: toolDefinitions.length
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Cron status API
  router.get('/cron/status', (req, res) => {
    try {
      const cronManager = require('./cron/cronManager');
      const status = cronManager.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Trigger daily assessment
  router.post('/cron/trigger-daily', async (req, res) => {
    try {
      const { DailyAssessmentJob } = require('./jobs/dailyAssessment');
      const job = new DailyAssessmentJob();
      await job.run();
      res.json({ success: true, message: 'Daily assessment triggered successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Trigger test assessment
  router.post('/cron/trigger-test', async (req, res) => {
    try {
      const { DailyAssessmentJob } = require('./jobs/dailyAssessment');
      const job = new DailyAssessmentJob();
      await job.runTestAssessment();
      res.json({ success: true, message: 'Test assessment triggered successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Main dashboard route
  router.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CRM Bot Admin Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            background: #f3f4f6;
            color: #333;
            line-height: 1.6;
        }

        .container {
            min-height: 100vh;
            padding: 2rem;
        }

        /* Terminal Window */
        .terminal-window {
            max-width: 7xl;
            margin: 0 auto;
            background: white;
            border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            border: 1px solid #d1d5db;
        }

        /* Terminal Header */
        .terminal-header {
            background: #f3f4f6;
            padding: 0.5rem 1rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid #d1d5db;
        }

        .terminal-controls {
            display: flex;
            gap: 0.5rem;
        }

        .terminal-dot {
            width: 0.75rem;
            height: 0.75rem;
            border-radius: 50%;
        }

        .terminal-dot:nth-child(1) { background: #ef4444; }
        .terminal-dot:nth-child(2) { background: #eab308; }
        .terminal-dot:nth-child(3) { background: #22c55e; }

        .terminal-title {
            font-size: 0.875rem;
            color: #6b7280;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }

        .terminal-status {
            font-size: 0.75rem;
            color: #6b7280;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }

        .terminal-status .status-dot {
            color: #22c55e;
        }

        /* Terminal Content */
        .terminal-content {
            padding: 1.5rem;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.875rem;
        }

        /* Command Prompt */
        .command-prompt {
            margin-bottom: 1.5rem;
        }

        .prompt-symbol {
            color: #22c55e;
        }

        .command-text {
            color: #4b5563;
        }

        /* Module Sections */
        .module-section {
            background: #f9fafb;
            border: 1px solid #d1d5db;
            border-radius: 0.25rem;
            padding: 1rem;
            margin-bottom: 1.5rem;
        }

        .module-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1rem;
        }

        .module-title {
            display: flex;
            align-items: center;
        }

        .module-tag {
            color: #3b82f6;
            margin-right: 0.5rem;
        }

        .module-name {
            font-weight: 700;
        }

        .module-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 2rem;
            margin-bottom: 1rem;
        }

        .stat-item {
            text-align: center;
        }

        .stat-item:nth-child(2) {
            text-align: center;
        }

        .stat-item:nth-child(3) {
            text-align: right;
        }

        .stat-label {
            font-size: 0.75rem;
            color: #6b7280;
            margin-bottom: 0.25rem;
        }

        .stat-value {
            font-weight: 700;
            font-size: 1.125rem;
        }

        .module-controls {
            display: flex;
            gap: 0.75rem;
        }

        /* Buttons */
        .btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 0.25rem;
            cursor: pointer;
            font-size: 0.875rem;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }

        .btn-primary {
            background: #22c55e;
            color: white;
        }

        .btn-primary:hover {
            background: #16a34a;
        }

        .btn-warning {
            background: #f59e0b;
            color: white;
        }

        .btn-warning:hover {
            background: #d97706;
        }

        .btn-secondary {
            background: #3b82f6;
            color: white;
        }

        .btn-secondary:hover {
            background: #2563eb;
        }

        .btn-gray {
            background: #6b7280;
            color: white;
        }

        .btn-gray:hover {
            background: #4b5563;
        }

        /* Three Column Grid */
        .three-column-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
            margin-bottom: 1.5rem;
        }

        .column-item {
            background: #f9fafb;
            border: 1px solid #d1d5db;
            border-radius: 0.25rem;
            padding: 1rem;
        }

        .column-header {
            display: flex;
            align-items: center;
            margin-bottom: 0.75rem;
        }

        .column-tag {
            margin-right: 0.5rem;
        }

        .column-tag.purple { color: #8b5cf6; }
        .column-tag.blue { color: #3b82f6; }
        .column-tag.cyan { color: #06b6d4; }

        .column-title {
            font-weight: 700;
        }

        .column-description {
            font-size: 0.75rem;
            color: #6b7280;
            margin-bottom: 1rem;
            height: 3rem;
        }

        .column-button {
            width: 100%;
            padding: 0.5rem 0.75rem;
        }

        /* Cron Management */
        .cron-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1rem;
        }

        .cron-controls {
            display: flex;
            gap: 0.5rem;
        }

        .cron-info {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 2rem;
        }

        .cron-detail {
            font-size: 0.75rem;
            color: #6b7280;
        }

        .cron-value {
            margin-left: 0.5rem;
            font-weight: 700;
        }

        /* System Information */
        .system-info {
            background: #1f2937;
            color: #f3f4f6;
            border-radius: 0.25rem;
            padding: 1rem;
            margin-bottom: 1.5rem;
        }

        .system-header {
            display: flex;
            align-items: center;
            margin-bottom: 0.75rem;
        }

        .system-tag {
            color: #10b981;
            margin-right: 0.5rem;
        }

        .system-title {
            font-weight: 700;
        }

        .system-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            font-size: 0.75rem;
        }

        .system-item .system-label {
            color: #9ca3af;
            margin-bottom: 0.25rem;
        }

        .system-item .system-value {
            font-weight: 700;
        }

        .system-value.version { color: #60a5fa; }
        .system-value.agent { color: #f3f4f6; }
        .system-value.agent-sub { color: #9ca3af; }
        .system-value.env { color: #10b981; }
        .system-value.platform { color: #f3f4f6; }

        /* Footer */
        .terminal-footer {
            font-size: 0.75rem;
            color: #6b7280;
            text-align: center;
        }

        .footer-line {
            margin-bottom: 0.25rem;
        }

        .footer-line:last-child {
            margin-top: 0.5rem;
        }

        /* Content Viewer */
        .content-viewer {
            background: #f9fafb;
            border: 1px solid #d1d5db;
            border-radius: 0.25rem;
            padding: 2rem;
            margin-top: 2rem;
            display: none;
        }

        .content-viewer h3 {
            color: #1f2937;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #e5e7eb;
        }

        .content-viewer pre {
            background: #f3f4f6;
            padding: 1rem;
            border-radius: 0.25rem;
            overflow-x: auto;
            border: 1px solid #e5e7eb;
            font-size: 0.8rem;
            line-height: 1.4;
        }

        .loading {
            text-align: center;
            padding: 2rem;
            color: #6b7280;
        }

        .error {
            color: #dc2626;
            background: #fef2f2;
            padding: 1rem;
            border-radius: 0.25rem;
            margin: 1rem 0;
        }

        .meta {
            font-size: 0.75rem;
            color: #6b7280;
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid #e5e7eb;
        }

        /* Accordion styles */
        .accordion {
            margin-top: 1rem;
        }

        .accordion-item {
            border: 1px solid #e5e7eb;
            border-radius: 0.25rem;
            margin-bottom: 0.5rem;
            overflow: hidden;
        }

        .accordion-header {
            background: #f3f4f6;
            padding: 1rem;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            border-bottom: 1px solid #e5e7eb;
        }

        .accordion-header:hover {
            background: #f9fafb;
        }

        .accordion-header.active {
            background: #3b82f6;
            color: white;
        }

        .accordion-content {
            padding: 1rem;
            display: none;
            background: #f9f9f9;
            border-top: 1px solid #e5e7eb;
        }

        .accordion-content.active {
            display: block;
        }

        .accordion-icon {
            transition: transform 0.2s;
        }

        .accordion-icon.rotated {
            transform: rotate(180deg);
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Terminal Window -->
        <div class="terminal-window">
            <!-- Terminal Header -->
            <div class="terminal-header">
                <div class="terminal-controls">
                    <div class="terminal-dot"></div>
                    <div class="terminal-dot"></div>
                    <div class="terminal-dot"></div>
                </div>
                <div class="terminal-title">crm-bot-admin.log</div>
                <div class="terminal-status">
                    <span class="status-dot">●</span> Status: <span id="status">healthy (development)</span>
                </div>
            </div>
            
            <!-- Terminal Content -->
            <div class="terminal-content">
                <!-- Command Prompt -->
                <div class="command-prompt">
                    <span class="prompt-symbol">$</span> <span class="command-text">crm-bot admin --dashboard</span>
                </div>
                
                <!-- Daily Assessment - Main Control Panel -->
                <div class="module-section">
                    <div class="module-header">
                        <div class="module-title">
                            <span class="module-tag">[MODULE]</span>
                            <span class="module-name">Daily Assessment - Status & Controls</span>
                        </div>
                    </div>
                    
                    <div class="module-stats">
                        <div class="stat-item">
                            <div class="stat-label">Status</div>
                            <div class="stat-value" id="assessment-status">Idle</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Next Run</div>
                            <div class="stat-value" id="next-run">7/22/2025, 8:00:00 AM</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Last Run</div>
                            <div class="stat-value" id="last-run">Never</div>
                        </div>
                    </div>
                    
                    <div class="module-controls">
                        <button class="btn btn-primary" onclick="triggerAssessment()">
                            ✓ Run Assessment
                        </button>
                        <button class="btn btn-warning" onclick="triggerTestAssessment()">
                            ⚡ Test Run (2 deals)
                        </button>
                    </div>
                </div>
                
                <!-- Three Column Section -->
                <div class="three-column-grid">
                    <!-- System Prompt -->
                    <div class="column-item">
                        <div class="column-header">
                            <span class="column-tag purple">[PROMPT]</span>
                            <span class="column-title">System Prompt</span>
                        </div>
                        <p class="column-description">
                            View the main system prompt that powers the CRM Bot's behavior.
                        </p>
                        <button class="btn btn-secondary column-button" onclick="loadSystemPrompt()">
                            Load System Prompt
                        </button>
                    </div>
                    
                    <!-- Daily Assessment Prompt -->
                    <div class="column-item">
                        <div class="column-header">
                            <span class="column-tag blue">[PROMPT]</span>
                            <span class="column-title">Daily Assessment Prompt</span>
                        </div>
                        <p class="column-description">
                            View the daily assessment prompt template used for deal evaluations.
                        </p>
                        <button class="btn btn-secondary column-button" onclick="loadAssessmentPrompt()">
                            Load Assessment Prompt
                        </button>
                    </div>
                    
                    <!-- Tool Definitions -->
                    <div class="column-item">
                        <div class="column-header">
                            <span class="column-tag cyan">[TOOLS]</span>
                            <span class="column-title">Tool Definitions</span>
                        </div>
                        <p class="column-description">
                            View all available tools and their definitions.
                        </p>
                        <button class="btn btn-secondary column-button" onclick="loadToolDefinitions()">
                            Load Tool Definitions
                        </button>
                    </div>
                </div>
                
                <!-- Cron Management -->
                <div class="module-section">
                    <div class="cron-section">
                        <div class="module-title">
                            <span class="module-tag" style="color: #22c55e;">[CRON]</span>
                            <span class="module-name">Cron Management</span>
                        </div>
                        <div class="cron-controls">
                            <button class="btn btn-secondary" style="font-size: 0.75rem;">
                                Toggle Cron
                            </button>
                            <button class="btn btn-gray" style="font-size: 0.75rem;">
                                View History
                            </button>
                        </div>
                    </div>
                    
                    <div class="cron-info">
                        <div>
                            <span class="cron-detail">Timezone:</span>
                            <span class="cron-value">America/New_York</span>
                        </div>
                        <div>
                            <span class="cron-detail">Schedule:</span>
                            <span class="cron-value">8:00 America/New_York</span>
                        </div>
                    </div>
                </div>
                
                <!-- System Information -->
                <div class="system-info">
                    <div class="system-header">
                        <span class="system-tag">[SYSTEM]</span>
                        <span class="system-title">System Information</span>
                    </div>
                    <div class="system-grid">
                        <div class="system-item">
                            <div class="system-label">Version</div>
                            <div class="system-value version">1.12.0</div>
                        </div>
                        <div class="system-item">
                            <div class="system-label">Agent</div>
                            <div class="system-value agent">Claude Sonnet 4</div>
                            <div class="system-value agent-sub">(Native Tool Calling)</div>
                        </div>
                        <div class="system-item">
                            <div class="system-label">Environment</div>
                            <div class="system-value env" id="environment">Development</div>
                        </div>
                        <div class="system-item">
                            <div class="system-label">Platform</div>
                            <div class="system-value platform">Local</div>
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="terminal-footer">
                    <div class="footer-line">CRM Bot Admin Dashboard - Powered by Claude Sonnet 4</div>
                    <div class="footer-line" id="last-updated">Last updated: 7/21/2025, 10:52:36 AM</div>
                    <div class="footer-line">EOF</div>
                </div>
            </div>
        </div>

        <div class="content-viewer" id="contentViewer">
            <div id="content"></div>
        </div>
    </div>

    <script>
        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            checkHealth();
            loadAssessmentStatus();
        });

        async function loadAssessmentStatus() {
            try {
                const response = await fetch('/cron/status');
                const data = await response.json();
                
                // Update assessment status
                document.getElementById('assessment-status').textContent = 
                    data.currentJob && data.currentJob.isRunning ? 'Running' : 'Idle';
                
                if (data.jobs && data.jobs.length > 0) {
                    const job = data.jobs[0];
                    document.getElementById('next-run').textContent = 
                        new Date(job.nextRun).toLocaleString();
                    document.getElementById('last-run').textContent = 
                        job.lastRun !== 'Never' ? new Date(job.lastRun).toLocaleString() : 'Never';
                }
                
            } catch (error) {
                console.error('Error loading status:', error);
            }
        }

        async function triggerAssessment() {
            if (confirm('Are you sure you want to trigger the daily assessment?')) {
                try {
                    const response = await fetch('/cron/trigger-daily', { method: 'POST' });
                    const data = await response.json();
                    
                    if (data.success) {
                        showMessage('Assessment triggered successfully!', 'success');
                        loadAssessmentStatus();
                    } else {
                        showMessage('Error: ' + data.error, 'error');
                    }
                } catch (error) {
                    showMessage('Error triggering assessment: ' + error.message, 'error');
                }
            }
        }

        async function triggerTestAssessment() {
            if (confirm('Are you sure you want to trigger a test assessment (2 deals)?')) {
                try {
                    const response = await fetch('/cron/trigger-test', { method: 'POST' });
                    const data = await response.json();
                    
                    if (data.success) {
                        showMessage('Test assessment triggered successfully!', 'success');
                        loadAssessmentStatus();
                    } else {
                        showMessage('Error: ' + data.error, 'error');
                    }
                } catch (error) {
                    showMessage('Error triggering test assessment: ' + error.message, 'error');
                }
            }
        }

        function showMessage(message, type) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'error'; // Use error class for all messages since we only have error style
            messageDiv.textContent = message;
            messageDiv.style.position = 'fixed';
            messageDiv.style.top = '20px';
            messageDiv.style.right = '20px';
            messageDiv.style.zIndex = '1000';
            
            if (type === 'success') {
                messageDiv.style.background = '#e8f5e8';
                messageDiv.style.color = '#4CAF50';
            }
            
            document.body.appendChild(messageDiv);
            
            setTimeout(() => {
                messageDiv.remove();
            }, 5000);
        }

        // Auto-refresh status every 30 seconds
        setInterval(loadAssessmentStatus, 30000);

        async function checkHealth() {
            try {
                const response = await fetch('/health');
                const data = await response.json();
                document.getElementById('status').textContent = \`\${data.status} (\${data.environment})\`;
                document.getElementById('environment').textContent = data.environment || 'Development';
                document.getElementById('last-updated').textContent = \`Last updated: \${new Date().toLocaleString()}\`;
            } catch (error) {
                document.getElementById('status').textContent = 'error';
                document.getElementById('environment').textContent = 'Unknown';
            }
        }

        function showToolDefinitions(data) {
            const viewer = document.getElementById('contentViewer');
            const tabs = document.getElementById('tabs');
            const content = document.getElementById('content');

            tabs.innerHTML = '';
            
            let accordionHtml = '<div class="accordion">';
            data.content.forEach((tool, index) => {
                accordionHtml += \`
                    <div class="accordion-item">
                        <div class="accordion-header" onclick="toggleAccordion(\${index})">
                            <div>
                                <strong>\${tool.name}</strong>
                                <div style="font-size: 0.9em; color: #666; font-weight: normal; margin-top: 0.2rem;">
                                    \${tool.description || 'No description'}
                                </div>
                            </div>
                            <span class="accordion-icon" id="icon-\${index}">▼</span>
                        </div>
                        <div class="accordion-content" id="content-\${index}">
                            <div style="margin-bottom: 1rem;">
                                <strong>Function:</strong> \${tool.name}<br>
                                <strong>Description:</strong> \${tool.description || 'No description'}
                            </div>
                            <div style="margin-bottom: 1rem;">
                                <strong>Parameters:</strong>
                                <pre style="margin-top: 0.5rem; font-size: 0.9em;">\${JSON.stringify(tool.input_schema, null, 2)}</pre>
                            </div>
                        </div>
                    </div>
                \`;
            });
            accordionHtml += '</div>';
            
            content.innerHTML = \`
                <h3>Tool Definitions (\${data.tool_count} tools)</h3>
                \${accordionHtml}
                <div class="meta">
                    <strong>Source:</strong> \${data.source || 'Unknown'}<br>
                    \${data.lines ? \`<strong>Lines:</strong> \${data.lines}<br>\` : ''}
                    <strong>Timestamp:</strong> \${data.timestamp}
                </div>
            \`;

            viewer.style.display = 'block';
        }

        function toggleAccordion(index) {
            const content = document.getElementById(\`content-\${index}\`);
            const icon = document.getElementById(\`icon-\${index}\`);
            const header = icon.parentElement;
            
            if (content.classList.contains('active')) {
                content.classList.remove('active');
                icon.classList.remove('rotated');
                header.classList.remove('active');
            } else {
                content.classList.add('active');
                icon.classList.add('rotated');
                header.classList.add('active');
            }
        }

        async function loadSystemPrompt() {
            showLoading();
            try {
                const response = await fetch('/api/prompts/system');
                const data = await response.json();
                showContent('System Prompt', data);
            } catch (error) {
                showError('Failed to load system prompt: ' + error.message);
            }
        }

        async function loadAssessmentPrompt() {
            showLoading();
            try {
                const response = await fetch('/api/prompts/assessment');
                const data = await response.json();
                showContent('Daily Assessment Prompt', data);
            } catch (error) {
                showError('Failed to load assessment prompt: ' + error.message);
            }
        }

        async function loadToolDefinitions() {
            showLoading();
            try {
                const response = await fetch('/api/prompts/tools');
                const data = await response.json();
                showToolDefinitions(data);
            } catch (error) {
                showError('Failed to load tool definitions: ' + error.message);
            }
        }

        function showContent(title, data) {
            const viewer = document.getElementById('contentViewer');
            const tabs = document.getElementById('tabs');
            const content = document.getElementById('content');

            tabs.innerHTML = '';
            
            // Handle different data formats
            let displayContent;
            if (data.content) {
                displayContent = typeof data.content === 'string' ? data.content : JSON.stringify(data.content, null, 2);
            } else if (data.hidden_context_format) {
                displayContent = data.hidden_context_format;
            } else {
                displayContent = JSON.stringify(data, null, 2);
            }
            
            content.innerHTML = \`
                <h3>\${title}</h3>
                <pre>\${displayContent}</pre>
                <div class="meta">
                    <strong>Source:</strong> \${data.source || 'Unknown'}<br>
                    \${data.lines ? \`<strong>Lines:</strong> \${data.lines}<br>\` : ''}
                    <strong>Timestamp:</strong> \${data.timestamp}
                </div>
            \`;

            viewer.style.display = 'block';
        }

        function showLoading() {
            const viewer = document.getElementById('contentViewer');
            const content = document.getElementById('content');
            
            content.innerHTML = '<div class="loading">Loading...</div>';
            viewer.style.display = 'block';
        }

        function showError(message) {
            const viewer = document.getElementById('contentViewer');
            const content = document.getElementById('content');
            
            content.innerHTML = \`<div class="error">\${message}</div>\`;
            viewer.style.display = 'block';
        }
    </script>
</body>
</html>
    `);
  });

  return router;
}

module.exports = { createDashboardRouter };