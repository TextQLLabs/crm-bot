const express = require('express');
const app = express();
const port = 3000;

// Add basic route
app.get('/', (req, res) => {
  res.send('<h1>Test HTTP Server</h1><p>This server is running in HTTP mode on port 3000</p>');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`🌐 Test HTTP server listening on port ${port}`);
  console.log(`🌐 Open your browser to: http://localhost:${port}`);
});