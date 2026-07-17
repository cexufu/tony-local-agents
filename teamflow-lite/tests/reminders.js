const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const appPort = 17363;
const hookPort = 17362;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamflow-reminders-'));
let received = null;
const webhook = http.createServer((req, res) => { let raw = ''; req.on('data', chunk => raw += chunk); req.on('end', () => { received = JSON.parse(raw); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); }); }).listen(hookPort, '127.0.0.1');
const child = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(appPort), DATA_DIR: dataDir, INITIAL_ADMIN_PASSWORD: 'test-password', REMINDER_WEBHOOK_URL: `http://127.0.0.1:${hookPort}/notify`, REMINDER_TIMEZONE: 'UTC', REMINDER_HOUR: String(new Date().getUTCHours()) }, stdio: ['ignore', 'pipe', 'pipe'] });
let cookie = '';
async function request(url, options = {}) { const response = await fetch(`http://127.0.0.1:${appPort}${url}`, { ...options, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) } }); if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0]; const body = await response.json(); if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body)}`); return body; }
async function ready() { for (let i = 0; i < 30; i += 1) { try { await request('/api/health'); return; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } } throw new Error('server timeout'); }

(async () => {
  try {
    await ready();
    const health = await request('/api/health');
    if (!health.reminder.generic) throw new Error('webhook config missing from health');
    await request('/api/login', { method: 'POST', body: JSON.stringify({ email: 'admin@team.local', password: 'test-password' }) });
    const dueDate = new Date().toISOString().slice(0, 10);
    await request('/api/tasks', { method: 'POST', body: JSON.stringify({ title: 'Reminder delivery test', status: 'todo', priority: 'P1', assigneeId: 'usr_owner', dueDate }) });
    const sent = await request('/api/reminders/run', { method: 'POST', body: '{}' });
    if (!sent.sent || !received || received.event !== 'teamflow.reminder') throw new Error('active delivery failed');
    const duplicate = await request('/api/reminders/run', { method: 'POST', body: '{}' });
    if (duplicate.skipped !== 'nothing_new') throw new Error('daily deduplication failed');
    const tracking = await request('/api/reminders/tracking');
    if (!tracking.deliveries.some(item => item.status === 'sent') || !tracking.pending.length) throw new Error('tracking data missing');
    if (!fs.existsSync(path.join(dataDir, 'teamflow.json.bak'))) throw new Error('backup file missing');
    console.log('Reminder test passed: scheduled engine, webhook delivery, daily deduplication, tracking, backup');
  } finally { child.kill(); webhook.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
