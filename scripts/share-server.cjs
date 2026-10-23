const path = require('node:path');
const http = require('node:http');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const project = path.join(root, 'DeTai10_Nhom07_AuditLog_Cassandra', 'audit-log-system');
const requireBackend = createRequire(path.join(project, 'backend', 'package.json'));
const express = requireBackend('express');
const app = express();
const publicDir = path.join(project, 'frontend', 'dist-api');
if (!fs.existsSync(path.join(publicDir, 'index.html'))) throw Error('Build the frontend before sharing.');
app.disable('x-powered-by');
app.get('/__demo/health', (req, res) => res.json({ service: 'AuditFlow shared demo', ready: true }));
// One fixed API origin; request streams/Authorization stay unchanged across the proxy.
app.use('/api', (req, res) => {
  const upstream = http.request({ hostname: '127.0.0.1', port: 5000, path: req.originalUrl,
    method: req.method, headers: { ...req.headers, host: '127.0.0.1:5000' }, timeout: 30000 }, response => {
    res.writeHead(response.statusCode || 502, response.headers);
    response.pipe(res);
  });
  upstream.on('timeout', () => upstream.destroy(new Error('API timeout')));
  upstream.on('error', () => {
    if (!res.headersSent) res.status(503).json({ success: false, message: 'Demo API temporarily unavailable' });
    else res.destroy();
  });
  req.on('aborted', () => upstream.destroy());
  req.pipe(upstream);
});
app.use(express.static(publicDir, { index: false, dotfiles: 'deny' }));
app.get('*', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(publicDir, 'index.html'));
});
const server = app.listen(5180, '127.0.0.1', () => console.log('AuditFlow share server ready on 127.0.0.1:5180'));
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
