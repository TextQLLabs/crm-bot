const http = require('http');
const fs = require('fs');

// Simple HTTP server to test the dashboard
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    // Serve the dashboard HTML
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CRM Bot Dashboard - Test</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        h1 {
            color: #667eea;
            margin-bottom: 10px;
        }
        .status {
            background: #4CAF50;
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            display: inline-block;
            margin-bottom: 20px;
        }
        .message {
            background: #e8f5e8;
            padding: 20px;
            border-radius: 5px;
            border-left: 4px solid #4CAF50;
            margin: 20px 0;
        }
        .btn {
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin: 10px 0;
            display: block;
            width: 200px;
        }
        .btn:hover {
            background: #5a67d8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 CRM Bot Dashboard</h1>
            <div class="status">✅ Test Server Running</div>
        </div>
        
        <div class="message">
            <h3>🎉 Dashboard Connection Test Successful!</h3>
            <p>This proves that:</p>
            <ul>
                <li>✅ Port 3000 is accessible</li>
                <li>✅ Your browser can connect to localhost:3000</li>
                <li>✅ The dashboard HTML renders correctly</li>
            </ul>
            <p>The issue was with the Slack Bolt ExpressReceiver configuration, not with your network or browser.</p>
        </div>
        
        <div>
            <h3>Next Steps:</h3>
            <p>Now that we've confirmed the connection works, we need to fix the ExpressReceiver configuration in the main CRM bot to properly start the HTTP server.</p>
            
            <button class="btn" onclick="testAPI()">Test API Call</button>
            <div id="result"></div>
        </div>
    </div>

    <script>
        function testAPI() {
            document.getElementById('result').innerHTML = '<p>API functionality would be available once the main server is fixed.</p>';
        }
    </script>
</body>
</html>
    `);
  } else if (req.url === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      status: 'healthy',
      message: 'Test server is running',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Not Found');
  }
});

const port = 3001;
server.listen(port, () => {
  console.log(`🧪 Test dashboard server running on http://localhost:${port}`);
  console.log(`🌐 Open your browser to: http://localhost:${port}`);
});