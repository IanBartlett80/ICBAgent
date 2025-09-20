const express = require('express');
const path = require('path');

const app = express();
const PORT = 8080;

// Basic middleware
app.use(express.static(path.join(__dirname, 'public')));

// Simple route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Simple server running on http://0.0.0.0:${PORT}`);
    console.log(`Process ID: ${process.pid}`);
});

process.on('SIGINT', () => {
    console.log('Server shutting down...');
    process.exit(0);
});